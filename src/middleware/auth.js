import { verifyAccessToken } from "../utils/jwt.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import User from "../models/User.js";
import { isJtiBlacklisted } from "../services/cache.service.js";

/**
 * Requires a valid Bearer access token (not blacklisted).
 */
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("Not authenticated", 401);
  }
  const accessToken = header.slice(7);
  let payload;
  try {
    payload = verifyAccessToken(accessToken);
  } catch {
    throw new AppError("Not authenticated", 401);
  }
  if (payload.typ !== "access") throw new AppError("Not authenticated", 401);
  if (await isJtiBlacklisted(payload.jti)) {
    throw new AppError("Not authenticated", 401);
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new AppError("Not authenticated", 401);
  req.user = user;
  req.accessToken = accessToken;
  req.auth = {
    userId: String(user._id),
    role: user.role,
    jti: payload.jti,
  };
  next();
});

/** Restricts route to admin role. */
export const restrictToAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};
