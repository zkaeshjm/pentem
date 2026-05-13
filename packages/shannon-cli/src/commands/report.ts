import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface ReportOptions {
  sessionId: string;
  output?: string;
}

export async function reportCommand(options: ReportOptions): Promise<void> {
  const isLocal = !!process.env.SHANNON_LOCAL;
  const basePath = isLocal
    ? path.resolve(process.cwd(), 'workspaces')
    : path.join(os.homedir(), '.shannon', 'workspaces');

  const auditDir = path.join(basePath, options.sessionId, 'audit');
  const reportPath = path.join(auditDir, 'final-report.md');

  if (!fs.existsSync(reportPath)) {
    console.error(`[shannon] Report not found for session: ${options.sessionId}`);
    process.exit(1);
  }

  const content = fs.readFileSync(reportPath, 'utf-8');

  if (options.output) {
    fs.writeFileSync(options.output, content, 'utf-8');
    console.log(`[shannon] Report written to: ${options.output}`);
  } else {
    console.log(content);
  }
}
