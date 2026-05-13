import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface ResumeOptions {
  sessionId: string;
}

export async function resumeCommand(options: ResumeOptions): Promise<void> {
  const isLocal = !!process.env.SHANNON_LOCAL;
  const basePath = isLocal
    ? path.resolve(process.cwd(), 'workspaces')
    : path.join(os.homedir(), '.shannon', 'workspaces');

  const sessionPath = path.join(basePath, '.shannon', `${options.sessionId}.json`);

  if (!fs.existsSync(sessionPath)) {
    console.error(`[shannon] Session not found: ${options.sessionId}`);
    process.exit(1);
  }

  console.log(`[shannon] Resuming session: ${options.sessionId}`);
  console.log('[shannon] Resume support is active in the Temporal workflow');
}
