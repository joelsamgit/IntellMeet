const chars = "abcdefghijklmnopqrstuvwxyz0123456789";

function segment(len) {
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Human-readable meeting codes compatible with the frontend join flow (e.g. abc-1234-xyz). */
export function generateMeetingCode() {
  return `${segment(3)}-${segment(4)}-${segment(3)}`;
}
