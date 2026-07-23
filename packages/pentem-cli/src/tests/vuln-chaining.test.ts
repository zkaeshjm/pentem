import { describe, expect, it } from 'vitest';
import { findAttackChains } from '../tui/services/vuln-chaining.ts';

describe('Attack Chain Detection', () => {
  it('should detect info disclosure → compromise chain', () => {
    const findings = [
      {
        type: 'information-disclosure',
        severity: 'medium' as const,
        url: 'http://test.com/.env',
        description: '.env exposed',
        detail: 'Contains DB credentials',
      },
      {
        type: 'sqli',
        severity: 'critical' as const,
        url: 'http://test.com/login',
        description: 'SQL Injection',
        detail: '',
      },
    ];
    const chains = findAttackChains(findings);
    expect(chains.length).toBeGreaterThan(0);
    const infoDChain = chains.find((c) => c.name.includes('Information Disclosure'));
    expect(infoDChain).toBeDefined();
    if (infoDChain) {
      expect(infoDChain.severity).toBe('critical');
      expect(infoDChain.steps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should detect XSS → session hijacking chain', () => {
    const findings = [
      { type: 'xss', severity: 'high' as const, url: 'http://test.com/profile', description: 'Stored XSS', detail: '' },
    ];
    const chains = findAttackChains(findings);
    const hijackChain = chains.find((c) => c.name.includes('XSS'));
    expect(hijackChain).toBeDefined();
    if (hijackChain) {
      expect(hijackChain.impact).toContain('Account takeover');
    }
  });

  it('should return empty for isolated low-severity findings', () => {
    const findings = [
      {
        type: 'info',
        severity: 'low' as const,
        url: 'http://test.com/',
        description: 'Server header',
        detail: 'Apache',
      },
      {
        type: 'missing-header',
        severity: 'low' as const,
        url: 'http://test.com/',
        description: 'Missing header',
        detail: 'X-Frame-Options',
      },
    ];
    const chains = findAttackChains(findings);
    expect(chains.length).toBe(0);
  });

  it('should detect SSRF → internal pivot chain', () => {
    const findings = [
      {
        type: 'ssrf',
        severity: 'high' as const,
        url: 'http://test.com/fetch',
        description: 'SSRF vulnerability',
        detail: 'Unvalidated URL parameter',
      },
      {
        type: 'information-disclosure',
        severity: 'medium' as const,
        url: 'http://test.com/.aws',
        description: 'AWS creds exposed',
        detail: '',
      },
    ];
    const chains = findAttackChains(findings);
    const pivotChain = chains.find((c) => c.name.includes('Pivot') || c.name.includes('SSRF'));
    expect(pivotChain).toBeDefined();
  });

  it('should return multiple chains for diverse findings', () => {
    const findings = [
      {
        type: 'xss',
        severity: 'high' as const,
        url: 'http://test.com/search',
        description: 'Reflected XSS',
        detail: '',
      },
      {
        type: 'information-disclosure',
        severity: 'medium' as const,
        url: 'http://test.com/.env',
        description: '.env exposed',
        detail: '',
      },
      { type: 'sqli', severity: 'critical' as const, url: 'http://test.com/login', description: 'SQLi', detail: '' },
    ];
    const chains = findAttackChains(findings);
    expect(chains.length).toBeGreaterThanOrEqual(2);
  });
});
