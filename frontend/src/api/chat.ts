import api from './axios';
import type { Message } from '@/types';

export async function getMeetingChatHistory(meetingId: string): Promise<Message[]> {
  const response = await api.get(`/ai/chat-history/${meetingId}`);
  return response.data.data;
}
