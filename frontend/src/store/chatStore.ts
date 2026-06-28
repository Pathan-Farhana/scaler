import { create } from "zustand";
import { Conversation, Message, TypingState, User } from "@/types";

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  typingState: TypingState;
  onlineUsers: Set<string>;

  setConversations: (convs: Conversation[]) => void;
  upsertConversation: (conv: Conversation) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (convId: string, msgs: Message[]) => void;
  prependMessages: (convId: string, msgs: Message[]) => void;
  addMessage: (msg: Message) => void;
  updateMessage: (msg: Partial<Message> & { id: string }) => void;
  deleteMessage: (convId: string, msgId: string) => void;
  setUserOnline: (userId: string, online: boolean) => void;
  setTyping: (convId: string, userId: string, isTyping: boolean) => void;
  handleWSEvent: (event: { event: string; data: Record<string, unknown> }) => void;
  updateMessageReaction: (data: { message_id: string; conversation_id: string; emoji: string; user_id: string; action: string }) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  typingState: {},
  onlineUsers: new Set(),

  setConversations: (convs) => set({ conversations: convs }),

  upsertConversation: (conv) =>
    set((s) => {
      const idx = s.conversations.findIndex((c) => c.id === conv.id);
      if (idx >= 0) {
        const updated = [...s.conversations];
        updated[idx] = conv;
        return { conversations: updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()) };
      }
      return { conversations: [conv, ...s.conversations] };
    }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setMessages: (convId, msgs) =>
    set((s) => ({ messages: { ...s.messages, [convId]: msgs } })),

  prependMessages: (convId, msgs) =>
    set((s) => ({
      messages: { ...s.messages, [convId]: [...msgs, ...(s.messages[convId] || [])] },
    })),

  addMessage: (msg) =>
    set((s) => {
      const existing = s.messages[msg.conversation_id] || [];
      // Avoid duplicates
      if (existing.some((m) => m.id === msg.id)) return {};
      const updated = [...existing, msg];
      // Update last message in conversation
      const convIdx = s.conversations.findIndex((c) => c.id === msg.conversation_id);
      const updatedConvs = [...s.conversations];
      if (convIdx >= 0) {
        updatedConvs[convIdx] = {
          ...updatedConvs[convIdx],
          last_message: msg,
          updated_at: msg.created_at,
          unread_count:
            msg.conversation_id !== s.activeConversationId
              ? (updatedConvs[convIdx].unread_count || 0) + 1
              : 0,
        };
        updatedConvs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      }
      return {
        messages: { ...s.messages, [msg.conversation_id]: updated },
        conversations: updatedConvs,
      };
    }),

  updateMessage: (partial) =>
    set((s) => {
      const convMsgs = s.messages[partial.conversation_id as string] || [];
      const updated = convMsgs.map((m) => (m.id === partial.id ? { ...m, ...partial } : m));
      return { messages: { ...s.messages, [partial.conversation_id as string]: updated } };
    }),

  deleteMessage: (convId, msgId) =>
    set((s) => {
      const msgs = (s.messages[convId] || []).map((m) =>
        m.id === msgId ? { ...m, is_deleted: true, content: undefined } : m
      );
      return { messages: { ...s.messages, [convId]: msgs } };
    }),

  setUserOnline: (userId, online) =>
    set((s) => {
      const next = new Set(s.onlineUsers);
      if (online) next.add(userId); else next.delete(userId);
      // Also update in conversations
      const convs = s.conversations.map((c) => ({
        ...c,
        members: c.members.map((m) =>
          m.user_id === userId ? { ...m, user: { ...m.user, is_online: online } } : m
        ),
      }));
      return { onlineUsers: next, conversations: convs };
    }),

  setTyping: (convId, userId, isTyping) =>
    set((s) => ({
      typingState: {
        ...s.typingState,
        [convId]: { ...(s.typingState[convId] || {}), [userId]: isTyping },
      },
    })),

  updateMessageReaction: ({ message_id, conversation_id, emoji, user_id, action }) =>
    set((s) => {
      const msgs = s.messages[conversation_id] || [];
      const updated = msgs.map((m) => {
        if (m.id !== message_id) return m;
        let reactions = [...(m.reactions || [])];
        if (action === "removed") {
          reactions = reactions.filter((r) => !(r.user_id === user_id && r.emoji === emoji));
        } else {
          if (!reactions.some((r) => r.user_id === user_id && r.emoji === emoji)) {
            reactions.push({ id: Date.now().toString(), emoji, user_id, user: {} as User });
          }
        }
        return { ...m, reactions };
      });
      return { messages: { ...s.messages, [conversation_id]: updated } };
    }),

  handleWSEvent: ({ event, data }) => {
    const store = get();
    switch (event) {
      case "message.new":
        store.addMessage(data as unknown as Message);
        break;
      case "message.deleted":
        store.deleteMessage(data.conversation_id as string, data.message_id as string);
        break;
      case "message.reaction":
        store.updateMessageReaction(data as Parameters<typeof store.updateMessageReaction>[0]);
        break;
      case "typing.start":
        store.setTyping(data.conversation_id as string, data.user_id as string, true);
        setTimeout(() => store.setTyping(data.conversation_id as string, data.user_id as string, false), 3000);
        break;
      case "typing.stop":
        store.setTyping(data.conversation_id as string, data.user_id as string, false);
        break;
      case "user.online":
        store.setUserOnline(data.user_id as string, true);
        break;
      case "user.offline":
        store.setUserOnline(data.user_id as string, false);
        break;
    }
  },
}));
