import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ScheduledTarget {
  url: string;
  name: string;
  interval: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  lastRun: string | null;
  nextRun: string | null;
  tags: string[];
  config?: string;
}

export interface ScanQueue {
  targets: ScheduledTarget[];
  running: string[];
  completed: string[];
  failed: string[];
}

export class ScanScheduler {
  private readonly persistPath: string;
  private queue: ScanQueue;

  constructor(workspacePath: string) {
    const dir = path.join(workspacePath, '.pentem');
    fs.mkdirSync(dir, { recursive: true });
    this.persistPath = path.join(dir, 'schedule.json');
    this.queue = this.load();
  }

  private load(): ScanQueue {
    try {
      if (fs.existsSync(this.persistPath)) {
        return JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
      }
    } catch {}
    return { targets: [], running: [], completed: [], failed: [] };
  }

  private save(): void {
    const tmp = `${this.persistPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.queue, null, 2));
    fs.renameSync(tmp, this.persistPath);
  }

  addTarget(target: ScheduledTarget): void {
    this.queue.targets.push(target);
    this.save();
  }

  removeTarget(name: string): void {
    this.queue.targets = this.queue.targets.filter((t) => t.name !== name);
    this.save();
  }

  getDueTargets(): ScheduledTarget[] {
    const now = new Date();
    return this.queue.targets.filter((t) => {
      if (t.interval === 'once' && t.lastRun) return false;
      if (!t.nextRun) return true;
      return new Date(t.nextRun) <= now;
    });
  }

  markRunning(url: string): void {
    if (!this.queue.running.includes(url)) this.queue.running.push(url);
    this.save();
  }

  markCompleted(url: string): void {
    this.queue.running = this.queue.running.filter((u) => u !== url);
    if (!this.queue.completed.includes(url)) this.queue.completed.push(url);
    const target = this.queue.targets.find((t) => t.url === url);
    if (target) {
      target.lastRun = new Date().toISOString();
      target.nextRun = this.computeNextRun(target.interval);
    }
    this.save();
  }

  markFailed(url: string): void {
    this.queue.running = this.queue.running.filter((u) => u !== url);
    if (!this.queue.failed.includes(url)) this.queue.failed.push(url);
    this.save();
  }

  private computeNextRun(interval: string): string {
    const now = new Date();
    switch (interval) {
      case 'hourly':
        return new Date(now.getTime() + 3600000).toISOString();
      case 'daily':
        return new Date(now.getTime() + 86400000).toISOString();
      case 'weekly':
        return new Date(now.getTime() + 604800000).toISOString();
      case 'monthly':
        return new Date(now.getTime() + 2592000000).toISOString();
      default:
        return '';
    }
  }

  getQueue(): ScanQueue {
    return { ...this.queue };
  }

  bulkImport(urls: string[], tags?: string[]): void {
    for (const url of urls) {
      const name = new URL(url).hostname;
      if (!this.queue.targets.find((t) => t.url === url)) {
        this.addTarget({
          url,
          name,
          interval: 'once',
          lastRun: null,
          nextRun: new Date().toISOString(),
          tags: tags ?? [],
        });
      }
    }
  }

  parseBulkInput(input: string): string[] {
    return input
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => (s.startsWith('http') ? s : `https://${s}`));
  }
}
