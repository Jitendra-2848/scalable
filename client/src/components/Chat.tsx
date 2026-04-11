import {
  EllipsisVertical,
  Phone,
  Send,
  Video,
  Check,
  CheckCheck,
  Clock3,
  ArrowLeft,
  Loader2Icon,
  Paperclip,
  Download,
} from "lucide-react";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "../hooks/useChat";
import { useNavigate } from "react-router-dom";
import { useMessage } from "../hooks/useMessage";
import { api } from "../utils/axios";

const Chat: React.FC = () => {
  const { handleTyping, typingUsers, onlineUser, selectUser, selectedUser } =
    useChat();

  const { messages, sendMessage, fetchOlderMessages, hasMore, markAsRead } =
    useMessage();

  const navigate = useNavigate();
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const readSetRef = useRef<Set<string>>(new Set());
  const [preview, setPreview] = useState<{
    file: File;
    url: string;
    type: "image" | "video" | "file";
  } | null>(null);

  // Focus input and scroll to bottom when chat opens
  useEffect(() => {
  inputRef.current?.focus();

  requestAnimationFrame(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  });
}, [selectedUser?.id]);

  // Auto-fill if messages dont create scrollbar
  useEffect(() => {
    const el = chatRef.current;
    if (!el || !hasMore || loading || messages.length === 0) return;
    if (el.scrollHeight <= el.clientHeight) {
      loadMore();
    }
  }, [messages.length, hasMore]);

  async function loadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    const el = chatRef.current;
    const oldHeight = el ? el.scrollHeight : 0;
    await fetchOlderMessages();
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - oldHeight;
      setLoading(false);
    });
  }

  function handleScroll() {
    const el = chatRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollTop < 80) loadMore();
  }

  // Read receipts
  useEffect(() => {
    // readSetRef.current.clear();
    // if (observerRef.current) observerRef.current.disconnect();
    inputRef.current?.focus();
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
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
      { root: chatRef.current, threshold: 0.6 },
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

  function handleMessageSend() {
    if (!msg.trim()) return;
    sendMessage(msg);
    setMsg("");
    inputRef.current?.focus();
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  }
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
      const base64String = reader.result as string;

      setPreview({
        file,
        url: base64String,
        type: file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
            ? "video"
            : "file",
      });
    };
    reader.readAsDataURL(file);
    sendFileMessage();
  }

  // When sending from preview modal:
  async function sendFileMessage() {
    if (!preview) return;

    const formData = new FormData();
    formData.append("file", preview.file);
    formData.append("receiver_id", String(selectedUser?.id));
    formData.append("conversation_id", String(selectedUser?.conversation_id));
    formData.append("message", "");
    const reader = new FileReader();

    reader.onload = async () => {
      const base64 = reader.result as string;

      const response = await api.post(`/message/${selectedUser?.id}`, {
        id: uuidv4(),
        file: base64,
        receiver_id: selectedUser?.id,
        conversation_id: selectedUser?.conversation_id,
        message: "",
      });
      console.log(response.data);
      // Handle response...
      setPreview(null);
    };
    reader.readAsDataURL(preview.file);
  }

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
                : selectedUser.last_message_time
                  ? `last seen at ${selectedUser.last_message_time?.split("T")[1]?.split(":").splice(0, 2).join(":")}`
                  : "Chat with me to know my seen 😊"}
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
      <div
        ref={chatRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto px-3 sm:px-4 py-4 bg-[#f8f5f1]"
      >
        {loading && (
          <div className="flex justify-center py-3">
            <Loader2Icon className="animate-spin text-[#b08968]" size={20} />
          </div>
        )}

        {!hasMore && messages.length > 0 && (
          <div className="text-center text-xs text-[#7b6f66] py-2">
            Beginning of conversation
          </div>
        )}

        <div className="w-full space-y-3 flex flex-col">
          {messages.map((m, idx) => {
            const isMine = m.sender_id !== selectedUser.id;
            const isIncoming = m.sender_id === selectedUser.id;
            return (
              <div
                ref={isMine ? undefined : incomingRef}
                data-message-id={m.id}
                data-sender-id={m.sender_id}
                key={m.id + "-" + idx}
                className={`relative rounded-lg max-w-[80%] sm:max-w-[65%] shadow-sm ${
                  isMine
                    ? "self-end bg-[#d9fdd3] text-[#2f2a26]"
                    : "self-start bg-white text-[#2f2a26] border border-[#e5ddd3]"
                }`}
              >
                {m.file_url ? (
                  <div className="p-1">
                    {m.file_type?.startsWith("image/") ||
                    m.file_type?.startsWith("video/") ? (
                      <div className="relative">
                        {m.file_type.startsWith("image/") ? (
                          <img
                            src={m.file_url}
                            alt="attachment"
                            className="w-full h-auto max-h-[240px] sm:max-h-[320px] object-cover rounded-md"
                          />
                        ) : (
                          <video
                            src={m.file_url}
                            controls
                            className="w-full h-auto max-h-[240px] sm:max-h-[320px] rounded-md"
                          />
                        )}
                        <span className="text-[10px] flex items-center gap-1 font-medium absolute bottom-1.5 right-1.5 bg-black/40 text-white px-1.5 py-0.5 rounded-full">
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                          {isMine && (
                            <span className="inline-block">
                              {m.status === "pending" && <Clock3 size={12} />}
                              {m.status === "sent" && <Check size={12} />}
                              {m.status === "delivered" && (
                                <CheckCheck size={12} />
                              )}
                              {m.status === "read" && (
                                <CheckCheck
                                  size={12}
                                  className="text-[#53bdeb]"
                                />
                              )}
                            </span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <a
                        href={m.file_url}
                        download
                        className="flex items-center gap-2 p-2 bg-[#f0f0f0] rounded-md hover:bg-[#e8e8e8] transition-colors"
                      >
                        <Paperclip
                          size={16}
                          className="text-[#5e5148] flex-shrink-0"
                        />
                        <span className="text-xs sm:text-sm text-gray-700 truncate min-w-0">
                          {m.file_name || "Download File"}
                        </span>
                        <Download
                          size={16}
                          className="ml-auto text-[#5e5148] flex-shrink-0"
                        />
                      </a>
                    )}
                  </div>
                ) : null}

                {m.message && (
                  <p className="break-words px-2 pt-1 pb-1 pr-14 text-sm">
                    {m.message}
                  </p>
                )}

                {!m.file_type?.startsWith("image/") &&
                  !m.file_type?.startsWith("video/") && (
                    <span className={`text-[10px] flex items-center gap-1 font-medium absolute bottom-1.5 right-3 text-[#667781] ${isMine ? "right-1" : "right-5"}`}>
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                      {isMine && (
                        <span className="inline-block">
                          {m.status === "pending" && <Clock3 size={12} />}
                          {m.status === "sent" && <Check size={12} />}
                          {m.status === "delivered" && <CheckCheck size={12} />}
                          {m.status === "read" && (
                            <CheckCheck size={12} className="text-[#53bdeb]" />
                          )}
                        </span>
                      )}
                    </span>
                  )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* File Preview Modal */}
      {preview && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">Preview</h3>
              <button
                onClick={() => setPreview(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              {preview.type === "image" && (
                <img
                  src={preview.url}
                  alt="Preview"
                  className="max-w-full h-auto"
                />
              )}
              {preview.type === "video" && (
                <video
                  src={preview.url}
                  controls
                  className="max-w-full h-auto"
                />
              )}
              {preview.type === "file" && (
                <div className="text-center py-8">
                  <Paperclip size={48} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">{preview.file.name}</p>
                  <p className="text-xs text-gray-400">
                    {(preview.file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  const formData = new FormData();
                  formData.append("file", preview.file);
                  sendMessage(formData);
                  setPreview(null);
                }}
                className="px-4 py-2 bg-[#0b0291] text-white rounded-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div className="relative cursor-grab p-2 rounded-md bg-white hover:bg-[#f8f5f1] transition-all">
            <input
              type="file"
              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFile}
            />
            <Paperclip className="cursor-pointer" size={20} />
          </div>
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
