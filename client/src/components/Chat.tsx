import { EllipsisVertical, Phone, Send, Video } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../hooks/useChat';

interface ChatProps {
  User?: { id: number; name: string; email: string } | {};
}

const Chat: React.FC<ChatProps> = () => {
  const { selectedUser, messages, sendMessage, handleTyping } = useChat();
  const [msg, setMsg] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleMessageSend = () => {
    if (!msg.trim()) return;
    sendMessage(msg);
    setMsg('');
  };

  if (!selectedUser) {
    return (
      <div className="w-full h-screen flex flex-col justify-center items-center bg-gray-50">
        <h1 className="font-extrabold text-2xl mb-4">Welcome to Chat kare!!</h1>
        <p className="w-[50%] text-justify [text-align-last:center] leading-relaxed text-gray-700">
          Select a user to start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full h-screen flex flex-col justify-center overflow-hidden">
        <div className="bg-yellow-200 flex justify-between items-center p-1">
          <div className="flex justify-center items-center">
            <img
              src={selectedUser?.avatar}
              className="h-12 aspect-[1] rounded-full"
              alt={selectedUser.name}
            />
            <div className="flex flex-col px-3">
              <h1 className="font-semibold leading-tight text-2xl">{selectedUser.name}</h1>
              <h1 className="font-normal text-sm px-1">
                {selectedUser?.isonline ? 'Online' : 'Offline'}
              </h1>
            </div>
          </div>
          <div className="flex justify-center items-center space-x-3">
            <span className="h-10 aspect-[1] justify-center flex items-center rounded-full hover:bg-slate-100 duration-100 transition-all">
              <Phone />
            </span>
            <span className="h-10 aspect-[1] rounded-full hover:bg-slate-100 justify-center flex items-center duration-100 transition-all">
              <Video />
            </span>
            <span className="h-10 aspect-[1] rounded-full hover:bg-slate-100 justify-center flex items-center duration-100 transition-all">
              <EllipsisVertical />
            </span>
          </div>
        </div>

        <div className="bg-gray-200 h-[90%] overflow-auto pt-2">
          <div className="w-full p-2 space-y-2 flex flex-col">
            {messages.map((msg, idx) => (
              <div
                ref={messagesEndRef}
                key={idx}
                className={`px-2 py-1 relative text-sm rounded-md shadow-sm border max-w-[70%] ${msg.sender_id !== selectedUser.id
                  ? 'self-end bg-[#5cc55c] rounded-br-none text-white border-green-600 pe-12'
                  : 'self-start rounded-bl-none bg-white text-black border-gray-300 pe-12'
                  }`}
              >
                {msg.message}
                <span
                  className="text-[9px] font-semibold absolute bottom-0 right-1"
                >
                  {msg.created_at
                    ? new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })
                    : '9:30 pm'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex p-1">
          <input
            ref={inputRef}
            type="text"
            className="border-gray-100 focus:ring-2 rounded-lg bg-gray-100 flex-1 px-2 py-1 text-sm focus:outline-none focus:transition-all duration-300"
            placeholder="message..."
            value={msg}
            onChange={(e) => { setMsg(e.target.value); handleTyping() }}
            onKeyDown={(e) => e.key === 'Enter' && handleMessageSend()}
          />
          <button
            onClick={handleMessageSend}
            className="bg-gray-300 justify-center items-center flex font-extrabold px-3 py-1.5 rounded-lg mx-1"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;