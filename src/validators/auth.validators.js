import { body } from "express-validator";

export const registerValidators = [
  body("name").trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email required")
    .normalizeEmail({ gmail_remove_dots: false }),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

export const loginValidators = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email required")
    .normalizeEmail({ gmail_remove_dots: false }),
  body("password").notEmpty().withMessage("Password is required"),
];

export const forgotPasswordValidators = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email required")
    .normalizeEmail({ gmail_remove_dots: false }),
];

export const resetPasswordValidators = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email required")
    .normalizeEmail({ gmail_remove_dots: false }),
  body("token").notEmpty().withMessage("Reset token is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

export const changePasswordValidators = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
];
