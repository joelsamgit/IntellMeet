import { body, param } from "express-validator";

export const aiMeetingParam = [param("meetingId").isMongoId()];

export const transcriptBodyValidators = [
  param("meetingId").exists().withMessage("Meeting ID is required"),
  body("transcript").optional().isString(),
  body("text").optional().isString(),
];

export const createTasksBodyValidators = [
  param("meetingId").isMongoId(),
  body("items").optional().isArray(),
  body("items.*.text").optional().isString(),
  body("items.*.title").optional().isString(),
  body("items.*.assignee").optional().isMongoId(),
  body("items.*.priority").optional().isIn(["low", "medium", "high"]),
];
