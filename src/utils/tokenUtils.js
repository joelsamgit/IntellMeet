import crypto from "crypto";

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateOpaqueToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString("hex");
}
