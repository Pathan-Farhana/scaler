"use client";
import { useState, useEffect, useCallback } from "react";
import {
  X, UserPlus, Search, MessageCircle, Phone, Trash2,
  ChevronRight, CheckCircle2, AlertCircle, Loader2, Users
} from "lucide-react";
import { Contact, User } from "@/types";
import { usersApi, conversationsApi } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { useChatStore } from "@/store/chatStore";
import toast from "react-hot-toast";

interface Props {
  onClose: () => void;
  onOpenConversation: (id: string) => void;
}

type View = "list" | "add";

export function ContactsModal({ onClose, onOpenConversation }: Props) {
  const [view, setView] = useState<View>("list");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);

  // Add contact state
  const [addPhone, setAddPhone] = useState("");
  const [addNickname, setAddNickname] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addResult, setAddResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [previewUser, setPreviewUser] = useState<User | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const { upsertConversation } = useChatStore();

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const res = await usersApi.getContacts();
      setContacts(res.data);
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  // Live lookup as user types phone number
  useEffect(() => {
    if (addPhone.length < 7) { setPreviewUser(null); return; }
    const timer = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const res = await usersApi.search(addPhone);
        const match = (res.data as User[]).find((u) => u.phone_number === addPhone);
        setPreviewUser(match || null);
      } catch {
        setPreviewUser(null);
      } finally {
        setLookupLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [addPhone]);

  const resetAdd = () => {
    setAddPhone(""); setAddNickname(""); setAddResult(null); setPreviewUser(null);
  };

  const handleAddContact = async () => {
    if (!addPhone.trim()) { setAddResult({ type: "error", message: "Enter a phone number" }); return; }
    setAddLoading(true);
    setAddResult(null);
    try {
      await usersApi.addContact(addPhone.trim(), addNickname.trim() || undefined);
      setAddResult({ type: "success", message: "Contact added successfully!" });
      await loadContacts();
      setTimeout(() => { resetAdd(); setView("list"); }, 1200);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAddResult({ type: "error", message: detail || "Failed to add contact" });
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveContact = async (contact: Contact) => {
    if (!confirm(`Remove ${contact.nickname || contact.contact_user.display_name} from contacts?`)) return;
    try {
      await usersApi.removeContact(contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      toast.success("Contact removed");
    } catch {
      toast.error("Failed to remove contact");
    }
  };

  const handleMessage = async (contact: Contact) => {
    try {
      const res = await conversationsApi.createDirect(contact.contact_user.id);
      upsertConversation(res.data);
      onOpenConversation(res.data.id);
      onClose();
    } catch {
      toast.error("Failed to open conversation");
    }
  };

  const filtered = contacts.filter((c) => {
    const name = (c.nickname || c.contact_user.display_name).toLowerCase();
    const phone = c.contact_user.phone_number.toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || phone.includes(q);
  });

  // Group by first letter
  const grouped = filtered.reduce<Record<string, Contact[]>>((acc, c) => {
    const key = (c.nickname || c.contact_user.display_name)[0].toUpperCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});
  const sortedLetters = Object.keys(grouped).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col max-h-[85vh]">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-signal-border flex-shrink-0">
          <div className="flex items-center gap-2">
            {view === "add" && (
              <button
                onClick={() => { setView("list"); resetAdd(); }}
                className="p-1 text-signal-icon hover:text-gray-700 -ml-1"
              >
                <ChevronRight size={18} className="rotate-180" />
              </button>
            )}
            <h2 className="font-semibold text-gray-800">
              {view === "list" ? "Contacts" : "Add Contact"}
            </h2>
            {view === "list" && contacts.length > 0 && (
              <span className="text-xs bg-signal-bg text-signal-secondary px-2 py-0.5 rounded-full font-medium">
                {contacts.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {view === "list" && (
              <button
                onClick={() => setView("add")}
                className="flex items-center gap-1.5 text-sm font-medium text-signal-teal hover:bg-signal-teal-light px-3 py-1.5 rounded-lg transition-colors"
              >
                <UserPlus size={15} />
                Add
              </button>
            )}
            <button onClick={onClose} className="p-1 text-signal-icon hover:text-gray-700">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <>
            <div className="px-4 py-3 border-b border-signal-border flex-shrink-0">
              <div className="flex items-center gap-2 bg-signal-bg rounded-xl px-3 py-2">
                <Search size={15} className="text-signal-icon flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts"
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-signal-secondary"
                  autoFocus
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-signal-icon hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingContacts ? (
                <div className="flex flex-col gap-2 p-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse px-2 py-2">
                      <div className="w-11 h-11 rounded-full bg-gray-200 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-2/5" />
                        <div className="h-2 bg-gray-100 rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-signal-bg flex items-center justify-center mb-3">
                    <Users size={28} className="text-signal-icon" />
                  </div>
                  {search ? (
                    <>
                      <p className="font-semibold text-gray-700 text-sm">No results for &quot;{search}&quot;</p>
                      <p className="text-signal-secondary text-xs mt-1">Try a different name or number</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-gray-700 text-sm">No contacts yet</p>
                      <p className="text-signal-secondary text-xs mt-1">Add contacts to start messaging</p>
                      <button
                        onClick={() => setView("add")}
                        className="mt-4 flex items-center gap-2 bg-signal-teal text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-signal-teal-dark transition-colors"
                      >
                        <UserPlus size={15} />
                        Add your first contact
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="pb-3">
                  {sortedLetters.map((letter) => (
                    <div key={letter}>
                      <div className="px-5 py-1.5 bg-signal-bg/60">
                        <span className="text-[11px] font-bold text-signal-teal uppercase tracking-wider">{letter}</span>
                      </div>
                      {grouped[letter].map((contact) => (
                        <ContactRow
                          key={contact.id}
                          contact={contact}
                          onMessage={() => handleMessage(contact)}
                          onRemove={() => handleRemoveContact(contact)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── ADD CONTACT VIEW ── */}
        {view === "add" && (
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

            {/* Phone */}
            <div>
              <label className="text-xs font-semibold text-signal-secondary uppercase tracking-wide block mb-1.5">
                Phone Number <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={addPhone}
                  onChange={(e) => { setAddPhone(e.target.value); setAddResult(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleAddContact()}
                  placeholder="+1 234 567 8900"
                  autoFocus
                  className="w-full border border-signal-border rounded-xl px-4 py-3 text-sm focus:border-signal-teal transition-colors pr-10"
                />
                {lookupLoading && (
                  <Loader2 size={15} className="absolute right-3 top-3.5 animate-spin text-signal-secondary" />
                )}
              </div>
              <p className="text-[11px] text-signal-secondary mt-1">
                Full number with country code, e.g. +1234567890
              </p>
            </div>

            {/* Nickname */}
            <div>
              <label className="text-xs font-semibold text-signal-secondary uppercase tracking-wide block mb-1.5">
                Nickname <span className="font-normal text-signal-secondary">(optional)</span>
              </label>
              <input
                type="text"
                value={addNickname}
                onChange={(e) => setAddNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddContact()}
                placeholder="How you know them"
                className="w-full border border-signal-border rounded-xl px-4 py-3 text-sm focus:border-signal-teal transition-colors"
              />
            </div>

            {/* Preview card — user found */}
            {previewUser && !addResult && (
              <div className="flex items-center gap-3 bg-signal-teal-light border border-signal-teal/20 rounded-xl px-4 py-3">
                <Avatar name={previewUser.display_name} src={previewUser.avatar_url} size={44} online={previewUser.is_online} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[14px] text-gray-800">{previewUser.display_name}</p>
                  <p className="text-[12px] text-signal-secondary">{previewUser.phone_number}</p>
                  {previewUser.about && (
                    <p className="text-[11px] text-signal-secondary truncate mt-0.5 italic">{previewUser.about}</p>
                  )}
                </div>
                <CheckCircle2 size={18} className="text-signal-teal flex-shrink-0" />
              </div>
            )}

            {/* No user found hint */}
            {addPhone.length >= 7 && !lookupLoading && !previewUser && !addResult && (
              <div className="flex items-start gap-2 text-[12px] text-signal-secondary bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <AlertCircle size={14} className="flex-shrink-0 text-amber-500 mt-0.5" />
                No Signal user found with this number — you can still save them as a contact.
              </div>
            )}

            {/* Result banner */}
            {addResult && (
              <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${
                addResult.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`}>
                {addResult.type === "success"
                  ? <CheckCircle2 size={16} className="flex-shrink-0" />
                  : <AlertCircle size={16} className="flex-shrink-0" />}
                {addResult.message}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setView("list"); resetAdd(); }}
                className="flex-1 border border-signal-border text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-signal-bg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddContact}
                disabled={addLoading || !addPhone.trim()}
                className="flex-1 bg-signal-teal text-white py-3 rounded-xl text-sm font-medium hover:bg-signal-teal-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addLoading
                  ? <><Loader2 size={15} className="animate-spin" /> Adding…</>
                  : <><UserPlus size={15} /> Add Contact</>}
              </button>
            </div>

            {/* Demo hint */}
            <div className="bg-signal-bg rounded-xl px-4 py-3">
              <p className="text-[11px] font-semibold text-signal-secondary uppercase tracking-wide mb-2">Tap a demo number</p>
              <div className="space-y-0.5">
                {[
                  ["+1234567890", "Alice Johnson"],
                  ["+1234567891", "Bob Smith"],
                  ["+1234567892", "Carol White"],
                  ["+1234567893", "David Brown"],
                  ["+1234567894", "Eva Martinez"],
                  ["+1234567895", "Frank Lee"],
                  ["+1234567896", "Grace Kim"],
                ].map(([num, name]) => (
                  <button
                    key={num}
                    onClick={() => { setAddPhone(num); setAddResult(null); }}
                    className={`w-full flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-white transition-colors text-left ${addPhone === num ? "bg-white ring-1 ring-signal-teal" : ""}`}
                  >
                    <span className="text-[12px] font-medium text-gray-700">{name}</span>
                    <span className="text-[11px] text-signal-secondary font-mono">{num}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ContactRow({ contact, onMessage, onRemove }: {
  contact: Contact;
  onMessage: () => void;
  onRemove: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const displayName = contact.nickname || contact.contact_user.display_name;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-signal-bg transition-colors"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <Avatar
        name={displayName}
        src={contact.contact_user.avatar_url}
        size={44}
        online={contact.contact_user.is_online}
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[14px] text-gray-800 truncate">{displayName}</p>
        <div className="flex items-center gap-1.5 min-w-0">
          {contact.nickname && (
            <>
              <span className="text-[11px] text-signal-teal font-medium truncate">
                {contact.contact_user.display_name}
              </span>
              <span className="text-signal-border text-[11px]">·</span>
            </>
          )}
          <span className="text-[12px] text-signal-secondary truncate">
            {contact.contact_user.phone_number}
          </span>
        </div>
      </div>

      {/* Hover actions */}
      <div className={`flex items-center gap-1 transition-opacity flex-shrink-0 ${showActions ? "opacity-100" : "opacity-0"}`}>
        <button
          onClick={onMessage}
          title="Send message"
          className="p-2 rounded-lg text-signal-icon hover:text-signal-teal hover:bg-signal-teal-light transition-colors"
        >
          <MessageCircle size={16} />
        </button>
        <button
          onClick={() => toast("Calls coming soon!", { icon: "📞" })}
          title="Voice call"
          className="p-2 rounded-lg text-signal-icon hover:text-signal-teal hover:bg-signal-teal-light transition-colors"
        >
          <Phone size={16} />
        </button>
        <button
          onClick={onRemove}
          title="Remove contact"
          className="p-2 rounded-lg text-signal-icon hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
