import { io, Socket } from "socket.io-client";

const URL = import.meta.env.VITE_API_URL;

export const socket: Socket = io(URL, {
  autoConnect: true,
  transports: ["websocket"],
});