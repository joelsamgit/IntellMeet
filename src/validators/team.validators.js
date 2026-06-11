import { body, param } from "express-validator";

export const teamCreateValidators = [
  body("name").trim().isLength({ min: 2 }).withMessage("Team name is required"),
  body("projects").optional().isArray(),
];

export const teamUpdateValidators = [
  param("id").isMongoId(),
  body("name").optional().trim().isLength({ min: 2 }),
  body("memberIds").optional().isArray(),
  body("memberIds.*").optional().isMongoId(),
  body("projects").optional().isArray(),
];

export const teamIdParam = [param("id").isMongoId()];
