import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AgentMetrics, AgentResult, AgentType } from '@internal/shannon-shared';

export interface SessionState {
  sessionId: string;
  targetUrl: string;
  status: 'in_progress' | 'completed' | 'failed';
  completedAgents: AgentType[];
  failedAgents: Array<{ agent: AgentType; error: string }>;
  currentPhase: string;
  gitCheckpoint?: string;
  metrics: AgentMetrics;
  startedAt: string;
  completedAt?: string;
}

export class SessionManager {
  private readonly statePath: string;

  constructor(workspacePath: string, sessionId: string) {
    const sessionsDir = path.join(workspacePath, '.shannon');
    fs.mkdirSync(sessionsDir, { recursive: true });
    this.statePath = path.join(sessionsDir, `${sessionId}.json`);
  }

  load(): SessionState | null {
    try {
      return JSON.parse(fs.readFileSync(this.statePath, 'utf-8')) as SessionState;
    } catch {
      return null;
    }
  }

  save(state: SessionState): void {
    const tmp = `${this.statePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, this.statePath);
  }

  markAgentCompleted(state: SessionState, agent: AgentType, result: AgentResult): void {
    if (!state.completedAgents.includes(agent)) {
      state.completedAgents.push(agent);
    }
    state.metrics.perAgent[agent] = {
      cost: result.cost,
      turns: result.turnCount,
      durationMs: result.durationMs,
    };
    state.metrics.totalCost += result.cost;
    state.metrics.totalTurns += result.turnCount;
    state.metrics.totalDurationMs += result.durationMs;
    this.save(state);
  }

  static create(sessionId: string, targetUrl: string, workspacePath: string): SessionManager {
    const mgr = new SessionManager(workspacePath, sessionId);
    const state: SessionState = {
      sessionId,
      targetUrl,
      status: 'in_progress',
      completedAgents: [],
      failedAgents: [],
      currentPhase: 'pre-recon',
      metrics: { totalCost: 0, totalTurns: 0, totalDurationMs: 0, perAgent: {} },
      startedAt: new Date().toISOString(),
    };
    mgr.save(state);
    return mgr;
  }
}
