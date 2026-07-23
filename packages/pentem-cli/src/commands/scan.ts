import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { computeScopeFromTarget, validateUrlAgainstScope } from '@internal/pentem-shared';
import { detectProvider } from '../providers.ts';
import type { AgentProgress } from '../tui/services/agent-runner.ts';
import { AuthSessionManager } from '../tui/services/auth-session.ts';
import { DirectAgentPipeline } from '../tui/services/direct-agent.ts';
import { analyzeFalsePositives } from '../tui/services/false-positive.ts';
import { ManualScanner } from '../tui/services/manual-scanner.ts';
import { PluginHost, PluginLoader } from '../tui/services/plugin-sdk/index.ts';
import { exportFindings } from '../tui/services/collaboration/export.ts';
import { loadNotificationConfig } from '../tui/services/collaboration/config.ts';
import { generateSarifReport, getExitCode } from '../tui/services/sarif-output.ts';
import { getRateLimiter } from '../tui/services/scanner.ts';
import { findAttackChains } from '../tui/services/vuln-chaining.ts';
import { saveSessionOutput } from '../tui/services/workspace.ts';

export interface ScanOptions {
  config?: string;
  url: string;
  manual?: boolean;
  output?: string;
  saveLogs?: string;
  notify?: string;
  share?: string;
  sarif?: boolean;
  exitCode?: boolean;
  scope?: string;
}

export async function scanCommand(options: ScanOptions): Promise<void> {
  if (options.config) {
    console.log(`[pentem] Config option: ${options.config}`);
  }

  const targetUrl = options.url;
  try {
    new URL(targetUrl);
  } catch {
    console.error('[pentem] Invalid target URL');
    process.exit(1);
  }

  const scope = computeScopeFromTarget(targetUrl);
  if (options.scope) {
    const extraDomains = options.scope.split(',').map((s) => s.trim());
    scope.allowedDomains = [...(scope.allowedDomains ?? []), ...extraDomains];
  }
  const scopeCheck = validateUrlAgainstScope(targetUrl, targetUrl, scope);
  if (!scopeCheck.allowed) {
    console.error(`[pentem] URL blocked by scope: ${scopeCheck.reason}`);
    process.exit(1);
  }

  if (options.manual) {
    const exitCode = await runManualScan(targetUrl, options.saveLogs, options.output, options.sarif ?? false, options.notify, options.share);
    if (options.exitCode) process.exit(exitCode ?? 0);
    return;
  }

  const exitCode = await runAgenticScan(targetUrl, options.saveLogs, options.output, options.sarif ?? false, options.notify, options.share);
  if (options.exitCode) process.exit(exitCode ?? 0);
}

async function runManualScan(url: string, saveLogs?: string, output?: string, sarif?: boolean, notify?: string, share?: string): Promise<number> {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║    Pentem Manual Security Scan          ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  Target: ${url}`);
  console.log('  Mode: Manual (no AI)');
  console.log('');

  const authSession = new AuthSessionManager();
  const rateLimiter = getRateLimiter();
  const scanner = new ManualScanner(url, authSession, rateLimiter);
  const result = await scanner.run();

  const fpAnalyzed = analyzeFalsePositives(result.findings);
  const realFindings = fpAnalyzed.filter((f) => !f.isFp);
  const chains = findAttackChains(realFindings);

  console.log('\n  ═══════════════════════════════════════');
  console.log('  Scan complete!');
  console.log(`  Requests made: ${result.log.length}`);
  console.log(`  Total findings: ${result.findings.length}`);
  console.log(`  After FP analysis: ${realFindings.length}`);
  console.log(`  Attack chains: ${chains.length}`);
  console.log(`  Critical: ${realFindings.filter((f) => f.severity === 'critical').length}`);
  console.log(`  High: ${realFindings.filter((f) => f.severity === 'high').length}`);
  console.log(`  Medium: ${realFindings.filter((f) => f.severity === 'medium').length}`);
  console.log(`  Low: ${realFindings.filter((f) => f.severity === 'low').length}`);
  console.log('');

  const workspacePath = process.env.PENTEM_LOCAL
    ? path.resolve(process.cwd(), 'workspaces')
    : path.join(os.homedir(), '.pentem', 'workspaces');
  const sessionId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const auditDir = path.join(workspacePath, sessionId, 'audit');
  fs.mkdirSync(auditDir, { recursive: true });

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
    enhancedReport += '\n## False Positives Filtered\n\n';
    enhancedReport += '| Finding | Reason |\n|---------|--------|\n';
    for (const f of fpAnalyzed) {
      if (f.isFp) enhancedReport += `| ${f.type}: ${f.description} | ${f.fpReason} |\n`;
    }
    enhancedReport += '\n';
  }

  fs.writeFileSync(path.join(auditDir, 'final-report.md'), enhancedReport, 'utf-8');

  const logContent = scanner.generateLogContent();
  fs.writeFileSync(path.join(auditDir, 'request-log.md'), logContent, 'utf-8');

  if (sarif) {
    const sarifPath = path.join(auditDir, 'report.sarif');
    generateSarifReport(realFindings, url, 'Pentem Manual Scanner', sarifPath);
    console.log(`  SARIF report: ${sarifPath}`);
  }

  const sessionsDir = path.join(workspacePath, '.pentem');
  fs.mkdirSync(sessionsDir, { recursive: true });
  const session = {
    sessionId,
    targetUrl: url,
    status: 'completed' as const,
    completedAgents: ['manual-scanner'],
    failedAgents: [],
    currentPhase: 'complete',
    metrics: { totalCost: 0, totalTurns: 0, totalDurationMs: 0, perAgent: {} },
    startedAt: new Date(Date.now() - 5000).toISOString(),
    completedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(sessionsDir, `${sessionId}.json`), JSON.stringify(session, null, 2));

  if (saveLogs) {
    const saved = saveSessionOutput(sessionId, saveLogs);
    if (saved) console.log(`  Logs saved to: ${saved}`);
  }
  if (output) {
    fs.writeFileSync(output, enhancedReport, 'utf-8');
    console.log(`  Report saved to: ${output}`);
  }

  console.log(`  Session: ${sessionId}`);
  console.log(`  Report: pentem report ${sessionId}`);
  console.log(`  Logs:   pentem report ${sessionId} --logs`);
  console.log(`  Save:   pentem report ${sessionId} --save ./pentem-output`);

  const chainsOutput = chains.length > 0 ? `\n  ⚡ Attack chains detected: ${chains.length}` : '';
  console.log(`${chainsOutput}\n`);
  console.log(enhancedReport);

  if (notify) {
    await runNotifications(notify, url, sessionId, realFindings, enhancedReport);
  }

  if (share) {
    exportFindings(realFindings, url, sessionId, { outputPath: share, toolName: 'Pentem Manual Scanner' });
    console.log(`  Findings shared: ${share}`);
  }

  const exitCode = getExitCode(realFindings);
  if (exitCode > 0) {
    console.log(`\n  ⚠ Exit code ${exitCode} — findings exceed severity threshold`);
  }
  return exitCode;
}

async function runAgenticScan(url: string, saveLogs?: string, _output?: string, _sarif?: boolean, notify?: string, share?: string): Promise<number> {
  const provider = detectProvider();
  if (!provider.configured) {
    console.error(`[pentem] ${provider.validationError}`);
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  Pentem AI Agent Penetration Test       ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  Target: ${url}`);
  console.log(`  Provider: ${provider.type.toUpperCase()}`);
  console.log(`  Model: ${provider.model || 'default'}`);
  console.log('');

  const workspacePath = process.env.PENTEM_LOCAL
    ? path.resolve(process.cwd(), 'workspaces')
    : path.join(os.homedir(), '.pentem', 'workspaces');
  fs.mkdirSync(workspacePath, { recursive: true });

  const pipeline = new DirectAgentPipeline(
    {
      type: provider.type,
      configured: true,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      model: provider.model,
    },
    url,
    workspacePath,
  );

  const session = pipeline.getSession();
  console.log(`  Session: ${session.sessionId}\n`);

  pipeline.onProgress((progress: AgentProgress) => {
    if (progress.status === 'started' && progress.agent === 'system') {
      const names: Record<string, string> = {
        'pre-recon': 'Phase 1/5: Reconnaissance',
        recon: 'Phase 2/5: Target Exploration',
        vuln: 'Phase 3/5: Vulnerability Analysis',
        exploit: 'Phase 4/5: Exploitation',
        report: 'Phase 5/5: Report Generation',
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
  console.log('\n  ═══════════════════════════════════════');
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
  console.log('');

  // Show report
  const reportPath = path.join(workspacePath, session.sessionId, 'audit', 'final-report.md');
  if (fs.existsSync(reportPath)) {
    const report = fs.readFileSync(reportPath, 'utf-8');
    console.log(report);
  }

  if (notify) {
    await runNotifications(notify, url, s.sessionId, [], fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf-8') : '');
  }

  if (share) {
    const findings: Array<{ type: string; severity: string; url: string; description: string; detail: string }> = [];
    const sarifPath = path.join(workspacePath, session.sessionId, 'audit', 'report.sarif');
    if (fs.existsSync(sarifPath)) {
      try {
        const sarifContent = JSON.parse(fs.readFileSync(sarifPath, 'utf-8'));
        const results = sarifContent?.runs?.[0]?.results ?? [];
        for (const r of results) {
          findings.push({
            type: r.ruleId || 'unknown',
            severity: r.level === 'error' ? 'high' : r.level === 'warning' ? 'medium' : 'low',
            url: r.locations?.[0]?.physicalLocation?.artifactLocation?.uri || url,
            description: r.message?.text?.split('\n')[0] || '',
            detail: r.message?.text || '',
          });
        }
      } catch { }
    }
    exportFindings(findings, url, s.sessionId, { outputPath: share, toolName: 'Pentem AI Scanner' });
    console.log(`  Findings shared: ${share}`);
  }

  const exitCode = s.failedAgents.length > 0 ? 10 : 0;
  return exitCode;
}

async function runNotifications(
  notify: string,
  targetUrl: string,
  scanId: string,
  findings: Array<{ type: string; severity: string; url: string; description: string; detail: string }>,
  report: string,
): Promise<void> {
  try {
    const config = await loadNotificationConfig();
    const registry = await PluginLoader.loadAll();
    const host = new PluginHost(registry);

    const channels = notify.split(',').map((c) => c.trim()).filter(Boolean);
    for (const channel of channels) {
      const pluginKey = `${channel}-notification`;
      if (!config[pluginKey]) {
        const envKey = channel === 'slack' ? 'SLACK_WEBHOOK_URL' : channel === 'discord' ? 'DISCORD_WEBHOOK_URL' : channel === 'webhook' ? 'WEBHOOK_URL' : null;
        if (envKey) {
          const envVal = process.env[envKey];
          if (envVal) {
            config[pluginKey] = { webhookUrl: envVal, url: envVal };
          }
        }
      }
    }

    for (const [pluginName, pluginConfig] of Object.entries(config)) {
      const plugin = registry.get(pluginName);
      if (!plugin) continue;
      if (!channels.some((c) => pluginName.startsWith(c))) continue;

      const ctx = {
        scanId,
        targetUrl,
        config: pluginConfig as Record<string, unknown>,
        findings,
        report,
      };

      await host.onAfterScan(ctx);
    }

    console.log(`  Notifications sent: ${channels.join(', ')}`);
  } catch (err) {
    console.log(`  Notification error: ${err}`);
  }
}
