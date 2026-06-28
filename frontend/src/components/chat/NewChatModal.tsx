"use client";
import { useState } from "react";
import { Search, X, UserPlus } from "lucide-react";
import { User } from "@/types";
import { usersApi, conversationsApi } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { useChatStore } from "@/store/chatStore";
import toast from "react-hot-toast";

interface Props {
  onClose: () => void;
  onOpenConversation: (id: string) => void;
}

export function NewChatModal({ onClose, onOpenConversation }: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const { upsertConversation } = useChatStore();

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await usersApi.search(q);
      setResults(res.data);
    } catch {}
    setLoading(false);
  };

  const handleSelect = async (user: User) => {
    try {
      const res = await conversationsApi.createDirect(user.id);
      upsertConversation(res.data);
      onOpenConversation(res.data.id);
      onClose();
    } catch {
      toast.error("Failed to open conversation");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-signal-border">
          <h2 className="font-semibold text-gray-800">New Message</h2>
          <button onClick={onClose} className="p-1 text-signal-icon hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-2 bg-signal-bg rounded-xl px-3 py-2">
            <Search size={15} className="text-signal-icon" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or phone number"
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-signal-secondary"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto px-2 pb-3">
          {loading ? (
            <div className="flex justify-center py-6 text-signal-secondary text-sm">Searching…</div>
          ) : results.length === 0 && search ? (
            <div className="flex flex-col items-center py-8 text-signal-secondary gap-2">
              <UserPlus size={32} className="opacity-30" />
              <p className="text-sm">No users found</p>
              <p className="text-xs">Try a different phone number or name</p>
            </div>
          ) : (
            results.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelect(user)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-signal-bg transition-colors text-left"
              >
                <Avatar name={user.display_name} src={user.avatar_url} size={44} online={user.is_online} />
                <div>
                  <p className="font-semibold text-[14px] text-gray-800">{user.display_name}</p>
                  <p className="text-[12px] text-signal-secondary">{user.phone_number}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
