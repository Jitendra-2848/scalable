import { Socket } from "socket.io-client";

// Unified interface - all users normalized to this format
export interface User {
  id: number;
  name: string;
  email?: string;
  avatar?: string;
  isonline?: boolean;
  lastMessage?: string;
  lastSeen?: string;
  conversation_id?: number;
}

export interface Message {
  id: number;
  message: string;
  created_at: Date;
  read: boolean;
  sendedbyme: boolean;
  exist: boolean;
  sender_id:number;
}

export interface ChatContextType {
  selectedUser: User | null;
  selectUser: (user: any) => void;
  messages: Message[];
  sendMessage: (msg: string) => void;
  users: User[];
  getAllUser: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredUsers: User[];
  addMessageFromSocket: (msg: Message) => void;
  handleTyping: () => void;
}

// Converts user_id or id to unified id - single entry point for all user formats
export const normalizeUser = (rawUser: any): User => {
  const id = rawUser.user_id ?? rawUser.id;
  
  if (!id) {
    throw new Error('User must have either id or user_id');
  }

  return {
    id,
    name: rawUser.name,
    email: rawUser.email,
    avatar: rawUser.avatar,
    isonline: rawUser.isonline,
    lastMessage: rawUser.lastMessage || rawUser.last_message,
    lastSeen: rawUser.lastSeen || rawUser.last_seen,
    conversation_id: rawUser.conversation_id,
  };
};

export interface socketconInterface {
  socket: Socket | null;
  sendmsg: (msg: Message) => void;
  joining: (id:number) => void;
}

export interface childrenInterface {
  children: React.ReactNode;
}

export interface login_data {
  email: string;
  pass: string;
}

export interface Register_data {
  email: string;
  name: string;
  pass: string;
} 
export interface userInfoInterface {
    login: (data: any) => void,
    Register: (data: any) => void,
    getuser: (data: any) => void,
    userdetail: {
        name: string,
        email: string,
    },
    auth: boolean;
    logout : () => void;
    userSearch : (search:any) => void;
    

}

export interface user_info{
  id:number,
  email:string,
  name:string,
  pass?:string,
}