import { Queue } from "bullmq";

const connection = {
  host: "127.0.0.1",
  port: 6379,
  password: "Jitendra123",
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