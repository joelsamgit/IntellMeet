import api from './axios';
import type { Meeting } from '../types';

export const createMeeting = async (data: {
  title: string;
  scheduledTime: string;
  description?: string;
  participantIds?: string[];
  status?: string;
}) => {
  const response = await api.post('/meetings/create', data);
  return response.data;
};

export const listMeetings = async (): Promise<Meeting[]> => {
  const response = await api.get('/meetings');
  return response.data.meetings || [];
};

export const getMeetingDetails = async (id: string): Promise<Meeting> => {
  const response = await api.get(`/meetings/${id}`);
  return response.data.meeting;
};

export const updateMeeting = async (
  id: string,
  data: Partial<{
    title: string;
    description: string;
    scheduledTime: string;
    endTime: string | null;
    status: string;
    summary: string;
    recording: string;
    participantIds: string[];
  }>
) => {
  const response = await api.put(`/meetings/${id}`, data);
  return response.data;
};

export const deleteMeeting = async (id: string) => {
  const response = await api.delete(`/meetings/${id}`);
  return response.data;
};
