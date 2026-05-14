import type { AgentResult, AgentType, ModelTier } from '@internal/pentem-shared';
import { runAgent } from '../agents/agent-runner.js';

export interface AgentActivityParams {
  agentType: string;
  targetUrl: string;
  configJson: string;
  auditDir: string;
  workspacePath: string;
  sessionId: string;
  modelTier?: string;
  phaseResults?: Record<string, string>;
}

export async function runVulnAgent(params: AgentActivityParams): Promise<AgentResult> {
  return runAgent(
    params.agentType as AgentType,
    'vuln',
    params.targetUrl,
    params.configJson,
    params.auditDir,
    (params.modelTier as ModelTier) ?? 'medium',
  );
}

// Specific activity functions for Temporal registration
export async function vulnAgentSqli(params: Omit<AgentActivityParams, 'agentType'>): Promise<AgentResult> {
  return runVulnAgent({ ...params, agentType: 'sqli' });
}

export async function vulnAgentXss(params: Omit<AgentActivityParams, 'agentType'>): Promise<AgentResult> {
  return runVulnAgent({ ...params, agentType: 'xss' });
}

export async function vulnAgentAuthBypass(params: Omit<AgentActivityParams, 'agentType'>): Promise<AgentResult> {
  return runVulnAgent({ ...params, agentType: 'auth-bypass' });
}

export async function vulnAgentAuthzBypass(params: Omit<AgentActivityParams, 'agentType'>): Promise<AgentResult> {
  return runVulnAgent({ ...params, agentType: 'authz-bypass' });
}

export async function vulnAgentSsrf(params: Omit<AgentActivityParams, 'agentType'>): Promise<AgentResult> {
  return runVulnAgent({ ...params, agentType: 'ssrf' });
}
