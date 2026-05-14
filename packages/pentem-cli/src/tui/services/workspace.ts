import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface SessionData {
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

function getWorkspacePath(): string {
  if (process.env.PENTEM_LOCAL) return path.resolve(process.cwd(), 'workspaces');
  return path.join(os.homedir(), '.pentem', 'workspaces');
}

export function listSessions(): SessionData[] {
  const sessionsDir = path.join(getWorkspacePath(), '.pentem');
  if (!fs.existsSync(sessionsDir)) return [];
  const sessions: SessionData[] = [];
  for (const file of fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.json'))) {
    try { sessions.push(JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf-8'))); } catch {}
  }
  sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return sessions;
}

export function getSession(sessionId: string): SessionData | null {
  const p = path.join(getWorkspacePath(), '.pentem', `${sessionId}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

export function getReportContent(sessionId: string): string | null {
  const p = path.join(getWorkspacePath(), sessionId, 'audit', 'final-report.md');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
}

export function listReports(): Array<{ sessionId: string; targetUrl: string; fileSize: number }> {
  return listSessions()
    .map((s) => {
      const rp = path.join(getWorkspacePath(), s.sessionId, 'audit', 'final-report.md');
      if (!fs.existsSync(rp)) return null;
      return { sessionId: s.sessionId, targetUrl: s.targetUrl, fileSize: fs.statSync(rp).size };
    })
    .filter(Boolean) as Array<{ sessionId: string; targetUrl: string; fileSize: number }>;
}

export function getSessionLogContent(sessionId: string): string | null {
  // Try to find agent logs in the audit directory
  const auditDir = path.join(getWorkspacePath(), sessionId, 'audit');
  if (!fs.existsSync(auditDir)) return null;

  const lines: string[] = [`# Pentem Session Log: ${sessionId}`, `**Date:** ${new Date().toISOString()}`, ''];

  // Collect all log files
  const collectDir = (dir: string, depth = 0) => {
    if (!fs.existsSync(dir) || depth > 3) return;
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        lines.push(`---`);
        lines.push(`# Directory: ${path.relative(auditDir, fullPath)}`);
        lines.push(``);
        collectDir(fullPath, depth + 1);
      } else if (entry.endsWith('.log') || entry.endsWith('.md') || entry.endsWith('.json') || entry.endsWith('.txt')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          lines.push(`---`);
          lines.push(`## File: ${path.relative(auditDir, fullPath)}`);
          lines.push(``);
          const preview = content.length > 3000 ? content.slice(0, 3000) + '\n... [truncated]' : content;
          lines.push(preview);
          lines.push(``);
        } catch {}
      }
    }
  };

  collectDir(auditDir);
  return lines.join('\n');
}

export function saveSessionOutput(sessionId: string, outputDir: string): string | null {
  try {
    const targetDir = path.resolve(outputDir);
    fs.mkdirSync(targetDir, { recursive: true });

    // Save report
    const report = getReportContent(sessionId);
    if (report) {
      fs.writeFileSync(path.join(targetDir, `${sessionId}-report.md`), report, 'utf-8');
    }

    // Save session state
    const session = getSession(sessionId);
    if (session) {
      fs.writeFileSync(path.join(targetDir, `${sessionId}-session.json`), JSON.stringify(session, null, 2), 'utf-8');
    }

    // Save logs
    const logs = getSessionLogContent(sessionId);
    if (logs) {
      fs.writeFileSync(path.join(targetDir, `${sessionId}-logs.md`), logs, 'utf-8');
    }

    // Copy all audit files
    const auditDir = path.join(getWorkspacePath(), sessionId, 'audit');
    if (fs.existsSync(auditDir)) {
      const copyDir = (src: string, dest: string) => {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src)) {
          const s = path.join(src, entry);
          const d = path.join(dest, entry);
          if (fs.statSync(s).isDirectory()) copyDir(s, d);
          else fs.copyFileSync(s, d);
        }
      };
      copyDir(auditDir, path.join(targetDir, `${sessionId}-audit`));
    }

    return targetDir;
  } catch (err) {
    return null;
  }
}

export function getConfigContent(): string | null {
  for (const p of [
    path.resolve(process.cwd(), 'pentem.yaml'),
    path.resolve(process.cwd(), '.pentem.yaml'),
    path.join(os.homedir(), '.pentem', 'config.yaml'),
  ]) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
  }
  return null;
}

export function getConfigPath(): string | null {
  for (const p of [
    path.resolve(process.cwd(), 'pentem.yaml'),
    path.resolve(process.cwd(), '.pentem.yaml'),
    path.join(os.homedir(), '.pentem', 'config.yaml'),
  ]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function writeConfig(content: string): boolean {
  const cp = getConfigPath();
  if (!cp) return false;
  try { fs.writeFileSync(cp, content, 'utf-8'); return true; } catch { return false; }
}
