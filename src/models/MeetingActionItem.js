import mongoose from 'mongoose';

const meetingActionItemSchema = new mongoose.Schema(
  {
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
    text: { type: String, required: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assigneeName: { type: String, default: '' },
    dueDate: { type: Date },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending',
    },
    source: { type: String, default: 'ai-extracted' },
  },
  { timestamps: true }
);

meetingActionItemSchema.index({ meeting: 1, status: 1 });
meetingActionItemSchema.index({ assignee: 1 });

export default mongoose.model('MeetingActionItem', meetingActionItemSchema);
