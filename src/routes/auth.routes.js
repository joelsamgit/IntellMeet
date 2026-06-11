import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  registerValidators,
  loginValidators,
  forgotPasswordValidators,
  resetPasswordValidators,
  changePasswordValidators,
} from "../validators/auth.validators.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.post("/register", registerValidators, validateRequest, ctrl.register);
router.post("/signup", registerValidators, validateRequest, ctrl.register);
router.post("/login", loginValidators, validateRequest, ctrl.login);
router.post("/refresh-token", ctrl.refreshToken);
router.post("/logout", protect, ctrl.logout);
router.post("/forgot-password", forgotPasswordValidators, validateRequest, ctrl.forgotPassword);
router.post("/reset-password", resetPasswordValidators, validateRequest, ctrl.resetPassword);
router.put("/change-password", protect, changePasswordValidators, validateRequest, ctrl.changePassword);

export default router;
