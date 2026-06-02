import api from './axios';
import type { Message } from '@/types';

export async function getMeetingChatHistory(meetingId: string): Promise<Message[]> {
  const response = await api.get(`/chat/meetings/${meetingId}/messages`);
  const rawMessages = response.data.messages || [];
  return rawMessages.map((msg: any) => ({
    _id: msg._id,
    senderId: msg.sender?._id || '',
    senderName: msg.sender?.name || 'Guest',
    senderAvatar: msg.sender?.avatar || '',
    text: msg.message || '',
    timestamp: msg.createdAt || new Date().toISOString(),
    type: msg.kind === 'file' ? 'file' : 'text',
  }));
}
