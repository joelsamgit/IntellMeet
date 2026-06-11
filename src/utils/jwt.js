import jwt from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";

export function signAccessToken(userId, role) {
  const jti = crypto.randomUUID();
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is required");
  const token = jwt.sign({ sub: userId, role, jti, typ: "access" }, secret, {
    expiresIn: ACCESS_EXPIRES,
  });
  return { token, jti, expiresIn: ACCESS_EXPIRES };
}

/** Decode without verify — used only to read exp/jti for blacklisting. */
export function decodeTokenUnsafe(token) {
  return jwt.decode(token);
}

export function verifyAccessToken(token) {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is required");
  return jwt.verify(token, secret);
}
