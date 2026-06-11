import { asyncHandler } from "../utils/asyncHandler.js";
import * as authService from "../services/auth.service.js";
import { setRefreshCookie, clearRefreshCookie } from "../utils/cookieHelper.js";

/** Register — same payload as /register; used by frontend as /auth/signup */
export const register = asyncHandler(async (req, res) => {
  const out = await authService.registerUser(req.body);
  setRefreshCookie(res, out.refreshToken);
  res.status(201).json({ user: out.user, token: out.token });
});

export const login = asyncHandler(async (req, res) => {
  const out = await authService.loginUser(req.body);
  setRefreshCookie(res, out.refreshToken);
  res.json({ user: out.user, token: out.token });
});

export const refreshToken = asyncHandler(async (req, res) => {
  const out = await authService.refreshSession(req.cookies.refreshToken);
  setRefreshCookie(res, out.refreshToken);
  res.json({ user: out.user, token: out.token });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logoutUser(req.user._id, req.auth.jti, req.accessToken);
  clearRefreshCookie(res);
  res.json({ message: "Logged out successfully" });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.requestPasswordReset(req.body.email);
  res.json(result);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPasswordWithToken(req.body);
  res.json(result);
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user._id, {
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
  });
  clearRefreshCookie(res);
  res.json(result);
});
