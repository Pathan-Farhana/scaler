"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Paperclip, Smile, X, Clock } from "lucide-react";
import { Message } from "@/types";

const EMOJIS = ["😀","😂","😍","🥰","😎","🤔","👍","❤️","🎉","🔥","✅","💯","🙏","😢","😮","🤣","💪","🌟","😊","🤩"];
const DISAPPEAR_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "5s", value: 5 },
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
  { label: "1h", value: 3600 },
  { label: "1d", value: 86400 },
];

interface Props {
  replyTo: Message | null;
  onClearReply: () => void;
  onSendText: (text: string, disappearAfter?: number) => void;
  onSendFile: (file: File, disappearAfter?: number) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
}

export function MessageInput({ replyTo, onClearReply, onSendText, onSendFile, onTypingStart, onTypingStop }: Props) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showDisappear, setShowDisappear] = useState(false);
  const [disappearAfter, setDisappearAfter] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTyping = useCallback(() => {
    onTypingStart();
    if (typingRef.current) clearTimeout(typingRef.current);
    typingRef.current = setTimeout(onTypingStop, 2000);
  }, [onTypingStart, onTypingStop]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    handleTyping();
    // Auto-resize
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed, disappearAfter || undefined);
    setText("");
    onTypingStop();
    if (typingRef.current) clearTimeout(typingRef.current);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendFile(file, disappearAfter || undefined);
      e.target.value = "";
    }
  };

  const addEmoji = (emoji: string) => {
    setText((t) => t + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  useEffect(() => {
    return () => { if (typingRef.current) clearTimeout(typingRef.current); };
  }, []);

  const currentDisappear = DISAPPEAR_OPTIONS.find((o) => o.value === disappearAfter);

  return (
    <div className="bg-white border-t border-signal-border px-3 py-2">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-signal-bg rounded-lg border-l-4 border-signal-teal">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-signal-teal">
              Replying to {replyTo.sender?.display_name || "Unknown"}
            </p>
            <p className="text-[12px] text-signal-secondary truncate">
              {replyTo.is_deleted ? "Message deleted" : replyTo.content || "📎 Attachment"}
            </p>
          </div>
          <button onClick={onClearReply} className="text-signal-icon hover:text-red-500 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Emoji */}
        <div className="relative">
          <button
            onClick={() => { setShowEmoji(!showEmoji); setShowDisappear(false); }}
            className="p-2 text-signal-icon hover:text-signal-teal transition-colors"
          >
            <Smile size={22} />
          </button>
          {showEmoji && (
            <div className="absolute bottom-12 left-0 bg-white rounded-xl shadow-xl border border-signal-border p-3 z-20 w-64">
              <div className="grid grid-cols-5 gap-1">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => addEmoji(e)} className="text-xl hover:bg-signal-bg rounded-lg p-1.5 transition-colors">
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* File attach */}
        <button
          onClick={() => fileRef.current?.click()}
          className="p-2 text-signal-icon hover:text-signal-teal transition-colors"
        >
          <Paperclip size={22} />
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} accept="image/*,video/*,application/pdf,.doc,.docx,.txt" />

        {/* Disappear timer */}
        <div className="relative">
          <button
            onClick={() => { setShowDisappear(!showDisappear); setShowEmoji(false); }}
            className={`p-2 transition-colors ${disappearAfter > 0 ? "text-signal-teal" : "text-signal-icon hover:text-signal-teal"}`}
            title="Disappearing messages"
          >
            <Clock size={20} />
          </button>
          {disappearAfter > 0 && (
            <span className="absolute -top-1 -right-1 text-[9px] bg-signal-teal text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {currentDisappear?.label}
            </span>
          )}
          {showDisappear && (
            <div className="absolute bottom-12 left-0 bg-white rounded-xl shadow-xl border border-signal-border p-3 z-20 min-w-[160px]">
              <p className="text-[11px] font-semibold text-signal-secondary mb-2 uppercase tracking-wide">Disappear after</p>
              {DISAPPEAR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setDisappearAfter(opt.value); setShowDisappear(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-signal-bg transition-colors ${
                    disappearAfter === opt.value ? "text-signal-teal font-semibold" : "text-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text area */}
        <div className="flex-1 bg-signal-bg rounded-2xl px-4 py-2 flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Message"
            rows={1}
            className="flex-1 bg-transparent text-[14px] text-gray-800 placeholder:text-signal-secondary resize-none msg-input max-h-[120px] leading-relaxed"
          />
        </div>

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className={`p-2.5 rounded-full transition-all ${
            text.trim()
              ? "bg-signal-teal text-white hover:bg-signal-teal-dark shadow-sm"
              : "bg-signal-bg text-signal-icon"
          }`}
        >
          <Send size={18} />
        </button>
      </div>

      {/* Close popups on outside click */}
      {(showEmoji || showDisappear) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => { setShowEmoji(false); setShowDisappear(false); }}
        />
      )}
    </div>
  );
}
