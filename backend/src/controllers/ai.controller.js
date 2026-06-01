import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import Meeting from "../models/Meeting.js";
import Task from "../models/Task.js";
import { canAccessMeeting, canManageMeeting } from "../utils/access.js";
import { extractActionItems, generateSummary, transcribeAudio } from "../services/ai.service.js";
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

  let transcript;
  if (req.file) {
    transcript = await transcribeAudio(req.file.buffer, req.file.originalname);
  } else {
    const raw = req.body.text || req.body.transcript || "";
    if (!raw) throw new AppError("Provide an audio file or a text/transcript field", 400);
    transcript = raw.trim();
  }

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
  const tasks = await Task.insertMany(taskInputs);
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

// POST /api/ai/meetings/:meetingId/process
// Accepts audio file (field: audio) or text body.
// Runs the full post-meeting pipeline in one request:
// transcribe → summarize → extract action items → persist → notify.
export const processMeeting = asyncHandler(async (req, res) => {
  const meeting = await getAuthorizedMeeting(req.params.meetingId, req.user, true);

  // 1. Transcribe
  let transcript;
  if (req.file) {
    transcript = await transcribeAudio(req.file.buffer, req.file.originalname);
  } else {
    transcript = (req.body.transcript || req.body.text || "").trim();
    if (!transcript) throw new AppError("Provide an audio file (field: audio) or a transcript text body", 400);
  }

  // 2. Summarize + extract action items in parallel
  const [summary, rawActionItems] = await Promise.all([
    generateSummary(transcript),
    extractActionItems(transcript),
  ]);

  // 3. Persist results and mark meeting ended
  meeting.summary = summary;
  meeting.status = "ended";
  meeting.endTime = new Date();
  meeting.actionItems.push(
    ...rawActionItems.map((item) => ({ text: item.text, status: "pending" }))
  );
  await meeting.save();

  // 4. Notify all participants
  await notifyUsers(meeting.participants, {
    type: "meeting",
    meeting: meeting._id,
    message: `Summary and action items are ready for "${meeting.title}"`,
  });

  res.json({
    transcript,
    summary,
    actionItems: meeting.actionItems,
  });
});
