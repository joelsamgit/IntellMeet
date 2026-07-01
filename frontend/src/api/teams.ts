import api from './axios';

export const listTeams = async () => {
  const response = await api.get('/teams');
  return response.data.teams || [];
};

export const createTeam = async (data: {
  name: string;
  projects?: Array<{ name: string; description?: string }>;
}) => {
  const response = await api.post('/teams', data);
  return response.data;
};

export const getTeamDetails = async (id: string) => {
  const response = await api.get(`/teams/${id}`);
  return response.data.team;
};

export const updateTeam = async (
  id: string,
  data: Partial<{
    name: string;
    projects: Array<{ name: string; description?: string }>;
    memberIds: string[];
  }>
) => {
  const response = await api.put(`/teams/${id}`, data);
  return response.data;
};

export const deleteTeam = async (id: string) => {
  const response = await api.delete(`/teams/${id}`);
  return response.data;
};

export const inviteMember = async (email: string, teamId?: string) => {
  const response = await api.post('/teams/invite', { email, teamId });
  return response.data;
};

export const listPendingInvitations = async () => {
  const response = await api.get('/teams/invitations/pending');
  return response.data.invitations || [];
};

export const respondToInvitation = async (id: string, action: 'accept' | 'decline') => {
  const response = await api.post(`/teams/invitations/${id}/respond`, { action });
  return response.data;
};

export const removeMember = async (teamId: string, memberId: string) => {
  const response = await api.delete(`/teams/${teamId}/members/${memberId}`);
  return response.data;
};
