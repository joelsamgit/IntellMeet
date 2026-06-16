import { Router } from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import meetingRoutes from "./meeting.routes.js";
import teamRoutes from "./team.routes.js";
import taskRoutes from "./task.routes.js";
import notificationRoutes from "./notification.routes.js";
import chatRoutes from "./chat.routes.js";
import aiRoutes from "./ai.routes.js";
import uploadRoutes from "./upload.routes.js";
import { authLimiter, apiLimiter } from "../middleware/rateLimiters.js";

const router = Router();

router.use("/auth", authLimiter, authRoutes);
router.use(apiLimiter);
router.use("/users", userRoutes);
router.use("/meetings", meetingRoutes);
router.use("/teams", teamRoutes);
router.use("/tasks", taskRoutes);
router.use("/notifications", notificationRoutes);
router.use("/chat", chatRoutes);
router.use("/ai", aiRoutes);
router.use("/upload", uploadRoutes);

router.get("/health", (req, res) => {
  res.json({ ok: true, service: "intellmeet-api", version: "cors-v2" });
});

export default router;
