// People.tsx
import { Plus, Search } from 'lucide-react';
import React from 'react';
import { useChat } from '../hooks/useChat';
import { User } from '../types';

interface PeopleProps {
  onAddClick: () => void;
}

const People: React.FC<PeopleProps> = ({ onAddClick }) => {
  const { filteredUsers, selectUser, selectedUser, searchQuery, setSearchQuery, typingUsers, onlineUser } = useChat();

  return (
    <div className="w-full sm:max-w-[340px] h-screen flex flex-col overflow-hidden border-r border-[#ddd2c5] bg-[#f3eee8]">

      {/* Header */}
      <div className="p-4 bg-gradient-to-br from-[#ffffff] to-[#fff0e4] flex-none">
        <div className="flex justify-between items-center mb-1">
          <h1 className="font-semibold text-xl tracking-tight">Chat Kare!</h1>
          <button
            onClick={onAddClick}
            title="Add people"
            className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-all"
          >
            <Plus size={16} className="bg-[#fefffc]" />
          </button>
        </div>
        <p className="text-xs mb-3">Your conversations</p>

        <div className="relative ">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white/90 rounded-xl text-sm text-[#3d3530] placeholder-[#c4b5a5] focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
          />
        </div>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user: User, idx) => (
            <div
              key={idx}
              onClick={() => selectUser(user)}
              className={`px-4 py-3 flex items-center gap-3 cursor-pointer border-b transition-all duration-200 ${
                selectedUser?.id === user.id ? 'bg-[#98f7cf]' : 'bg-white hover:bg-[#f7f3ee]'
              }`}
            >
              <div className="relative flex-none">
                <div className="h-11 w-11 rounded-full bg-[#ff8686] flex items-center justify-center text-white font-semibold text-sm">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                {onlineUser.includes(Number(user.id)) && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <h1 className="font-medium text-sm text-[#3d3530] truncate">{user.name}</h1>
                  <span className="text-[10px] text-[#a39081] flex-none ml-2">
                    {user.last_message_time?.split('T')[1]?.split(':').splice(0, 2).join(':')}
                  </span>
                </div>
                <p className="text-xs text-[#a39081] truncate mt-0.5">
                  {typingUsers[user.id] ? (
                    <span className="text-[#69ee67] font-medium">Typing...</span>
                  ) : (
                    user.last_message
                  )}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-[#c4b5a5]">
            <p className="text-sm">No conversations yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default People;