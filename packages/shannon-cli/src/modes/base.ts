import type { LoadedConfig } from '../config-loader.ts';

export interface ModeContext {
  workspacePath: string;
  configPath?: string;
  config: LoadedConfig;
  taskQueue: string;
  sessionId: string;
}

export function generateSessionId(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateTaskQueue(sessionId: string): string {
  return `shannon-${sessionId}`;
}
