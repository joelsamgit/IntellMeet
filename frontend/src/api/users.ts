import api from './axios';
import type { User } from '../types';

export const listAllUsers = async (): Promise<User[]> => {
  const response = await api.get('/users/all');
  // Admin route might return error for members, so wrap in try-catch in pages
  return response.data.users || [];
};

export const getUserProfile = async (): Promise<User> => {
  const response = await api.get('/users/profile');
  return response.data;
};

export const updateUserProfile = async (data: {
  name?: string;
  bio?: string;
  email?: string;
}) => {
  const response = await api.put('/users/profile', data);
  return response.data;
};

export const uploadAvatar = async (formData: FormData) => {
  const response = await api.post('/users/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};
