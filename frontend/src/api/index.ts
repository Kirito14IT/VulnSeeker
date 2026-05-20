/**
 * Axios instance with JWT interceptor.
 * All API calls go through here.
 */

import axios from 'axios';
import type {
  TokenResponse,
  User,
  UserCreate,
  UserLogin,
  Task,
  TaskWithUser,
  TaskCreate,
  IssueSummary,
  IssueDetail,
  IssueDecisionUpdate,
  TaskLogResponse,
  RepoStat,
  ConfigValidationResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 300_000, // 5 minutes (long enough for analysis)
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach JWT ────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vulnseeker_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle 401 ───────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('vulnseeker_token');
      localStorage.removeItem('vulnseeker_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: UserCreate) =>
    api.post<TokenResponse>('/api/auth/register', data).then((r) => r.data),

  login: (data: UserLogin) =>
    api.post<TokenResponse>('/api/auth/login', data).then((r) => r.data),

  me: () =>
    api.get<User>('/api/auth/me').then((r) => r.data),
};

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const tasksApi = {
  list: () =>
    api.get<Task[]>('/api/tasks').then((r) => r.data),

  get: (id: number) =>
    api.get<Task>(`/api/tasks/${id}`).then((r) => r.data),

  create: (data: TaskCreate) =>
    api.post<Task>('/api/tasks', data).then((r) => r.data),

  delete: (id: number) =>
    api.delete(`/api/tasks/${id}`),

  start: (id: number) =>
    api.post<Task>(`/api/tasks/${id}/start`).then((r) => r.data),

  logs: (id: number) =>
    api.get<TaskLogResponse>(`/api/tasks/${id}/logs`).then((r) => r.data),
};

// ── Results ───────────────────────────────────────────────────────────────────

export const resultsApi = {
  listIssues: (taskId: number) =>
    api.get<IssueSummary[]>(`/api/tasks/${taskId}/issues`).then((r) => r.data),

  getIssue: (taskId: number, issueId: string) =>
    api.get<IssueDetail>(`/api/tasks/${taskId}/issues/${issueId}`).then((r) => r.data),

  updateDecision: (taskId: number, issueId: string, decision: string | null) =>
    api.patch(`/api/tasks/${taskId}/issues/${issueId}`, { decision } as IssueDecisionUpdate),
};

export const legacyApi = {
  listIssues: () =>
    api.get<IssueSummary[]>('/api/legacy/issues').then((r) => r.data),

  getIssue: (issueId: string) =>
    api.get<IssueDetail>(`/api/legacy/issues/${issueId}`).then((r) => r.data),

  updateDecision: (issueId: string, decision: string | null) =>
    api.patch(`/api/legacy/issues/${issueId}`, { decision } as IssueDecisionUpdate),

  stats: () =>
    api.get<RepoStat[]>('/api/legacy/stats').then((r) => r.data),
};

export const systemApi = {
  validate: async (): Promise<ConfigValidationResponse> => {
    const response = await api.get('/api/system/validate');
    return response.data;
  },
  fetchQLDeps: async (): Promise<{ status: string }> => {
    const response = await api.post('/api/system/fetch-ql-deps');
    return response.data;
  },
};

// ── Admin ────────────────────────────────────────────────────────────────────

export const adminApi = {
  listUsers: () =>
    api.get<User[]>('/api/admin/users').then((r) => r.data),

  getUser: (id: number) =>
    api.get<User>(`/api/admin/users/${id}`).then((r) => r.data),

  createUser: (data: { username: string; email: string; password: string; role?: string }) =>
    api.post<User>('/api/admin/users', data).then((r) => r.data),

  updateUser: (id: number, data: { username?: string; email?: string; password?: string; role?: string }) =>
    api.put<User>(`/api/admin/users/${id}`, data).then((r) => r.data),

  deleteUser: (id: number) =>
    api.delete(`/api/admin/users/${id}`),

  // ── Tasks ────────────────────────────────────────────────────────────
  listTasks: () =>
    api.get<TaskWithUser[]>('/api/admin/tasks').then((r) => r.data),

  getTask: (id: number) =>
    api.get<TaskWithUser>(`/api/admin/tasks/${id}`).then((r) => r.data),

  createTask: (data: TaskCreate & { user_id?: number }) =>
    api.post<TaskWithUser>('/api/admin/tasks', data).then((r) => r.data),

  updateTask: (id: number, data: Partial<TaskCreate> & { status?: string; user_id?: number }) =>
    api.put<TaskWithUser>(`/api/admin/tasks/${id}`, data).then((r) => r.data),

  deleteTask: (id: number) =>
    api.delete(`/api/admin/tasks/${id}`),
};
