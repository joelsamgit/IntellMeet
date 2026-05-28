import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import Meeting from "../models/Meeting.js";
import Task from "../models/Task.js";
import { canAccessMeeting, canManageMeeting } from "../utils/access.js";
import { extractActionItems, generateSummary, transcribeAudioPlaceholder } from "../services/ai.service.js";
import { createNotification, notifyUsers } from "../services/notification.service.js";

async function getAuthorizedMeeting(meetingId, user, manage = false) {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new AppError("Meeting not found", 404);
  const allowed = manage
    ? canManageMeeting(meeting, user._id, user.role)
    : canAccessMeeting(meeting, user._id, user.role);
  if (!allowed) throw new AppError("Meeting not found", 404);
  return meeting;
}

export const transcribeMeeting = asyncHandler(async (req, res) => {
  await getAuthorizedMeeting(req.params.meetingId, req.user);
  const transcript = await transcribeAudioPlaceholder({ text: req.body.text || req.body.transcript });
  res.json({ transcript });
});

export const summarizeMeeting = asyncHandler(async (req, res) => {
  const meeting = await getAuthorizedMeeting(req.params.meetingId, req.user, true);
  const transcript = req.body.transcript || req.body.text || meeting.summary || "";
  const summary = await generateSummary(transcript);
  meeting.summary = summary;
  await meeting.save();
  await notifyUsers(meeting.participants, {
    type: "meeting",
    meeting: meeting._id,
    message: `Summary is ready for ${meeting.title}`,
  });
  res.json({ summary });
});

export const extractMeetingActionItems = asyncHandler(async (req, res) => {
  const meeting = await getAuthorizedMeeting(req.params.meetingId, req.user, true);
  const transcript = req.body.transcript || req.body.text || meeting.summary || "";
  const actionItems = await extractActionItems(transcript);
  meeting.actionItems.push(...actionItems.map((item) => ({
    text: item.text,
    status: item.status === "done" ? "done" : "pending",
  })));
  await meeting.save();
  res.status(201).json({ actionItems: meeting.actionItems });
});

export const createTasksFromActionItems = asyncHandler(async (req, res) => {
  const meeting = await getAuthorizedMeeting(req.params.meetingId, req.user, true);
  const items = Array.isArray(req.body.items) ? req.body.items : meeting.actionItems;
  const taskInputs = items
    .map((item) => ({
      title: item.text || item.title,
      description: `Created from meeting: ${meeting.title}`,
      assignee: item.assignee || undefined,
      priority: item.priority || "medium",
      status: "todo",
      createdBy: req.user._id,
    }))
    .filter((item) => item.title);
  const tasks = await Task.insertMany(
    taskInputs
  );
  await Promise.all(
    tasks
      .filter((task) => task.assignee)
      .map((task) =>
        createNotification({
          user: task.assignee,
          type: "action_item",
          task: task._id,
          meeting: meeting._id,
          message: `New action item from ${meeting.title}: ${task.title}`,
        })
      )
  );
  res.status(201).json({ tasks });
});
