import { Queue } from "bullmq";

const connection = {
  username: process.env.REDIS_USERNAME,
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
};

const message_Queue = new Queue("message", { connection });

export async function message_saving(data) {
  const res = await message_Queue.add("saving_in_Db", data, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  });
  console.log("Job added:", res.id);
}