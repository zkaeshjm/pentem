import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadConfig } from '../config-loader.ts';
import { generateCompose, runCompose, writeComposeFile } from '../docker/compose.ts';

export async function runNpx(targetUrl: string, configPath?: string): Promise<void> {
  const pentemDir = path.join(os.homedir(), '.pentem');
  const workspacePath = path.join(pentemDir, 'workspaces');
  fs.mkdirSync(workspacePath, { recursive: true });

  const config = loadConfig(configPath ?? path.join(pentemDir, 'config.yaml'));

  if (targetUrl) {
    config.target.url = targetUrl;
  }

  const sessionId = `npx-${Date.now()}`;
  const taskQueue = `pentem-${sessionId}`;

  console.log(`[pentem] NPX mode — workspace: ${workspacePath}`);
  console.log(`[pentem] Session: ${sessionId}`);

  const imageTag = process.env.PENTEM_IMAGE_TAG ?? 'pentem-worker:latest';
  console.log(`[pentem] Pulling worker image: ${imageTag}`);
  execSync(`docker pull ${imageTag}`, { stdio: 'inherit', timeout: 300_000 });

  const composeConfig = generateCompose({
    workspacePath,
    taskQueue,
    imageTag,
    localDev: false,
  });
  const composeFile = writeComposeFile(workspacePath, composeConfig);

  console.log('[pentem] Starting Temporal server and worker...');
  await runCompose(composeFile, 'up');

  console.log(`[pentem] Scan started on ${targetUrl}`);
  console.log(`[pentem] Monitor with: docker compose -f "${composeFile}" logs -f worker`);
  console.log(`[pentem] When complete, run: docker compose -f "${composeFile}" down`);
}
