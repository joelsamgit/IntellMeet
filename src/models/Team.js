import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
  },
  { _id: true }
);

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    projects: [projectSchema],
  },
  { timestamps: true }
);

teamSchema.index({ name: 1 });

export default mongoose.model("Team", teamSchema);
