"use client";
import { useState } from "react";
import { X, UserPlus, UserMinus, Edit2, Shield, Bell, Trash2, Crown } from "lucide-react";
import { Conversation, User } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { conversationsApi, usersApi } from "@/lib/api";
import { useChatStore } from "@/store/chatStore";
import toast from "react-hot-toast";

interface Props {
  conversation: Conversation;
  currentUser: User;
  onClose: () => void;
}

export function ConversationInfo({ conversation, currentUser, onClose }: Props) {
  const { upsertConversation } = useChatStore();
  const [addSearch, setAddSearch] = useState("");
  const [addResults, setAddResults] = useState<User[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const isGroup = conversation.type === "group";
  const myMembership = conversation.members.find((m) => m.user_id === currentUser.id);
  const isAdmin = myMembership?.is_admin || false;
  const otherMember = !isGroup ? conversation.members.find((m) => m.user_id !== currentUser.id) : null;

  const handleAddMemberSearch = async (q: string) => {
    setAddSearch(q);
    if (!q) { setAddResults([]); return; }
    const res = await usersApi.search(q);
    setAddResults(res.data.filter((u: User) => !conversation.members.some((m) => m.user_id === u.id)));
  };

  const handleAddMember = async (userId: string) => {
    try {
      await conversationsApi.addMember(conversation.id, userId);
      const res = await conversationsApi.get(conversation.id);
      upsertConversation(res.data);
      setShowAdd(false);
      setAddSearch("");
      setAddResults([]);
      toast.success("Member added");
    } catch {
      toast.error("Failed to add member");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Remove this member?")) return;
    try {
      await conversationsApi.removeMember(conversation.id, userId);
      const res = await conversationsApi.get(conversation.id);
      upsertConversation(res.data);
      toast.success("Member removed");
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const displayName = isGroup
    ? conversation.name
    : otherMember?.user?.display_name || "Unknown";
  const displayAvatar = isGroup ? conversation.avatar_url : otherMember?.user?.avatar_url;
  const displayAbout = isGroup ? conversation.description : otherMember?.user?.about;

  return (
    <div className="flex flex-col h-full bg-white border-l border-signal-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-signal-border">
        <h3 className="font-semibold text-gray-800">{isGroup ? "Group Info" : "Contact Info"}</h3>
        <button onClick={onClose} className="p-1.5 text-signal-icon hover:text-gray-700 rounded-lg hover:bg-signal-bg">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile section */}
        <div className="flex flex-col items-center py-6 px-4 border-b border-signal-border">
          <Avatar name={displayName || "?"} src={displayAvatar} size={80} />
          <h2 className="mt-3 font-bold text-[17px] text-gray-800">{displayName}</h2>
          {!isGroup && otherMember?.user && (
            <p className="text-[13px] text-signal-secondary mt-0.5">{otherMember.user.phone_number}</p>
          )}
          {isGroup && (
            <p className="text-[13px] text-signal-secondary mt-0.5">
              {conversation.members.length} members
            </p>
          )}
        </div>

        {/* About */}
        {displayAbout && (
          <div className="px-5 py-4 border-b border-signal-border">
            <p className="text-[11px] font-semibold text-signal-teal uppercase tracking-wide mb-1">About</p>
            <p className="text-[13px] text-gray-700">{displayAbout}</p>
          </div>
        )}

        {/* Online status for direct */}
        {!isGroup && otherMember?.user && (
          <div className="px-5 py-4 border-b border-signal-border">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${otherMember.user.is_online ? "bg-green-500" : "bg-gray-400"}`} />
              <span className="text-[13px] text-signal-secondary">
                {otherMember.user.is_online ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        )}

        {/* Group members */}
        {isGroup && (
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold text-signal-teal uppercase tracking-wide mb-2 px-1">
              {conversation.members.length} Members
            </p>
            {conversation.members.map((member) => (
              <div key={member.user_id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-signal-bg transition-colors">
                <Avatar
                  name={member.user?.display_name || "?"}
                  src={member.user?.avatar_url}
                  size={40}
                  online={member.user?.is_online}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-[13px] text-gray-800 truncate">
                      {member.user?.display_name}
                      {member.user_id === currentUser.id && " (You)"}
                    </p>
                    {member.is_admin && <Crown size={12} className="text-yellow-500 flex-shrink-0" />}
                  </div>
                  <p className="text-[11px] text-signal-secondary">{member.is_admin ? "Admin" : "Member"}</p>
                </div>
                {isAdmin && member.user_id !== currentUser.id && (
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    className="p-1.5 text-signal-icon hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                  >
                    <UserMinus size={14} />
                  </button>
                )}
              </div>
            ))}

            {/* Add member */}
            {isAdmin && (
              <div className="mt-2">
                {showAdd ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={addSearch}
                      onChange={(e) => handleAddMemberSearch(e.target.value)}
                      placeholder="Search users to add"
                      autoFocus
                      className="w-full border border-signal-border rounded-xl px-3 py-2 text-sm focus:border-signal-teal"
                    />
                    {addResults.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleAddMember(u.id)}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-signal-bg"
                      >
                        <Avatar name={u.display_name} src={u.avatar_url} size={32} />
                        <span className="text-sm font-medium">{u.display_name}</span>
                      </button>
                    ))}
                    <button onClick={() => setShowAdd(false)} className="text-xs text-signal-secondary hover:underline">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 text-signal-teal text-[13px] font-medium px-2 py-2 hover:bg-signal-bg rounded-xl transition-colors w-full"
                  >
                    <UserPlus size={16} />
                    Add member
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="px-4 py-3 border-t border-signal-border space-y-1">
          <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-signal-bg text-[13px] text-signal-secondary transition-colors">
            <Bell size={16} />
            Mute notifications
          </button>
          <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-red-50 text-[13px] text-red-500 transition-colors">
            <Trash2 size={16} />
            {isGroup ? "Leave group" : "Delete conversation"}
          </button>
        </div>
      </div>
    </div>
  );
}
