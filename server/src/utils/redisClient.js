import { createClient } from "redis";

const REDIS_CHANNEL = process.env.REDIS_CHANNEL || "chat_events";

let client;
let pubClient;
let subClient;

const attachRedisLogging = (conn, label) => {
  conn.on("connect", () => console.log(`Redis ${label} connecting...`));
  conn.on("ready", () => console.log(`Redis ${label} ready ✅`));
  conn.on("reconnecting", () => console.log(`Redis ${label} reconnecting...`));
  conn.on("end", () => console.log(`Redis ${label} connection closed`));
  conn.on("error", (err) => console.log(`Redis ${label} Error`, err));
};

export const createRedis = async () => {
  client = createClient({
    url: process.env.REDIS_URI,
    socket: {
      keepAlive: 5000,
      reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
    },
  });

  pubClient = client.duplicate();
  subClient = client.duplicate();

  attachRedisLogging(client, "client");
  attachRedisLogging(pubClient, "pub");
  attachRedisLogging(subClient, "sub");

  await client.connect();
  await pubClient.connect();
  await subClient.connect();

  console.log("Redis connected ✅");

  return { client, pubClient, subClient };
};

export const getRedisClient = () => {
  if (!client) throw new Error("Redis client not initialized!");
  return client;
};

export const publish = async (data) => {
  if (!pubClient) throw new Error("Redis pub client not initialized");
  await pubClient.publish(REDIS_CHANNEL, JSON.stringify(data));
};

export const subscribe = async (callback) => {
  if (!subClient) throw new Error("Redis sub client not initialized");
  await subClient.subscribe(REDIS_CHANNEL, (message) => {
    callback(JSON.parse(message));
  });
};