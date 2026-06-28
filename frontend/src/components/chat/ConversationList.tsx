"use client";
import { useState, useEffect } from "react";
import { Search, Edit, Settings, Users, Phone, Archive, Star } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { useAuthStore } from "@/store/authStore";
import { conversationsApi } from "@/lib/api";
import { Conversation } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import toast from "react-hot-toast";

interface Props {
  onNewChat: () => void;
  onNewGroup: () => void;
  onSettings: () => void;
  onContacts: () => void;
  onSelectConversation: (id: string) => void;
}

export function ConversationList({ onNewChat, onNewGroup, onSettings, onContacts, onSelectConversation }: Props) {
  const { conversations, setConversations, activeConversationId, setActiveConversation } = useChatStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await conversationsApi.list();
        setConversations(res.data);
      } catch {
        toast.error("Failed to load conversations");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [setConversations]);

  const filtered = conversations.filter((c) => {
    const name = getConvName(c, user?.id || "");
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleSelect = async (conv: Conversation) => {
    setActiveConversation(conv.id);
    onSelectConversation(conv.id);
    try { await conversationsApi.markRead(conv.id); } catch {}
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-signal-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-signal-border">
        <div className="flex items-center gap-2">
          {user && <Avatar name={user.display_name} src={user.avatar_url} size={36} />}
          <span className="font-semibold text-gray-800 text-[15px]">Signal</span>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn icon={<Archive size={18} />} title="Archived" onClick={() => {}} />
          <IconBtn icon={<Edit size={18} />} title="New Chat" onClick={onNewChat} />
          <IconBtn icon={<Users size={18} />} title="Contacts" onClick={onContacts} />
          <IconBtn icon={<Settings size={18} />} title="Settings" onClick={onSettings} />
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 bg-signal-bg rounded-lg px-3 py-2">
          <Search size={15} className="text-signal-icon flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="bg-transparent text-sm w-full text-gray-800 placeholder:text-signal-secondary"
          />
        </div>
      </div>

      {/* Nav pills */}
      <div className="flex gap-1 px-3 pb-2">
        {["All", "Unread", "Groups"].map((tab) => (
          <button key={tab} className="text-xs px-3 py-1 rounded-full bg-signal-bg text-signal-secondary hover:bg-signal-border transition-colors font-medium">
            {tab}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-2 p-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                  <div className="h-2 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-signal-secondary text-sm">
            <Search size={24} className="mb-2 opacity-40" />
            <p>No conversations found</p>
          </div>
        ) : (
          filtered.map((conv) => (
            <ConvItem
              key={conv.id}
              conv={conv}
              currentUserId={user?.id || ""}
              isActive={activeConversationId === conv.id}
              onSelect={() => handleSelect(conv)}
            />
          ))
        )}
      </div>

      {/* Bottom nav */}
      <div className="border-t border-signal-border px-4 py-2 flex items-center justify-around">
        {[
          { icon: <Edit size={16} />, label: "Chats", onClick: onNewChat },
          { icon: <Phone size={16} />, label: "Calls", onClick: () => {} },
          { icon: <Star size={16} />, label: "Stories", onClick: () => {} },
        ].map(({ icon, label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex flex-col items-center gap-0.5 text-signal-secondary hover:text-signal-teal transition-colors py-1"
          >
            {icon}
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConvItem({ conv, currentUserId, isActive, onSelect }: {
  conv: Conversation;
  currentUserId: string;
  isActive: boolean;
  onSelect: () => void;
}) {
  const name = getConvName(conv, currentUserId);
  const otherMember = conv.type === "direct"
    ? conv.members.find((m) => m.user_id !== currentUserId)
    : null;
  const isOnline = otherMember?.user?.is_online || false;
  const avatarSrc = conv.type === "direct" ? otherMember?.user?.avatar_url : conv.avatar_url;

  const lastMsgText = conv.last_message
    ? conv.last_message.is_deleted
      ? "🚫 Message deleted"
      : conv.last_message.message_type === "image"
      ? "📷 Photo"
      : conv.last_message.message_type === "file"
      ? `📎 ${conv.last_message.file_name || "File"}`
      : conv.last_message.content || ""
    : "";

  const timeStr = conv.last_message
    ? formatTime(conv.last_message.created_at)
    : formatTime(conv.updated_at);

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-3 py-3 conversation-item text-left ${isActive ? "active" : ""}`}
    >
      <Avatar
        name={name}
        src={avatarSrc}
        size={48}
        online={conv.type === "direct" ? isOnline : undefined}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[14px] text-gray-800 truncate">{name}</span>
          <span className="text-[11px] text-signal-secondary flex-shrink-0 ml-2">{timeStr}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[13px] text-signal-secondary truncate max-w-[160px]">{lastMsgText}</p>
          {conv.unread_count > 0 && (
            <span className="bg-signal-unread text-white text-[11px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0 ml-2 unread-pulse">
              {conv.unread_count > 99 ? "99+" : conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function IconBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-2 rounded-lg text-signal-icon hover:bg-signal-bg hover:text-signal-teal transition-colors"
    >
      {icon}
    </button>
  );
}

function getConvName(conv: Conversation, currentUserId: string): string {
  if (conv.name) return conv.name;
  if (conv.type === "direct") {
    const other = conv.members.find((m) => m.user_id !== currentUserId);
    return other?.user?.display_name || "Unknown";
  }
  return "Group Chat";
}

function formatTime(dateStr: string) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
