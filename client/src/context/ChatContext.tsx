import React, {
  createContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import { ChatContextType, User, Message, normalizeUser } from "../types/index";
import { api } from "../utils/axios";
import { useUser } from "../hooks/useUser";
import { useSocket } from "../hooks/useSocket";

export const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<number, Message[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const { userdetail } = useUser();
  const { sendMsg, socket } = useSocket();

  // Fetch all users 
  const getAllUser = useCallback(async () => {
    try {
      const result = await api.get("/user/");
      const normalizedUsers = (result.data.data || []).map((u: any) =>
        normalizeUser(u)
      );
      setUsers(normalizedUsers);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }, []);

  //  Add user if not in list 
  const addUserIfNotExists = useCallback((user: User) => {
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      return exists ? prev : [...prev, user];
    });
  }, []);

  // Select a user and load messages 
  const selectUser = useCallback(
    async (rawUser: any) => {
      try {
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
          conversation_id:
            result.data.conversation_id || user.conversation_id,
        };

        setSelectedUser(userWithConv);
        addUserIfNotExists(userWithConv);
      } catch (err) {
        console.error("Error selecting user:", err);
      }
    },
    [messagesMap, addUserIfNotExists]
  );

  //  Derived messages for selected user 
  const messages = useMemo(() => {
    if (!selectedUser) return [];
    return messagesMap[selectedUser.id] || [];
  }, [selectedUser, messagesMap]);

  // Send a message 
  const sendMessage = useCallback(
    (msg: string) => {
      if (!selectedUser || !msg.trim() || !userdetail) return;

      const newMsg: Message = {
        id: selectedUser.id,
        message: msg,
        created_at: new Date(),
        read: false,
        sender_id: userdetail.id,
        sendedbyme: true,
        exist: true,
        conversation_id: selectedUser.conversation_id,
      };

      setMessagesMap((prev) => ({
        ...prev,
        [selectedUser.id]: [...(prev[selectedUser.id] || []), newMsg],
      }));

      sendMsg(newMsg);
    },
    [selectedUser, sendMsg, userdetail] 
  );

  const addMessageFromSocket = useCallback((msg: Message) => {
    setMessagesMap((prev) => ({
      ...prev,
      [msg.sender_id]: [...(prev[msg.sender_id] || []), msg],
    }));
  }, []); 

  const handleTyping = useCallback(()=>{
    console.log(selectedUser?.id);
    socket?.emit("typing",selectedUser?.id)
  },[socket,selectedUser]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg: Message) => {
      console.log("Received message from socket:", msg);
      addMessageFromSocket(msg);
    };
    socket.on("onMessage", handleMessage);
    socket.on("Typing",handleSocketTyping)
    return () => {
      socket.off("onMessage", handleMessage);
    };
  }, [socket, addMessageFromSocket]);

  // ─── Filtered users for search ───
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
      handleTyping
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
    ]
  );

  return (
    <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
  );
};