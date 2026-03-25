import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { Message } from "../types";
import { api } from "../utils/axios";

interface SocketContextInterface {
  socket: Socket | null;
  sendMsg: (msg: Message) => Promise<void>;
  joining: (id: number) => void;
}

export const SocketContext = createContext<SocketContextInterface | null>(null);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io("http://localhost:8000",{
      withCredentials:true,
      transports: ["websocket", "polling"]
    });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, []);
  
 const joining = useCallback(
  (id: number) => {
    if (!socket) {
      console.log("Socket not ready yet");
      return;
    }
    if (socket.connected) {
      socket.emit("join", id);          
      socket.emit("get_online_users");  
    } else {
      socket.once("connect", () => {
        socket.emit("join", id);
        socket.emit("get_online_users");
      });
    }
  },
  [socket]
);

  const sendMsg = useCallback(
    async (msg: Message) => {
      try {
        socket?.emit("message", msg);
        await api.post(`/message/${msg.id}`, msg);
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    },
    [socket]
  );

  const value = useMemo(
    () => ({ socket, sendMsg, joining }),
    [socket, sendMsg, joining]
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};