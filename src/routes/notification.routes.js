import { Router } from "express";
import * as ctrl from "../controllers/notification.controller.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.get("/", ctrl.listNotifications);
router.patch("/:id/read", ctrl.markNotificationRead);
router.post("/mark-all-read", ctrl.markAllNotificationsRead);

export default router;
