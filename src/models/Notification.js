import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["mention", "action_item", "meeting", "chat", "screen_share", "system"],
      default: "system",
    },
    message: { type: String, required: true },
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: "Meeting" },
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
