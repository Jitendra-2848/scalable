import React, {
  createContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { ChatContextType, User, Message, normalizeUser } from "../types/index";
import { api } from "../utils/axios";
import { useUser } from "../hooks/useUser";
import { useSocket } from "../hooks/useSocket";
import { hasRefreshToken } from "../hooks/TokenManagement";
import { v4 as uuidv4 } from 'uuid';

export const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<number, Message[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<number, boolean>>({});
  const { userdetail } = useUser();
  const { sendMsg, socket } = useSocket();
  const [onlineUser, setOnlineUsers] = useState([]);
  const usersRef = useRef<User[]>([]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const getAllUser = useCallback(async () => {
    try {
      if(hasRefreshToken()){
      const result = await api.get("/user/");
      const normalizedUsers = (result.data.data || []).map((u: any) =>
        normalizeUser(u)
      );
      setUsers(normalizedUsers);
    }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }, []);

  const addUserIfNotExists = useCallback((user: User) => {
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      return exists ? prev : [...prev, user];
    });
  }, []);

  const selectUser = useCallback(
    async (rawUser: any) => {
      try {
        if(rawUser == null){
          setSelectedUser(null);
          return ;
        }
        const user = normalizeUser(rawUser);
        if (messagesMap[user.id]) {
          setSelectedUser(user);
          addUserIfNotExists(user);
          return;
        }
        const result = await api.post("/message/getmsg", {
          conversation_id: user.conversation_id ?? null,
          user_id: user.id,
        });
        setMessagesMap((prev) => ({
          ...prev,
          [user.id]: result.data.data || [],
        }));
        const userWithConv: User = {
          ...user,
          conversation_id: result.data.conversation_id || user.conversation_id,
        };
        setSelectedUser(userWithConv);
        addUserIfNotExists(userWithConv);
      } catch (err) {
        console.error("Error selecting user:", err);
      }
    },
    [messagesMap, addUserIfNotExists]
  );

  const messages = useMemo(() => {
    if (!selectedUser) return [];
    return messagesMap[selectedUser.id] || [];
  }, [selectedUser, messagesMap]);

  const sendMessage = useCallback(
    (msg: string) => {
      if (!selectedUser || !msg.trim() || !userdetail) return;

      const tempId = uuidv4();
      const newMsg: Message = {
        id: tempId,
        message: msg,
        created_at: new Date(),
        read: false,
        sender_id: userdetail.id,
        receiver_id: selectedUser.id,
        sendedbyme: true,
        status: "pending",
        last_message: msg,
        last_message_time: new Date(),
        conversation_id: selectedUser.conversation_id,
      };

      setMessagesMap((prev) => ({
        ...prev,
        [selectedUser.id]: [...(prev[selectedUser.id] || []), newMsg],
      }));

      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? {
                ...u,
                last_message: msg,
                last_message_time: new Date().toISOString(),
              }
            : u
        )
      );

      sendMsg(newMsg);
    },
    [selectedUser, sendMsg, userdetail]
  );

const addMessageFromSocket = useCallback((msg: Message) => {
  if (!usersRef.current.some((u) => u.id === msg.sender_id)) {
    setUsers((prev) => [
      ...prev,
      {
        id: msg.sender_id,
        name: "Unknown", // optional fallback
        conversation_id: msg.conversation_id,
        last_message: msg.last_message,
        last_message_time: msg.last_message_time,
      } as User,
    ]);
  }

  setMessagesMap((prev) => {
    const existing = prev[msg.sender_id] || [];

    return {
      ...prev,
      [msg.sender_id]: [...existing, msg],
    };
  });

  setUsers((prev) =>
    prev.map((u) =>
      u.id === msg.sender_id
        ? {
            ...u,
            last_message: msg.last_message,
            last_message_time: String(msg.last_message_time),
          }
        : u
    )
  );
}, []);







  const markAsRead = useCallback(
    (messageId: string, senderId: number) => {
      socket?.emit("message_read", {
        message_id: messageId,
        sender_id: senderId,
      });
    },
    [socket]
  );

  const handleTyping = useCallback(() => {
    socket?.emit("typing", selectedUser?.id);
  }, [socket, selectedUser]);

 useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg: Message) => {
      addMessageFromSocket(msg);
      socket.emit("message_delivered", {
        message_id: msg.id,
        sender_id: msg.sender_id,
      });
    };

    const handleSocketTyping = (userId: number) => {
      setTypingUsers((prev) => ({ ...prev, [userId]: true }));
      setTimeout(() => {
        setTypingUsers((prev) => ({ ...prev, [userId]: false }));
      }, 2000);
    };

    const handleOnlineUser = (x: any) => {
      setOnlineUsers(x);
    };

    const handleMessageSent = (data: {
      temp_id: string;
      receiver_id: number;
      conversation_id: number;
    }) => {
      setMessagesMap((prev) => {
        const userMessages = prev[data.receiver_id];
        if (!userMessages) return prev;
        return {
          ...prev,
          [data.receiver_id]: userMessages.map((m) =>
            m.id === data.temp_id
              ? {
                  ...m,
                  status: "sent" as const,
                  conversation_id: data.conversation_id || m.conversation_id,
                }
              : m
          ),
        };
      });
    };

    const handleMessageDelivered = (data: {
      message_id: string;
      receiver_id: number;
    }) => {
      setMessagesMap((prev) => {
        const userMessages = prev[data.receiver_id];
        if (!userMessages) return prev;
        return {
          ...prev,
          [data.receiver_id]: userMessages.map((m) =>
            m.id === data.message_id
              ? { ...m, status: "delivered" as const }
              : m
          ),
        };
      });
    };

    const handleMessageRead = (data: {
      message_id: string;
      receiver_id: number;
    }) => {
      setMessagesMap((prev) => {
        const userMessages = prev[data.receiver_id];
        if (!userMessages) return prev;
        return {
          ...prev,
          [data.receiver_id]: userMessages.map((m) =>
            m.id === data.message_id
              ? { ...m, status: "delivered" as const }
              : m
          ),
        };
      });
    };

    socket.on("onlineUsers", handleOnlineUser);
    socket.on("onMessage", handleMessage);
    socket.on("Typing", handleSocketTyping);
    socket.on("message_sent", handleMessageSent);
    socket.on("message_delivered", handleMessageDelivered);
    socket.on("message_read", handleMessageRead);

    // Listeners are now attached, safe to request
    socket.emit("get_online_users");

    return () => {
      socket.off("onlineUsers", handleOnlineUser);
      socket.off("onMessage", handleMessage);
      socket.off("Typing", handleSocketTyping);
      socket.off("message_sent", handleMessageSent);
      socket.off("message_delivered", handleMessageDelivered);
      socket.off("message_read", handleMessageRead);
    };
  }, [socket, addMessageFromSocket]);
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    return users.filter((u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  useEffect(() => {
    getAllUser();
  }, [getAllUser]);

  const value = useMemo(
    () => ({
      selectedUser,
      selectUser,
      messages,
      sendMessage,
      users,
      searchQuery,
      setSearchQuery,
      filteredUsers,
      getAllUser,
      addMessageFromSocket,
      handleTyping,
      typingUsers,
      onlineUser,
      markAsRead,
    }),
    [
      selectedUser,
      selectUser,
      messages,
      sendMessage,
      users,
      searchQuery,
      filteredUsers,
      getAllUser,
      addMessageFromSocket,
      handleTyping,
      typingUsers,
      onlineUser,
      markAsRead,
    ]
  );

  return (
    <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
  );
};