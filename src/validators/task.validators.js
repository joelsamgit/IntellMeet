import { body, param } from "express-validator";

export const taskCreateValidators = [
  body("title").trim().isLength({ min: 1 }).withMessage("Title is required"),
  body("description").optional().isString(),
  body("teamId").optional().isMongoId(),
  body("assigneeId").optional().isMongoId(),
  body("priority").optional().isIn(["low", "medium", "high"]),
  body("status").optional().isIn(["todo", "inprogress", "done"]),
  body("dueDate").optional().isISO8601(),
];

export const taskUpdateValidators = [
  param("id").isMongoId(),
  body("title").optional().trim().isLength({ min: 1 }),
  body("description").optional().isString(),
  body("assigneeId").optional().isMongoId(),
  body("teamId").optional().isMongoId(),
  body("priority").optional().isIn(["low", "medium", "high"]),
  body("status").optional().isIn(["todo", "inprogress", "done"]),
  body("dueDate").optional().isISO8601(),
];

export const taskIdParam = [param("id").isMongoId()];
