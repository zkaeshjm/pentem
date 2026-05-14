import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface StatusOptions {
  sessionId: string;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  const isLocal = !!process.env.PENTEM_LOCAL;
  const basePath = isLocal
    ? path.resolve(process.cwd(), 'workspaces')
    : path.join(os.homedir(), '.pentem', 'workspaces');

  const sessionPath = path.join(basePath, '.pentem', `${options.sessionId}.json`);

  if (!fs.existsSync(sessionPath)) {
    console.error(`[pentem] Session not found: ${options.sessionId}`);
    process.exit(1);
  }

  const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
  console.log(`Session:    ${session.sessionId}`);
  console.log(`Target:     ${session.targetUrl}`);
  console.log(`Status:     ${session.status}`);
  console.log(`Phase:      ${session.currentPhase}`);
  console.log(`Completed:  ${session.completedAgents?.length ?? 0} agents`);
  console.log(`Total Cost: $${session.metrics?.totalCost?.toFixed(4) ?? '0.00'}`);
  console.log(`Started:    ${session.startedAt}`);
  if (session.completedAt) {
    console.log(`Completed:  ${session.completedAt}`);
  }
}
