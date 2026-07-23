import * as fs from 'node:fs';
import * as path from 'node:path';

interface Finding {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  url: string;
  description: string;
  detail: string;
}

export function generateSarifReport(
  findings: Finding[],
  _targetUrl: string,
  toolName: string,
  outputPath: string,
): string {
  const severityMap: Record<string, string> = {
    critical: 'error',
    high: 'error',
    medium: 'warning',
    low: 'note',
  };

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: toolName,
            version: '1.0.0',
            informationUri: 'https://pentem.ai',
            rules: findings.map((f, i) => ({
              id: `PENTEM-${String(i + 1).padStart(3, '0')}`,
              name: f.type.toUpperCase(),
              shortDescription: { text: f.description },
              fullDescription: { text: f.detail },
              defaultConfiguration: { level: severityMap[f.severity] ?? 'warning' },
              properties: { severity: f.severity, vulnerabilityType: f.type },
            })),
          },
        },
        results: findings.map((f, i) => ({
          ruleId: `PENTEM-${String(i + 1).padStart(3, '0')}`,
          level: severityMap[f.severity] ?? 'warning',
          message: { text: f.description },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: f.url },
                region: { startLine: 1 },
              },
            },
          ],
          properties: {
            severity: f.severity,
            vulnerabilityType: f.type,
            detail: f.detail,
          },
        })),
        invocations: [
          {
            executionSuccessful: findings.length === 0,
            startTimeUtc: new Date().toISOString(),
            endTimeUtc: new Date().toISOString(),
          },
        ],
      },
    ],
  };

  const content = JSON.stringify(sarif, null, 2);
  fs.writeFileSync(outputPath, content, 'utf-8');
  return outputPath;
}

export const SEVERITY_EXIT_CODES: Record<string, number> = {
  none: 0,
  low: 0,
  medium: 10,
  high: 20,
  critical: 30,
};

export function getExitCode(findings: Finding[]): number {
  if (findings.length === 0) return 0;
  const maxSeverity = findings.reduce((max, f) => {
    const order = ['low', 'medium', 'high', 'critical'];
    return order.indexOf(f.severity) > order.indexOf(max) ? f.severity : max;
  }, 'low' as string);
  return SEVERITY_EXIT_CODES[maxSeverity] ?? 0;
}
