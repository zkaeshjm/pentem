export const VULNERABILITY_AGENTS = ['sqli', 'xss', 'auth-bypass', 'authz-bypass', 'ssrf'] as const;
export const ALL_VULNERABILITY_TYPES = [
  ...VULNERABILITY_AGENTS,
  'csrf',
  'lfi',
  'xxe',
  'ssti',
  'business-logic',
  'race-condition',
  'deserialization',
  'insecure-config',
  'information-disclosure',
] as const;

export type AgentType = (typeof VULNERABILITY_AGENTS)[number];
export type VulnerabilityType = (typeof ALL_VULNERABILITY_TYPES)[number];

export type AgentCategory = 'vuln' | 'exploit';
export type ModelTier = 'small' | 'medium' | 'large';

export interface AgentParams {
  agentType: AgentType;
  category: AgentCategory;
  targetUrl: string;
  config: string;
  auditDir: string;
  workspacePath: string;
  sessionId: string;
  phaseResults?: Record<string, string>;
  vulnResult?: AgentResult;
}

export interface AgentResult {
  analysisPath: string;
  exploitationQueuePath: string;
  deliverables: string[];
  turnCount: number;
  cost: number;
  durationMs: number;
  error?: string;
}

export interface AgentMetrics {
  totalCost: number;
  totalTurns: number;
  totalDurationMs: number;
  perAgent: Record<string, { cost: number; turns: number; durationMs: number }>;
}
