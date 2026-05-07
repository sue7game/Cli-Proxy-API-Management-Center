/**
 * 认证文件相关类型
 * 基于原项目 src/modules/auth-files.js
 */

import type { RecentRequestBucket } from '@/utils/recentRequests';

export type AuthFileType =
  | 'qwen'
  | 'kimi'
  | 'gemini'
  | 'gemini-cli'
  | 'aistudio'
  | 'claude'
  | 'codex'
  | 'antigravity'
  | 'iflow'
  | 'vertex'
  | 'empty'
  | 'unknown';

export interface AuthFileItem {
  name: string;
  type?: AuthFileType | string;
  provider?: string;
  size?: number;
  authIndex?: string | number | null;
  runtimeOnly?: boolean | string;
  disabled?: boolean;
  unavailable?: boolean;
  status?: string;
  statusMessage?: string;
  lastRefresh?: string | number;
  modified?: number;
  success?: unknown;
  failed?: unknown;
  recent_requests?: RecentRequestBucket[];
  recentRequests?: RecentRequestBucket[];
  disable_cooling?: boolean;
  auto_disable_429_threshold?: number;
  auto_429_recheck_interval?: number;
  auto_429_count?: number;
  auto_disabled_by_429?: boolean;
  auto_disabled_429_at?: string;
  last_auto_429_at?: string;
  auto_disabled_429_model?: string;
  next_auto_429_recheck_at?: string;
  auto_429_probe_model?: string;
  auto_429_probe_status?: number;
  auto_429_probe_error?: string;
  has_auto_429_events?: boolean;
  auto_429_event_count?: number;
  [key: string]: unknown;
}

export interface AuthFilesResponse {
  files: AuthFileItem[];
  total?: number;
}

export interface AuthFileAuto429Event {
  time: string;
  type: string;
  model: string;
  result: string;
}
