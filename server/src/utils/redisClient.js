import { createClient } from "redis";

let pubClient;
let subClient;

export const createRedis = async () => {
  pubClient = createClient({
    url: process.env.REDIS_URI,

    socket: {
      keepAlive: 5000, // 🔥 prevents idle disconnect
    reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
    },
  });

  subClient = pubClient.duplicate();

  pubClient.on("connect", () => console.log("Redis pub connecting..."));
  subClient.on("connect", () => console.log("Redis sub connecting..."));

  pubClient.on("ready", () => console.log("Redis pub ready ✅"));
  subClient.on("ready", () => console.log("Redis sub ready ✅"));

  pubClient.on("reconnecting", () => console.log("Redis pub reconnecting..."));
  subClient.on("reconnecting", () => console.log("Redis sub reconnecting..."));

  pubClient.on("end", () => console.log("Redis pub connection closed"));
  subClient.on("end", () => console.log("Redis sub connection closed"));

  pubClient.on("error", (err) => console.log("Redis Pub Error", err));
  subClient.on("error", (err) => console.log("Redis Sub Error", err));

  await pubClient.connect();
  await subClient.connect();

  console.log("Redis connected ✅");

  return { pubClient, subClient };
};

export const getRedisClient = () => {
  if (!pubClient) throw new Error("Redis client not initialized!");
  return pubClient;
};

export const publish = async (data) => {
  if (!pubClient) throw new Error("Redis not initialized");
  await pubClient.publish("channel", JSON.stringify(data));
};

export const subscribe = async (callback) => {
  if (!subClient) throw new Error("Redis not initialized");
  await subClient.subscribe("channel", (message) => {
    callback(JSON.parse(message));
  });
};