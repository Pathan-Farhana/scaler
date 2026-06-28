"use client";
import { useState, useRef } from "react";
import { X, Camera, User, Bell, Lock, Monitor, Link, HelpCircle, LogOut, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { usersApi } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface Props {
  onClose: () => void;
}

const SETTING_SECTIONS = [
  { icon: <User size={18} />, label: "Account", sub: "Privacy, security, change number", comingSoon: true },
  { icon: <Bell size={18} />, label: "Notifications", sub: "Message, group and call tones", comingSoon: true },
  { icon: <Lock size={18} />, label: "Privacy", sub: "Block contacts, disappearing messages", comingSoon: true },
  { icon: <Monitor size={18} />, label: "Appearance", sub: "Theme, wallpaper, chat size", comingSoon: true },
  { icon: <Link size={18} />, label: "Linked Devices", sub: "Link a phone, iPad or computer", comingSoon: true },
  { icon: <HelpCircle size={18} />, label: "Help", sub: "FAQ, contact us, privacy policy", comingSoon: true },
];

export function Settings({ onClose }: Props) {
  const { user, updateUser, logout } = useAuthStore();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.display_name || "");
  const [about, setAbout] = useState(user?.about || "");
  const [editing, setEditing] = useState<"name" | "about" | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (field: "name" | "about") => {
    setSaving(true);
    try {
      const res = await usersApi.updateMe(
        field === "name" ? { display_name: name } : { about }
      );
      updateUser(res.data);
      setEditing(null);
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await usersApi.uploadAvatar(file);
      updateUser(res.data);
      toast.success("Avatar updated");
    } catch {
      toast.error("Failed to upload avatar");
    }
    e.target.value = "";
  };

  const handleLogout = () => {
    logout();
    router.replace("/auth");
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-full bg-white border-r border-signal-border">
      <div className="flex items-center justify-between px-4 py-3 border-b border-signal-border">
        <h2 className="font-semibold text-gray-800">Settings</h2>
        <button onClick={onClose} className="p-1.5 text-signal-icon hover:text-gray-700 rounded-lg hover:bg-signal-bg">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile card */}
        <div className="p-5 border-b border-signal-border">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar name={user.display_name} src={user.avatar_url} size={64} />
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-6 h-6 bg-signal-teal rounded-full flex items-center justify-center shadow"
              >
                <Camera size={12} className="text-white" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div className="flex-1 min-w-0">
              {editing === "name" ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 border border-signal-border rounded-lg px-2 py-1 text-sm focus:border-signal-teal"
                  />
                  <button
                    onClick={() => handleSave("name")}
                    disabled={saving}
                    className="text-xs text-signal-teal font-semibold"
                  >
                    {saving ? "…" : "Save"}
                  </button>
                  <button onClick={() => setEditing(null)} className="text-xs text-signal-secondary">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setEditing("name")} className="flex items-center gap-1 group">
                  <span className="font-bold text-[16px] text-gray-800">{user.display_name}</span>
                  <span className="text-signal-icon opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                </button>
              )}
              <p className="text-[13px] text-signal-secondary mt-0.5">{user.phone_number}</p>
            </div>
          </div>

          {/* About */}
          <div className="mt-3">
            {editing === "about" ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  className="flex-1 border border-signal-border rounded-lg px-2 py-1 text-sm focus:border-signal-teal"
                />
                <button onClick={() => handleSave("about")} disabled={saving} className="text-xs text-signal-teal font-semibold">
                  {saving ? "…" : "Save"}
                </button>
                <button onClick={() => setEditing(null)} className="text-xs text-signal-secondary">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setEditing("about")} className="flex items-center gap-1 group w-full text-left">
                <span className="text-[13px] text-signal-secondary italic">{user.about || "Tap to set about"}</span>
                <span className="text-signal-icon opacity-0 group-hover:opacity-100 transition-opacity text-xs">✏️</span>
              </button>
            )}
          </div>
        </div>

        {/* Settings sections */}
        <div className="py-2">
          {SETTING_SECTIONS.map(({ icon, label, sub, comingSoon }) => (
            <button
              key={label}
              onClick={() => comingSoon && toast("Coming soon!", { icon: "🚧" })}
              className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-signal-bg transition-colors"
            >
              <span className="text-signal-icon">{icon}</span>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-800">{label}</p>
                <p className="text-[12px] text-signal-secondary">{sub}</p>
              </div>
              <ChevronRight size={16} className="text-signal-icon" />
            </button>
          ))}
        </div>

        {/* App info */}
        <div className="px-5 py-4 border-t border-signal-border text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-signal-teal flex items-center justify-center">
              <svg viewBox="0 0 56 56" className="w-4 h-4 fill-white">
                <path d="M28 4C14.745 4 4 14.745 4 28s10.745 24 24 24 24-10.745 24-24S41.255 4 28 4z"/>
              </svg>
            </div>
            <span className="font-semibold text-gray-700">Signal Clone</span>
          </div>
          <p className="text-[11px] text-signal-secondary">v1.0.0 · Built with Next.js + FastAPI</p>
        </div>

        {/* Logout */}
        <div className="px-4 pb-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors font-medium text-[14px]"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
