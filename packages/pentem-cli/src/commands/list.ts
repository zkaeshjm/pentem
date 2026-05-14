import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export async function listCommand(): Promise<void> {
  const isLocal = !!process.env.PENTEM_LOCAL;
  const basePath = isLocal
    ? path.resolve(process.cwd(), 'workspaces')
    : path.join(os.homedir(), '.pentem', 'workspaces');

  const sessionsDir = path.join(basePath, '.pentem');
  if (!fs.existsSync(sessionsDir)) {
    console.log('No sessions found');
    return;
  }

  const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('No sessions found');
    return;
  }

  for (const file of files) {
    try {
      const session = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf-8'));
      console.log(`${session.sessionId.padEnd(30)} ${session.status.padEnd(12)} ${session.targetUrl}`);
    } catch {
      // skip corrupted
    }
  }
}
