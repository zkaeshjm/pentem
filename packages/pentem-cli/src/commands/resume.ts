import { resumeScan } from '../tui/services/scanner.ts';
import { getSession } from '../tui/services/workspace.ts';

export interface ResumeOptions {
  sessionId: string;
}

export async function resumeCommand(options: ResumeOptions): Promise<void> {
  const session = getSession(options.sessionId);

  if (!session) {
    console.error(`[pentem] Session not found: ${options.sessionId}`);
    console.error('Run "pentem list" to see available sessions');
    process.exit(1);
  }

  if (session.status === 'completed') {
    console.log(`[pentem] Session ${options.sessionId} is already completed.`);
    console.log('Run "pentem report" to view the results.');
    return;
  }

  console.log(`[pentem] Resuming session: ${options.sessionId}`);
  console.log(`[pentem] Target: ${session.targetUrl}`);
  console.log(`[pentem] Status: ${session.status}`);
  console.log(`[pentem] Completed agents: ${session.completedAgents.length}`);
  console.log(`[pentem] Failed agents: ${session.failedAgents.length}`);
  console.log('');

  const result = await resumeScan(options.sessionId);

  if (!result.success) {
    console.error(`[pentem] Failed to resume: ${result.error}`);
    process.exit(1);
  }

  console.log(`[pentem] Scan resumed successfully (session: ${result.sessionId})`);
  console.log('[pentem] Use "pentem status <session-id>" to check progress');
  console.log('[pentem] Use "pentem report <session-id>" to view results when complete');
}
