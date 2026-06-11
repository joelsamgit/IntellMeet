import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import Team from "../models/Team.js";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import { createNotification } from "../services/notification.service.js";

function isMember(team, userId) {
  return team.members.some((m) => String(m) === String(userId));
}

function canEditTeam(team, user, role) {
  if (role === "admin") return true;
  return isMember(team, user._id);
}

export const createTeam = asyncHandler(async (req, res) => {
  const team = await Team.create({
    name: req.body.name,
    members: [req.user._id],
    projects: req.body.projects || [],
  });
  await User.findByIdAndUpdate(req.user._id, { $addToSet: { teams: team._id } });
  const populated = await Team.findById(team._id).populate("members", "name email role avatar");
  res.status(201).json({ team: populated });
});

export const listTeams = asyncHandler(async (req, res) => {
  const q = req.user.role === "admin" ? {} : { members: req.user._id };
  const teams = await Team.find(q).populate("members", "name email role avatar");

  const teamIds = teams.map((t) => t._id);
  const invitations = await Invitation.find({ team: { $in: teamIds }, status: "pending" });

  const teamsWithInvites = teams.map((team) => {
    const teamObj = team.toObject();
    teamObj.pendingInvitations = invitations
      .filter((inv) => String(inv.team) === String(team._id))
      .map((inv) => inv.email.toLowerCase());
    return teamObj;
  });

  res.json({ teams: teamsWithInvites });
});

export const getTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id).populate("members", "name email role avatar");
  if (!team) throw new AppError("Team not found", 404);
  if (req.user.role !== "admin" && !isMember(team, req.user._id)) {
    throw new AppError("Team not found", 404);
  }
  res.json({ team });
});

export const updateTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new AppError("Team not found", 404);
  if (!canEditTeam(team, req.user, req.user.role)) {
    throw new AppError("Not allowed to update this team", 403);
  }
  if (req.body.name !== undefined) team.name = req.body.name;
  if (req.body.projects !== undefined) team.projects = req.body.projects;
  if (req.body.memberIds !== undefined) {
    const ids = [...new Set(req.body.memberIds.map(String))];
    team.members = ids;
    await User.updateMany({ teams: team._id }, { $pull: { teams: team._id } });
    await User.updateMany({ _id: { $in: ids } }, { $addToSet: { teams: team._id } });
  }
  await team.save();
  const populated = await Team.findById(team._id).populate("members", "name email role avatar");
  res.json({ team: populated });
});

export const deleteTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new AppError("Team not found", 404);
  if (req.user.role === "admin") {
    await User.updateMany({ teams: team._id }, { $pull: { teams: team._id } });
    await team.deleteOne();
    return res.json({ message: "Team deleted" });
  }
  if (!isMember(team, req.user._id)) throw new AppError("Team not found", 404);
  if (String(team.members[0]) !== String(req.user._id)) {
    throw new AppError("Only team owner or admin can delete", 403);
  }
  await User.updateMany({ teams: team._id }, { $pull: { teams: team._id } });
  await team.deleteOne();
  res.json({ message: "Team deleted" });
});

export const inviteMember = asyncHandler(async (req, res) => {
  const { email, teamId } = req.body;
  if (!email) throw new AppError("Email is required", 400);

  const sanitizedEmail = String(email).trim().toLowerCase();

  // Check if invited user exists
  const invitedUser = await User.findOne({ email: sanitizedEmail });
  if (!invitedUser) {
    throw new AppError("User with this email is not registered with IntellMeet", 404);
  }

  // Find or create team
  let team;
  if (teamId && mongoose.Types.ObjectId.isValid(teamId)) {
    team = await Team.findById(teamId);
  }

  if (!team) {
    // Look for a team where the host is member
    team = await Team.findOne({ members: req.user._id });
    if (!team) {
      // Create a default team
      team = await Team.create({
        name: `${req.user.name}'s Team`,
        members: [req.user._id],
      });
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { teams: team._id } });
    }
  }

  if (!team) throw new AppError("Team not found", 404);

  // Check if user is already in the team
  const isAlreadyMember = team.members.some(m => String(m) === String(invitedUser._id));
  if (isAlreadyMember) {
    throw new AppError("User is already a member of this team", 400);
  }

  // Check if there is an active pending invitation
  const existingInvite = await Invitation.findOne({
    email: sanitizedEmail,
    team: team._id,
    status: "pending"
  });
  if (existingInvite) {
    throw new AppError("An invitation is already pending for this user", 400);
  }

  const invitation = await Invitation.create({
    email: sanitizedEmail,
    invitedBy: req.user._id,
    team: team._id,
    status: "pending"
  });

  // Notify the user
  await createNotification({
    user: invitedUser._id,
    type: "system",
    message: `${req.user.name} invited you to join team "${team.name}"`,
    meta: { invitationId: invitation._id, teamId: team._id }
  });

  res.status(201).json({ message: "Invitation sent successfully", invitation });
});

export const listInvitations = asyncHandler(async (req, res) => {
  const invites = await Invitation.find({
    email: req.user.email.toLowerCase(),
    status: "pending"
  }).populate("invitedBy", "name email avatar").populate("team", "name");

  res.json({ invitations: invites });
});

export const respondToInvitation = asyncHandler(async (req, res) => {
  const { action } = req.body;
  if (!["accept", "decline"].includes(action)) {
    throw new AppError("Invalid action, must be accept or decline", 400);
  }

  const invite = await Invitation.findById(req.params.id);
  if (!invite) throw new AppError("Invitation not found", 404);

  if (invite.email.toLowerCase() !== req.user.email.toLowerCase()) {
    throw new AppError("Unauthorized", 403);
  }

  if (invite.status !== "pending") {
    throw new AppError("Invitation is already processed", 400);
  }

  if (action === "accept") {
    invite.status = "accepted";
    // Add user to team
    await Team.findByIdAndUpdate(invite.team, { $addToSet: { members: req.user._id } });
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { teams: invite.team } });

    // Notify inviter
    await createNotification({
      user: invite.invitedBy,
      type: "system",
      message: `${req.user.name} accepted your invitation to join team`,
    });
  } else {
    invite.status = "declined";
  }

  await invite.save();
  res.json({ message: `Invitation ${action}ed successfully`, invitation: invite });
});
