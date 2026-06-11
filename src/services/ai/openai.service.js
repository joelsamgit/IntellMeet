import OpenAI from 'openai';
import { File } from 'node:buffer';

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not set — AI features will be unavailable');
      return null;
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

/**
 * Transcribe audio using OpenAI Whisper.
 * @param {Buffer} audioBuffer - Raw audio data
 * @param {string} filename - Original filename with extension
 * @returns {Promise<{text: string, segments: Array, language: string, duration: number}>}
 */
export async function transcribeAudio(audioBuffer, filename = 'audio.webm') {
  const openai = getClient();
  if (!openai) throw new Error('OpenAI client not available');

  const mimeType = filename.endsWith('.mp3')
    ? 'audio/mpeg'
    : filename.endsWith('.wav')
      ? 'audio/wav'
      : 'audio/webm';
  const file = new File([audioBuffer], filename, { type: mimeType });

  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  });

  return {
    text: response.text,
    segments: (response.segments || []).map((seg) => ({
      text: seg.text,
      startTime: seg.start,
      endTime: seg.end,
    })),
    language: response.language || 'en',
    duration: response.duration || 0,
  };
}

/**
 * Generate a meeting summary using GPT.
 * @param {string} transcriptText - Full transcript text
 * @param {string[]} participantNames - Names of participants
 * @returns {Promise<{summary: string, keyPoints: string[], followUpNotes: string}>}
 */
export async function generateSummary(transcriptText, participantNames = []) {
  const openai = getClient();
  if (!openai) throw new Error('OpenAI client not available');

  const participantList = participantNames.length
    ? `Participants: ${participantNames.join(', ')}`
    : '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert meeting analyst. Given a meeting transcript, generate a comprehensive summary. ${participantList}

Respond in valid JSON format:
{
  "summary": "A clear, detailed paragraph summarizing the meeting",
  "keyPoints": ["Key point 1", "Key point 2", ...],
  "followUpNotes": "Suggested follow-up actions and notes"
}`,
      },
      {
        role: 'user',
        content: `Meeting transcript:\n\n${transcriptText.slice(0, 12000)}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 2000,
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch {
    return {
      summary: response.choices[0].message.content,
      keyPoints: [],
      followUpNotes: '',
    };
  }
}

/**
 * Infer speaker names for transcript segments using the meeting participant roster.
 * @param {Array<{text: string}>} segments - Whisper transcript segments
 * @param {string[]} participantNames - Names of meeting participants
 * @returns {Promise<Array<{index: number, speakerName: string, confidence: number}>>}
 */
export async function identifySpeakers(segments, participantNames = []) {
  if (!segments?.length) return [];

  const openai = getClient();
  if (!openai) {
    return segments.map((_, index) => ({ index, speakerName: 'Speaker', confidence: 0.5 }));
  }

  const labels = new Array(segments.length).fill(null);
  const batchSize = 20;

  for (let start = 0; start < segments.length; start += batchSize) {
    const batch = segments.slice(start, start + batchSize);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You assign the most likely speaker for each meeting transcript segment.
Participants: ${participantNames.join(', ') || 'Unknown'}

Return valid JSON:
{
  "segments": [
    { "index": 0, "speakerName": "Name or Unknown", "confidence": 0.0 }
  ]
}

Rules:
- Keep the original segment order.
- Use a participant name only when the evidence is reasonably strong.
- Otherwise use "Unknown".
- Confidence must be a number from 0 to 1.`,
        },
        {
          role: 'user',
          content: batch
            .map((segment, index) => `${start + index}: ${segment.text}`)
            .join('\n'),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1200,
    });

    try {
      const parsed = JSON.parse(response.choices[0].message.content);
      for (const item of parsed.segments || []) {
        const globalIndex = start + Number(item.index);
        if (globalIndex >= 0 && globalIndex < labels.length) {
          labels[globalIndex] = {
            index: globalIndex,
            speakerName: item.speakerName || 'Unknown',
            confidence:
              typeof item.confidence === 'number' ? item.confidence : 0.5,
          };
        }
      }
    } catch {
      for (let index = start; index < Math.min(start + batch.length, labels.length); index += 1) {
        labels[index] ||= { index, speakerName: 'Unknown', confidence: 0.5 };
      }
    }
  }

  return labels.map((entry, index) => entry || { index, speakerName: 'Unknown', confidence: 0.5 });
}

/**
 * Extract action items from transcript using GPT.
 * @param {string} transcriptText - Full transcript text
 * @param {string[]} participantNames - Names of participants
 * @returns {Promise<Array<{text: string, assigneeName: string, priority: string, dueDate: string|null}>>}
 */
export async function extractActionItems(transcriptText, participantNames = []) {
  const openai = getClient();
  if (!openai) throw new Error('OpenAI client not available');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert at extracting action items from meeting transcripts.
Participants: ${participantNames.join(', ') || 'Unknown'}

Extract all action items, tasks, commitments, and follow-ups mentioned.
Respond in valid JSON format:
{
  "actionItems": [
    {
      "text": "Description of the action item",
      "assigneeName": "Name of the person responsible (or 'Unassigned')",
      "priority": "low|medium|high|urgent",
      "dueDate": "YYYY-MM-DD or null"
    }
  ]
}`,
      },
      {
        role: 'user',
        content: `Meeting transcript:\n\n${transcriptText.slice(0, 12000)}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 2000,
  });

  try {
    const parsed = JSON.parse(response.choices[0].message.content);
    return parsed.actionItems || [];
  } catch {
    return [];
  }
}

/**
 * Generate meeting insights (engagement, talk time estimates).
 * @param {string} transcriptText - Full transcript text
 * @param {string[]} participantNames - Names of participants
 * @returns {Promise<{engagementScore: number, talkTimeDistribution: Object, sentiment: string, sentimentScore: number}>}
 */
export async function generateInsights(transcriptText, participantNames = []) {
  const openai = getClient();
  if (!openai) throw new Error('OpenAI client not available');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a meeting analytics expert. Analyze the transcript and provide insights.
Participants: ${participantNames.join(', ') || 'Unknown'}

Respond in valid JSON format:
{
  "engagementScore": 0-100,
  "talkTimeDistribution": { "Name": percentage_number, ... },
  "sentiment": "positive|negative|neutral|mixed",
  "sentimentScore": 0.0-1.0
}`,
      },
      {
        role: 'user',
        content: `Meeting transcript:\n\n${transcriptText.slice(0, 12000)}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 1000,
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch {
    return { engagementScore: 0, talkTimeDistribution: {}, sentiment: 'neutral', sentimentScore: 0.5 };
  }
}
