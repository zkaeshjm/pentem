import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getReportContent, getSessionLogContent, saveSessionOutput } from '../tui/services/workspace.ts';

export interface ReportOptions {
  sessionId: string;
  output?: string;
  logs?: boolean;
  save?: string;
}

export async function reportCommand(options: ReportOptions): Promise<void> {
  const basePath = process.env.PENTEM_LOCAL
    ? path.resolve(process.cwd(), 'workspaces')
    : path.join(os.homedir(), '.pentem', 'workspaces');

  // Save all output to a directory
  if (options.save) {
    const result = saveSessionOutput(options.sessionId, options.save);
    if (!result) {
      console.error(`[pentem] Failed to save session: ${options.sessionId}`);
      process.exit(1);
    }
    console.log(`[pentem] Session ${options.sessionId} saved to: ${result}`);
    return;
  }

  // View raw logs
  if (options.logs) {
    const logs = getSessionLogContent(options.sessionId);
    if (!logs) {
      console.error(`[pentem] No logs found for session: ${options.sessionId}`);
      process.exit(1);
    }
    if (options.output) {
      fs.writeFileSync(options.output, logs, 'utf-8');
      console.log(`[pentem] Logs written to: ${options.output}`);
    } else {
      console.log(logs);
    }
    return;
  }

  // View report
  const content = getReportContent(options.sessionId);
  if (!content) {
    console.error(`[pentem] Report not found for session: ${options.sessionId}`);
    process.exit(1);
  }

  if (options.output) {
    fs.writeFileSync(options.output, content, 'utf-8');
    console.log(`[pentem] Report written to: ${options.output}`);
  } else {
    console.log(content);
  }
}
