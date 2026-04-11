
import { tryCatch } from "bullmq";
import pool from "../config/db.js";
import { message_saving } from "../data/queue.js";
import {
  getAllMessage,
  createMessage,
  readByIdMessage,
  updateMessage,
  deleteMessage
} from "../models/userModel.js";
import { publish } from "../utils/redisClient.js";
import { uploadImage } from "../lib/cloudinary.js";

// Create conversation if needed, then send message
export const sendmessage = async (req, res) => {
  try {
    console.log("Incoming message request:", req.body);
    const { id, conversation_id, message, receiver_id, file, file_type, file_name } = req.body;
    const currentUserId = req.user.id;

    // Validate input
    if ((!message || !message.trim()) && !file) {
      return res.status(400).json({ error: "Message or file is required" });
    }

    if (!receiver_id) {
      return res.status(400).json({ error: "receiver_id is required" });
    }

    // Find or create conversation
    let convId = conversation_id;
    if (!convId) {
      const exist = await pool.query(
        `SELECT DISTINCT cp1.conversation_id 
         FROM conversation_participants cp1
         JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
         WHERE cp1.user_id = $1 AND cp2.user_id = $2
         LIMIT 1`,
        [currentUserId, receiver_id]
      );

      if (exist.rows.length > 0) {
        convId = exist.rows[0].conversation_id;
      } else {
        const newConv = await pool.query(
          "INSERT INTO conversations (type) VALUES ($1) RETURNING id",
          ['private']
        );
        convId = newConv.rows[0].id;
        await pool.query(
          "INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1,$2),($1,$3)",
          [convId, currentUserId, receiver_id]
        );
      }
    }

    let fileUrl = null;
    
    // Upload file to Cloudinary if base64 exists
    if (file) {
      try {
        fileUrl = await uploadImage(file); // file is base64 string
        console.log("File uploaded to Cloudinary:", fileUrl);
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError);
        return res.status(500).json({ error: "File upload failed" });
      }
    }

    const messageData = {
      id: id,
      conversation_id: convId,
      message: message?.trim() || '',
      receiver_id,
      sender_id: currentUserId,
      created_at:message?.created_at || new Date(),
      file_url: fileUrl,
      file_type: file_type || null,
      file_name: file_name || null,
    };

    // Publish to queue/socket
    await publish(messageData);
    console.log("Message published to queue");
    
    // Save to database
    await message_saving(messageData);
    console.log("Message saved to database");

    return res.status(200).json({ 
      message: "Message sent successfully", 
      conversation_id: convId,
      file_url: fileUrl,
      temp_id: id,
    });

  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error.message 
    });
  }
};

// Find or create conversation, then fetch messages
export const getmessage = async (req, res) => {
  try {
    const { conversation_id, user_id } = req.body;
    const currentUserId = req.user.id;
    const limit = 10;

    let convId = conversation_id;

    if (!convId && user_id) {
      const existingConv = await pool.query(
        `SELECT DISTINCT cp1.conversation_id 
         FROM conversation_participants cp1
         JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
         WHERE cp1.user_id = $1 AND cp2.user_id = $2
         LIMIT 1`,
        [currentUserId, user_id]
      );

      if (existingConv.rows.length > 0) {
        convId = existingConv.rows[0].conversation_id;
      } else {
        const newConv = await pool.query(
          "INSERT INTO conversations (type) VALUES ($1) RETURNING id",
          ['private']
        );
        convId = newConv.rows[0].id;

        await pool.query(
          "INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1,$2),($1,$3)",
          [convId, currentUserId, user_id]
        );
      }
    }

    if (!convId) {
      return res.status(200).json({ message: "No conversation", data: [], hasMore: false });
    }

    const result = await pool.query(
      "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2",
      [convId, limit]
    );

    const chronologicalMessages = result.rows.reverse();

    return res.status(200).json({
      message: "Messages fetched",
      data: chronologicalMessages,
      conversation_id: convId,
      hasMore: result.rows.length === limit,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: error.message });
  }
};











export const getUsers = async (req, res) => {
  try {
    res.status(200).json({ message: "OK" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email } = req.body;
    const newUser = await createMessage(name, email);
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await readByIdMessage(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { name, email } = req.body;
    const updatedUser = await updateMessage(name, email, req.params.id);

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const deletedUser = await deleteMessage(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(deletedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const oldMessages = async (req, res) => {
  try {
    const { conversation_id, cursor } = req.body;
    const limit = 50;
    console.log(cursor);
    if (!conversation_id || !cursor) {
      return res.status(400).json({ message: "Missing conversation_id or cursor" });
    }

    // Fetch 50 messages that were sent BEFORE the cursor timestamp
    const result = await pool.query(
      `SELECT * FROM messages 
       WHERE conversation_id = $1 AND created_at < $2::timestamptz
       ORDER BY created_at DESC 
       LIMIT $3`,
      [conversation_id, cursor, limit]
    );

    // Reverse them so they display chronologically (top-to-bottom) in the UI
    const chronologicalMessages = result.rows.reverse();
    console.log(result.rows.length);
    return res.status(200).json({
      message: "Successfully Loaded messages",
      data: chronologicalMessages,
      hasMore: result.rows.length > 0, // If we got 50, there are probably more
    });
  } catch (error) {
    console.error("Error in oldMessages:", error.message);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};





// export {
//     sendmessage,
//     getmessage
// }