import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { resolveApiBaseUrl } from "@/api/axios"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAvatarUrl(avatarPath?: string): string | undefined {
  if (!avatarPath) return undefined;
  if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://") || avatarPath.startsWith("data:")) {
    return avatarPath;
  }
  const baseUrl = resolveApiBaseUrl().replace(/\/api$/, "");
  return `${baseUrl}${avatarPath}`;
}
