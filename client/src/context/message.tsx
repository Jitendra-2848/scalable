import React, {
  createContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Message, MessageContextType } from "../types/index";
import { api } from "../utils/axios";
import { useUser } from "../hooks/useUser";
import { useSocket } from "../hooks/useSocket";
import { useChat } from "../hooks/useChat";
import { v4 as uuidv4 } from "uuid";

export const MessageContext = createContext<MessageContextType | null>(null); // ✅ Typed

export const MessageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [messagesMap, setMessagesMap] = useState<Record<number, Message[]>>({});
  const [hasMoreChats, setHasMoreChats] = useState<Record<number, boolean>>({});

  const { userdetail } = useUser();
  const { socket, sendMsg } = useSocket();
  const { selectedUser, updateSidebarWithNewMessage, updateSelectedUserConvId } =
    useChat();

  const fetchedChats = useRef<Set<number>>(new Set());

  const messagesMapRef = useRef(messagesMap);
  useEffect(() => {
    messagesMapRef.current = messagesMap;
  }, [messagesMap]);
  useEffect(() => {
    if (!selectedUser || fetchedChats.current.has(selectedUser.id)) return;

    const fetchInitialMessages = async () => {
      try {
        const result = await api.post("/message/getmsg", {
          conversation_id: selectedUser.conversation_id ?? null,
          user_id: selectedUser.id,
        });

        const dbMessages: Message[] = result.data.data || [];

        setHasMoreChats((prev) => ({
          ...prev,
          [selectedUser.id]: result.data.hasMore,
        }));

        setMessagesMap((prev) => {
          const liveMessages = prev[selectedUser.id] || [];

          const msgMap = new Map<string, Message>();
          dbMessages.forEach((m) => msgMap.set(String(m.id), m));
          liveMessages.forEach((m) => msgMap.set(String(m.id), m));

          const merged = Array.from(msgMap.values()).sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
          );

          return { ...prev, [selectedUser.id]: merged };
        });

        if (result.data.conversation_id) {
          updateSelectedUserConvId(result.data.conversation_id);
        }

        fetchedChats.current.add(selectedUser.id);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };
    fetchInitialMessages();
  }, [selectedUser?.id]);


const fetchOlderMessages = useCallback(async () => {
  if (!selectedUser) return;

  const currentMessages = messagesMapRef.current[selectedUser.id] || [];
  
  let cursor = null;
  console.log("messages:", messages.length);
console.log("hasMore:", hasMore);
console.log("hasMoreChats:", hasMoreChats);
console.log("fetched:", fetchedChats.current.has(selectedUser?.id));
  if (currentMessages.length > 0) {
    const oldestMessage = currentMessages[0]; // ensure sorted correctly
    if (!oldestMessage?.created_at) return;
    cursor = oldestMessage.created_at;
  }

  try {
    const result = await api.post("/message/oldMessages", {
      conversation_id: selectedUser.conversation_id,
      user_id: selectedUser.id,
      cursor,
    });

    const olderMessages: Message[] = result.data.data || [];

    setHasMoreChats((prev) => ({
      ...prev,
      [selectedUser.id]: result.data.hasMore,
    }));

    if (olderMessages.length > 0) {
      setMessagesMap((prev) => ({
        ...prev,
        [selectedUser.id]: [
          ...olderMessages,
          ...(prev[selectedUser.id] || []),
        ],
      }));
    }
  } catch (error) {
    console.error("Failed to fetch older messages", error);
  }
}, [selectedUser, userdetail]);
const sendMessage = useCallback(
  async (msg: string | FormData) => {
    if (!selectedUser || !userdetail) return;
    
    const isFormData = msg instanceof FormData;
    if (!isFormData && (!msg || !msg.trim())) return;

    const tempId = uuidv4();
    
    try {
      if (isFormData) {
        const file = msg.get('file') as File;
        if (!file) return;

        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Create optimistic UI message
        const fileMsg: Message = {
          id: tempId,
          message: '',
          created_at: new Date(),
          sender_id: userdetail.id,
          receiver_id: selectedUser.id,
          status: "pending",
          conversation_id: selectedUser.conversation_id,
          file_url: base64, // Show preview immediately
          file_type: file.type,
          file_name: file.name,
        };

        // Add to UI immediately
        setMessagesMap((prev) => ({
          ...prev,
          [selectedUser.id]: [...(prev[selectedUser.id] || []), fileMsg],
        }));

        updateSidebarWithNewMessage(
          selectedUser.id,
          `📎 ${file.name}`,
          new Date().toISOString()
        );

        // Send to backend
        const response = await api.post("/message/send", {
          id: tempId,
          receiver_id: selectedUser.id,
          conversation_id: selectedUser.conversation_id,
          message: '',
          file: base64,
          file_type: file.type,
          file_name: file.name,
        });

        // Update with actual Cloudinary URL
        setMessagesMap((prev) => ({
          ...prev,
          [selectedUser.id]: prev[selectedUser.id].map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  file_url: response.data.file_url,
                  status: "sent",
                  conversation_id: response.data.conversation_id,
                }
              : m
          ),
        }));

        if (response.data.conversation_id) {
          updateSelectedUserConvId(response.data.conversation_id);
        }

      } else {
        // Regular text message
        const newMsg: Message = {
          id: tempId,
          message: msg,
          created_at: new Date(),
          sender_id: userdetail.id,
          receiver_id: selectedUser.id,
          status: "pending",
          conversation_id: selectedUser.conversation_id,
        };

        setMessagesMap((prev) => ({
          ...prev,
          [selectedUser.id]: [...(prev[selectedUser.id] || []), newMsg],
        }));

        updateSidebarWithNewMessage(
          selectedUser.id,
          msg,
          new Date().toISOString()
        );

        sendMsg(newMsg);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Mark message as failed
      setMessagesMap((prev) => ({
        ...prev,
        [selectedUser.id]: prev[selectedUser.id].map((m) =>
          m.id === tempId ? { ...m, status: "failed" } : m
        ),
      }));
    }
  },
  [selectedUser, sendMsg, userdetail, updateSidebarWithNewMessage, updateSelectedUserConvId]
);





  const markAsRead = useCallback(
    (messageId: string, senderId: number) => {
      socket?.emit("message_read", {
        message_id: messageId,
        sender_id: senderId,
      });
    },
    [socket]
  );
  useEffect(() => {
    if (!socket) return;
    const handleMessage = (msg: Message) => {
      console.log(msg);
      setMessagesMap((prev) => ({
        ...prev,
        [msg.sender_id]: [...(prev[msg.sender_id] || []), msg],
      }));

      updateSidebarWithNewMessage(
        msg.sender_id,
        msg.message,
        String(msg.created_at)
      );
      socket.emit("message_delivered", {
        message_id: msg.id,
        sender_id: msg.sender_id,
      });
    };
    const updateMsgStatus = (
      userId: number,
      msgId: string,
      status: string,
      convId?: number
    ) => {
      setMessagesMap((prev) => {
        const userMessages = prev[userId];
        if (!userMessages) return prev;
        return {
          ...prev,
          [userId]: userMessages.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  status,
                  ...(convId ? { conversation_id: convId } : {}),
                }
              : m
          ),
        };
      });
    };
    const handleMessageSent = (data: {
      temp_id: string;
      receiver_id: number;
      conversation_id: number;
    }) => {
      updateMsgStatus(data.receiver_id, data.temp_id, "sent", data.conversation_id);
      if (data.conversation_id) {
        updateSelectedUserConvId(data.conversation_id);
      }
    };
    const handleMessageDelivered = (data: {
      message_id: string;
      receiver_id: number;
    }) => {
      updateMsgStatus(data.receiver_id, data.message_id, "delivered");
    };
    const handleMessageRead = (data: {
      message_id: string;
      receiver_id: number;
    }) => {
      updateMsgStatus(data.receiver_id, data.message_id, "read"); // ✅ WAS "delivered"
    };

    socket.on("onMessage", handleMessage);
    socket.on("message_sent", handleMessageSent);
    socket.on("message_delivered", handleMessageDelivered);
    socket.on("message_read", handleMessageRead);

    return () => {
      socket.off("onMessage", handleMessage);
      socket.off("message_sent", handleMessageSent);
      socket.off("message_delivered", handleMessageDelivered);
      socket.off("message_read", handleMessageRead);
    };
  }, [socket, updateSidebarWithNewMessage, updateSelectedUserConvId]);
  const messages = useMemo(() => {
    if (!selectedUser) return [];
    return messagesMap[selectedUser.id] || [];
  }, [selectedUser, messagesMap]);

  const hasMore = useMemo(() => {
    if (!selectedUser) return false;
    return hasMoreChats[selectedUser.id] ?? true;
  }, [selectedUser, hasMoreChats]);
  const value = useMemo(
    () => ({
      messages,
      sendMessage,
      fetchOlderMessages,
      hasMore,
      markAsRead,
    }),
    [messages, sendMessage, fetchOlderMessages, hasMore, markAsRead]
  );

  return (
    <MessageContext.Provider value={value}>{children}</MessageContext.Provider>
  );
};