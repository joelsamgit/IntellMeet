import { body, param, query } from "express-validator";

export const meetingIdParam = [param("meetingId").isMongoId()];

export const chatCreateValidators = [
  param("meetingId").isMongoId(),
  body("message").trim().isLength({ min: 1, max: 4000 }),
  body("attachments").optional().isArray(),
];

export const chatListValidators = [
  param("meetingId").isMongoId(),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("before").optional().isISO8601(),
];
