import { body, param } from "express-validator";

export const meetingCreateValidators = [
  body("title").trim().isLength({ min: 3 }).withMessage("Title must be at least 3 characters"),
  body("description").optional().isString(),
  body("scheduledTime").isISO8601().withMessage("scheduledTime must be a valid ISO date"),
  body("participantIds").optional().isArray(),
  body("participantIds.*").optional().isMongoId(),
  body("status").optional().isIn(["scheduled", "live", "ended"]),
];

export const meetingUpdateValidators = [
  param("id").notEmpty().withMessage("Meeting id or code is required"),
  body("title").optional().trim().isLength({ min: 3 }),
  body("description").optional().isString(),
  body("scheduledTime").optional().isISO8601(),
  body("endTime").optional().isISO8601(),
  body("status").optional().isIn(["scheduled", "live", "ended"]),
  body("summary").optional().isString(),
  body("recording").optional().isString(),
  body("participantIds").optional().isArray(),
  body("participantIds.*").optional().isMongoId(),
];

export const meetingIdParam = [
  param("id").notEmpty().withMessage("Meeting id or code is required"),
];
