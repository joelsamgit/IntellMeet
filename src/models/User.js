import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    avatar: { type: String, default: "" },
    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },
    bio: { type: String, default: "", maxlength: 2000 },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: "Team" }],
    meetings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Meeting" }],
    /** SHA-256 hash of the active opaque refresh token (never store the raw token). */
    refreshTokenHash: { type: String, select: false, default: null },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    avatar: this.avatar || undefined,
    role: this.role,
    bio: this.bio,
  };
};

export default mongoose.model("User", userSchema);
