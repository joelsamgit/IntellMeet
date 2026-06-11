/** Cookie name for opaque refresh tokens (HTTP-only). */
export const REFRESH_COOKIE_NAME = "refreshToken";

/**
 * Sets the refresh token cookie scoped to auth routes.
 */
export function setRefreshCookie(res, token, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeMs,
    path: "/api/auth",
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    path: "/api/auth",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}
