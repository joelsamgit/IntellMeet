import mongoose from 'mongoose';

const segmentSchema = new mongoose.Schema(
  {
    speaker: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    speakerName: { type: String, default: 'Unknown' },
    text: { type: String, required: true },
    startTime: { type: Number },
    endTime: { type: Number },
    confidence: { type: Number, min: 0, max: 1 },
  },
  { _id: true }
);

const transcriptSchema = new mongoose.Schema(
  {
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
    segments: [segmentSchema],
    fullText: { type: String, default: '' },
    language: { type: String, default: 'en' },
    duration: { type: Number },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
    },
  },
  { timestamps: true }
);

transcriptSchema.index({ meeting: 1, status: 1 });

export default mongoose.model('Transcript', transcriptSchema);
