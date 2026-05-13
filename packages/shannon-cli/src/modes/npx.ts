import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadConfig } from '../config-loader.ts';
import { generateCompose, runCompose, writeComposeFile } from '../docker/compose.ts';

export async function runNpx(targetUrl: string, configPath?: string): Promise<void> {
  const shannonDir = path.join(os.homedir(), '.shannon');
  const workspacePath = path.join(shannonDir, 'workspaces');
  fs.mkdirSync(workspacePath, { recursive: true });

  const config = loadConfig(configPath ?? path.join(shannonDir, 'config.yaml'));

  if (targetUrl) {
    config.target.url = targetUrl;
  }

  const sessionId = `npx-${Date.now()}`;
  const taskQueue = `shannon-${sessionId}`;

  console.log(`[shannon] NPX mode — workspace: ${workspacePath}`);
  console.log(`[shannon] Session: ${sessionId}`);

  const imageTag = process.env.SHANNON_IMAGE_TAG ?? 'shannon-worker:latest';
  console.log(`[shannon] Pulling worker image: ${imageTag}`);
  execSync(`docker pull ${imageTag}`, { stdio: 'inherit', timeout: 300_000 });

  const composeConfig = generateCompose({
    workspacePath,
    taskQueue,
    imageTag,
    localDev: false,
  });
  const composeFile = writeComposeFile(workspacePath, composeConfig);

  console.log('[shannon] Starting Temporal server and worker...');
  await runCompose(composeFile, 'up');

  console.log(`[shannon] Scan started on ${targetUrl}`);
  console.log(`[shannon] Monitor with: docker compose -f "${composeFile}" logs -f worker`);
  console.log(`[shannon] When complete, run: docker compose -f "${composeFile}" down`);
}
