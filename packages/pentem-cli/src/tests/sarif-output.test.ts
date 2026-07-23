import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateSarifReport, getExitCode } from '../tui/services/sarif-output.ts';

describe('SARIF Output', () => {
  it('should generate valid SARIF 2.1.0 JSON', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pentem-test-'));
    const outPath = path.join(tmpDir, 'report.sarif');
    generateSarifReport(
      [
        {
          type: 'xss',
          severity: 'high' as const,
          url: 'http://test.com/page',
          description: 'XSS',
          detail: 'Reflected',
        },
        {
          type: 'sqli',
          severity: 'critical' as const,
          url: 'http://test.com/data',
          description: 'SQLi',
          detail: 'Error-based',
        },
        {
          type: 'missing-header',
          severity: 'low' as const,
          url: 'http://test.com/',
          description: 'Missing HSTS',
          detail: '',
        },
      ],
      'http://test.com',
      'Pentem Test',
      outPath,
    );
    expect(fs.existsSync(outPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    expect(content.$schema).toContain('sarif-schema-2.1.0');
    expect(content.version).toBe('2.1.0');
    expect(content.runs).toHaveLength(1);
    expect(content.runs[0].results).toHaveLength(3);
    expect(content.runs[0].tool.driver.name).toBe('Pentem Test');
    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('Exit Codes', () => {
  it('should return 30 for critical findings', () => {
    const findings = [{ type: 'sqli', severity: 'critical' as const, url: '', description: '', detail: '' }];
    expect(getExitCode(findings)).toBe(30);
  });

  it('should return 20 for high findings without critical', () => {
    const findings = [{ type: 'xss', severity: 'high' as const, url: '', description: '', detail: '' }];
    expect(getExitCode(findings)).toBe(20);
  });

  it('should return 10 for medium findings without high/critical', () => {
    const findings = [{ type: 'missing-header', severity: 'medium' as const, url: '', description: '', detail: '' }];
    expect(getExitCode(findings)).toBe(10);
  });

  it('should return 0 for only low findings', () => {
    const findings = [{ type: 'info', severity: 'low' as const, url: '', description: '', detail: '' }];
    expect(getExitCode(findings)).toBe(0);
  });

  it('should return the highest severity code', () => {
    const findings = [
      { type: 'info', severity: 'low' as const, url: '', description: '', detail: '' },
      { type: 'sqli', severity: 'critical' as const, url: '', description: '', detail: '' },
      { type: 'xss', severity: 'high' as const, url: '', description: '', detail: '' },
    ];
    expect(getExitCode(findings)).toBe(30);
  });
});
