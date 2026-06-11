import { validationResult } from "express-validator";

/**
 * Runs after express-validator chains; returns structured validation errors.
 */
export function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      path: e.path,
      location: e.location,
      msg: e.msg,
    }));
    return res.status(422).json({
      message: formatted[0]?.msg || "Validation failed",
      errors: formatted,
    });
  }
  next();
}
