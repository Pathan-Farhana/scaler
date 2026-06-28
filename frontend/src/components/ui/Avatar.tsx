"use client";
import Image from "next/image";
import { getMediaUrl } from "@/lib/api";

const GRADIENTS = [
  "avatar-gradient-1",
  "avatar-gradient-2",
  "avatar-gradient-3",
  "avatar-gradient-4",
  "avatar-gradient-5",
  "avatar-gradient-6",
  "avatar-gradient-7",
];

function getGradient(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % GRADIENTS.length;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  online?: boolean;
  className?: string;
}

export function Avatar({ name, src, size = 40, online, className = "" }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const gradient = getGradient(name);
  const fontSize = size < 32 ? "text-xs" : size < 48 ? "text-sm" : "text-base";

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      {src ? (
        <Image
          src={getMediaUrl(src)}
          alt={name}
          width={size}
          height={size}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div
          className={`${gradient} rounded-full flex items-center justify-center text-white font-semibold ${fontSize}`}
          style={{ width: size, height: size }}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-white ${
            online ? "bg-signal-online" : "bg-gray-400"
          }`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
