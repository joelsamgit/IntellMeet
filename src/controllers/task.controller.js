import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import Task from "../models/Task.js";
import Team from "../models/Team.js";
import { createNotification } from "../services/notification.service.js";

function serializeTask(doc) {
  const t = doc.toObject ? doc.toObject() : doc;
  return {
    _id: t._id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    assignee: t.assignee
      ? {
          _id: t.assignee._id,
          name: t.assignee.name,
          email: t.assignee.email,
          role: t.assignee.role,
          ...(t.assignee.avatar ? { avatar: t.assignee.avatar } : {}),
        }
      : undefined,
    team: t.team,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

async function assertTeamAccess(user, teamId) {
  if (!teamId) return;
  const team = await Team.findById(teamId);
  if (!team) throw new AppError("Team not found", 404);
  if (user.role !== "admin" && !team.members.some((m) => String(m) === String(user._id))) {
    throw new AppError("Not a member of this team", 403);
  }
}

export const createTask = asyncHandler(async (req, res) => {
  await assertTeamAccess(req.user, req.body.teamId);
  const task = await Task.create({
    title: req.body.title,
    description: req.body.description || "",
    assignee: req.body.assigneeId || null,
    team: req.body.teamId || null,
    priority: req.body.priority || "medium",
    status: req.body.status || "todo",
    dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
    createdBy: req.user._id,
  });
  const populated = await Task.findById(task._id)
    .populate("assignee", "name email role avatar")
    .populate("team", "name");
  if (task.assignee) {
    await createNotification({
      user: task.assignee,
      type: "action_item",
      task: task._id,
      message: `New task assigned: ${task.title}`,
    });
  }
  res.status(201).json({ task: serializeTask(populated) });
});

export const listTasks = asyncHandler(async (req, res) => {
  const { teamId } = req.query;
  const filter = {};
  if (teamId) {
    await assertTeamAccess(req.user, teamId);
    filter.team = teamId;
  } else if (req.user.role !== "admin") {
    filter.$or = [{ assignee: req.user._id }, { createdBy: req.user._id }];
  }
  const rows = await Task.find(filter)
    .sort({ createdAt: -1 })
    .populate("assignee", "name email role avatar")
    .populate("team", "name");
  res.json({ tasks: rows.map(serializeTask) });
});

export const getTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate("assignee", "name email role avatar")
    .populate("team", "name members");
  if (!task) throw new AppError("Task not found", 404);
  if (req.user.role !== "admin") {
    const okAssignee = task.assignee && String(task.assignee._id) === String(req.user._id);
    const okCreator = String(task.createdBy) === String(req.user._id);
    let okTeam = false;
    if (task.team?.members) {
      okTeam = task.team.members.some((m) => String(m) === String(req.user._id));
    }
    if (!okAssignee && !okCreator && !okTeam) throw new AppError("Task not found", 404);
  }
  res.json({ task: serializeTask(task) });
});

export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id).populate("team", "members");
  if (!task) throw new AppError("Task not found", 404);
  if (req.user.role !== "admin") {
    const inTeam =
      task.team &&
      task.team.members?.some((m) => String(m) === String(req.user._id));
    const isCreator = String(task.createdBy) === String(req.user._id);
    if (!inTeam && !isCreator) throw new AppError("Not allowed", 403);
  }
  const { title, description, assigneeId, teamId, priority, status, dueDate } = req.body;
  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (assigneeId !== undefined) task.assignee = assigneeId || null;
  if (teamId !== undefined) {
    await assertTeamAccess(req.user, teamId);
    task.team = teamId || null;
  }
  if (priority !== undefined) task.priority = priority;
  if (status !== undefined) task.status = status;
  if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
  await task.save();
  if (assigneeId !== undefined && task.assignee) {
    await createNotification({
      user: task.assignee,
      type: "action_item",
      task: task._id,
      message: `Task updated: ${task.title}`,
    });
  }
  const populated = await Task.findById(task._id)
    .populate("assignee", "name email role avatar")
    .populate("team", "name");
  res.json({ task: serializeTask(populated) });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id).populate("team", "members");
  if (!task) throw new AppError("Task not found", 404);
  if (req.user.role !== "admin") {
    const isCreator = String(task.createdBy) === String(req.user._id);
    const inTeam =
      task.team &&
      task.team.members?.some((m) => String(m) === String(req.user._id));
    if (!isCreator && !inTeam) throw new AppError("Not allowed", 403);
  }
  await task.deleteOne();
  res.json({ message: "Task deleted" });
});
