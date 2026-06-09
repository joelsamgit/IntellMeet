import { Router } from "express";
import * as ctrl from "../controllers/team.controller.js";
import { protect } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  teamCreateValidators,
  teamUpdateValidators,
  teamIdParam,
} from "../validators/team.validators.js";

const router = Router();

router.use(protect);

router.post("/", teamCreateValidators, validateRequest, ctrl.createTeam);
router.get("/", ctrl.listTeams);

router.post("/invite", ctrl.inviteMember);
router.get("/invitations/pending", ctrl.listInvitations);
router.post("/invitations/:id/respond", ctrl.respondToInvitation);

router.get("/:id", teamIdParam, validateRequest, ctrl.getTeam);
router.put("/:id", teamUpdateValidators, validateRequest, ctrl.updateTeam);
router.delete("/:id", teamIdParam, validateRequest, ctrl.deleteTeam);

export default router;
