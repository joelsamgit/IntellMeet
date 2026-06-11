import { Router } from "express";
import * as ctrl from "../controllers/user.controller.js";
import { protect, restrictToAdmin } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { profileUpdateValidators } from "../validators/user.validators.js";
import { memoryUpload } from "../middleware/multer.config.js";

const router = Router();

router.use(protect);

router.get("/profile", ctrl.getProfile);
router.put("/profile", profileUpdateValidators, validateRequest, ctrl.updateProfile);
router.post("/avatar", memoryUpload.single("avatar"), ctrl.uploadAvatar);
router.get("/all", ctrl.listAllUsers);

export default router;
