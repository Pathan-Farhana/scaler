"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function HomePage() {
  const router = useRouter();
  const { token } = useAuthStore();

  useEffect(() => {
    if (token) {
      router.replace("/chat");
    } else {
      router.replace("/auth");
    }
  }, [token, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-signal-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-signal-teal flex items-center justify-center">
          <svg viewBox="0 0 56 56" className="w-10 h-10 fill-white">
            <path d="M28 4C14.745 4 4 14.745 4 28s10.745 24 24 24 24-10.745 24-24S41.255 4 28 4zm-2 34l-8-8 2.83-2.83L26 32.34l13.17-13.17L42 22 26 38z"/>
          </svg>
        </div>
        <div className="text-signal-secondary text-sm">Loading...</div>
      </div>
    </div>
  );
}
