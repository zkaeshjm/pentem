import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateCompose, runCompose, writeComposeFile } from '../docker/compose.ts';

export async function runLocal(targetUrl: string, _configPath?: string): Promise<void> {
  const workspacePath = path.resolve(process.cwd(), 'workspaces');
  const sessionId = `local-${Date.now()}`;
  const taskQueue = `pentem-${sessionId}`;

  console.log(`[pentem] Local mode — workspace: ${workspacePath}`);
  console.log(`[pentem] Session: ${sessionId}`);

  const dockerfilePath = path.resolve(process.cwd(), 'docker', 'Dockerfile');
  if (!fs.existsSync(dockerfilePath)) {
    throw new Error('Dockerfile not found at docker/Dockerfile');
  }

  console.log('[pentem] Building worker image...');
  execSync(`docker build -f "${dockerfilePath}" -t pentem-worker:latest "${path.resolve(process.cwd())}"`, {
    stdio: 'inherit',
    timeout: 600_000,
  });

  const promptsDir = path.resolve(process.cwd(), 'prompts');
  const composeConfig = generateCompose({
    workspacePath,
    taskQueue,
    promptsDir,
    localDev: true,
  });
  const composeFile = writeComposeFile(workspacePath, composeConfig);

  console.log('[pentem] Starting Temporal server and worker...');
  await runCompose(composeFile, 'up');

  console.log(`[pentem] Scan started on ${targetUrl}`);
  console.log(`[pentem] Monitor with: docker compose -f "${composeFile}" logs -f worker`);
  console.log(`[pentem] When complete, run: docker compose -f "${composeFile}" down`);
}
