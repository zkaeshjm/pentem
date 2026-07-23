import * as fs from 'node:fs';
import * as path from 'node:path';

interface SharableFinding {
  type: string;
  severity: string;
  url: string;
  description: string;
  detail: string;
  isFp?: boolean;
  fpReason?: string;
}

interface SharableReport {
  format: 'pentem-share-v1';
  generatedAt: string;
  targetUrl: string;
  scanId: string;
  tool: string;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  findings: SharableFinding[];
  metadata?: Record<string, unknown>;
}

export function exportFindings(
  findings: SharableFinding[],
  targetUrl: string,
  scanId: string,
  options?: { outputPath?: string; toolName?: string },
): string {
  const critical = findings.filter((f) => f.severity === 'critical').length;
  const high = findings.filter((f) => f.severity === 'high').length;
  const medium = findings.filter((f) => f.severity === 'medium').length;
  const low = findings.filter((f) => f.severity === 'low').length;

  const report: SharableReport = {
    format: 'pentem-share-v1',
    generatedAt: new Date().toISOString(),
    targetUrl,
    scanId,
    tool: options?.toolName || 'Pentem',
    summary: { total: findings.length, critical, high, medium, low },
    findings: findings.map((f) => ({
      type: f.type,
      severity: f.severity,
      url: f.url,
      description: f.description,
      detail: f.detail,
      ...(f.isFp !== undefined ? { isFp: f.isFp } : {}),
      ...(f.fpReason ? { fpReason: f.fpReason } : {}),
    })),
  };

  const json = JSON.stringify(report, null, 2);

  if (options?.outputPath) {
    const outPath = path.resolve(options.outputPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json, 'utf-8');
  }

  return json;
}

export function importFindings(filePath: string): SharableReport | null {
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return null;
    const content = fs.readFileSync(fullPath, 'utf-8');
    const parsed = JSON.parse(content) as SharableReport;
    if (parsed.format !== 'pentem-share-v1') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function findingsToSarif(findings: SharableFinding[], _targetUrl: string): string {
  const results = findings.map((f, _i) => ({
    ruleId: f.type,
    level: f.severity === 'critical' || f.severity === 'high' ? 'error' : f.severity === 'medium' ? 'warning' : 'note',
    message: { text: `${f.description}\n${f.detail}` },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: f.url },
          region: { snippet: { text: f.description } },
        },
      },
    ],
  }));

  const sarif = {
    $schema: 'https://schemastore.ast-grep.org/schemas/json/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: { driver: { name: 'Pentem', version: '1.0.0' } },
        results,
        invocations: [
          {
            startTimeUtc: new Date().toISOString(),
            endTimeUtc: new Date().toISOString(),
            executionSuccessful: true,
          },
        ],
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}
