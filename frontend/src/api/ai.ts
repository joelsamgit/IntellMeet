import api from './axios';
import type { AISummary, MeetingActionItem } from '@/types';

export async function transcribeMeeting(meetingId: string, audioBlob: Blob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await api.post(`/ai/meetings/${meetingId}/transcribe`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return response.data;
}

export async function processMeeting(meetingId: string, audioBlob: Blob, segments?: any[]) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  if (segments) {
    formData.append('segments', JSON.stringify(segments));
  }

  const response = await api.post(`/ai/meetings/${meetingId}/process`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return response.data;
}

export async function summarizeMeeting(meetingId: string) {
  const response = await api.post(`/ai/meetings/${meetingId}/summary`);
  return response.data;
}

export async function getMeetingSummary(meetingId: string): Promise<AISummary | null> {
  const response = await api.get(`/ai/meetings/${meetingId}/summary`);
  return response.data.data;
}

export async function getMeetingTranscript(meetingId: string) {
  const response = await api.get(`/ai/meetings/${meetingId}/transcript`);
  return response.data.data;
}

export async function getActionItems(meetingId: string): Promise<MeetingActionItem[]> {
  const response = await api.get(`/ai/meetings/${meetingId}/action-items`);
  return response.data.data;
}
