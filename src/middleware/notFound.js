/**
 * 404 handler for unknown API routes.
 */
export function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}
