export interface CheckpointPlugin {
  save(label: string): Promise<string>;
  restore(checkpoint: string): Promise<void>;
  list(): Promise<string[]>;
}

export class NoopCheckpointPlugin implements CheckpointPlugin {
  async save(_label: string): Promise<string> {
    return 'noop';
  }
  async restore(_checkpoint: string): Promise<void> {
    // no-op
  }
  async list(): Promise<string[]> {
    return [];
  }
}
