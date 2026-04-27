import { getRedisClient } from "./redisClient.js";

const conversationKey = (userA, userB) => {
  const [left, right] = [String(userA), String(userB)].sort();
  return `conv:${left}:${right}`;
};

const recentMessagesKey = (conversationId) => `chat:${conversationId}`;
const userSocketsKey = (userId) => `user:${userId}`;

export const getConversationCache = async (userA, userB) => {
  const redis = getRedisClient();
  if (!redis) return null;
  return await redis.get(conversationKey(userA, userB));
};

export const setConversationCache = async (userA, userB, conversationId) => {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.set(conversationKey(userA, userB), String(conversationId), {
    EX: 60 * 60 * 24,
  });
};

export const addRecentMessage = async (conversationId, message) => {
  const redis = getRedisClient();
  if (!redis) return;
  const payload = JSON.stringify(message);

  await redis
    .multi()
    .lPush(recentMessagesKey(conversationId), payload)
    .lTrim(recentMessagesKey(conversationId), 0, 49)
    .expire(recentMessagesKey(conversationId), 60 * 60 * 24)
    .exec();
};

export const getRecentMessages = async (conversationId, limit = 50) => {
  const redis = getRedisClient();
  if (!redis) return [];
  const rows = await redis.lRange(recentMessagesKey(conversationId), 0, limit - 1);
  return rows.length ? rows.map((item) => JSON.parse(item)).reverse() : [];
};

export const addSocketToUser = async (userId, socketId) => {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.sAdd(userSocketsKey(userId), socketId);
};

export const removeSocketFromUser = async (userId, socketId) => {
  const redis = getRedisClient();
  if (!redis) return false;
  await redis.sRem(userSocketsKey(userId), socketId);
  const remaining = await redis.sCard(userSocketsKey(userId));
  return remaining === 0;
};

export const getUserSocketIds = async (userId) => {
  const redis = getRedisClient();
  if (!redis) return [];
  return await redis.sMembers(userSocketsKey(userId));
};
