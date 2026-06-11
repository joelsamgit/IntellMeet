import { Router } from "express";
import * as ctrl from "../controllers/upload.controller.js";
import { protect } from "../middleware/auth.js";
import { memoryUpload } from "../middleware/multer.config.js";

const router = Router();

router.use(protect);

router.post("/attachment", memoryUpload.single("file"), ctrl.uploadAttachment);

export default router;
