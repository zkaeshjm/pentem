import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ComposeOptions {
  workspacePath: string;
  taskQueue: string;
  imageTag?: string;
  promptsDir?: string;
  localDev?: boolean;
}

export function generateCompose(options: ComposeOptions): string {
  const { workspacePath, taskQueue, imageTag, promptsDir, localDev } = options;
  const image = localDev ? 'pentem-worker:latest' : (imageTag ?? `pentem-worker:${taskQueue}`);

  const config: Record<string, unknown> = {
    services: {
      temporal: {
        image: 'temporalio/server:1.26.4',
        ports: ['7233:7233'],
        environment: {
          DB: 'sqlite',
          SQLITE_DB_FILENAME: '/temporal-db/temporal.db',
        },
        volumes: [`${workspacePath}/.temporal:/temporal-db`],
        logging: { driver: 'json-file', options: { 'max-size': '10m' } },
      },
      worker: {
        image,
        depends_on: ['temporal'],
        environment: {
          TEMPORAL_ADDRESS: 'temporal:7233',
          TEMPORAL_TASK_QUEUE: taskQueue,
          PENTEM_PROMPTS_DIR: '/prompts',
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
          CLAUDE_CODE_USE_BEDROCK: process.env.CLAUDE_CODE_USE_BEDROCK ?? '',
          CLAUDE_CODE_USE_VERTEX: process.env.CLAUDE_CODE_USE_VERTEX ?? '',
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?? '',
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? '',
          AWS_REGION: process.env.AWS_REGION ?? '',
          GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '',
          PENTEM_MODEL_SMALL: process.env.PENTEM_MODEL_SMALL ?? '',
          PENTEM_MODEL_MEDIUM: process.env.PENTEM_MODEL_MEDIUM ?? '',
          PENTEM_MODEL_LARGE: process.env.PENTEM_MODEL_LARGE ?? '',
        },
        volumes: [`${workspacePath}:/workspace`],
        logging: { driver: 'json-file', options: { 'max-size': '10m' } },
      },
    },
  };

  if (localDev && promptsDir) {
    const svc = config.services as Record<string, { volumes: string[] }>;
    svc.worker?.volumes.push(`${promptsDir}:/prompts`);
  }

  return JSON.stringify(config, null, 2);
}

export function writeComposeFile(workspacePath: string, config: string): string {
  const dir = path.join(workspacePath, '.pentem');
  fs.mkdirSync(dir, { recursive: true });
  const composePath = path.join(dir, 'docker-compose.yml');
  fs.writeFileSync(composePath, config, 'utf-8');
  return composePath;
}

export async function runCompose(composePath: string, service: 'up' | 'down'): Promise<void> {
  const cmd = service === 'up' ? `docker compose -f "${composePath}" up -d` : `docker compose -f "${composePath}" down`;

  const { execSync } = await import('node:child_process');
  execSync(cmd, { stdio: 'inherit', timeout: 120_000 });
}
