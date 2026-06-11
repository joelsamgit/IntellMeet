import { Router } from "express";
import * as ctrl from "../controllers/meeting.controller.js";
import { protect } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  meetingCreateValidators,
  meetingUpdateValidators,
  meetingIdParam,
} from "../validators/meeting.validators.js";

const router = Router();

router.use(protect);

router.post("/create", meetingCreateValidators, validateRequest, ctrl.createMeeting);
router.get("/", ctrl.listMeetings);
router.get("/:id", meetingIdParam, validateRequest, ctrl.getMeeting);
router.put("/:id", meetingUpdateValidators, validateRequest, ctrl.updateMeeting);
router.delete("/:id", meetingIdParam, validateRequest, ctrl.deleteMeeting);

export default router;
