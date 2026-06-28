"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Conversation, Message, User } from "@/types";
import { useChatStore } from "@/store/chatStore";
import { messagesApi, conversationsApi } from "@/lib/api";
import { MessageBubble } from "./MessageBubble";
import { ChatHeader } from "./ChatHeader";
import { MessageInput } from "./MessageInput";
import { format, isSameDay } from "date-fns";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  conversation: Conversation;
  currentUser: User;
  wsRef: React.MutableRefObject<WebSocket | null>;
  onShowInfo: () => void;
  onBack?: () => void;
  sendWs: (event: string, data: Record<string, unknown>) => void;
}

export function ChatWindow({ conversation, currentUser, onShowInfo, onBack, sendWs }: Props) {
  const { messages, setMessages, addMessage, deleteMessage, updateMessageReaction, typingState } = useChatStore();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const convMessages = messages[conversation.id] || [];

  // Typing users
  const typingMap = typingState[conversation.id] || {};
  const typingUserIds = Object.entries(typingMap)
    .filter(([uid, typing]) => typing && uid !== currentUser.id)
    .map(([uid]) => uid);
  const typingNames = typingUserIds.map((uid) => {
    const member = conversation.members.find((m) => m.user_id === uid);
    return member?.user?.display_name?.split(" ")[0] || "Someone";
  });

  // Load messages
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setHasMore(true);
      try {
        const res = await messagesApi.list(conversation.id);
        setMessages(conversation.id, res.data);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 50);
      } catch {
        toast.error("Failed to load messages");
      } finally {
        setLoading(false);
      }
    };
    load();
    // Mark as read
    conversationsApi.markRead(conversation.id).catch(() => {});
  }, [conversation.id, setMessages]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (convMessages.length === 0) return;
    const last = convMessages[convMessages.length - 1];
    if (last.sender_id === currentUser.id) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      // Only auto-scroll if near bottom
      const el = containerRef.current;
      if (el) {
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distFromBottom < 150) {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  }, [convMessages.length]);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || convMessages.length === 0) return;
    const firstId = convMessages[0]?.id;
    if (!firstId) return;
    setLoadingMore(true);
    try {
      const res = await messagesApi.list(conversation.id, firstId);
      if (res.data.length === 0) {
        setHasMore(false);
      } else {
        const el = containerRef.current;
        const prevScrollHeight = el?.scrollHeight || 0;
        useChatStore.getState().prependMessages(conversation.id, res.data);
        // Maintain scroll position
        setTimeout(() => {
          if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
        }, 50);
      }
    } catch {}
    setLoadingMore(false);
  }, [loadingMore, hasMore, convMessages, conversation.id]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (el && el.scrollTop < 100) loadMore();
  }, [loadMore]);

  const handleSendText = async (text: string, disappearAfter?: number) => {
    try {
      const tempId = `temp-${Date.now()}`;
      const tempMsg: Message = {
        id: tempId,
        conversation_id: conversation.id,
        sender_id: currentUser.id,
        sender: currentUser,
        content: text,
        message_type: "text",
        status: "sending",
        reply_to_id: replyTo?.id,
        reply_to: replyTo || undefined,
        is_deleted: false,
        reactions: [],
        created_at: new Date().toISOString(),
      };
      addMessage(tempMsg);
      setReplyTo(null);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });

      const res = await messagesApi.send(conversation.id, {
        content: text,
        reply_to_id: replyTo?.id,
        disappear_after_seconds: disappearAfter,
      });
      // Replace temp with real
      const store = useChatStore.getState();
      const msgs = (store.messages[conversation.id] || []).filter((m) => m.id !== tempId);
      store.setMessages(conversation.id, [...msgs, res.data]);
    } catch {
      toast.error("Failed to send message");
    }
  };

  const handleSendFile = async (file: File, disappearAfter?: number) => {
    try {
      const res = await messagesApi.sendFile(conversation.id, file, replyTo?.id, disappearAfter);
      setReplyTo(null);
      addMessage(res.data);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch {
      toast.error("Failed to send file");
    }
  };

  const handleDelete = async (msgId: string) => {
    try {
      await messagesApi.delete(conversation.id, msgId);
      deleteMessage(conversation.id, msgId);
    } catch {
      toast.error("Failed to delete message");
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    try {
      await messagesApi.react(conversation.id, msgId, emoji);
      // Optimistic update happens via WebSocket broadcast
    } catch {
      toast.error("Failed to react");
    }
  };

  const handleTypingStart = useCallback(() => {
    sendWs("typing.start", { conversation_id: conversation.id });
  }, [sendWs, conversation.id]);

  const handleTypingStop = useCallback(() => {
    sendWs("typing.stop", { conversation_id: conversation.id });
  }, [sendWs, conversation.id]);

  // Group messages by date
  const grouped = groupByDate(convMessages);

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        conversation={conversation}
        currentUserId={currentUser.id}
        typingUsers={typingNames}
        onShowInfo={onShowInfo}
        onBack={onBack}
      />

      {/* Messages area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{
          background: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23dce3ee' fill-opacity='0.25'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\") #EBF0FA",
        }}
      >
        {/* Load more */}
        {loadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 size={16} className="animate-spin text-signal-secondary" />
          </div>
        )}
        {hasMore && !loadingMore && convMessages.length >= 50 && (
          <button onClick={loadMore} className="w-full text-center text-xs text-signal-teal py-2 hover:underline">
            Load earlier messages
          </button>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 size={24} className="animate-spin text-signal-teal" />
          </div>
        ) : convMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-signal-secondary">
            <div className="text-4xl mb-3">👋</div>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          grouped.map(({ date, msgs }) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-3">
                <span className="bg-white/80 text-signal-secondary text-[11px] font-medium px-3 py-1 rounded-full shadow-sm border border-signal-border">
                  {date}
                </span>
              </div>
              {msgs.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  currentUser={currentUser}
                  isGroup={conversation.type === "group"}
                  onDelete={handleDelete}
                  onReact={handleReact}
                  onReply={setReplyTo}
                />
              ))}
            </div>
          ))
        )}

        {/* Typing indicator */}
        {typingNames.length > 0 && (
          <div className="flex items-end gap-2 mt-1">
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-message flex items-center gap-1.5">
              <span className="typing-dot w-2 h-2 bg-signal-secondary rounded-full inline-block" />
              <span className="typing-dot w-2 h-2 bg-signal-secondary rounded-full inline-block" />
              <span className="typing-dot w-2 h-2 bg-signal-secondary rounded-full inline-block" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <MessageInput
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onSendText={handleSendText}
        onSendFile={handleSendFile}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
      />
    </div>
  );
}

function groupByDate(msgs: Message[]) {
  const map = new Map<string, Message[]>();
  for (const msg of msgs) {
    const d = new Date(msg.created_at);
    const today = new Date();
    let label: string;
    if (isSameDay(d, today)) label = "Today";
    else if (isSameDay(d, new Date(today.setDate(today.getDate() - 1)))) label = "Yesterday";
    else label = format(d, "MMMM d, yyyy");

    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(msg);
  }
  return Array.from(map.entries()).map(([date, msgs]) => ({ date, msgs }));
}
