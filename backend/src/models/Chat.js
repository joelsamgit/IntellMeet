import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    kind: {
      type: String,
      enum: ["text", "system"],
      default: "text",
    },
    attachments: [
      {
        url: { type: String, required: true },
        publicId: { type: String },
        originalName: { type: String },
      },
    ],
    editedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

chatSchema.index({ meeting: 1, createdAt: -1 });

export default mongoose.model("Chat", chatSchema);
