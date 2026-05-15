import { execSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AgentProgress } from './agent-runner.ts';
import { DirectAgentPipeline } from './direct-agent.ts';
import { ManualScanner } from './manual-scanner.ts';
import { detectFromEnvOrConfig } from './providers-config.ts';

export interface ScanStartResult {
  success: boolean;
  error?: string;
  sessionId?: string;
  manual?: boolean;
}

export const scanEvents = new EventEmitter();

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

  const workspacePath = getWorkspacePath();

  if (manual) {
    return startManualScan(url, workspacePath);
  }

  // Agentic mode — requires API key
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

    const scanner = new ManualScanner(url);

    // Run async and emit progress
    scanner
      .run()
      .then((result) => {
        // Save report
        const auditDir = path.join(workspacePath, sessionId, 'audit');
        fs.mkdirSync(auditDir, { recursive: true });
        fs.writeFileSync(path.join(auditDir, 'final-report.md'), result.report, 'utf-8');

        // Update session
        session.status = result.findings.some((f) => f.severity === 'critical' || f.severity === 'high')
          ? 'completed'
          : 'completed';
        session.completedAt = new Date().toISOString();
        session.completedAgents = ['manual-scanner'];
        fs.writeFileSync(path.join(sessionsDir, `${sessionId}.json`), JSON.stringify(session, null, 2));

        scanEvents.emit('scanProgress', sessionId, {
          phase: 'report',
          agent: 'system',
          status: 'completed',
          message: `Manual scan complete — ${result.findings.length} findings`,
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

export function cleanStoppedScans(): void {
  const workspacePath = getWorkspacePath();
  const composeFile = path.join(workspacePath, '.pentem', 'docker-compose.yml');
  if (fs.existsSync(composeFile)) {
    try {
      execSync(`docker compose -f "${composeFile}" down`, { stdio: 'pipe', timeout: 30000 });
    } catch {}
  }
}
