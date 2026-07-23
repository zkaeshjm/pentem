import { describe, expect, it } from 'vitest';
import { detectWaf } from '../tui/services/waf-detector.ts';

describe('WAF Detector', () => {
  it('should detect Cloudflare', () => {
    const result = detectWaf(403, { server: 'cloudflare', 'cf-ray': 'abc123' }, '');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Cloudflare');
  });

  it('should detect AWS WAF', () => {
    const result = detectWaf(403, { 'x-amz-request-id': 'abc123', 'x-amz-id-2': 'def456' }, '');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('AWS WAF');
  });

  it('should detect ModSecurity via server header', () => {
    const result = detectWaf(406, { server: 'Apache/2.4.41' }, 'ModSecurity: Access denied');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('ModSecurity');
  });

  it('should detect F5 BIG-IP ASM via response body', () => {
    const result = detectWaf(403, { 'x-content-type-options': 'nosniff', 'x-xss-protection': '1; mode=block' }, '');
    expect(result).not.toBeNull();
    expect(result!.name).toContain('F5');
  });

  it('should return null for no WAF', () => {
    const result = detectWaf(200, { server: 'nginx/1.20.1' }, '<html>OK</html>');
    expect(result).toBeNull();
  });

  it('should detect multiple signatures and report them', () => {
    const result = detectWaf(403, { server: 'cloudflare', 'cf-ray': 'abc123' }, '');
    expect(result!.signatures.length).toBeGreaterThan(0);
    expect(result!.certainty).toBe('high');
  });
});
