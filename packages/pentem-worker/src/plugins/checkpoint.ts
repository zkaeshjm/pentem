import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CheckpointPlugin {
  save(label: string): Promise<string>;
  restore(checkpoint: string): Promise<void>;
  list(): Promise<string[]>;
}

export class DiskCheckpointPlugin implements CheckpointPlugin {
  private readonly checkpointDir: string;

  constructor(auditDir: string) {
    this.checkpointDir = path.join(auditDir, 'checkpoints');
    fs.mkdirSync(this.checkpointDir, { recursive: true });
  }

  async save(label: string): Promise<string> {
    const timestamp = Date.now();
    const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${timestamp}-${safeLabel}.json`;
    const filePath = path.join(this.checkpointDir, fileName);

    const data = {
      label,
      timestamp: new Date().toISOString(),
      createdAt: timestamp,
    };

    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, filePath);

    return filePath;
  }

  async restore(checkpoint: string): Promise<void> {
    const filePath = path.resolve(this.checkpointDir, checkpoint);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Checkpoint not found: ${checkpoint}`);
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!data.label) {
      throw new Error(`Invalid checkpoint file: ${checkpoint}`);
    }
  }

  async list(): Promise<string[]> {
    if (!fs.existsSync(this.checkpointDir)) return [];
    return fs
      .readdirSync(this.checkpointDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => path.join(this.checkpointDir, f));
  }
}

export { NoopCheckpointPlugin as LegacyNoopCheckpointPlugin };

export class NoopCheckpointPlugin implements CheckpointPlugin {
  async save(_label: string): Promise<string> {
    return 'noop';
  }
  async restore(_checkpoint: string): Promise<void> {}
  async list(): Promise<string[]> {
    return [];
  }
}
