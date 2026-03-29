
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

// Create conversation if needed, then send message
export const sendmessage = async (req, res) => {
  try {
    console.log("Incoming message request:", req.body);
    const { conversation_id, message, receiver_id } = req.body;
    const currentUserId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }

    if (!receiver_id) {
      return res.status(400).json({ error: "receiver_id is required" });
    }

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
        console.log("Created new conversation:", convId);
      }
    }
    await publish(req.body);
    message_saving(req.body);
    return res.status(200).json({ 
      message: "Message sent", 
      conversation_id: convId 
    });

  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Find or create conversation, then fetch messages
export const getmessage = async (req, res) => {
  try {
    const { conversation_id, user_id } = req.body;
    const currentUserId = req.user.id;

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
      return res.status(200).json({ message: "No conversation", data: [] });
    }

    const result = await pool.query(
      "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at desc limit 50",
      [convId]
    );

    return res.status(200).json({
      message: "Messages fetched",
      data: result.rows,
      conversation_id: convId
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







// export {
//     sendmessage,
//     getmessage
// }