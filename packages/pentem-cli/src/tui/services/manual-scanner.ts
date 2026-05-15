import * as fs from 'node:fs';
import * as path from 'node:path';

interface ScanResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  error?: string;
  requestUrl: string;
  requestMethod: string;
  requestBody?: string;
  duration: number;
}

interface Finding {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  url: string;
  description: string;
  detail: string;
}

const COMMON_PATHS = [
  '/robots.txt',
  '/sitemap.xml',
  '/.env',
  '/admin',
  '/login',
  '/wp-admin',
  '/.git/config',
  '/config.php',
  '/backup',
  '/.well-known/security.txt',
  '/api',
  '/graphql',
  '/swagger.json',
  '/api-docs',
  '/.htaccess',
  '/server-status',
  '/phpinfo.php',
  '/crossdomain.xml',
  '/clientaccesspolicy.xml',
  '/.DS_Store',
  '/.gitignore',
  '/.htpasswd',
  '/wp-config.php',
  '/administrator',
  '/phpmyadmin',
  '/_debug',
  '/test',
  '/dev',
];

const HEADER_CHECKS = [
  { name: 'Strict-Transport-Security', desc: 'HTTP Strict Transport Security (HSTS)', severity: 'medium' as const },
  { name: 'Content-Security-Policy', desc: 'Content Security Policy (CSP)', severity: 'medium' as const },
  { name: 'X-Frame-Options', desc: 'Clickjacking Protection', severity: 'medium' as const },
  { name: 'X-Content-Type-Options', desc: 'MIME Sniffing Protection', severity: 'low' as const },
  { name: 'X-XSS-Protection', desc: 'XSS Protection Header', severity: 'low' as const },
  { name: 'Referrer-Policy', desc: 'Referrer Policy', severity: 'low' as const },
  { name: 'Permissions-Policy', desc: 'Permissions Policy', severity: 'low' as const },
];

const SQLI_PATTERNS = [
  { payload: "'", pattern: /sql|syntax|unclosed|unexpected|mysql|oracle|odbc|driver|queries|database/i },
  { payload: "' OR '1'='1", pattern: /sql|syntax|unclosed|unexpected/i },
  { payload: "' OR 1=1--", pattern: /sql|syntax|unclosed/i },
  { payload: "' UNION SELECT NULL--", pattern: /sql|syntax|unclosed/i },
  { payload: "' AND SLEEP(5)--", pattern: /sql|syntax|sleep/i },
];

const XSS_PATTERNS = [
  { payload: '<script>alert(1)</script>', pattern: /<script>alert\(1\)/i },
  { payload: '"><script>alert(1)</script>', pattern: /<script>alert\(1\)/i },
  { payload: '<img src=x onerror=alert(1)>', pattern: /<img[^>]+onerror/i },
  { payload: 'javascript:alert(1)', pattern: /javascript:alert\(1\)/i },
];

export class ManualScanner {
  private targetUrl: string;
  private baseUrl: string;
  private findings: Finding[] = [];
  private requestLog: ScanResult[] = [];

  constructor(targetUrl: string) {
    this.targetUrl = targetUrl;
    const u = new URL(targetUrl);
    this.baseUrl = `${u.protocol}//${u.host}`;
  }

  getRequestLog(): ScanResult[] {
    return this.requestLog;
  }

  private async fetchUrl(url: string, method = 'GET', body?: string): Promise<ScanResult> {
    const start = Date.now();
    const entry: ScanResult = {
      requestUrl: url,
      requestMethod: method,
      requestBody: body,
      status: 0,
      headers: {},
      body: '',
      duration: 0,
    };
    try {
      const fetchOpts: RequestInit = {
        method,
        headers: { 'User-Agent': 'Pentem-Manual-Scanner/1.0' },
        redirect: 'manual' as const,
      };
      if (body && method !== 'GET') fetchOpts.body = body;
      const resp = await fetch(url, fetchOpts);
      const headers: Record<string, string> = {};
      resp.headers.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });
      const text = await resp.text();
      entry.status = resp.status;
      entry.headers = headers;
      entry.body = text.slice(0, 50000);
    } catch (err) {
      entry.error = String(err);
    }
    entry.duration = Date.now() - start;
    this.requestLog.push(entry);
    return entry;
  }

  async run(): Promise<{ findings: Finding[]; report: string; log: ScanResult[] }> {
    console.log(`  Manual scan of ${this.targetUrl}\n`);

    // Phase 1: Base target + headers
    await this.checkBaseTarget();

    // Phase 2: Security headers
    await this.checkSecurityHeaders();

    // Phase 3: Common paths
    console.log(`  Probing ${COMMON_PATHS.length} common paths...`);
    await this.checkCommonPaths();

    // Phase 4: SQLi tests
    console.log(`  Testing ${SQLI_PATTERNS.length} SQL injection patterns...`);
    await this.checkSQLi();

    // Phase 5: XSS tests
    console.log(`  Testing ${XSS_PATTERNS.length} XSS patterns...`);
    await this.checkXSS();

    // Phase 6: Technology detection
    await this.detectTechnologies();

    const report = this.generateReport();
    return { findings: this.findings, report, log: this.requestLog };
  }

  private async checkBaseTarget(): Promise<void> {
    const result = await this.fetchUrl(this.targetUrl);
    if (result.error) {
      this.addFinding('connectivity', 'high', this.targetUrl, 'Target unreachable', result.error);
      return;
    }
    this.addFinding(
      'info',
      'low',
      this.targetUrl,
      'Target is reachable',
      `HTTP ${result.status} in ${result.duration}ms`,
    );
  }

  private async checkSecurityHeaders(): Promise<void> {
    const result = await this.fetchUrl(this.targetUrl);
    const present: string[] = [];
    for (const check of HEADER_CHECKS) {
      if (result.headers[check.name.toLowerCase()]) {
        present.push(check.name);
      } else {
        this.addFinding(
          'missing-header',
          check.severity,
          this.targetUrl,
          `Missing ${check.desc}`,
          `${check.name} header not found`,
        );
      }
    }
    if (present.length > 0) {
      this.addFinding('info', 'low', this.targetUrl, 'Security headers present', `${present.join(', ')}`);
    }
  }

  private addFinding(
    type: string,
    severity: Finding['severity'],
    url: string,
    description: string,
    detail: string,
  ): void {
    this.findings.push({ type, severity, url, description, detail });
  }

  private async checkCommonPaths(): Promise<void> {
    let found = 0;
    for (const p of COMMON_PATHS) {
      const url = `${this.baseUrl}${p}`;
      const result = await this.fetchUrl(url);
      const statusStr =
        result.status === 200
          ? 'OK'
          : result.status === 403
            ? '403'
            : result.status === 301 || result.status === 302
              ? '->'
              : `${result.status}`;
      process.stdout.write(`    ${p.padEnd(35)} ${statusStr}\r`);
      if (result.status === 200) {
        this.addFinding(
          'exposed-path',
          'high',
          url,
          `Exposed path: ${p}`,
          'HTTP 200 - may contain sensitive information',
        );
        found++;
      } else if (result.status === 403) {
        this.addFinding('info', 'low', url, `Restricted: ${p}`, 'HTTP 403 - exists but protected');
      } else if (result.status === 301 || result.status === 302) {
        this.addFinding(
          'info',
          'low',
          url,
          `Redirect: ${p}`,
          `HTTP ${result.status} → ${result.headers.location || 'unknown'}`,
        );
      }
    }
    console.log(`    Done — ${found} exposed path(s) found`);
    if (found > 0) {
      console.log('    ⚠ Review exposed paths in the report');
    }
  }

  private async checkSQLi(): Promise<void> {
    const seenUrls = new Set<string>();
    let found = 0;
    for (const sqli of SQLI_PATTERNS) {
      const testUrl = `${this.targetUrl}${this.targetUrl.includes('?') ? '&' : '?'}test=${encodeURIComponent(sqli.payload)}`;
      if (seenUrls.has(testUrl)) continue;
      seenUrls.add(testUrl);
      process.stdout.write(`    SQLi test: ${sqli.payload.slice(0, 25).padEnd(27)}\r`);
      const result = await this.fetchUrl(testUrl);
      if (sqli.pattern.test(result.body) || result.status === 500) {
        this.addFinding(
          'sqli',
          'critical',
          testUrl,
          'Potential SQL Injection',
          `Payload: ${sqli.payload} - Error/pattern match in response`,
        );
        found++;
      }
    }
    if (found > 0) {
      console.log(`    ⚠ ${found} SQLi indicator(s) found — check report`);
    } else {
      console.log('    No SQL injection indicators detected');
    }
  }

  private async checkXSS(): Promise<void> {
    let found = 0;
    for (const xss of XSS_PATTERNS) {
      const testUrl = `${this.targetUrl}${this.targetUrl.includes('?') ? '&' : '?'}q=${encodeURIComponent(xss.payload)}`;
      process.stdout.write(`    XSS test: ${xss.payload.slice(0, 25).padEnd(27)}\r`);
      const result = await this.fetchUrl(testUrl);
      if (xss.pattern.test(result.body)) {
        this.addFinding('xss', 'high', testUrl, 'Potential XSS', `Payload: ${xss.payload} reflected in response`);
        found++;
      }
    }
    if (found > 0) {
      console.log(`    ⚠ ${found} XSS indicator(s) found — check report`);
    } else {
      console.log('    No XSS indicators detected');
    }
  }

  private async detectTechnologies(): Promise<void> {
    const result = await this.fetchUrl(this.targetUrl);
    if (result.headers.server) this.addFinding('info', 'low', this.targetUrl, `Server: ${result.headers.server}`, '');
    if (result.headers['x-powered-by'])
      this.addFinding('info', 'low', this.targetUrl, `Powered-By: ${result.headers['x-powered-by']}`, '');
    if (result.headers['set-cookie'])
      this.addFinding('info', 'low', this.targetUrl, `Cookies set: ${result.headers['set-cookie']}`, '');
    if (result.headers['www-authenticate'])
      this.addFinding(
        'info',
        'medium',
        this.targetUrl,
        'Authentication required',
        `WWW-Authenticate: ${result.headers['www-authenticate']}`,
      );
  }

  generateLogContent(): string {
    const lines: string[] = [
      '# Pentem Penetration Test Log',
      `**Target:** ${this.targetUrl}`,
      `**Date:** ${new Date().toISOString()}`,
      `**Requests made:** ${this.requestLog.length}`,
      '',
      '## Raw Request Log',
      '',
    ];

    this.requestLog.forEach((r, i) => {
      lines.push(`### Request ${i + 1}: ${r.requestMethod} ${r.requestUrl}`);
      lines.push(`**Status:** ${r.status} | **Duration:** ${r.duration}ms`);
      if (r.error) lines.push(`**Error:** ${r.error}`);
      lines.push('**Response Headers:**');
      for (const [k, v] of Object.entries(r.headers).slice(0, 15)) {
        lines.push(`  ${k}: ${v}`);
      }
      if (Object.keys(r.headers).length > 15) lines.push(`  ... (${Object.keys(r.headers).length - 15} more headers)`);
      lines.push('');
      if (r.body) {
        const preview = r.body.slice(0, 500);
        lines.push('**Response Body (first 500 chars):**');
        lines.push(`  ${preview.replace(/\n/g, '\n  ')}`);
        if (r.body.length > 500) lines.push('  ... (truncated)');
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  }

  private generateReport(): string {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...this.findings].sort(
      (a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99),
    );

    const lines = [
      '# Pentem Manual Security Scan Report',
      '',
      `**Target:** ${this.targetUrl}`,
      `**Date:** ${new Date().toISOString()}`,
      '**Mode:** Manual (no AI)',
      '',
      '## Summary',
      '',
      `- **Total findings:** ${this.findings.length}`,
      `- **Critical:** ${this.findings.filter((f) => f.severity === 'critical').length}`,
      `- **High:** ${this.findings.filter((f) => f.severity === 'high').length}`,
      `- **Medium:** ${this.findings.filter((f) => f.severity === 'medium').length}`,
      `- **Low:** ${this.findings.filter((f) => f.severity === 'low').length}`,
      `- **Requests made:** ${this.requestLog.length}`,
      '',
      '## Findings by Severity',
      '',
      ...sorted.map((f, i) => {
        const sevMap: Record<string, string> = {
          critical: '🔴 CRITICAL',
          high: '🟠 HIGH',
          medium: '🟡 MEDIUM',
          low: '🔵 LOW',
        };
        return [
          `### ${i + 1}. [${sevMap[f.severity] || f.severity}] ${f.description}`,
          `**URL:** ${f.url}`,
          `**Type:** ${f.type}`,
          f.detail ? `**Detail:** ${f.detail}` : '',
          '',
        ].join('\n');
      }),
      '',
      '## Recommendations',
      '',
      ...(this.findings.some((f) => f.severity === 'critical' || f.severity === 'high')
        ? [
            '- Address high/critical findings immediately',
            '- Implement missing security headers (HSTS, CSP, X-Frame-Options)',
            '- Secure exposed paths and directories',
            '- Validate and sanitize all user inputs',
            '- Run a full agentic AI scan for deeper analysis',
          ]
        : [
            '- Review medium-severity findings',
            '- Add recommended security headers',
            '- Monitor exposed paths for changes',
          ]),
      '',
      '## Raw Scan Log',
      '',
      'Full request/response log saved alongside this report.',
      'View logs with: pentem report <session-id> --logs',
      '',
      '---',
      '*Generated by Pentem Manual Scanner*',
    ];
    return lines.join('\n');
  }
}
