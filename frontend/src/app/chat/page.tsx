"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { conversationsApi } from "@/lib/api";
import { Conversation } from "@/types";

import { ConversationList } from "@/components/chat/ConversationList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ConversationInfo } from "@/components/chat/ConversationInfo";
import { NewChatModal } from "@/components/chat/NewChatModal";
import { NewGroupModal } from "@/components/chat/NewGroupModal";
import { Settings } from "@/components/layout/Settings";
import { EmptyState } from "@/components/layout/EmptyState";

export default function ChatPage() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const { activeConversationId, setActiveConversation, conversations } = useChatStore();
  const { send, ws } = useWebSocket();

  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  useEffect(() => {
    if (!token || !user) {
      router.replace("/auth");
    }
  }, [token, user, router]);

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    setShowInfo(false);
    setMobileView("chat");
  };

  const handleOpenConversation = (id: string) => {
    setActiveConversation(id);
    setMobileView("chat");
  };

  const handleBack = () => {
    setMobileView("list");
    setActiveConversation(null);
  };

  const sendWs = useCallback((event: string, data: Record<string, unknown>) => {
    send(event, data);
  }, [send]);

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-signal-bg">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { borderRadius: "12px", fontSize: "13px" },
          success: { iconTheme: { primary: "#2C6BED", secondary: "#fff" } },
        }}
      />

      {/* Left: Sidebar */}
      <div className={`
        w-full max-w-[360px] flex-shrink-0 flex flex-col h-full
        ${mobileView === "chat" ? "hidden lg:flex" : "flex"}
        ${showSettings ? "hidden lg:flex" : ""}
      `}>
        {showSettings ? (
          <Settings onClose={() => setShowSettings(false)} />
        ) : (
          <ConversationList
            onNewChat={() => setShowNewChat(true)}
            onNewGroup={() => setShowNewGroup(true)}
            onSettings={() => setShowSettings(true)}
            onSelectConversation={handleSelectConversation}
          />
        )}
      </div>

      {/* Center: Chat window */}
      <div className={`
        flex-1 flex flex-col h-full overflow-hidden
        ${mobileView === "list" ? "hidden lg:flex" : "flex"}
      `}>
        {activeConversation ? (
          <ChatWindow
            key={activeConversation.id}
            conversation={activeConversation}
            currentUser={user}
            wsRef={ws}
            onShowInfo={() => setShowInfo(!showInfo)}
            onBack={handleBack}
            sendWs={sendWs}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Right: Info panel */}
      {showInfo && activeConversation && (
        <div className="w-[320px] flex-shrink-0 h-full hidden lg:block">
          <ConversationInfo
            conversation={activeConversation}
            currentUser={user}
            onClose={() => setShowInfo(false)}
          />
        </div>
      )}

      {/* Modals */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onOpenConversation={handleOpenConversation}
        />
      )}
      {showNewGroup && (
        <NewGroupModal
          onClose={() => setShowNewGroup(false)}
          onOpenConversation={handleOpenConversation}
        />
      )}
    </div>
  );
}
