import { Worker } from "bullmq";
import pool from "../config/db.js";

const message_Db = async (data) => {
    console.log("koi toh hai : " + JSON.stringify(data));
    if(!message.trim()){
        return ;
    }
    const { sender_id, message, conversation_id: convId } = data;

    console.log(sender_id, message, convId);

    if (!sender_id || !message || !convId) {
        console.error("Missing required fields!");
        return;
    }

    await pool.query(
        "INSERT INTO messages (sender_id, message, seen, status, deleted, conversation_id) VALUES ($1, $2, $3, $4, $5, $6)",
        [sender_id, (message.trim()), false, 'delivered', false, convId]
    );

    console.log("kar diya ab toh\n");
}

const worker = new Worker("message", async (job) => {
    const messageData = job.data.data ? job.data.data : job.data;

    console.log(messageData);
    console.log("Queue added");
    console.log(job.id);
    console.log(messageData);

    await message_Db(messageData);

    console.log("Queue completed : ", job.id);
},
{
    connection: {
        host: "127.0.0.1",
        port: 6379,
        password: "yourpassword"
    }
});

export default worker;