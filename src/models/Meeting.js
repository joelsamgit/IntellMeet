import mongoose from "mongoose";

const actionItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["pending", "done"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    originalName: { type: String },
  },
  { _id: true }
);

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    meetingCode: { type: String, required: true, unique: true, index: true },
    scheduledTime: { type: Date, required: true },
    endTime: { type: Date },
    status: {
      type: String,
      enum: ["scheduled", "live", "ended"],
      default: "scheduled",
    },
    summary: { type: String },
    recording: { type: String },
    actionItems: [actionItemSchema],
    attachments: [attachmentSchema],
  },
  { timestamps: true }
);

meetingSchema.index({ host: 1, scheduledTime: -1 });
meetingSchema.index({ participants: 1 });

export default mongoose.model("Meeting", meetingSchema);
