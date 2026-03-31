/**
 * TypeScript type definitions matching the FastAPI schemas.
 */

export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface UserCreate {
  username: string;
  email: string;
  password: string;
}

export interface UserLogin {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
export type TaskSource = 'github' | 'local_db' | 'local_src';

export interface Task {
  id: number;
  user_id: number;
  repo_url: string;
  source_type: TaskSource;
  source_path: string | null;
  force: boolean;
  language: string;
  status: TaskStatus;
  error_message: string | null;
  result_path: string | null;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
}

export type LLMDecision = 'true' | 'false' | 'more' | 'raw';

export interface IssueSummary {
  id: string;
  name: string;
  file: string;
  line: number;
  status: LLMDecision;
  finalized: boolean;
  issue_type: string;
  repo: string;
  manual_decision: string | null;
}

export interface CodeSnippet {
  label: string;
  language: string;
  content: string;
}

export interface IssueDetail extends IssueSummary {
  snippets: CodeSnippet[];
  summary: string | null;
  raw_data: Record<string, unknown> | null;
  final_data: Array<Record<string, unknown>> | null;
}

export interface IssueDecisionUpdate {
  decision: string | null;
}

export type WsMessageType = 'log' | 'status' | 'error' | 'done';

export interface WsMessage {
  type: WsMessageType;
  content: string;
  result_path?: string;
  timestamp: string;
}

export interface TaskLogResponse {
  lines: WsMessage[];
}

export interface TaskCreate {
  source_type: TaskSource;
  repo_url?: string | null;
  source_path?: string | null;
  language: string;
  force?: boolean;
}

export interface RepoStat {
  repo: string;
  total: number;
  true_count: number;
  false_count: number;
  more_count: number;
}

export interface ConfigValidationResponse {
  valid: boolean;
  errors: string[];
}
