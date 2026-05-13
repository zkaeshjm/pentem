import * as fs from 'node:fs';
import * as path from 'node:path';

export class WorkflowLogger {
  private readonly logPath: string;

  constructor(auditDir: string) {
    fs.mkdirSync(auditDir, { recursive: true });
    this.logPath = path.join(auditDir, 'workflow.log');
  }

  info(message: string): void {
    this.write('INFO', message);
  }

  warn(message: string): void {
    this.write('WARN', message);
  }

  error(message: string): void {
    this.write('ERROR', message);
  }

  private write(level: string, message: string): void {
    const entry = `[${new Date().toISOString()}] [${level}] ${message}\n`;
    fs.appendFileSync(this.logPath, entry);
  }
}
