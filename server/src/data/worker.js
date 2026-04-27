import { Worker } from "bullmq";
import pool from "../config/db.js";
import { publish } from "../utils/redisClient.js";
import { addRecentMessage } from "../utils/cache.js";

const connection = {
  username: process.env.REDIS_USERNAME,
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
};

const message_Db = async (data) => {
  const { 
    sender_id, 
    message, 
    conversation_id, 
    id, 
    file_url, 
    file_type, 
    file_name,
    created_at
  } = data;

  if ((!message || !message.trim()) && !file_url) {
    console.error("Empty message and no file, skipping");
    return;
  }

  if (!sender_id || !conversation_id || !id) {
    console.error("Missing required fields:", data);
    return;
  }

  const result = await pool.query(
    `INSERT INTO messages 
     (id, sender_id, message, seen, status, deleted, conversation_id, file_url, file_type, file_name, created_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING`,
    [
      id,
      sender_id,
      message?.trim() || null,
      false,
      "delivered",
      false,
      conversation_id,
      file_url || null,
      file_type || null,
      file_name || null,
      created_at,
    ]
  );

  if (result.rowCount === 0) {
    console.warn("Worker skipped duplicate message", id);
    return;
  }

  await addRecentMessage(conversation_id, data);
  await publish(data);
};

const worker = new Worker(
  "message",
  async (job) => {
    await message_Db(job.data);
  },
  {concurrency: 20 ,
    connection }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

export default worker;