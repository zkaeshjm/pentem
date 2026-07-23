import * as os from 'node:os';
import * as path from 'node:path';
import { ScanScheduler } from '../tui/services/scheduler.ts';
import type { ScheduledTarget } from '../tui/services/scheduler.ts';

export interface ScheduleOptions {
  action: 'list' | 'add' | 'remove' | 'run-due' | 'import';
  url?: string;
  name?: string;
  interval?: string;
  tags?: string;
  file?: string;
}

function getWorkspacePath(): string {
  return process.env.PENTEM_LOCAL
    ? path.resolve(process.cwd(), 'workspaces')
    : path.join(os.homedir(), '.pentem', 'workspaces');
}

export async function scheduleCommand(options: ScheduleOptions): Promise<void> {
  const scheduler = new ScanScheduler(getWorkspacePath());

  switch (options.action) {
    case 'list': {
      const queue = scheduler.getQueue();
      console.log('\nScheduled Targets:');
      console.log('==================');
      for (const t of queue.targets) {
        console.log(`  ${t.name} (${t.url})`);
        console.log(`    Interval: ${t.interval}`);
        console.log(`    Last run: ${t.lastRun ?? 'never'}`);
        console.log(`    Next run: ${t.nextRun ?? 'not scheduled'}`);
        console.log(`    Tags: ${t.tags.length > 0 ? t.tags.join(', ') : 'none'}`);
        console.log('');
      }
      console.log(`Running: ${queue.running.length}`);
      console.log(`Completed: ${queue.completed.length}`);
      console.log(`Failed: ${queue.failed.length}`);
      break;
    }
    case 'add': {
      if (!options.url) {
        console.error(
          'Usage: pentem schedule add <url> [--name <name>] [--interval <daily|weekly|monthly>] [--tags <tag1,tag2>]',
        );
        process.exit(1);
      }
      scheduler.addTarget({
        url: options.url,
        name: options.name ?? new URL(options.url).hostname,
        interval: (options.interval as ScheduledTarget['interval']) ?? 'once',
        lastRun: null,
        nextRun: new Date().toISOString(),
        tags: options.tags ? options.tags.split(',').map((s) => s.trim()) : [],
      });
      console.log(`Added target: ${options.url}`);
      break;
    }
    case 'remove': {
      if (!options.name) {
        console.error('Usage: pentem schedule remove <name>');
        process.exit(1);
      }
      scheduler.removeTarget(options.name);
      console.log(`Removed target: ${options.name}`);
      break;
    }
    case 'run-due': {
      const due = scheduler.getDueTargets();
      console.log(`Found ${due.length} due targets`);
      for (const target of due) {
        console.log(`  Running: ${target.name} (${target.url})`);
        scheduler.markRunning(target.url);
      }
      break;
    }
    case 'import': {
      if (!options.file) {
        console.error('Usage: pentem schedule import <file> [--tags <tag1,tag2>]');
        process.exit(1);
      }
      const fs = await import('node:fs');
      const content = fs.readFileSync(options.file, 'utf-8');
      const urls = scheduler.parseBulkInput(content);
      scheduler.bulkImport(urls, options.tags ? options.tags.split(',').map((s) => s.trim()) : []);
      console.log(`Imported ${urls.length} targets from ${options.file}`);
      break;
    }
  }
}
