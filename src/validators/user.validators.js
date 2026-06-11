import { body } from "express-validator";

export const profileUpdateValidators = [
  body("name").optional().trim().isLength({ min: 2 }),
  body("bio").optional().isString().isLength({ max: 2000 }),
  body("email").optional().isEmail().normalizeEmail(),
];
