import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ExternalFinding {
  source: string;
  vulnerabilityType: string;
  targetUrl: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: string;
}

export interface ExternalFindingsPlugin {
  fetch(sessionId: string, targetUrl: string): Promise<ExternalFinding[]>;
}

function parseFindingFile(filePath: string): ExternalFinding[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      return data.filter(isValidFinding);
    }

    if (isValidFinding(data)) {
      return [data];
    }

    return [];
  } catch {
    return [];
  }
}

function isValidFinding(obj: unknown): obj is ExternalFinding {
  if (!obj || typeof obj !== 'object') return false;
  const f = obj as Record<string, unknown>;
  return (
    typeof f.source === 'string' &&
    typeof f.vulnerabilityType === 'string' &&
    typeof f.targetUrl === 'string' &&
    typeof f.description === 'string' &&
    typeof f.severity === 'string' &&
    ['critical', 'high', 'medium', 'low'].includes(f.severity) &&
    typeof f.evidence === 'string'
  );
}

export class FileExternalFindingsPlugin implements ExternalFindingsPlugin {
  private readonly findingsDir: string;

  constructor(findingsDir?: string) {
    this.findingsDir = findingsDir ?? '';
  }

  async fetch(_sessionId: string, _targetUrl: string): Promise<ExternalFinding[]> {
    if (!this.findingsDir || !fs.existsSync(this.findingsDir)) {
      return [];
    }

    const findings: ExternalFinding[] = [];

    for (const entry of fs.readdirSync(this.findingsDir)) {
      const fullPath = path.join(this.findingsDir, entry);
      if (fs.statSync(fullPath).isFile() && (entry.endsWith('.json') || entry.endsWith('.findings'))) {
        const parsed = parseFindingFile(fullPath);
        findings.push(...parsed);
      }
    }

    return findings;
  }
}

export class NoopExternalFindingsPlugin implements ExternalFindingsPlugin {
  async fetch(_sessionId: string, _targetUrl: string): Promise<ExternalFinding[]> {
    return [];
  }
}
