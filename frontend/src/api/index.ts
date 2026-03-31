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
  validate: () =>
    api.get<ConfigValidationResponse>('/api/system/validate').then((r) => r.data),
};
