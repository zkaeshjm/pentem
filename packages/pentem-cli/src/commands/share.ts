import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { exportFindings } from '../tui/services/collaboration/export.ts';
import { getSession } from '../tui/services/workspace.ts';

function getWorkspacePath(): string {
  const p = process.env.PENTEM_LOCAL
    ? path.resolve(process.cwd(), 'workspaces')
    : path.join(os.homedir(), '.pentem', 'workspaces');
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export interface ShareOptions {
  sessionId: string;
  output?: string;
}

export async function shareCommand(options: ShareOptions): Promise<void> {
  const session = getSession(options.sessionId);
  if (!session) {
    console.error(`[pentem] Session not found: ${options.sessionId}`);
    process.exit(1);
  }

  const auditDir = path.join(getWorkspacePath(), options.sessionId, 'audit');
  const sarifPath = path.join(auditDir, 'report.sarif');

  const findings: Array<{ type: string; severity: string; url: string; description: string; detail: string }> = [];

  if (fs.existsSync(sarifPath)) {
    try {
      const sarifContent = JSON.parse(fs.readFileSync(sarifPath, 'utf-8'));
      const results = sarifContent?.runs?.[0]?.results ?? [];
      for (const r of results) {
        findings.push({
          type: r.ruleId || 'unknown',
          severity: r.level === 'error' ? 'high' : r.level === 'warning' ? 'medium' : 'low',
          url: r.locations?.[0]?.physicalLocation?.artifactLocation?.uri || session.targetUrl,
          description: r.message?.text?.split('\n')[0] || '',
          detail: r.message?.text || '',
        });
      }
    } catch {}
  }

  const outputPath = options.output || path.join(process.cwd(), `${options.sessionId}-findings.json`);
  const json = exportFindings(findings, session.targetUrl, options.sessionId, {
    outputPath,
    toolName: 'Pentem',
  });

  console.log(`\n  Findings exported: ${outputPath}`);
  console.log(`  Total findings: ${findings.length}`);
  console.log(`  Export size: ${Buffer.byteLength(json, 'utf-8').toLocaleString()} bytes`);
}
