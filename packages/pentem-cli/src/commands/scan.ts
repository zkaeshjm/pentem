import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { detectProvider } from '../providers.ts';
import { DirectAgentPipeline } from '../tui/services/direct-agent.ts';
import { ManualScanner } from '../tui/services/manual-scanner.ts';
import { saveSessionOutput } from '../tui/services/workspace.ts';
import type { AgentProgress } from '../tui/services/agent-runner.ts';

export interface ScanOptions {
  config?: string;
  url: string;
  manual?: boolean;
  output?: string;
  saveLogs?: string;
}

export async function scanCommand(options: ScanOptions): Promise<void> {
  if (options.config) {
    console.log(`[pentem] Config option: ${options.config}`);
  }

  try {
    new URL(options.url);
  } catch {
    console.error('[pentem] Invalid target URL');
    process.exit(1);
  }

  if (options.manual) {
    await runManualScan(options.url, options.saveLogs, options.output);
    return;
  }

  await runAgenticScan(options.url, options.saveLogs, options.output);
}

async function runManualScan(url: string, saveLogs?: string, output?: string): Promise<void> {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║    Pentem Manual Security Scan          ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`  Target: ${url}`);
  console.log(`  Mode: Manual (no AI)`);
  console.log(``);

  const scanner = new ManualScanner(url);
  const result = await scanner.run();

  console.log(`\n  ═══════════════════════════════════════`);
  console.log(`  Scan complete!`);
  console.log(`  Requests made: ${result.log.length}`);
  console.log(`  Findings: ${result.findings.length}`);
  console.log(`  Critical: ${result.findings.filter((f) => f.severity === 'critical').length}`);
  console.log(`  High: ${result.findings.filter((f) => f.severity === 'high').length}`);
  console.log(`  Medium: ${result.findings.filter((f) => f.severity === 'medium').length}`);
  console.log(`  Low: ${result.findings.filter((f) => f.severity === 'low').length}`);
  console.log(``);

  // Save report and logs
  const workspacePath = process.env.PENTEM_LOCAL
    ? path.resolve(process.cwd(), 'workspaces')
    : path.join(os.homedir(), '.pentem', 'workspaces');
  const sessionId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const auditDir = path.join(workspacePath, sessionId, 'audit');
  fs.mkdirSync(auditDir, { recursive: true });

  // Save report
  fs.writeFileSync(path.join(auditDir, 'final-report.md'), result.report, 'utf-8');

  // Save log
  const logContent = scanner.generateLogContent();
  fs.writeFileSync(path.join(auditDir, 'request-log.md'), logContent, 'utf-8');

  // Save session state
  const sessionsDir = path.join(workspacePath, '.pentem');
  fs.mkdirSync(sessionsDir, { recursive: true });
  const session = {
    sessionId, targetUrl: url, status: 'completed' as const,
    completedAgents: ['manual-scanner'], failedAgents: [],
    currentPhase: 'complete',
    metrics: { totalCost: 0, totalTurns: 0, totalDurationMs: 0, perAgent: {} },
    startedAt: new Date(Date.now() - 5000).toISOString(),
    completedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(sessionsDir, `${sessionId}.json`), JSON.stringify(session, null, 2));

  // Save to custom output directory if specified
  if (saveLogs) {
    const saved = saveSessionOutput(sessionId, saveLogs);
    if (saved) console.log(`  Logs saved to: ${saved}`);
  }
  if (output) {
    fs.writeFileSync(output, result.report, 'utf-8');
    console.log(`  Report saved to: ${output}`);
  }

  console.log(`  Session: ${sessionId}`);
  console.log(`  Report: pentem report ${sessionId}`);
  console.log(`  Logs:   pentem report ${sessionId} --logs`);
  console.log(`  Save:   pentem report ${sessionId} --save ./pentem-output`);
  console.log(``);

  // Show full report in terminal
  console.log(result.report);
  console.log(``);
  console.log(`  ═══════════════════════════════════════`);
  console.log(`  Raw request log (${result.log.length} requests):`);
  console.log(`  pentem report ${sessionId} --logs`);
  if (saveLogs || output) {
    console.log(`  Output saved to: ${saveLogs || output}`);
  }
  console.log(`  ═══════════════════════════════════════`);
}

async function runAgenticScan(url: string, saveLogs?: string, output?: string): Promise<void> {
  const provider = detectProvider();
  if (!provider.configured) {
    console.error(`[pentem] ${provider.validationError}`);
    process.exit(1);
  }

  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  Pentem AI Agent Penetration Test       ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`  Target: ${url}`);
  console.log(`  Provider: ${provider.type.toUpperCase()}`);
  console.log(`  Model: ${provider.model || 'default'}`);
  console.log(``);

  const workspacePath = process.env.PENTEM_LOCAL
    ? path.resolve(process.cwd(), 'workspaces')
    : path.join(os.homedir(), '.pentem', 'workspaces');
  fs.mkdirSync(workspacePath, { recursive: true });

  const pipeline = new DirectAgentPipeline(
    {
      type: provider.type as any, configured: true,
      apiKey: provider.apiKey, baseUrl: provider.baseUrl, model: provider.model,
    },
    url, workspacePath,
  );

  const session = pipeline.getSession();
  console.log(`  Session: ${session.sessionId}\n`);

  pipeline.onProgress((progress: AgentProgress) => {
    if (progress.status === 'started' && progress.agent === 'system') {
      const names: Record<string, string> = {
        'pre-recon': 'Phase 1/5: Reconnaissance', 'recon': 'Phase 2/5: Target Exploration',
        'vuln': 'Phase 3/5: Vulnerability Analysis', 'exploit': 'Phase 4/5: Exploitation',
        'report': 'Phase 5/5: Report Generation',
      };
      console.log(`  ▶ ${names[progress.phase] || progress.phase}`);
    }
    if (progress.status === 'progress' && progress.agent !== 'system') {
      process.stdout.write(`    ${progress.agent}: ${progress.message}\r`);
    }
    if (progress.status === 'completed' && progress.agent !== 'system') {
      console.log(`    ✓ ${progress.agent} complete`);
    }
    if (progress.status === 'failed') {
      console.log(`    ✗ ${progress.agent || 'system'}: ${progress.message}`);
    }
  });

  await pipeline.run();

  const s = pipeline.getSession();
  console.log(`\n  ═══════════════════════════════════════`);
  console.log(`  Status: ${s.status === 'completed' ? 'COMPLETED' : 'FAILED'}`);
  console.log(`  Duration: ${(s.metrics.totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`  Agents: ${s.completedAgents.length} done, ${s.failedAgents.length} failed`);

  // Save output
  if (saveLogs) {
    const saved = saveSessionOutput(s.sessionId, saveLogs);
    if (saved) console.log(`  Logs saved to: ${saved}`);
  }

  console.log(`  Session: ${s.sessionId}`);
  console.log(`  Report: pentem report ${s.sessionId}`);
  console.log(`  Logs:   pentem report ${s.sessionId} --logs`);
  console.log(`  Save:   pentem report ${s.sessionId} --save ./pentem-output`);
  console.log(``);

  // Show report
  const reportPath = path.join(workspacePath, session.sessionId, 'audit', 'final-report.md');
  if (fs.existsSync(reportPath)) {
    const report = fs.readFileSync(reportPath, 'utf-8');
    console.log(report);
  }
}
