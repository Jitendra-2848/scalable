
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
import { getConversationCache, setConversationCache, addRecentMessage, getRecentMessages } from "../utils/cache.js";
import { uploadImage } from "../lib/cloudinary.js";
import { v4 as uuidv4 } from 'uuid';
const getOrCreateConversation = async (userId, otherUserId) => {
  const cachedConvId = await getConversationCache(userId, otherUserId);
  if (cachedConvId) {
    return cachedConvId;
  }

  const exist = await pool.query(
    `SELECT DISTINCT cp1.conversation_id 
     FROM conversation_participants cp1
     JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
     WHERE cp1.user_id = $1 AND cp2.user_id = $2
     LIMIT 1`,
    [userId, otherUserId]
  );

  let convId;
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
      [convId, userId, otherUserId]
    );
  }

  await setConversationCache(userId, otherUserId, convId);
  return convId;
};

const insertMessageToDb = async (data) => {
  const result = await pool.query(
    `INSERT INTO messages 
      (id, sender_id, message, seen, status, deleted, conversation_id, file_url, file_type, file_name, created_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [
      data.id,
      data.sender_id,
      data.message || null,
      false,
      'delivered',
      false,
      data.conversation_id,
      data.file_url || null,
      data.file_type || null,
      data.file_name || null,
      data.created_at,
    ]
  );
  return result.rows[0];
};

export const sendmessage = async (req, res) => {
  try {
    console.log("Incoming message request:", { ...req.body, params: req.params });
    const { id, conversation_id, message, receiver_id, file, file_type, file_name } = req.body;
    const routeReceiverId = Number(req.params.id);
    const currentUserId = req.user?.id;
    const actualReceiverId = Number(receiver_id || routeReceiverId);

    if (!currentUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if ((!message || !message.trim()) && !file) {
      return res.status(400).json({ error: "Message or file is required" });
    }

    if (!actualReceiverId) {
      return res.status(400).json({ error: "receiver_id is required" });
    }

    const convId = conversation_id || await getOrCreateConversation(currentUserId, actualReceiverId);

    let fileUrl = null;
    if (file) {
      try {
        fileUrl = await uploadImage(file);
        console.log("File uploaded to Cloudinary:", fileUrl);
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError);
        return res.status(500).json({ error: "File upload failed" });
      }
    }

    const messageData = {
      id: uuidv4(),
      conversation_id: convId,
      message: message?.trim() || '',
      receiver_id: actualReceiverId,
      sender_id: currentUserId,
      created_at: new Date(),
      file_url: fileUrl,
      file_type: file_type || null,
      file_name: file_name || null,
    };

    const savedMessage = await insertMessageToDb(messageData);
    if (!savedMessage) {
      console.warn("Duplicate message detected, continuing with idempotent path", messageData.id);
    }

    await addRecentMessage(convId, messageData);
    await publish(messageData);

    if (!savedMessage) {
      return res.status(200).json({
        message: "Message already persisted or idempotent retry acknowledged",
        conversation_id: convId,
        temp_id: id,
      });
    }

    return res.status(200).json({
      message: "Message sent successfully",
      conversation_id: convId,
      file_url: fileUrl,
      temp_id: id,
    });
  } catch (error) {
    console.error("Error sending message, fallback to queue:", error);
    const { id, conversation_id, message, receiver_id, file, file_type, file_name } = req.body;
    const routeReceiverId = Number(req.params.id);
    const currentUserId = req.user?.id;
    const actualReceiverId = Number(receiver_id || routeReceiverId);
    const convId = conversation_id || null;

    const fallbackMessage = {
      id: uuidv4(),
      conversation_id: convId,
      message: message?.trim() || '',
      receiver_id: actualReceiverId,
      sender_id: currentUserId,
      created_at: new Date(),
      file_url: file || null,
      file_type: file_type || null,
      file_name: file_name || null,
    };

    await message_saving(fallbackMessage);
    return res.status(200).json({
      message: "Message accepted and queued. Delivery will resume when DB recovers.",
      queued: true,
      conversation_id: convId,
      temp_id: id,
    });
  }
};

// Find or create conversation, then fetch messages
export const getmessage = async (req, res) => {
  try {
    const { conversation_id, user_id } = req.body;
    const currentUserId = req.user.id;
    const limit = Number(process.env.MESSAGE_LIMIT || 10);

    if (!currentUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let convId = conversation_id;
    if (!convId && user_id) {
      convId = await getOrCreateConversation(currentUserId, Number(user_id));
    }

    if (!convId) {
      return res.status(200).json({ message: "No conversation", data: [], hasMore: false });
    }

    const cachedMessages = await getRecentMessages(convId, limit);
    if (cachedMessages.length > 0) {
      return res.status(200).json({
        message: "Messages fetched",
        data: cachedMessages.slice(-limit),
        conversation_id: convId,
        hasMore: cachedMessages.length === limit,
      });
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