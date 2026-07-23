import { describe, expect, it } from 'vitest';
import { analyzeFalsePositives } from '../tui/services/false-positive.ts';

describe('False Positive Detection', () => {
  const makeFinding = (
    type: string,
    url: string,
    detail: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    description?: string,
  ) => ({
    type,
    severity,
    url,
    description: description ?? 'test finding',
    detail,
  });

  it('should flag error-based SQLi with HTTP 200/500 pattern as FP', () => {
    const findings = [
      makeFinding('sqli', 'http://test.com/page', 'Error detected with HTTP 200 and HTTP 500 responses'),
    ];
    const result = analyzeFalsePositives(findings);
    const f0 = result[0]!;
    expect(f0.isFp).toBe(true);
    expect(f0.fpReason).toContain('Error-based');
  });

  it('should not flag non-error SQLi', () => {
    const findings = [makeFinding('sqli', 'http://test.com/page', 'Time-based response delay observed')];
    const result = analyzeFalsePositives(findings);
    expect(result[0]!.isFp).toBe(false);
  });

  it('should flag XSS in non-rendering content type', () => {
    const findings = [makeFinding('xss', 'http://test.com/page', 'Reflected in Content-Type: image/png response')];
    const result = analyzeFalsePositives(findings);
    const f0 = result[0]!;
    expect(f0.isFp).toBe(true);
    expect(f0.fpReason).toContain('non-rendering');
  });

  it('should flag path existence with empty body', () => {
    const findings = [
      makeFinding('exposed-path', 'http://test.com/ok', 'HTTP 200 - Content-Length: 0', 'medium', 'Exposed path'),
    ];
    const result = analyzeFalsePositives(findings);
    const f0 = result[0]!;
    expect(f0.isFp).toBe(true);
    expect(f0.fpReason).toContain('empty');
  });

  it('should flag insecure-config header without version', () => {
    const findings = [makeFinding('insecure-config', 'http://test.com/', 'x-powered-by header exposed')];
    const result = analyzeFalsePositives(findings);
    const f0 = result[0]!;
    expect(f0.isFp).toBe(true);
    expect(f0.fpReason).toContain('Header exposed');
  });

  it('should not flag findings that pass all heuristics', () => {
    const findings = [makeFinding('xss', 'http://test.com/page', 'Confirmed XSS with callback')];
    const result = analyzeFalsePositives(findings);
    expect(result[0]!.isFp).toBe(false);
  });
});
