import { Router } from "express";
import * as ctrl from "../controllers/chat.controller.js";
import { protect } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { chatCreateValidators, chatListValidators } from "../validators/chat.validators.js";

const router = Router();

router.use(protect);

router.get("/meetings/:meetingId/messages", chatListValidators, validateRequest, ctrl.listMeetingMessages);
router.post("/meetings/:meetingId/messages", chatCreateValidators, validateRequest, ctrl.createMeetingMessage);

export default router;
