import api from './axios';
import type { Task } from '../types';

export const listTasks = async (teamId?: string): Promise<Task[]> => {
  const url = teamId ? `/tasks?teamId=${teamId}` : '/tasks';
  const response = await api.get(url);
  return response.data.tasks || [];
};

export const createTask = async (data: {
  title: string;
  description?: string;
  assigneeId?: string;
  teamId?: string;
  priority?: "low" | "medium" | "high";
  status?: "todo" | "inprogress" | "done";
  dueDate?: string;
}) => {
  const response = await api.post('/tasks', data);
  return response.data;
};

export const getTask = async (id: string): Promise<Task> => {
  const response = await api.get(`/tasks/${id}`);
  return response.data.task;
};

export const updateTask = async (
  id: string,
  data: Partial<{
    title: string;
    description: string;
    assigneeId: string | null;
    teamId: string | null;
    priority: "low" | "medium" | "high";
    status: "todo" | "inprogress" | "done";
    dueDate: string | null;
  }>
) => {
  const response = await api.put(`/tasks/${id}`, data);
  return response.data;
};

export const deleteTask = async (id: string) => {
  const response = await api.delete(`/tasks/${id}`);
  return response.data;
};
