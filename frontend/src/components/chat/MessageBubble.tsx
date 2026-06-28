"use client";
import { useState, useRef } from "react";
import { Check, CheckCheck, Clock, Trash2, Smile, Reply, MoreVertical } from "lucide-react";
import { Message, User } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { formatDistanceToNow, format } from "date-fns";
import { getMediaUrl } from "@/lib/api";
import Image from "next/image";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface Props {
  message: Message;
  currentUser: User;
  isGroup: boolean;
  onDelete: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onReply: (msg: Message) => void;
}

export function MessageBubble({ message, currentUser, isGroup, onDelete, onReact, onReply }: Props) {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const isMine = message.sender_id === currentUser.id;

  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => setShowActions(true), 100);
  };
  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setTimeout(() => {
      setShowActions(false);
      setShowReactions(false);
    }, 200);
  };

  if (message.is_deleted) {
    return (
      <div className={`flex items-end gap-2 my-0.5 ${isMine ? "flex-row-reverse" : ""}`}>
        {!isMine && isGroup && (
          <div className="w-7 h-7" />
        )}
        <div className={`px-3 py-2 rounded-2xl max-w-xs ${isMine ? "bg-blue-100" : "bg-gray-100"}`}>
          <span className="text-signal-secondary text-[13px] italic">🚫 This message was deleted</span>
        </div>
      </div>
    );
  }

  // Group reaction emojis
  const reactionGroups: Record<string, number> = {};
  for (const r of message.reactions || []) {
    reactionGroups[r.emoji] = (reactionGroups[r.emoji] || 0) + 1;
  }
  const hasMyReactions = (emoji: string) =>
    (message.reactions || []).some((r) => r.user_id === currentUser.id && r.emoji === emoji);

  return (
    <div
      className={`flex items-end gap-2 my-0.5 group ${isMine ? "flex-row-reverse" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Avatar (group only, others) */}
      {!isMine && isGroup && (
        <Avatar
          name={message.sender?.display_name || "?"}
          src={message.sender?.avatar_url}
          size={28}
          className="mb-1 flex-shrink-0"
        />
      )}

      <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[65%]`}>
        {/* Sender name (group) */}
        {!isMine && isGroup && message.sender && (
          <span className="text-[11px] font-semibold text-signal-teal mb-0.5 ml-1">
            {message.sender.display_name}
          </span>
        )}

        {/* Reply preview */}
        {message.reply_to && (
          <div className={`mb-1 px-2 py-1.5 rounded-lg border-l-4 border-signal-teal bg-black/5 max-w-full ${isMine ? "border-white/50" : ""}`}>
            <p className="text-[11px] font-semibold text-signal-teal truncate">
              {message.reply_to.sender?.display_name || "Unknown"}
            </p>
            <p className="text-[12px] text-signal-secondary truncate">
              {message.reply_to.is_deleted ? "Message deleted" : message.reply_to.content || "📎 Attachment"}
            </p>
          </div>
        )}

        {/* Bubble */}
        <div className="relative">
          <div
            className={`relative px-3 py-2 rounded-2xl shadow-message ${
              isMine
                ? "bg-signal-bubble-mine text-white rounded-br-sm"
                : "bg-white text-gray-800 rounded-bl-sm"
            }`}
          >
            {/* Image */}
            {message.message_type === "image" && message.file_url && (
              <div className="mb-1 rounded-xl overflow-hidden max-w-[240px]">
                <Image
                  src={getMediaUrl(message.file_url)}
                  alt="image"
                  width={240}
                  height={200}
                  className="object-cover w-full"
                  style={{ maxHeight: 200 }}
                />
              </div>
            )}

            {/* File */}
            {message.message_type === "file" && message.file_url && (
              <a
                href={getMediaUrl(message.file_url)}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-2 text-[13px] underline ${isMine ? "text-white/90" : "text-signal-teal"}`}
              >
                <span>📎</span>
                <span className="truncate max-w-[180px]">{message.file_name || "File"}</span>
                {message.file_size && (
                  <span className="text-[11px] opacity-70">({formatSize(message.file_size)})</span>
                )}
              </a>
            )}

            {/* Text */}
            {message.content && (
              <p className="text-[14px] leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>
            )}

            {/* Disappears */}
            {message.disappears_at && (
              <div className="flex items-center gap-1 mt-1">
                <Clock size={10} className={isMine ? "text-white/60" : "text-signal-secondary"} />
                <span className={`text-[10px] ${isMine ? "text-white/60" : "text-signal-secondary"}`}>
                  Disappears {formatDistanceToNow(new Date(message.disappears_at), { addSuffix: true })}
                </span>
              </div>
            )}

            {/* Time + status */}
            <div className={`flex items-center justify-end gap-1 mt-0.5 ${isMine ? "" : ""}`}>
              <span className={`text-[11px] ${isMine ? "text-white/70" : "text-signal-secondary"}`}>
                {format(new Date(message.created_at), "h:mm a")}
              </span>
              {isMine && <StatusIcon status={message.status} />}
            </div>
          </div>

          {/* Hover actions */}
          {showActions && (
            <div
              className={`absolute top-0 ${isMine ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"} flex items-center gap-1 z-10`}
            >
              <button
                onClick={() => setShowReactions(!showReactions)}
                className="p-1.5 rounded-full bg-white shadow-md text-signal-icon hover:text-signal-teal transition-colors"
              >
                <Smile size={14} />
              </button>
              <button
                onClick={() => onReply(message)}
                className="p-1.5 rounded-full bg-white shadow-md text-signal-icon hover:text-signal-teal transition-colors"
              >
                <Reply size={14} />
              </button>
              {isMine && (
                <button
                  onClick={() => onDelete(message.id)}
                  className="p-1.5 rounded-full bg-white shadow-md text-signal-icon hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}

          {/* Reaction picker */}
          {showReactions && (
            <div
              className={`absolute z-20 ${isMine ? "right-0" : "left-0"} -top-12 bg-white rounded-full shadow-lg px-2 py-1.5 flex items-center gap-1 border border-signal-border`}
            >
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { onReact(message.id, emoji); setShowReactions(false); }}
                  className={`text-lg hover:scale-125 transition-transform ${hasMyReactions(emoji) ? "opacity-100" : "opacity-80"}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reaction badges */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 ml-1">
            {Object.entries(reactionGroups).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className={`flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  hasMyReactions(emoji)
                    ? "bg-signal-teal-light border-signal-teal text-signal-teal"
                    : "bg-white border-signal-border text-gray-700 hover:border-signal-teal"
                }`}
              >
                <span>{emoji}</span>
                {count > 1 && <span className="font-medium">{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "sending") return <Clock size={12} className="text-white/70" />;
  if (status === "sent") return <Check size={12} className="text-white/70" />;
  if (status === "delivered") return <CheckCheck size={12} className="text-white/70" />;
  if (status === "read") return <CheckCheck size={12} className="text-blue-200" />;
  return null;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
