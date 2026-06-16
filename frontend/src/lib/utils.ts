import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAvatarUrl(avatarPath?: string): string | undefined {
  if (!avatarPath) return undefined;
  if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://") || avatarPath.startsWith("data:")) {
    return avatarPath;
  }
  const baseUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");
  return `${baseUrl}${avatarPath}`;
}
