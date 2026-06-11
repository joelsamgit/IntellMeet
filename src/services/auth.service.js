import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { signAccessToken, decodeTokenUnsafe } from "../utils/jwt.js";
import { generateOpaqueToken, hashToken } from "../utils/tokenUtils.js";
import {
  cacheUserSession,
  deleteUserSession,
  blacklistAccessJti,
} from "./cache.service.js";

function publicUser(userDoc) {
  return userDoc.toPublicJSON();
}

export async function registerUser(body = {}) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!name || !email || !password) {
    throw new AppError("Name, email, and password are required", 400);
  }
  const exists = await User.findOne({ email });
  if (exists) throw new AppError("Email already registered", 409);
  const count = await User.countDocuments();
  const role = count === 0 ? "admin" : "member";
  const user = await User.create({ name, email, password, role });
  const refreshToken = generateOpaqueToken(48);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  const { token: accessToken, jti } = signAccessToken(user._id, user.role);
  await cacheUserSession(String(user._id), { userId: String(user._id), role: user.role });
  return { user: publicUser(user), token: accessToken, refreshToken, accessJti: jti };
}

export async function loginUser(body = {}) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }
  const user = await User.findOne({ email }).select("+password +refreshTokenHash");
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError("Invalid email or password", 401);
  }
  const refreshToken = generateOpaqueToken(48);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  const { token: accessToken, jti } = signAccessToken(user._id, user.role);
  await cacheUserSession(String(user._id), { userId: String(user._id), role: user.role });
  return { user: publicUser(user), token: accessToken, refreshToken, accessJti: jti };
}

export async function refreshSession(refreshTokenFromCookie) {
  if (!refreshTokenFromCookie) throw new AppError("Missing refresh token", 401);
  const hashed = hashToken(refreshTokenFromCookie);
  const user = await User.findOne({ refreshTokenHash: hashed }).select("+refreshTokenHash");
  if (!user) throw new AppError("Invalid refresh token", 401);
  const newRefresh = generateOpaqueToken(48);
  user.refreshTokenHash = hashToken(newRefresh);
  await user.save();
  const { token: accessToken, jti } = signAccessToken(user._id, user.role);
  await cacheUserSession(String(user._id), { userId: String(user._id), role: user.role });
  return { user: publicUser(user), token: accessToken, refreshToken: newRefresh, accessJti: jti };
}

export async function logoutUser(userId, accessJti, accessTokenOptional) {
  const user = await User.findById(userId).select("+refreshTokenHash");
  if (user) {
    user.refreshTokenHash = null;
    await user.save();
  }
  await deleteUserSession(String(userId));
  if (accessJti) {
    let ttl = 900;
    if (accessTokenOptional) {
      const dec = decodeTokenUnsafe(accessTokenOptional);
      if (dec?.exp) ttl = Math.max(dec.exp - Math.floor(Date.now() / 1000), 60);
    }
    await blacklistAccessJti(accessJti, ttl);
  }
}

export async function requestPasswordReset(email) {
  const user = await User.findOne({ email });
  const generic = { message: "If that email exists, password reset instructions were sent." };
  if (!user) return generic;
  const rawToken = generateOpaqueToken(32);
  user.passwordResetTokenHash = hashToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });
  const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;
  if (process.env.NODE_ENV !== "production") {
    console.info("[IntellMeet] Password reset URL (dev only):", resetUrl);
    return { message: generic.message, resetUrl };
  }
  return generic;
}

export async function resetPasswordWithToken({ email, token, password }) {
  if (!email || !token || !password) throw new AppError("Invalid payload", 400);
  const user = await User.findOne({ email }).select(
    "+passwordResetTokenHash +passwordResetExpires +password"
  );
  if (!user?.passwordResetTokenHash || !user.passwordResetExpires) {
    throw new AppError("Invalid or expired reset token", 400);
  }
  if (user.passwordResetExpires < new Date()) {
    throw new AppError("Invalid or expired reset token", 400);
  }
  if (user.passwordResetTokenHash !== hashToken(token)) {
    throw new AppError("Invalid or expired reset token", 400);
  }
  user.password = password;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenHash = null;
  await user.save();
  return { message: "Password updated. Please sign in again." };
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select("+password");
  if (!user) throw new AppError("User not found", 404);
  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError("Current password is incorrect", 400);
  }
  user.password = newPassword;
  user.refreshTokenHash = null;
  await user.save();
  return { message: "Password changed successfully. Please log in again." };
}
