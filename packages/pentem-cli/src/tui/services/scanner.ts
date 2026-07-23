import { execSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  DEFAULT_RATE_LIMIT,
  TokenBucketRateLimiter,
  computeScopeFromTarget,
  validateUrlAgainstScope,
} from '@internal/pentem-shared';
import type { AgentProgress } from './agent-runner.ts';
import { AuthSessionManager } from './auth-session.ts';
import { DirectAgentPipeline } from './direct-agent.ts';
import { analyzeFalsePositives } from './false-positive.ts';
import { ManualScanner } from './manual-scanner.ts';
import { detectFromEnvOrConfig } from './providers-config.ts';
import { generateSarifReport, getExitCode } from './sarif-output.ts';
import { findAttackChains } from './vuln-chaining.ts';

export interface ScanStartResult {
  success: boolean;
  error?: string;
  sessionId?: string;
  manual?: boolean;
  exitCode?: number;
  sarifPath?: string;
}

export const scanEvents = new EventEmitter();

let globalRateLimiter: TokenBucketRateLimiter | null = null;

export function getRateLimiter(): TokenBucketRateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new TokenBucketRateLimiter(
      DEFAULT_RATE_LIMIT.requestsPerSecond,
      DEFAULT_RATE_LIMIT.burstSize,
      DEFAULT_RATE_LIMIT.concurrency,
    );
    globalRateLimiter.start();
  }
  return globalRateLimiter;
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function getWorkspacePath(): string {
  const p = process.env.PENTEM_LOCAL
    ? path.resolve(process.cwd(), 'workspaces')
    : path.join(os.homedir(), '.pentem', 'workspaces');
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export async function startScan(url: string, manual = false): Promise<ScanStartResult> {
  if (!validateUrl(url)) return { success: false, error: 'Invalid target URL' };

  const scope = computeScopeFromTarget(url);
  const validation = validateUrlAgainstScope(url, url, scope);
  if (!validation.allowed) {
    return { success: false, error: `URL blocked by scope: ${validation.reason}` };
  }

  const workspacePath = getWorkspacePath();

  if (manual) {
    return startManualScan(url, workspacePath);
  }

  const provider = detectFromEnvOrConfig();
  if (!provider.configured) {
    return { success: false, error: provider.error || 'No LLM provider configured' };
  }

  return startDirectScan(url, provider, workspacePath);
}

async function startManualScan(url: string, workspacePath: string): Promise<ScanStartResult> {
  try {
    const sessionId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sessionsDir = path.join(workspacePath, '.pentem');
    fs.mkdirSync(sessionsDir, { recursive: true });

    const session: {
      sessionId: string;
      targetUrl: string;
      status: string;
      completedAgents: string[];
      failedAgents: string[];
      currentPhase: string;
      metrics: { totalCost: number; totalTurns: number; totalDurationMs: number; perAgent: Record<string, unknown> };
      startedAt: string;
      completedAt?: string;
    } = {
      sessionId,
      targetUrl: url,
      status: 'in_progress',
      completedAgents: [],
      failedAgents: [],
      currentPhase: 'manual-scan',
      metrics: { totalCost: 0, totalTurns: 0, totalDurationMs: 0, perAgent: {} },
      startedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(sessionsDir, `${sessionId}.json`), JSON.stringify(session, null, 2));

    const authSession = new AuthSessionManager(path.join(workspacePath, sessionId, 'auth-session.json'));
    const scanner = new ManualScanner(url, authSession, getRateLimiter());

    scanner
      .run()
      .then((result) => {
        const auditDir = path.join(workspacePath, sessionId, 'audit');
        fs.mkdirSync(auditDir, { recursive: true });
        fs.writeFileSync(path.join(auditDir, 'final-report.md'), result.report, 'utf-8');

        const fpAnalyzed = analyzeFalsePositives(result.findings);
        const realFindings = fpAnalyzed.filter((f) => !f.isFp);
        const chains = findAttackChains(realFindings);

        let enhancedReport = result.report;
        if (chains.length > 0) {
          enhancedReport += '\n\n## Attack Chains\n\n';
          for (const chain of chains) {
            enhancedReport += `### ${chain.name}\n\n`;
            enhancedReport += `**Severity:** ${chain.severity.toUpperCase()}\n`;
            enhancedReport += `**Likelihood:** ${chain.likelihood}\n`;
            enhancedReport += `**Impact:** ${chain.impact}\n\n`;
            enhancedReport += '**Steps:**\n';
            for (const step of chain.steps) {
              enhancedReport += `- ${step.description}\n`;
            }
            enhancedReport += '\n';
          }
        }

        if (fpAnalyzed.some((f) => f.isFp)) {
          enhancedReport += '\n## False Positive Analysis\n\n';
          enhancedReport += '| Finding | Reason |\n|---------|--------|\n';
          for (const f of fpAnalyzed) {
            if (f.isFp) {
              enhancedReport += `| ${f.type}: ${f.description} | ${f.fpReason} |\n`;
            }
          }
          enhancedReport += '\n';
        }

        fs.writeFileSync(path.join(auditDir, 'final-report.md'), enhancedReport, 'utf-8');

        const sarifPath = path.join(auditDir, 'report.sarif');
        generateSarifReport(realFindings, url, 'Pentem Manual Scanner', sarifPath);

        session.status = realFindings.some((f) => f.severity === 'critical' || f.severity === 'high')
          ? 'completed'
          : 'completed';
        session.completedAt = new Date().toISOString();
        session.completedAgents = ['manual-scanner'];
        fs.writeFileSync(path.join(sessionsDir, `${sessionId}.json`), JSON.stringify(session, null, 2));

        scanEvents.emit('scanProgress', sessionId, {
          phase: 'report',
          agent: 'system',
          status: 'completed',
          message: `Manual scan complete — ${realFindings.length} findings (${fpAnalyzed.filter((f) => f.isFp).length} FP filtered)`,
        } as AgentProgress);
      })
      .catch((err) => {
        session.status = 'failed';
        session.completedAt = new Date().toISOString();
        fs.writeFileSync(path.join(sessionsDir, `${sessionId}.json`), JSON.stringify(session, null, 2));
        scanEvents.emit('scanProgress', sessionId, {
          phase: 'error',
          agent: 'system',
          status: 'failed',
          message: `Manual scan error: ${err.message}`,
        } as AgentProgress);
      });

    return { success: true, sessionId, manual: true };
  } catch (err) {
    return { success: false, error: `Failed to start manual scan: ${err}` };
  }
}

async function startDirectScan(
  url: string,
  provider: { provider: string; apiKey?: string; model?: string; baseUrl?: string },
  workspacePath: string,
): Promise<ScanStartResult> {
  try {
    const pipeline = new DirectAgentPipeline(
      {
        type: provider.provider as import('../../providers.ts').ProviderType,
        configured: true,
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl,
        model: provider.model,
      },
      url,
      workspacePath,
    );

    const session = pipeline.getSession();

    pipeline.onProgress((progress: AgentProgress) => {
      scanEvents.emit('scanProgress', session.sessionId, progress);
    });

    pipeline.run().catch((err: Error) => {
      scanEvents.emit('scanProgress', session.sessionId, {
        phase: 'error',
        agent: 'system',
        status: 'failed',
        message: `Pipeline error: ${err.message}`,
      } as AgentProgress);
    });

    return { success: true, sessionId: session.sessionId };
  } catch (err) {
    return { success: false, error: `Failed to start scan: ${err}` };
  }
}

export function stopScan(sessionId: string): void {
  const workspacePath = getWorkspacePath();
  const sessionPath = path.join(workspacePath, '.pentem', `${sessionId}.json`);
  if (fs.existsSync(sessionPath)) {
    try {
      const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      session.status = 'failed';
      session.completedAt = new Date().toISOString();
      fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
    } catch {}
  }

  // Clean up Docker if it was used
  const composeFile = path.join(workspacePath, '.pentem', 'docker-compose.yml');
  if (fs.existsSync(composeFile)) {
    try {
      execSync(`docker compose -f "${composeFile}" down`, { stdio: 'pipe', timeout: 30000 });
    } catch {}
  }
}

export async function resumeScan(sessionId: string): Promise<ScanStartResult> {
  const workspacePath = getWorkspacePath();
  const sessionPath = path.join(workspacePath, '.pentem', `${sessionId}.json`);

  if (!fs.existsSync(sessionPath)) {
    return { success: false, error: `Session not found: ${sessionId}` };
  }

  let sessionData: Record<string, unknown>;
  try {
    sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
  } catch {
    return { success: false, error: `Failed to read session data: ${sessionId}` };
  }

  const status = sessionData.status as string;
  if (status === 'completed') {
    return { success: false, error: `Session ${sessionId} is already completed` };
  }

  const targetUrl = sessionData.targetUrl as string;
  const existingAgents = (sessionData.completedAgents as string[]) || [];

  const provider = detectFromEnvOrConfig();
  if (!provider.configured) {
    return { success: false, error: provider.error || 'No LLM provider configured' };
  }

  const sessionFromFile: import('./direct-agent.ts').ScanSession = {
    sessionId,
    targetUrl,
    status: 'in_progress',
    completedAgents: existingAgents,
    failedAgents: (sessionData.failedAgents as import('./direct-agent.ts').ScanSession['failedAgents']) || [],
    currentPhase: (sessionData.currentPhase as string) || 'pre-recon',
    metrics: (sessionData.metrics as import('./direct-agent.ts').ScanSession['metrics']) || {
      totalCost: 0,
      totalTurns: 0,
      totalDurationMs: 0,
      perAgent: {},
    },
    startedAt: (sessionData.startedAt as string) || new Date().toISOString(),
  };

  const pipeline = new DirectAgentPipeline(
    {
      type: provider.provider as import('../../providers.ts').ProviderType,
      configured: true,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      model: provider.model,
    },
    targetUrl,
    workspacePath,
    sessionFromFile,
  );

  pipeline.onProgress((progress: import('./agent-runner.ts').AgentProgress) => {
    scanEvents.emit('scanProgress', sessionId, progress);
  });

  pipeline.run().catch((err: Error) => {
    scanEvents.emit('scanProgress', sessionId, {
      phase: 'error',
      agent: 'system',
      status: 'failed',
      message: `Resume error: ${err.message}`,
    } as import('./agent-runner.ts').AgentProgress);
  });

  return { success: true, sessionId };
}

export function cleanStoppedScans(): void {
  const workspacePath = getWorkspacePath();
  const composeFile = path.join(workspacePath, '.pentem', 'docker-compose.yml');
  if (fs.existsSync(composeFile)) {
    try {
      execSync(`docker compose -f "${composeFile}" down`, { stdio: 'pipe', timeout: 30000 });
    } catch {}
  }
}
