import * as fs from 'node:fs';
import * as path from 'node:path';

export class AuditService {
  private readonly auditDir: string;

  constructor(auditDir: string) {
    this.auditDir = auditDir;
    fs.mkdirSync(auditDir, { recursive: true });
  }

  private async withLock<T>(fn: () => T): Promise<T> {
    const lockDir = path.join(this.auditDir, '.audit-lock');
    while (true) {
      try {
        fs.mkdirSync(lockDir);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    try {
      return fn();
    } finally {
      fs.rmdirSync(lockDir);
    }
  }

  async log(agentType: string, message: string): Promise<void> {
    const entry = `[${new Date().toISOString()}] [${agentType}] ${message}\n`;
    await this.withLock(() => {
      fs.appendFileSync(path.join(this.auditDir, agentType, 'agent.log'), entry);
      fs.appendFileSync(path.join(this.auditDir, 'workflow.log'), entry);
    });
  }

  async savePromptSnapshot(agentType: string, prompt: string): Promise<void> {
    const agentDir = path.join(this.auditDir, agentType);
    fs.mkdirSync(agentDir, { recursive: true });
    await this.withLock(() => {
      fs.writeFileSync(path.join(agentDir, 'prompt.txt'), prompt);
    });
  }

  async saveDeliverable(agentType: string, name: string, content: string | Buffer): Promise<string> {
    const delDir = path.join(this.auditDir, agentType, 'deliverables');
    fs.mkdirSync(delDir, { recursive: true });
    const filePath = path.join(delDir, name);
    const maxSize = 2 * 1024 * 1024;
    const data = typeof content === 'string' ? Buffer.from(content) : content;
    const truncated = data.byteLength > maxSize ? data.subarray(0, maxSize) : data;
    await this.withLock(() => {
      fs.writeFileSync(filePath, truncated);
    });
    return filePath;
  }

  async logWorkflowEvent(event: string): Promise<void> {
    const entry = `[${new Date().toISOString()}] [WORKFLOW] ${event}\n`;
    await this.withLock(() => {
      fs.appendFileSync(path.join(this.auditDir, 'workflow.log'), entry);
    });
  }

  deliverableExists(agentType: string, name: string): boolean {
    return fs.existsSync(path.join(this.auditDir, agentType, 'deliverables', name));
  }
}
