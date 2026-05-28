import mongoose from 'mongoose';

const aiSummarySchema = new mongoose.Schema(
  {
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
    summary: { type: String, default: '' },
    keyPoints: [{ type: String }],
    sentiment: { type: String, default: 'neutral' },
    sentimentScore: { type: Number, min: 0, max: 1 },
    engagementScore: { type: Number, min: 0, max: 100 },
    talkTimeDistribution: { type: Map, of: Number },
    followUpNotes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
    },
    generatedBy: { type: String, default: 'gpt-4' },
  },
  { timestamps: true }
);

aiSummarySchema.index({ meeting: 1 });

export default mongoose.model('AISummary', aiSummarySchema);
