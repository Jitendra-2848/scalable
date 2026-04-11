import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createRedis, subscribe, getRedisClient, publish } from "./redisClient.js";
import jwt from "jsonwebtoken";
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

const userSocketMap = new Map();

let redis;

const addUserSocket = (userId, socketId) => {
  if (!userSocketMap.has(userId)) {
    userSocketMap.set(userId, new Set());
  }
  userSocketMap.get(userId).add(socketId);
};

const removeUserSocket = (userId, socketId) => {
  const sockets = userSocketMap.get(userId);
  if (!sockets) return true;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    userSocketMap.delete(userId);
    return true;
  }
  return false;
};

const broadcastOnlineUsers = async () => {
  const onlineUsers = await redis.sMembers("online_users");
  io.emit("onlineUsers", onlineUsers.map(Number));
};

const initSocket = async () => {
  await createRedis();
  redis = await getRedisClient();

  if (!redis) {
    throw new Error("Redis client failed to initialize!");
  }

  console.log("✅ Redis connected");

  await redis.del("online_users");

  await subscribe((data) => {
    const receiverId = Number(data.receiver_id);
    console.log(receiverId);
    const socketIds = userSocketMap.get(receiverId);
    if (socketIds) {
      socketIds.forEach((sid) => {
        io.to(sid).emit("onMessage", data);
      });
    }
  });

  console.log("✅ Redis subscribed");

  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie; // string of cookies
    const cookies = cookieHeader?.split(";").map(c => c.trim());
    try {
      const jwtCookie = cookies.find(c => c.startsWith("jwt=")).split("=")[1];
      const decoded = jwt.verify(jwtCookie, process.env.JWT_SECRET);
      console.log(decoded.userId);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error("Invalid JWT"));
    }
  })
  io.on("connection", (socket) => {
    socket.on("join", async (rawUserId) => {
      const userId = Number(rawUserId);
      if (isNaN(userId)) return;

      socket.userId = userId;
      addUserSocket(userId, socket.id);

      await redis.sAdd("online_users", String(userId));
      console.log(`User ${userId} joined`);

      await broadcastOnlineUsers();
    });
    socket.on("get_online_users", async () => {
      const onlineUsers = await redis.sMembers("online_users");
      socket.emit("onlineUsers", onlineUsers.map(Number));
    });

socket.on("message", async (message) => {
  console.log(message);
  if (socket.userId == null) return;
  // Emit with file metadata if present
  socket.emit("message_sent", {
    temp_id: message.id,
    receiver_id: message.receiver_id,
    conversation_id: message.conversation_id,
    created_at: message.created_at,
    file_url: message.file_url || null,
    file_type: message.file_type || null,
    file_name: message.file_name || null,
  });
});

    socket.on("message_delivered", ({ message_id, sender_id }) => {
      const senderSockets = userSocketMap.get(Number(sender_id));
      if (senderSockets) {
        senderSockets.forEach((sid) => {
          io.to(sid).emit("message_delivered", {
            message_id,
            receiver_id: socket.userId,
          });
        });
      }
    });

    socket.on("message_read", ({ message_id, sender_id }) => {
      const senderSockets = userSocketMap.get(Number(sender_id));
      if (senderSockets) {
        senderSockets.forEach((sid) => {
          io.to(sid).emit("message_read", {
            message_id,
            receiver_id: socket.userId,
          });
        });
      }
    });

    socket.on("typing", (receiverId) => {
      const receiverSockets = userSocketMap.get(Number(receiverId));
      if (receiverSockets) {
        receiverSockets.forEach((sid) => {
          io.to(sid).emit("Typing", socket.userId);
        });
      }
    });

    socket.on("disconnect", async () => {
      if (socket.userId == null) return;

      const userId = socket.userId;
      const fullyOffline = removeUserSocket(userId, socket.id);

      if (fullyOffline) {
        await redis.sRem("online_users", String(userId));
        console.log(`User ${userId} offline`);
      }

      await broadcastOnlineUsers();
    });
  });

  console.log("✅ Socket handlers ready");
};

initSocket().catch((err) => {
  console.error("❌ Failed to initialize:", err);
  process.exit(1);
});

export { server, app, express };