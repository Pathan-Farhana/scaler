"use client";
import { useState, useEffect, useCallback } from "react";
import {
  X, Search, UserPlus, MessageCircle, Trash2,
  Phone, ChevronRight, Users, Check, Loader2,
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

type Tab = "all" | "add";

export function ContactsModal({ onClose, onOpenConversation }: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add-contact form state
  const [addPhone, setAddPhone] = useState("");
  const [addNickname, setAddNickname] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  const { upsertConversation } = useChatStore();

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.getContacts();
      setContacts(res.data);
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  // Live-search users while typing in Add tab
  const handleAddPhoneChange = async (val: string) => {
    setAddPhone(val);
    if (val.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await usersApi.search(val.trim());
      setSearchResults(res.data);
    } catch {}
    setSearching(false);
  };

  const handleAddContact = async (phone?: string, nickname?: string) => {
    const targetPhone = phone ?? addPhone.trim();
    if (!targetPhone) return toast.error("Enter a phone number");
    setAddLoading(true);
    try {
      const res = await usersApi.addContact(targetPhone, nickname ?? addNickname.trim() || undefined);
      setContacts((prev) => [...prev, res.data]);
      setAddPhone("");
      setAddNickname("");
      setSearchResults([]);
      setTab("all");
      toast.success(`${res.data.contact_user.display_name} added to contacts!`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to add contact";
      toast.error(msg);
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemove = async (contactId: string, name: string) => {
    if (!confirm(`Remove ${name} from contacts?`)) return;
    try {
      await usersApi.removeContact(contactId);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      toast.success("Contact removed");
    } catch {
      toast.error("Failed to remove contact");
    }
  };

  const handleMessage = async (userId: string) => {
    try {
      const res = await conversationsApi.createDirect(userId);
      upsertConversation(res.data);
      onOpenConversation(res.data.id);
      onClose();
    } catch {
      toast.error("Failed to open conversation");
    }
  };

  const filtered = contacts.filter((c) => {
    const name = c.nickname || c.contact_user.display_name;
    const phone = c.contact_user.phone_number;
    const q = search.toLowerCase();
    return name.toLowerCase().includes(q) || phone.includes(q);
  });

  // Alphabetical grouping
  const grouped = filtered.reduce<Record<string, Contact[]>>((acc, c) => {
    const name = c.nickname || c.contact_user.display_name;
    const letter = name[0]?.toUpperCase() || "#";
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(c);
    return acc;
  }, {});
  const sortedKeys = Object.keys(grouped).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden" style={{ maxHeight: "85vh" }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-signal-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-signal-teal" />
            <h2 className="font-semibold text-gray-800 text-[16px]">Contacts</h2>
            {contacts.length > 0 && (
              <span className="text-xs bg-signal-bg text-signal-secondary px-2 py-0.5 rounded-full font-medium">
                {contacts.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-signal-icon hover:text-gray-700 rounded-lg hover:bg-signal-bg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-signal-border flex-shrink-0">
          {([["all", "All Contacts"], ["add", "Add Contact"]] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                tab === t ? "text-signal-teal" : "text-signal-secondary hover:text-gray-700"
              }`}
            >
              {label}
              {tab === t && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-signal-teal rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── All Contacts Tab ── */}
        {tab === "all" && (
          <>
            {/* Search bar */}
            <div className="px-4 py-3 flex-shrink-0">
              <div className="flex items-center gap-2 bg-signal-bg rounded-xl px-3 py-2">
                <Search size={15} className="text-signal-icon flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts"
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-signal-secondary"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-signal-icon hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Contact list */}
            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 size={24} className="animate-spin text-signal-teal" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-signal-bg flex items-center justify-center">
                    <Users size={28} className="text-signal-icon" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">No contacts yet</p>
                    <p className="text-sm text-signal-secondary mt-1">
                      Add people by their phone number to start messaging.
                    </p>
                  </div>
                  <button
                    onClick={() => setTab("add")}
                    className="mt-2 flex items-center gap-2 bg-signal-teal text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-signal-teal-dark transition-colors"
                  >
                    <UserPlus size={16} />
                    Add your first contact
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-signal-secondary gap-2">
                  <Search size={24} className="opacity-30" />
                  <p className="text-sm">No contacts match &ldquo;{search}&rdquo;</p>
                </div>
              ) : (
                sortedKeys.map((letter) => (
                  <div key={letter}>
                    {/* Letter divider */}
                    <div className="px-3 py-1.5 sticky top-0 bg-white/80 backdrop-blur-sm">
                      <span className="text-[11px] font-bold text-signal-teal uppercase tracking-widest">
                        {letter}
                      </span>
                    </div>
                    {grouped[letter].map((contact) => (
                      <ContactRow
                        key={contact.id}
                        contact={contact}
                        onMessage={() => handleMessage(contact.contact_user.id)}
                        onRemove={() => handleRemove(contact.id, contact.nickname || contact.contact_user.display_name)}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Add button footer */}
            {contacts.length > 0 && (
              <div className="px-4 py-3 border-t border-signal-border flex-shrink-0">
                <button
                  onClick={() => setTab("add")}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-signal-teal text-signal-teal text-sm font-medium hover:bg-signal-teal-light transition-colors"
                >
                  <UserPlus size={16} />
                  Add New Contact
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Add Contact Tab ── */}
        {tab === "add" && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-5 space-y-4">
              {/* Instructions */}
              <div className="bg-signal-teal-light rounded-xl px-4 py-3">
                <p className="text-[13px] text-signal-teal font-medium">
                  Enter a phone number to find and add a user on Signal.
                </p>
              </div>

              {/* Phone input */}
              <div>
                <label className="text-xs font-semibold text-signal-secondary uppercase tracking-wide block mb-1.5">
                  Phone Number *
                </label>
                <div className="flex items-center gap-2 border border-signal-border rounded-xl px-3 py-3 focus-within:border-signal-teal transition-colors">
                  <Phone size={16} className="text-signal-icon flex-shrink-0" />
                  <input
                    autoFocus
                    type="tel"
                    value={addPhone}
                    onChange={(e) => handleAddPhoneChange(e.target.value)}
                    placeholder="+1 234 567 8900"
                    className="flex-1 text-sm text-gray-800 placeholder:text-signal-secondary bg-transparent"
                  />
                  {searching && <Loader2 size={14} className="animate-spin text-signal-icon" />}
                </div>
              </div>

              {/* Nickname input */}
              <div>
                <label className="text-xs font-semibold text-signal-secondary uppercase tracking-wide block mb-1.5">
                  Nickname (optional)
                </label>
                <input
                  type="text"
                  value={addNickname}
                  onChange={(e) => setAddNickname(e.target.value)}
                  placeholder="e.g. Work Alice"
                  className="w-full border border-signal-border rounded-xl px-4 py-3 text-sm focus:border-signal-teal transition-colors"
                />
              </div>

              {/* Live search results */}
              {searchResults.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-signal-secondary uppercase tracking-wide mb-2">
                    Matching Users
                  </p>
                  <div className="border border-signal-border rounded-xl overflow-hidden divide-y divide-signal-border">
                    {searchResults.map((user) => {
                      const alreadyAdded = contacts.some((c) => c.contact_user.id === user.id);
                      return (
                        <div key={user.id} className="flex items-center gap-3 px-3 py-3 bg-white hover:bg-signal-bg transition-colors">
                          <Avatar name={user.display_name} src={user.avatar_url} size={40} online={user.is_online} />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[13px] text-gray-800 truncate">{user.display_name}</p>
                            <p className="text-[11px] text-signal-secondary">{user.phone_number}</p>
                          </div>
                          {alreadyAdded ? (
                            <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">
                              <Check size={11} /> Added
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddContact(user.phone_number, addNickname || undefined)}
                              disabled={addLoading}
                              className="flex items-center gap-1 text-[12px] text-signal-teal font-semibold bg-signal-teal-light px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
                            >
                              <UserPlus size={13} />
                              Add
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Manual add button */}
              <button
                onClick={() => handleAddContact()}
                disabled={addLoading || !addPhone.trim()}
                className="w-full bg-signal-teal text-white py-3 rounded-xl font-medium text-sm hover:bg-signal-teal-dark transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {addLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> Adding…</>
                ) : (
                  <><UserPlus size={16} /> Add Contact</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single contact row ────────────────────────────────────────────────────────

function ContactRow({
  contact,
  onMessage,
  onRemove,
}: {
  contact: Contact;
  onMessage: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const user = contact.contact_user;
  const displayName = contact.nickname || user.display_name;

  return (
    <div className="rounded-xl overflow-hidden mb-0.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-signal-bg transition-colors text-left"
      >
        <Avatar name={displayName} src={user.avatar_url} size={44} online={user.is_online} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[14px] text-gray-800 truncate">{displayName}</p>
          {contact.nickname && (
            <p className="text-[11px] text-signal-secondary truncate">{user.display_name}</p>
          )}
          <p className="text-[11px] text-signal-secondary truncate">{user.phone_number}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${user.is_online ? "bg-green-400" : "bg-gray-300"}`} />
          <ChevronRight
            size={16}
            className={`text-signal-icon transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </div>
      </button>

      {/* Expanded actions */}
      {expanded && (
        <div className="flex items-center gap-2 px-4 pb-3 pt-1 bg-signal-bg rounded-b-xl">
          <button
            onClick={onMessage}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-signal-teal text-white text-[13px] font-medium hover:bg-signal-teal-dark transition-colors"
          >
            <MessageCircle size={15} />
            Message
          </button>
          <a
            href={`tel:${user.phone_number}`}
            className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-signal-border bg-white text-[13px] font-medium text-gray-700 hover:bg-signal-bg transition-colors"
          >
            <Phone size={15} />
            Call
          </a>
          <button
            onClick={onRemove}
            className="p-2 rounded-xl border border-red-100 text-red-400 hover:bg-red-50 transition-colors"
            title="Remove contact"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
