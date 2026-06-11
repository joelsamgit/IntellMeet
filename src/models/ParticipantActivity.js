import mongoose from 'mongoose';

const participantActivitySchema = new mongoose.Schema(
  {
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
    duration: { type: Number, default: 0 },
    talkTime: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 },
    reactions: { type: Number, default: 0 },
  },
  { timestamps: true }
);

participantActivitySchema.index({ meeting: 1, user: 1 }, { unique: true });

export default mongoose.model('ParticipantActivity', participantActivitySchema);
