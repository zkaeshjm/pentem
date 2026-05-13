import * as fs from 'node:fs';
import * as path from 'node:path';
import { Worker } from '@temporalio/worker';
import * as activities from './activities/index.js';

async function main(): Promise<void> {
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE;
  if (!taskQueue) {
    throw new Error('TEMPORAL_TASK_QUEUE environment variable is required');
  }

  const serverAddress = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';

  const worker = await Worker.create({
    workflowsPath: new URL('./workflows', import.meta.url).pathname,
    activities,
    taskQueue,
    identity: `shannon-worker-${taskQueue}`,
    maxConcurrentActivityTaskExecutions: 10,
    maxConcurrentWorkflowTaskExecutions: 5,
  });

  console.log(`[shannon-worker] Starting worker for task queue: ${taskQueue}`);
  console.log(`[shannon-worker] Temporal server: ${serverAddress}`);

  await worker.run();
}

main().catch((err) => {
  console.error('[shannon-worker] Fatal error:', err);
  process.exit(1);
});
