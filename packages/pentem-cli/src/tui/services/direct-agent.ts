import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import type { ProviderConfig } from '../../providers.ts';
import { AgentRunner, type AgentProgress } from './agent-runner.ts';

export interface ScanSession {
  sessionId: string;
  targetUrl: string;
  status: 'in_progress' | 'completed' | 'failed';
  completedAgents: string[];
  failedAgents: Array<{ agent: string; error: string }>;
  currentPhase: string;
  metrics: { totalCost: number; totalTurns: number; totalDurationMs: number; perAgent: Record<string, unknown> };
  startedAt: string;
  completedAt?: string;
}

const VULN_AGENTS = ['sqli', 'xss', 'auth-bypass', 'authz-bypass', 'ssrf'] as const;
const PHASES = ['pre-recon', 'recon', 'vuln', 'exploit', 'report'] as const;

export class DirectAgentPipeline extends EventEmitter {
  private provider: ProviderConfig;
  private session: ScanSession;
  private workspacePath: string;
  private sessionPath: string;
  private runner: AgentRunner;

  constructor(provider: ProviderConfig, targetUrl: string, workspacePath: string) {
    super();
    this.provider = provider;
    this.workspacePath = workspacePath;
    this.runner = new AgentRunner(provider);

    const sessionId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.session = {
      sessionId,
      targetUrl,
      status: 'in_progress',
      completedAgents: [],
      failedAgents: [],
      currentPhase: 'pre-recon',
      metrics: { totalCost: 0, totalTurns: 0, totalDurationMs: 0, perAgent: {} },
      startedAt: new Date().toISOString(),
    };

    const sessionsDir = path.join(workspacePath, '.pentem');
    fs.mkdirSync(sessionsDir, { recursive: true });
    this.sessionPath = path.join(sessionsDir, `${sessionId}.json`);
    this.saveSession();
  }

  onProgress(cb: (progress: AgentProgress) => void): void {
    this.on('progress', cb);
    this.runner.onProgress(cb);
  }

  getSession(): ScanSession {
    return this.session;
  }

  private saveSession(): void {
    fs.writeFileSync(this.sessionPath, JSON.stringify(this.session, null, 2));
    this.emit('progress', {
      phase: this.session.currentPhase,
      agent: 'system',
      status: 'progress',
      message: `Session state saved`,
    } as AgentProgress);
  }

  private async updatePhase(phase: string): Promise<void> {
    this.session.currentPhase = phase;
    this.saveSession();
  }

  private async addCompletedAgent(agent: string): Promise<void> {
    if (!this.session.completedAgents.includes(agent)) {
      this.session.completedAgents.push(agent);
    }
    this.saveSession();
  }

  private async addFailedAgent(agent: string, error: string): Promise<void> {
    this.session.failedAgents.push({ agent, error });
    this.saveSession();
  }

  private getOutputDir(): string {
    const dir = path.join(this.workspacePath, this.session.sessionId, 'audit');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  async run(): Promise<void> {
    const startTime = Date.now();
    const outputDir = this.getOutputDir();

    try {
      // Phase 1: Pre-recon
      await this.updatePhase('pre-recon');
      this.emit('progress', { phase: 'pre-recon', agent: 'system', status: 'started', message: 'Starting reconnaissance phase...', percent: 0 } as AgentProgress);
      await this.runPreRecon(outputDir);

      // Phase 2: Recon
      await this.updatePhase('recon');
      this.emit('progress', { phase: 'recon', agent: 'system', status: 'started', message: 'Starting reconnaissance phase...', percent: 0 } as AgentProgress);
      await this.runRecon(outputDir);

      // Phase 3: Vulnerability analysis
      await this.updatePhase('vuln');
      this.emit('progress', { phase: 'vuln', agent: 'system', status: 'started', message: 'Starting vulnerability analysis...', percent: 0 } as AgentProgress);
      await this.runVulnAnalysis(outputDir);

      // Phase 4: Exploitation
      await this.updatePhase('exploit');
      this.emit('progress', { phase: 'exploit', agent: 'system', status: 'started', message: 'Starting exploitation phase...', percent: 0 } as AgentProgress);
      await this.runExploitation(outputDir);

      // Phase 5: Report
      await this.updatePhase('report');
      this.emit('progress', { phase: 'report', agent: 'system', status: 'started', message: 'Generating final report...', percent: 0 } as AgentProgress);
      await this.generateReport(outputDir);

      this.session.status = 'completed';
      this.session.completedAt = new Date().toISOString();
      this.session.metrics.totalDurationMs = Date.now() - startTime;
      this.saveSession();

      this.emit('progress', { phase: 'report', agent: 'system', status: 'completed', message: 'Scan completed successfully!', percent: 100 } as AgentProgress);

    } catch (err) {
      this.session.status = 'failed';
      this.session.completedAt = new Date().toISOString();
      this.saveSession();

      const errorMsg = err instanceof Error ? err.message : String(err);
      this.emit('progress', { phase: this.session.currentPhase, agent: 'system', status: 'failed', message: `Scan failed: ${errorMsg}` } as AgentProgress);
    }
  }

  private async runPreRecon(outputDir: string): Promise<void> {
    const context = JSON.stringify({ targetUrl: this.session.targetUrl });
    const fsDir = path.join(outputDir, 'pre-recon', 'deliverables');
    fs.mkdirSync(fsDir, { recursive: true });

    try {
      const result = await this.runner.runAgent('recon', 'pre-recon', this.session.targetUrl, context, outputDir);
      await this.addCompletedAgent('pre-recon');
      this.emit('progress', { phase: 'pre-recon', agent: 'system', status: 'completed', message: 'Pre-recon complete - target information gathered', percent: 100 } as AgentProgress);
    } catch (err) {
      await this.addFailedAgent('pre-recon', err instanceof Error ? err.message : String(err));
    }
  }

  private async runRecon(outputDir: string): Promise<void> {
    this.emit('progress', { phase: 'recon', agent: 'browser', status: 'started', message: 'Probing target endpoints...', percent: 0 } as AgentProgress);

    try {
      const context = JSON.stringify({ targetUrl: this.session.targetUrl });
      const result = await this.runner.runAgent('explore', 'recon', this.session.targetUrl, context, outputDir);
      await this.addCompletedAgent('recon');
      this.emit('progress', { phase: 'recon', agent: 'system', status: 'completed', message: 'Recon complete - endpoints mapped', percent: 100 } as AgentProgress);
    } catch (err) {
      await this.addFailedAgent('recon', err instanceof Error ? err.message : String(err));
    }
  }

  private async runVulnAnalysis(outputDir: string): Promise<void> {
    const context = JSON.stringify({ targetUrl: this.session.targetUrl });
    const results: Array<{ agent: string; analysis: string; queue: string }> = [];

    for (const agent of VULN_AGENTS) {
      try {
        const result = await this.runner.runAgent(agent, 'vuln', this.session.targetUrl, context, outputDir);
        results.push({ agent, ...result });
        await this.addCompletedAgent(`vuln-${agent}`);
      } catch (err) {
        await this.addFailedAgent(`vuln-${agent}`, err instanceof Error ? err.message : String(err));
      }
    }

    this.emit('progress', { phase: 'vuln', agent: 'system', status: 'completed', message: `Vulnerability analysis complete - ${results.length} agents finished`, percent: 100 } as AgentProgress);
  }

  private async runExploitation(outputDir: string): Promise<void> {
    const context = JSON.stringify({ targetUrl: this.session.targetUrl, phase: 'exploit' });

    for (const agent of VULN_AGENTS) {
      try {
        const result = await this.runner.runAgent(agent, 'exploit', this.session.targetUrl, context, outputDir);
        await this.addCompletedAgent(`exploit-${agent}`);
      } catch (err) {
        await this.addFailedAgent(`exploit-${agent}`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  private async generateReport(outputDir: string): Promise<void> {
    const reportPath = path.join(outputDir, 'final-report.md');
    const lines: string[] = [
      `# Pentem Security Assessment Report`,
      ``,
      `**Target:** ${this.session.targetUrl}`,
      `**Session:** ${this.session.sessionId}`,
      `**Date:** ${new Date().toISOString()}`,
      `**Status:** ${this.session.status}`,
      ``,
      `## Summary`,
      ``,
      `- **Total Agents:** ${VULN_AGENTS.length * 2 + 2} (pre-recon + recon + ${VULN_AGENTS.length} vuln + ${VULN_AGENTS.length} exploit)`,
      `- **Completed:** ${this.session.completedAgents.length}`,
      `- **Failed:** ${this.session.failedAgents.length}`,
      `- **Duration:** ${(this.session.metrics.totalDurationMs / 1000).toFixed(1)}s`,
      ``,
      `## Deliverables`,
      ``,
      `Each agent's findings are available in the audit directory:`,
      `  \`${path.relative(this.workspacePath, outputDir)}\``,
      ``,
      `### Vulnerability Agents`,
      ``,
      ...VULN_AGENTS.map((a) => {
        const completed = this.session.completedAgents.includes(`vuln-${a}`);
        const failed = this.session.failedAgents.find((f) => f.agent === `vuln-${a}`);
        return `- **${a.toUpperCase()}**: ${completed ? '✅ Completed' : failed ? `❌ Failed: ${failed.error}` : '⏳ Pending'}`;
      }),
      ``,
      `### Exploit Agents`,
      ``,
      ...VULN_AGENTS.map((a) => {
        const completed = this.session.completedAgents.includes(`exploit-${a}`);
        const failed = this.session.failedAgents.find((f) => f.agent === `exploit-${a}`);
        return `- **${a.toUpperCase()}**: ${completed ? '✅ Completed' : failed ? `❌ Failed: ${failed.error}` : '⏳ Pending'}`;
      }),
      ``,
      `---`,
      `*Generated by Pentem - Autonomous Penetration Testing Framework*`,
    ];

    fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
    this.emit('progress', { phase: 'report', agent: 'system', status: 'completed', message: 'Final report generated', percent: 100 } as AgentProgress);
  }
}
