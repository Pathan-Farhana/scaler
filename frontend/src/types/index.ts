export interface User {
  id: string;
  phone_number: string;
  username?: string;
  display_name: string;
  avatar_url?: string;
  about?: string;
  is_online: boolean;
  last_seen?: string;
}

export interface Contact {
  id: string;
  contact_user: User;
  nickname?: string;
  created_at: string;
}

export type MessageStatus = "sending" | "sent" | "delivered" | "read";
export type MessageType = "text" | "image" | "file" | "system";
export type ConversationType = "direct" | "group";

export interface Reaction {
  id: string;
  emoji: string;
  user_id: string;
  user: User;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id?: string;
  sender?: User;
  content?: string;
  message_type: MessageType;
  status: MessageStatus;
  reply_to_id?: string;
  reply_to?: Message;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  disappears_at?: string;
  is_deleted: boolean;
  reactions: Reaction[];
  created_at: string;
  edited_at?: string;
}

export interface ConversationMember {
  user_id: string;
  user: User;
  is_admin: boolean;
  joined_at: string;
  last_read_at?: string;
  muted: boolean;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name?: string;
  avatar_url?: string;
  description?: string;
  created_by?: string;
  members: ConversationMember[];
  last_message?: Message;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface WSEvent {
  event: string;
  data: Record<string, unknown>;
}

export interface TypingState {
  [conversationId: string]: {
    [userId: string]: boolean;
  };
}
