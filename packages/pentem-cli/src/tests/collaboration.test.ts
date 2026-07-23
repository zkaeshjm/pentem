import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportFindings, findingsToSarif, importFindings } from '../tui/services/collaboration/export.ts';

describe('Collaboration Export/Import', () => {
  const sampleFindings = [
    {
      type: 'xss',
      severity: 'high' as const,
      url: 'http://test.com/page',
      description: 'XSS vulnerability',
      detail: 'Reflected XSS in query param',
    },
    {
      type: 'sqli',
      severity: 'critical' as const,
      url: 'http://test.com/data',
      description: 'SQL Injection',
      detail: 'Error-based SQLi in id param',
    },
    {
      type: 'info',
      severity: 'low' as const,
      url: 'http://test.com/',
      description: 'Server header',
      detail: 'Server: Apache/2.4.41',
    },
  ];

  it('should export findings as JSON string', () => {
    const json = exportFindings(sampleFindings, 'http://test.com', 'scan-001');
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe('pentem-share-v1');
    expect(parsed.targetUrl).toBe('http://test.com');
    expect(parsed.scanId).toBe('scan-001');
    expect(parsed.summary.total).toBe(3);
    expect(parsed.summary.critical).toBe(1);
    expect(parsed.summary.high).toBe(1);
    expect(parsed.summary.low).toBe(1);
    expect(parsed.findings).toHaveLength(3);
  });

  it('should export findings to file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pentem-test-'));
    const outPath = path.join(tmpDir, 'findings.json');
    exportFindings(sampleFindings, 'http://test.com', 'scan-001', { outputPath: outPath });
    expect(fs.existsSync(outPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    expect(content.format).toBe('pentem-share-v1');
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should import findings from file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pentem-test-'));
    const outPath = path.join(tmpDir, 'findings.json');
    exportFindings(sampleFindings, 'http://test.com', 'scan-001', { outputPath: outPath });
    const imported = importFindings(outPath);
    expect(imported).not.toBeNull();
    expect(imported!.targetUrl).toBe('http://test.com');
    expect(imported!.findings).toHaveLength(3);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should return null for invalid import files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pentem-test-'));
    const invalidPath = path.join(tmpDir, 'invalid.json');
    fs.writeFileSync(invalidPath, '{"format": "unknown"}');
    expect(importFindings(invalidPath)).toBeNull();
    expect(importFindings('/nonexistent/file.json')).toBeNull();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should convert findings to SARIF format', () => {
    const sarif = findingsToSarif(sampleFindings, 'http://test.com');
    const parsed = JSON.parse(sarif);
    expect(parsed.version).toBe('2.1.0');
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0].results).toHaveLength(3);
    expect(parsed.runs[0].results[0].ruleId).toBe('xss');
    expect(parsed.runs[0].results[0].level).toBe('error');
  });
});
