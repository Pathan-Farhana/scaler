"use client";
import { useState } from "react";
import { Search, X, Check, Users } from "lucide-react";
import { User } from "@/types";
import { usersApi, conversationsApi } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { useChatStore } from "@/store/chatStore";
import toast from "react-hot-toast";

interface Props {
  onClose: () => void;
  onOpenConversation: (id: string) => void;
}

export function NewGroupModal({ onClose, onOpenConversation }: Props) {
  const [step, setStep] = useState<"members" | "name">("members");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const { upsertConversation } = useChatStore();

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (!q.trim()) { setResults([]); return; }
    try {
      const res = await usersApi.search(q);
      setResults(res.data);
    } catch {}
  };

  const toggleSelect = (user: User) => {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) return toast.error("Enter a group name");
    if (selected.length === 0) return toast.error("Select at least one member");
    setLoading(true);
    try {
      const res = await conversationsApi.createGroup({
        name: groupName.trim(),
        description: groupDesc.trim() || undefined,
        member_ids: selected.map((u) => u.id),
      });
      upsertConversation(res.data);
      onOpenConversation(res.data.id);
      onClose();
    } catch {
      toast.error("Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-signal-border">
          <h2 className="font-semibold text-gray-800">
            {step === "members" ? "Add Members" : "New Group"}
          </h2>
          <button onClick={onClose} className="p-1 text-signal-icon hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {step === "members" ? (
          <>
            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pt-3">
                {selected.map((u) => (
                  <span key={u.id} className="flex items-center gap-1.5 bg-signal-teal-light text-signal-teal text-xs px-3 py-1.5 rounded-full font-medium">
                    {u.display_name}
                    <button onClick={() => toggleSelect(u)}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}

            <div className="px-4 py-3">
              <div className="flex items-center gap-2 bg-signal-bg rounded-xl px-3 py-2">
                <Search size={15} className="text-signal-icon" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search contacts"
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-signal-secondary"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto px-2">
              {results.map((user) => {
                const isSelected = selected.some((u) => u.id === user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => toggleSelect(user)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-signal-bg transition-colors"
                  >
                    <Avatar name={user.display_name} src={user.avatar_url} size={40} />
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-[14px] text-gray-800">{user.display_name}</p>
                      <p className="text-[12px] text-signal-secondary">{user.phone_number}</p>
                    </div>
                    {isSelected && <Check size={18} className="text-signal-teal flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="px-4 py-3 border-t border-signal-border">
              <button
                onClick={() => selected.length > 0 && setStep("name")}
                disabled={selected.length === 0}
                className="w-full bg-signal-teal text-white py-2.5 rounded-xl font-medium text-sm hover:bg-signal-teal-dark transition-colors disabled:opacity-40"
              >
                Next ({selected.length} selected)
              </button>
            </div>
          </>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-signal-bg flex items-center justify-center border-2 border-dashed border-signal-border">
                <Users size={32} className="text-signal-icon" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-signal-secondary uppercase tracking-wide">Group Name</label>
              <input
                autoFocus
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="My Group"
                className="mt-1 w-full border border-signal-border rounded-xl px-4 py-3 text-sm focus:border-signal-teal transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-signal-secondary uppercase tracking-wide">Description (optional)</label>
              <input
                type="text"
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                placeholder="What's this group about?"
                className="mt-1 w-full border border-signal-border rounded-xl px-4 py-3 text-sm focus:border-signal-teal transition-colors"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.map((u) => (
                <span key={u.id} className="text-xs bg-signal-bg text-signal-secondary px-2 py-1 rounded-full">
                  {u.display_name}
                </span>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep("members")} className="flex-1 border border-signal-border text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-signal-bg">
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 bg-signal-teal text-white py-2.5 rounded-xl text-sm font-medium hover:bg-signal-teal-dark disabled:opacity-50"
              >
                {loading ? "Creating…" : "Create Group"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
