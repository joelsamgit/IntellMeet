import { Router } from "express";
import * as ctrl from "../controllers/task.controller.js";
import { protect } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  taskCreateValidators,
  taskUpdateValidators,
  taskIdParam,
} from "../validators/task.validators.js";

const router = Router();

router.use(protect);

router.post("/", taskCreateValidators, validateRequest, ctrl.createTask);
router.get("/", ctrl.listTasks);
router.get("/:id", taskIdParam, validateRequest, ctrl.getTask);
router.put("/:id", taskUpdateValidators, validateRequest, ctrl.updateTask);
router.delete("/:id", taskIdParam, validateRequest, ctrl.deleteTask);

export default router;
