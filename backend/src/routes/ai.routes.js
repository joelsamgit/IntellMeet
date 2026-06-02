import { Router } from "express";
import * as ctrl from "../controllers/ai.controller.js";
import { protect } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { createTasksBodyValidators, transcriptBodyValidators } from "../validators/ai.validators.js";
import { memoryUpload } from "../middleware/multer.config.js";

const router = Router();

router.use(protect);

router.post(
  "/meetings/:meetingId/transcribe",
  memoryUpload.single("audio"),
  transcriptBodyValidators,
  validateRequest,
  ctrl.transcribeMeeting,
);
router.post("/meetings/:meetingId/summary", transcriptBodyValidators, validateRequest, ctrl.summarizeMeeting);
router.post("/meetings/:meetingId/action-items", transcriptBodyValidators, validateRequest, ctrl.extractMeetingActionItems);
router.post("/meetings/:meetingId/tasks", createTasksBodyValidators, validateRequest, ctrl.createTasksFromActionItems);
router.post(
  "/meetings/:meetingId/process",
  memoryUpload.single("audio"),
  transcriptBodyValidators,
  validateRequest,
  ctrl.processMeeting,
);

router.get("/meetings/:meetingId/transcript", ctrl.getMeetingTranscript);
router.get("/meetings/:meetingId/summary", ctrl.getMeetingSummary);
router.get("/meetings/:meetingId/action-items", ctrl.getMeetingActionItems);

router.get("/transcript/:meetingId", ctrl.getMeetingTranscript);
router.get("/summary/:meetingId", ctrl.getMeetingSummary);
router.get("/action-items/:meetingId", ctrl.getMeetingActionItems);

export default router;
