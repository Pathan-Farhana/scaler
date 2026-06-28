"use client";
import { MessageCircle, Shield, Lock } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#EBF0FA]">
      <div className="flex flex-col items-center gap-4 max-w-xs text-center">
        <div className="w-24 h-24 rounded-full bg-signal-teal/10 flex items-center justify-center">
          <MessageCircle size={48} className="text-signal-teal opacity-60" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Signal Desktop</h2>
          <p className="text-signal-secondary text-sm leading-relaxed">
            Send and receive messages without keeping your phone online.
            Use Signal on up to 5 linked devices and 1 phone.
          </p>
        </div>
        <div className="flex items-center gap-2 text-signal-secondary text-xs mt-2">
          <Lock size={12} />
          <span>End-to-end encrypted</span>
        </div>
      </div>

      <div className="absolute bottom-8 flex items-center gap-4 text-[11px] text-signal-secondary">
        <div className="flex items-center gap-1.5">
          <Shield size={12} />
          <span>Privacy Policy</span>
        </div>
        <span>·</span>
        <span>Terms of Service</span>
        <span>·</span>
        <span>Cookie Policy</span>
      </div>
    </div>
  );
}
