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
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "../hooks/useChat";
import { useNavigate } from "react-router-dom";
import { useMessage } from "../hooks/useMessage";
import { v4 as uuidv4 } from "uuid";
import { api } from "../utils/axios";

const Chat: React.FC = () => {
  const { handleTyping, typingUsers, onlineUser, selectUser, selectedUser } =
    useChat();

  const { messages, sendMessage, fetchOlderMessages, hasMore, markAsRead } =
    useMessage();

  const navigate = useNavigate();
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingFile, setSendingFile] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const readSetRef = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);
  const previousScrollHeight = useRef(0);
  const shouldScrollToBottom = useRef(true);
  const [preview, setPreview] = useState<{
    file: File;
    url: string;
    type: "image" | "video" | "file";
  } | null>(null);

  let x = 0;

  // Scroll to bottom helper
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = chatRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior });
      el.scrollTop = el.scrollHeight;
    });
  }, []);
  console.log(messages);
  console.log(hasMore);
  // Check if user is at bottom of chat
  const isUserAtBottom = useCallback(() => {
    const el = chatRef.current;
    if (!el) return true;
    const threshold = 150;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Focus input and scroll to bottom when chat opens
  useEffect(() => {
    if (!selectedUser) return;

    // Reset states
    readSetRef.current.clear();
    isInitialLoad.current = true;
    shouldScrollToBottom.current = true;
    setMsg("");
    setPreview(null);

    // Focus input
    inputRef.current?.focus();

    // Scroll to bottom after a short delay to ensure messages are rendered
  }, [selectedUser?.id, scrollToBottom]);

  // Auto-scroll on new messages (only if user is near bottom)
  useEffect(() => {
    if (messages.length === 0) return;

    // if (isInitialLoad.current) {
    //   scrollToBottom("auto");
    //   return;
    // }

    const lastMessage = messages[messages.length - 1];
    const isMyMessage = lastMessage?.sender_id !== selectedUser?.id;

    // Always scroll if it's my message, or if user is near bottom
    if (isMyMessage || isUserAtBottom()) {
      scrollToBottom("smooth");
    }
  }, [scrollToBottom, isUserAtBottom, selectedUser?.id]);

  // Auto-fill if messages don't create scrollbar
  useEffect(() => {
    if (!shouldScrollToBottom.current) return;

    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    const isMyMessage = lastMessage?.sender_id !== selectedUser?.id;

    if (isMyMessage || isUserAtBottom()) {
      scrollToBottom("smooth");
    }
  }, [messages.length, selectedUser?.id]);

  const sendFileMessage = useCallback(async () => {
    if (!preview || !selectedUser || sendingFile) return;

    setSendingFile(true);
    shouldScrollToBottom.current = true;

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;

          const response = await api.post(`/message/${selectedUser.id}`, {
            id: uuidv4(),
            file: base64,
            file_type: preview.file.type, 
            file_name: preview.file.name,
            receiver_id: selectedUser.id,
            conversation_id: selectedUser.conversation_id,
            message: "",
          });

          console.log("File sent:", response.data);
          setPreview(null);
          setSendingFile(false);
          setTimeout(() => scrollToBottom("smooth"), 100);
        } catch (error) {
          console.error("Error sending file:", error);
          setSendingFile(false);
          alert("Failed to send file. Please try again.");
        }
      };

      reader.onerror = () => {
        console.error("Error reading file");
        setSendingFile(false);
        alert("Error reading file");
      };

      reader.readAsDataURL(preview.file);
    } catch (error) {
      console.error("Error in sendFileMessage:", error);
      setSendingFile(false);
    }
  }, [preview, selectedUser, sendingFile, scrollToBottom]);

  // Load more messages
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    const el = chatRef.current;
    if (!el) return;

    setLoading(true);

    // ❗ STOP auto scroll
    shouldScrollToBottom.current = false;

    // ✅ Save current height
    const prevScrollHeight = el.scrollHeight;

    try {
      await fetchOlderMessages();

      requestAnimationFrame(() => {
        if (!el) return;

        const newScrollHeight = el.scrollHeight;

        // ✅ THIS LINE FIXES YOUR ISSUE
        el.scrollTop = newScrollHeight - prevScrollHeight;
      });
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, fetchOlderMessages]);
  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el || loading || !hasMore) return;

    if (el.scrollTop < 100) {
      loadMore();
    }
  }, [loading, hasMore, loadMore]);

  // Setup read receipt observer
  useEffect(() => {
    if (!selectedUser) return;

    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const messageId = el.dataset.messageId;
            const senderId = el.dataset.senderId;

            if (
              messageId &&
              senderId &&
              !readSetRef.current.has(messageId) &&
              parseInt(senderId) === selectedUser.id
            ) {
              readSetRef.current.add(messageId);
              markAsRead(messageId, parseInt(senderId));
              observerRef.current?.unobserve(el);
            }
          }
        });
      },
      { root: chatRef.current, threshold: 0.6 },
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [markAsRead, selectedUser?.id]);

  // Ref callback for incoming messages
  const incomingRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !observerRef.current) return;

    const messageId = node.dataset.messageId;
    if (messageId && !readSetRef.current.has(messageId)) {
      observerRef.current.observe(node);
    }
  }, []);

  // Send text message
  const handleMessageSend = useCallback(() => {
    const trimmedMsg = msg.trim();
    if (!trimmedMsg || !selectedUser) return;

    shouldScrollToBottom.current = true;

    sendMessage(trimmedMsg);
    setMsg("");
  }, [msg, sendMessage, selectedUser]);
  // Handle file selection
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = () => {
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
  }, []);

  // Send file message

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleMessageSend();
      }
    },
    [handleMessageSend],
  );

  // Format time
  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "";
    }
  };

  // Format last seen
  const getLastSeenText = () => {
    if (onlineUser.includes(selectedUser?.id || 0)) {
      return typingUsers[selectedUser?.id || 0] ? "Typing..." : "Online";
    }
    if (selectedUser?.last_message_time) {
      const time = selectedUser.last_message_time
        .split("T")[1]
        ?.split(":")
        .splice(0, 2)
        .join(":");
      return time ? `Last seen at ${time}` : "Offline";
    }
    return "Offline";
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
            className="flex-shrink-0"
          >
            <ArrowLeft size={18} className="text-[#5e5148]" />
          </button>
          {selectedUser.avatar ? (
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
              {getLastSeenText()}
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

      {/* Messages Container */}
      <div
        ref={chatRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 bg-[#f8f5f1]"
      >
        more
        {loading && (
          <div className="flex justify-center py-3">
            <Loader2Icon className="animate-spin text-[#b08968]" size={20} />
          </div>
        )}
        {!hasMore && messages.length > 0 && (
          <div className="text-center text-xs text-[#7b6f66] py-2 mb-2">
            🔒 Messages are end-to-end encrypted
          </div>
        )}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-[#e7ded4] flex items-center justify-center mb-3">
              <span className="text-2xl">👋</span>
            </div>
            <p className="text-sm text-[#7b6f66]">
              No messages yet. Start the conversation!
            </p>
          </div>
        )}
        <div className="w-full space-y-2 flex flex-col">
          {messages.map((m, idx) => {
            const isMine = m.sender_id !== selectedUser.id;
            const showTimestamp =
              idx === 0 ||
              new Date(m.created_at).toDateString() !==
                new Date(messages[idx - 1]?.created_at).toDateString();

            return (
              <React.Fragment key={m?.id}>
                {showTimestamp && (
                  <div className="flex justify-center my-2">
                    <span className="text-xs text-[#7b6f66] bg-[#e7ded4] px-3 py-1 rounded-full">
                      {new Date(m.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}

                <div
                  ref={isMine ? undefined : incomingRef}
                  data-message-id={m.id}
                  data-sender-id={m.sender_id}
                  className={`relative rounded-lg max-w-[80%] sm:max-w-[65%] shadow-sm ${
                    isMine
                      ? "self-end bg-[#d9fdd3] text-[#2f2a26]"
                      : "self-start bg-white text-[#2f2a26] border border-[#e5ddd3]"
                  }`}
                >
                  {/* File Preview */}
                  {m.file_url && (
                    <div className="p-1">
                      {m.file_type?.startsWith("image/") ? (
                        <div className="relative">
                          <img
                            src={m.file_url}
                            alt="attachment"
                            className="w-full h-auto max-h-[240px] sm:max-h-[320px] object-cover rounded-md"
                            loading="lazy"
                          />
                          <span className="text-[10px] flex items-center gap-1 font-medium absolute bottom-1.5 right-1.5 bg-black/50 text-white px-1.5 py-0.5 rounded-full">
                            {formatTime(m.created_at)}
                            {isMine && (
                              <>
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
                              </>
                            )}
                          </span>
                        </div>
                      ) : m.file_type?.startsWith("video/") ? (
                        <div className="relative">
                          <video
                            src={m.file_url}
                            controls
                            className="w-full h-auto max-h-[240px] sm:max-h-[320px] rounded-md"
                          />
                          <span className="text-[10px] flex items-center gap-1 font-medium absolute bottom-1.5 right-1.5 bg-black/50 text-white px-1.5 py-0.5 rounded-full">
                            {formatTime(m.created_at)}
                            {isMine && (
                              <>
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
                              </>
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
                  )}

                  {/* Text Message */}
                  {m.message && (
                    <div className="px-3 pt-1.5 pb-1 pr-16">
                      <p className="break-words text-sm whitespace-pre-wrap">
                        {m.message}
                      </p>
                    </div>
                  )}

                  {/* Timestamp for non-media messages */}
                  {(!m.file_type ||
                    (!m.file_type.startsWith("image/") &&
                      !m.file_type.startsWith("video/"))) && (
                    <span
                      className={`text-[10px] flex items-center gap-1 font-medium absolute bottom-1 text-[#667781] ${
                        isMine ? "right-2" : "right-2"
                      }`}
                    >
                      {formatTime(m.created_at)}
                      {isMine && (
                        <>
                          {m.status === "pending" && <Clock3 size={12} />}
                          {m.status === "sent" && <Check size={12} />}
                          {m.status === "delivered" && <CheckCheck size={12} />}
                          {m.status === "read" && (
                            <CheckCheck size={12} className="text-[#53bdeb]" />
                          )}
                        </>
                      )}
                    </span>
                  )}
                </div>
              </React.Fragment>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* File Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex justify-between items-center bg-[#efe7dd]">
              <h3 className="font-semibold text-[#2f2a26]">Preview</h3>
              <button
                onClick={() => setPreview(null)}
                disabled={sendingFile}
                className="text-[#5e5148] hover:text-[#2f2a26] disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 bg-[#f8f5f1]">
              {preview.type === "image" && (
                <img
                  src={preview.url}
                  alt="Preview"
                  className="max-w-full h-auto rounded-lg"
                />
              )}
              {preview.type === "video" && (
                <video
                  src={preview.url}
                  controls
                  className="max-w-full h-auto rounded-lg"
                />
              )}
              {preview.type === "file" && (
                <div className="text-center py-8">
                  <Paperclip
                    size={48}
                    className="mx-auto mb-2 text-[#7b6f66]"
                  />
                  <p className="text-sm text-[#2f2a26] font-medium">
                    {preview.file.name}
                  </p>
                  <p className="text-xs text-[#7b6f66] mt-1">
                    {(preview.file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-[#efe7dd] flex justify-end gap-2">
              <button
                onClick={() => setPreview(null)}
                disabled={sendingFile}
                className="px-4 py-2 text-[#5e5148] hover:bg-[#e3d8cc] rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={sendFileMessage}
                disabled={sendingFile}
                className="px-6 py-2 bg-[#b08968] hover:bg-[#9c7455] text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingFile ? (
                  <>
                    <Loader2Icon className="animate-spin" size={16} />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-[#efe7dd] border-t border-[#ddd2c5] px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-shrink-0">
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFile}
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            />
            <button className="p-2 rounded-md bg-white hover:bg-[#f8f5f1] transition-all">
              <Paperclip size={20} className="text-[#5e5148]" />
            </button>
          </div>
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
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={handleMessageSend}
            disabled={!msg.trim()}
            className="h-11 w-11 rounded-full bg-[#b08968] hover:bg-[#9c7455] text-white flex items-center justify-center transition-all flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
