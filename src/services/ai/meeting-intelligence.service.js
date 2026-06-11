import * as openaiService from './openai.service.js';
import * as huggingfaceService from './huggingface.service.js';
import Transcript from '../../models/Transcript.js';
import AISummary from '../../models/AISummary.js';
import MeetingActionItem from '../../models/MeetingActionItem.js';
import Meeting from '../../models/Meeting.js';
import Notification from '../../models/Notification.js';
import { emitToUser } from '../../socket/index.js';

/**
 * Full AI processing pipeline for a meeting.
 * @param {string} meetingId - Meeting document ID
 * @param {Buffer} audioBuffer - Audio data
 * @param {string} filename - Audio filename
 * @param {Function} emitProgress - Callback to emit progress via Socket.io
 * @returns {Promise<{transcript: Object, summary: Object, actionItems: Array}>}
 */
export async function processMeeting(meetingId, audioBuffer, filename, emitProgress) {
  const notify = emitProgress || (() => {});

  const meeting = await Meeting.findById(meetingId).populate('participants', 'name').lean();
  if (!meeting) throw new Error('Meeting not found');

  const participantNames = meeting.participants.map((p) => p.name);

  // Step 1: Transcription
  notify({ step: 'transcription', status: 'processing', message: 'Transcribing audio...' });

  let transcriptDoc;
  try {
    const result = await openaiService.transcribeAudio(audioBuffer, filename);
    const speakerLabels = await openaiService.identifySpeakers(result.segments || [], participantNames);

    transcriptDoc = await Transcript.create({
      meeting: meetingId,
      segments: result.segments.map((seg, index) => ({
        text: seg.text,
        startTime: seg.startTime,
        endTime: seg.endTime,
        speakerName: speakerLabels[index]?.speakerName || 'Unknown',
        confidence: speakerLabels[index]?.confidence,
      })),
      fullText: result.text,
      language: result.language,
      duration: result.duration,
      status: 'completed',
    });

    notify({ step: 'transcription', status: 'completed', message: 'Transcription complete' });
  } catch (err) {
    console.error('Transcription failed:', err.message);
    transcriptDoc = await Transcript.create({
      meeting: meetingId,
      fullText: '',
      status: 'failed',
    });
    notify({ step: 'transcription', status: 'failed', message: err.message });
    throw err;
  }

  // Step 2: Summary generation
  notify({ step: 'summary', status: 'processing', message: 'Generating AI summary...' });

  let summaryDoc;
  try {
    const [summaryResult, insightsResult, sentimentResult] = await Promise.all([
      openaiService.generateSummary(transcriptDoc.fullText, participantNames),
      openaiService.generateInsights(transcriptDoc.fullText, participantNames),
      huggingfaceService.analyzeSentiment(transcriptDoc.fullText.slice(0, 3000)),
    ]);

    summaryDoc = await AISummary.create({
      meeting: meetingId,
      summary: summaryResult.summary || '',
      keyPoints: summaryResult.keyPoints || [],
      followUpNotes: summaryResult.followUpNotes || '',
      sentiment: sentimentResult.label?.toLowerCase() || insightsResult.sentiment || 'neutral',
      sentimentScore: sentimentResult.score || insightsResult.sentimentScore || 0.5,
      engagementScore: insightsResult.engagementScore || 0,
      talkTimeDistribution: insightsResult.talkTimeDistribution || {},
      status: 'completed',
    });

    await Meeting.findByIdAndUpdate(meetingId, {
      summary: summaryResult.summary,
    });

    notify({ step: 'summary', status: 'completed', message: 'Summary generated' });
  } catch (err) {
    console.error('Summary generation failed:', err.message);
    summaryDoc = await AISummary.create({
      meeting: meetingId,
      status: 'failed',
    });
    notify({ step: 'summary', status: 'failed', message: err.message });
  }

  // Step 3: Action item extraction
  notify({ step: 'actionItems', status: 'processing', message: 'Extracting action items...' });

  let actionItems = [];
  try {
    const extracted = await openaiService.extractActionItems(transcriptDoc.fullText, participantNames);

    actionItems = await Promise.all(
      extracted.map((item) =>
        MeetingActionItem.create({
          meeting: meetingId,
          text: item.text,
          assigneeName: item.assigneeName || 'Unassigned',
          priority: item.priority || 'medium',
          dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
          source: 'ai-extracted',
        })
      )
    );

    await Meeting.findByIdAndUpdate(meetingId, {
      actionItems: actionItems.map((item) => ({
        text: item.text,
        assignee: item.assignee || undefined,
        status: item.status,
      })),
    });

    notify({ step: 'actionItems', status: 'completed', message: `${actionItems.length} action items extracted` });
  } catch (err) {
    console.error('Action item extraction failed:', err.message);
    notify({ step: 'actionItems', status: 'failed', message: err.message });
  }

  // Step 4: Notify meeting host
  try {
    await Notification.create({
      user: meeting.host,
      type: 'meeting',
      message: `AI analysis complete for "${meeting.title}": ${actionItems.length} action items found`,
    });

    emitToUser(String(meeting.host), 'notification', {
      _id: `ai-${meetingId}-${Date.now()}`,
      type: 'meeting',
      message: `AI analysis complete for "${meeting.title}": ${actionItems.length} action items found`,
      read: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }

  return {
    transcript: transcriptDoc,
    summary: summaryDoc,
    actionItems,
  };
}

/**
 * Generate summary from existing transcript text (no audio processing).
 * @param {string} meetingId - Meeting document ID
 * @param {string} transcriptText - Full transcript text
 * @returns {Promise<Object>} The created/updated AISummary document
 */
export async function generateSummaryFromText(meetingId, transcriptText) {
  const meeting = await Meeting.findById(meetingId).populate('participants', 'name').lean();
  if (!meeting) throw new Error('Meeting not found');

  const participantNames = meeting.participants.map((p) => p.name);

  const [summaryResult, sentimentResult] = await Promise.all([
    openaiService.generateSummary(transcriptText, participantNames),
    huggingfaceService.analyzeSentiment(transcriptText.slice(0, 3000)),
  ]);

  const summaryDoc = await AISummary.findOneAndUpdate(
    { meeting: meetingId },
    {
      summary: summaryResult.summary || '',
      keyPoints: summaryResult.keyPoints || [],
      followUpNotes: summaryResult.followUpNotes || '',
      sentiment: sentimentResult.label?.toLowerCase() || 'neutral',
      sentimentScore: sentimentResult.score || 0.5,
      status: 'completed',
    },
    { upsert: true, new: true }
  );

  await Meeting.findByIdAndUpdate(meetingId, { summary: summaryResult.summary });

  return summaryDoc;
}
