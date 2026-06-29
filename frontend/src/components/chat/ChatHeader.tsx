// "use client";
// import { Phone, Video, Search, MoreVertical, Users, ArrowLeft, Info } from "lucide-react";
// import { Conversation, User } from "@/types";
// import { Avatar } from "@/components/ui/Avatar";
// import { formatDistanceToNow } from "date-fns";

// interface Props {
//   conversation: Conversation;
//   currentUserId: string;
//   typingUsers: string[];
//   onShowInfo: () => void;
//   onBack?: () => void;
// }

// export function ChatHeader({ conversation, currentUserId, typingUsers, onShowInfo, onBack }: Props) {
//   const isGroup = conversation.type === "group";
//   const otherMember = !isGroup
//     ? conversation.members.find((m) => m.user_id !== currentUserId)
//     : null;

//   const name = isGroup
//     ? conversation.name || "Group"
//     : otherMember?.user?.display_name || "Unknown";

//   const avatarSrc = isGroup ? conversation.avatar_url : otherMember?.user?.avatar_url;
//   const isOnline = !isGroup && (otherMember?.user?.is_online || false);
//   const lastSeen = !isGroup && otherMember?.user?.last_seen;

//   let subtitle = "";
//   if (typingUsers.length > 0) {
//     subtitle = isGroup
//       ? `${typingUsers.join(", ")} ${typingUsers.length === 1 ? "is" : "are"} typing…`
//       : "typing…";
//   } else if (isGroup) {
//     subtitle = conversation.members.map((m) => m.user?.display_name).filter(Boolean).join(", ");
//   } else if (isOnline) {
//     subtitle = "online";
//   } else if (lastSeen) {
//     subtitle = `last seen ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}`;
//   }

//   return (
//     <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-signal-border shadow-sm">
//       <div className="flex items-center gap-3">
//         {onBack && (
//           <button onClick={onBack} className="p-1 text-signal-icon hover:text-signal-teal lg:hidden">
//             <ArrowLeft size={20} />
//           </button>
//         )}
//         <button onClick={onShowInfo} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
//           <Avatar
//             name={name}
//             src={avatarSrc}
//             size={40}
//             online={!isGroup ? isOnline : undefined}
//           />
//           <div className="text-left">
//             <p className="font-semibold text-[15px] text-gray-800">{name}</p>
//             <p className={`text-[12px] truncate max-w-[240px] ${typingUsers.length > 0 ? "text-signal-teal" : "text-signal-secondary"}`}>
//               {subtitle}
//             </p>
//           </div>
//         </button>
//       </div>
//       <div className="flex items-center gap-1">
//         <HeaderBtn icon={<Phone size={18} />} title="Voice call" onClick={() => alert("Coming soon")} />
//         <HeaderBtn icon={<Video size={18} />} title="Video call" onClick={() => alert("Coming soon")} />
//         <HeaderBtn icon={<Search size={18} />} title="Search" onClick={() => {}} />
//         <HeaderBtn icon={<Info size={18} />} title="Info" onClick={onShowInfo} />
//       </div>
//     </div>
//   );
// }

// function HeaderBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
//   return (
//     <button
//       onClick={onClick}
//       title={title}
//       className="p-2 rounded-lg text-signal-icon hover:bg-signal-bg hover:text-signal-teal transition-colors"
//     >
//       {icon}
//     </button>
//   );
// }


"use client";

import { useState } from "react";
import { Phone, Video, Search, MoreVertical, Users, ArrowLeft, Info } from "lucide-react";
import { Conversation } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { formatDistanceToNow } from "date-fns";
import { ContactsModal } from "./ContactsModal";

interface Props {
  conversation: Conversation;
  currentUserId: string;
  typingUsers: string[];
  onShowInfo: () => void;
  onBack?: () => void;
}

export function ChatHeader({ conversation, currentUserId, typingUsers, onShowInfo, onBack }: Props) {
  const [showContacts, setShowContacts] = useState(false);

  const isGroup = conversation.type === "group";
  const otherMember = !isGroup
    ? conversation.members.find((m) => m.user_id !== currentUserId)
    : null;

  const name = isGroup
    ? conversation.name || "Group"
    : otherMember?.user?.display_name || "Unknown";

  const avatarSrc = isGroup ? conversation.avatar_url : otherMember?.user?.avatar_url;
  const isOnline = !isGroup && (otherMember?.user?.is_online || false);
  const lastSeen = !isGroup && otherMember?.user?.last_seen;

  let subtitle = "";
  if (typingUsers.length > 0) {
    subtitle = isGroup
      ? `${typingUsers.join(", ")} ${typingUsers.length === 1 ? "is" : "are"} typing…`
      : "typing…";
  } else if (isGroup) {
    subtitle = conversation.members.map((m) => m.user?.display_name).filter(Boolean).join(", ");
  } else if (isOnline) {
    subtitle = "online";
  } else if (lastSeen) {
    subtitle = `last seen ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}`;
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-signal-border shadow-sm">
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="p-1 text-signal-icon hover:text-signal-teal lg:hidden">
            <ArrowLeft size={20} />
          </button>
        )}
        <button onClick={onShowInfo} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Avatar
            name={name}
            src={avatarSrc}
            size={40}
            online={!isGroup ? isOnline : undefined}
          />
          <div className="text-left">
            <p className="font-semibold text-[15px] text-gray-800">{name}</p>
            <p className={`text-[12px] truncate max-w-[240px] ${typingUsers.length > 0 ? "text-signal-teal" : "text-signal-secondary"}`}>
              {subtitle}
            </p>
          </div>
        </button>
      </div>
      <div className="flex items-center gap-1">
        <HeaderBtn icon={<Phone size={18} />} title="Voice call" onClick={() => alert("Coming soon")} />
        <HeaderBtn icon={<Video size={18} />} title="Video call" onClick={() => alert("Coming soon")} />
        <HeaderBtn icon={<Search size={18} />} title="Search" onClick={() => {}} />
        <HeaderBtn icon={<Info size={18} />} title="Info" onClick={onShowInfo} />
        {/* New Add Contact button */}
        <HeaderBtn icon={<Users size={18} />} title="Add Contact" onClick={() => setShowContacts(true)} />
      </div>

      {/* {showContacts && (
        <ContactsModal onClose={() => setShowContacts(false)} />
      )} */}
      {showContacts && (
        <ContactsModal 
          onClose={() => setShowContacts(false)} 
          onOpenConversation={(conversationId) => {
            // handle opening a conversation here
            console.log("Open conversation:", conversationId);
          }}
        />
      )}
    </div>
  );
}

function HeaderBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
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
