import {
  EllipsisVertical,
  Phone,
  Send,
  Video,
  Check,
  CheckCheck,
  Clock3,
  ArrowLeft,
} from "lucide-react";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "../hooks/useChat";
import { useNavigate } from "react-router-dom";

interface ChatProps {
  User?: { id: number; name: string; email: string } | {};
}

const Chat: React.FC<ChatProps> = () => {
  const {
    selectedUser,
    messages,
    sendMessage,
    handleTyping,
    typingUsers,
    onlineUser,
    markAsRead,
    selectUser,
  } = useChat();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const readSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    readSetRef.current.clear();
    if (observerRef.current) observerRef.current.disconnect();
  }, [selectedUser?.id]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const messageId = el.dataset.messageId;
            const senderId = el.dataset.senderId;

            if (messageId && senderId && !readSetRef.current.has(messageId)) {
              readSetRef.current.add(messageId);
              markAsRead(messageId, parseInt(senderId));
              observerRef.current?.unobserve(el);
            }
          }
        });
      },
      {
        root: chatContainerRef.current,
        threshold: 0.6,
      }
    );

    return () => observerRef.current?.disconnect();
  }, [markAsRead, selectedUser?.id]);

  const incomingRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !observerRef.current) return;
    const messageId = node.dataset.messageId;
    if (messageId && !readSetRef.current.has(messageId)) {
      observerRef.current.observe(node);
    }
  }, []);

  const handleMessageSend = () => {
    if (!msg.trim()) return;
    sendMessage(msg);
    setMsg("");
  };

  if (!selectedUser) {
    return (
      <div className="w-full h-screen hidden sm:flex flex-col justify-center items-center bg-[#f8f5f1]">
        <div className="w-20 h-20 rounded-full bg-[#e7ded4] flex items-center justify-center mb-5">
          <span className="text-3xl">💬</span>
        </div>
        <h1 className="font-bold text-2xl text-[#2f2a26] mb-2">
          Welcome to Chat Kare
        </h1>
        <p className="w-[60%] text-center leading-relaxed text-[#7b6f66] text-sm">
          Select a user from the left side and start your conversation.
        </p>
      </div>
    );
  }
  return (
    <div className="w-full h-screen flex flex-col bg-[#f8f5f1]">
      {/* Header */}
      <div className="bg-[#efe7dd] border-b border-[#ddd2c5] flex justify-between items-center px-3 sm:px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              navigate("/log");
              selectUser(null);
            }}
          >
            <ArrowLeft size={18} className="text-[#5e5148]" />
          </button>
          {selectedUser?.avatar ? (
            <img
              src={selectedUser.avatar}
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover border border-[#d6c8b8] flex-none"
              alt={selectedUser.name}
            />
          ) : (
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-[#b08968] text-white flex items-center justify-center font-semibold text-base sm:text-lg flex-none">
              {selectedUser.name?.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <h1 className="font-semibold text-sm sm:text-lg text-[#2f2a26] truncate">
              {selectedUser.name}
            </h1>
            <h1 className="font-normal text-xs sm:text-sm text-[#7b6f66] truncate">
              {onlineUser.includes(selectedUser.id)
                ? typingUsers[selectedUser.id]
                  ? "Typing..."
                  : "Online"
                : selectedUser.last_message_time ? (`last seen at ${selectedUser.last_message_time
                  ?.split("T")[1]
                  ?.split(":")
                  .splice(0, 2)
                  .join(":")}`) : "Chat with me to know my seen 😊"}
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-2">
          <button className="h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-[#e3d8cc] flex items-center justify-center transition-all">
            <Phone size={17} className="text-[#5e5148]" />
          </button>
          <button className="h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-[#e3d8cc] flex items-center justify-center transition-all">
            <Video size={17} className="text-[#5e5148]" />
          </button>
          <button className="h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-[#e3d8cc] flex items-center justify-center transition-all">
            <EllipsisVertical size={17} className="text-[#5e5148]" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-auto px-3 sm:px-4 py-4 bg-[#f8f5f1]"
      >
        <div className="w-full space-y-3 flex flex-col">
          {messages.map((m, idx) => {
            const isMine = m.sender_id !== selectedUser.id;
            const isIncoming = m.sender_id === selectedUser.id;

            return (
              <div
                ref={isIncoming ? incomingRef : undefined}
                data-message-id={m.id}
                data-sender-id={m.sender_id}
                key={m.id || idx}
                className={`relative p-2 text-xs rounded-b-md max-w-[85%] sm:max-w-[72%] shadow-sm ${isMine
                  ? "self-end bg-[#6b7a58] text-white rounded-tl-md pe-14"
                  : "self-start bg-white text-[#2f2a26] border border-[#e5ddd3] rounded-tr-md pe-10"
                  }`}
              >
                <p className="break-words px-[2px]">{m.message}</p>

                <span
                  className={`text-[7px] flex items-center font-medium absolute bottom-0 ${isMine
                    ? "bottom-1 right-2 text-white/70"
                    : "bottom-1 right-2 text-[#8b7f75]"
                    }`}
                >
                  {m.created_at
                    ? new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })
                    : "9:30 pm"}

                  {isMine && (
                    <span className="inline-block ps-1">
                      {m.status === "pending" && <Clock3 size={10} />}
                      {m.status === "sent" && <Check size={11} />}
                      {m.status === "delivered" && <CheckCheck size={12} />}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-[#efe7dd] border-t border-[#ddd2c5] px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            className="flex-1 rounded-md bg-white px-4 py-3 text-sm text-[#2f2a26] placeholder:text-[#9a8f86] focus:outline-none focus:ring-2 focus:ring-[#c7b8a7] transition-all"
            placeholder="Type a message..."
            value={msg}
            onChange={(e) => {
              setMsg(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => e.key === "Enter" && handleMessageSend()}
          />
          <button
            onClick={handleMessageSend}
            className="h-11 w-16 rounded-xl bg-[#b08968] hover:bg-[#9c7455] text-white flex items-center justify-center transition-all flex-none"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;