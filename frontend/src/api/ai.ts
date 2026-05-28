import api from './axios';
import type { AISummary, MeetingActionItem } from '@/types';

export async function transcribeMeeting(meetingId: string, audioBlob: Blob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await api.post(`/ai/transcribe/${meetingId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return response.data;
}

export async function summarizeMeeting(meetingId: string) {
  const response = await api.post(`/ai/summarize/${meetingId}`);
  return response.data;
}

export async function getMeetingSummary(meetingId: string): Promise<AISummary | null> {
  const response = await api.get(`/ai/summary/${meetingId}`);
  return response.data.data;
}

export async function getMeetingTranscript(meetingId: string) {
  const response = await api.get(`/ai/transcript/${meetingId}`);
  return response.data.data;
}

export async function getActionItems(meetingId: string): Promise<MeetingActionItem[]> {
  const response = await api.get(`/ai/action-items/${meetingId}`);
  return response.data.data;
}
