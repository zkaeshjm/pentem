import type { AgentType } from './agent-types.js';
import type { PentemConfig } from './config-types.js';

export type PipelinePhase = 'pre-recon' | 'recon' | 'vuln' | 'exploit' | 'report';

export interface PipelineParams {
  sessionId: string;
  targetUrl: string;
  config: PentemConfig;
  workspacePath: string;
  auditDir: string;
  resumeFrom?: Record<AgentType, boolean>;
}

export interface PipelineResult {
  sessionId: string;
  success: boolean;
  phases: Record<PipelinePhase, PhaseResult>;
  reportPath?: string;
  error?: string;
}

export interface PhaseResult {
  startedAt: string;
  completedAt?: string;
  success: boolean;
  error?: string;
}

export interface Phase1Result {
  nmap: string;
  subfinder: string;
  whatweb: string;
  sourceAnalysis: string;
}

export interface Phase2Result {
  browserExploration: string;
  apiMapping: string;
}
