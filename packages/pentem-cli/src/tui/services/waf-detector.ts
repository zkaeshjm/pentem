export interface WafInfo {
  detected: boolean;
  name: string;
  certainty: 'low' | 'medium' | 'high';
  signatures: string[];
}

const WAF_SIGNATURES: Array<{
  name: string;
  headerCheck: Array<{ header: string; pattern: RegExp }>;
  responseCheck: Array<{ status: number; bodyPattern?: RegExp }>;
  certainty: 'low' | 'medium' | 'high';
}> = [
  {
    name: 'Cloudflare',
    headerCheck: [
      { header: 'server', pattern: /cloudflare/i },
      { header: 'cf-ray', pattern: /.+/ },
      { header: 'cf-cache-status', pattern: /.+/ },
    ],
    responseCheck: [
      { status: 403, bodyPattern: /cloudflare/i },
      { status: 503, bodyPattern: /cloudflare/i },
    ],
    certainty: 'high',
  },
  {
    name: 'AWS WAF',
    headerCheck: [
      { header: 'x-amz-request-id', pattern: /.+/ },
      { header: 'x-amz-id-2', pattern: /.+/ },
    ],
    responseCheck: [
      { status: 403, bodyPattern: /RequestBlocked/i },
      { status: 502, bodyPattern: /WAF/i },
    ],
    certainty: 'high',
  },
  {
    name: 'CloudFront',
    headerCheck: [
      { header: 'x-amz-cf-id', pattern: /.+/ },
      { header: 'x-amz-cf-pop', pattern: /.+/ },
    ],
    responseCheck: [],
    certainty: 'medium',
  },
  {
    name: 'Akamai GHOST',
    headerCheck: [{ header: 'server', pattern: /AkamaiGHost/i }],
    responseCheck: [{ status: 403, bodyPattern: /Akamai/i }],
    certainty: 'high',
  },
  {
    name: 'ModSecurity',
    headerCheck: [],
    responseCheck: [
      { status: 406, bodyPattern: /ModSecurity/i },
      { status: 406, bodyPattern: /Not Acceptable/i },
    ],
    certainty: 'medium',
  },
  {
    name: 'F5 BIG-IP ASM',
    headerCheck: [
      { header: 'x-content-type-options', pattern: /nosniff/i },
      { header: 'x-xss-protection', pattern: /1; mode=block/i },
    ],
    responseCheck: [{ status: 403, bodyPattern: /BigIP|F5/i }],
    certainty: 'medium',
  },
  {
    name: 'Imperva Incapsula',
    headerCheck: [
      { header: 'x-cdn', pattern: /Incapsula/i },
      { header: 'x-iinfo', pattern: /.+/ },
    ],
    responseCheck: [{ status: 403, bodyPattern: /Incapsula|imperva/i }],
    certainty: 'high',
  },
  {
    name: 'Sucuri CloudProxy',
    headerCheck: [
      { header: 'x-sucuri-id', pattern: /.+/ },
      { header: 'x-sucuri-cache', pattern: /.+/ },
    ],
    responseCheck: [],
    certainty: 'high',
  },
  {
    name: 'StackPath',
    headerCheck: [{ header: 'x-stackpath', pattern: /.+/ }],
    responseCheck: [],
    certainty: 'medium',
  },
];

export function detectWaf(statusCode: number, headers: Record<string, string>, body: string): WafInfo | null {
  for (const waf of WAF_SIGNATURES) {
    const headerMatches = waf.headerCheck.filter((check) => {
      const value = headers[check.header] || headers[check.header.toLowerCase()] || '';
      return check.pattern.test(value);
    });

    const responseMatches = waf.responseCheck.filter((check) => {
      if (check.status !== statusCode) return false;
      if (check.bodyPattern && !check.bodyPattern.test(body)) return false;
      return true;
    });

    if (headerMatches.length > 0 || responseMatches.length > 0) {
      const signatures = [
        ...headerMatches.map((h) => `${h.header}: ${headers[h.header] || headers[h.header.toLowerCase()]}`),
        ...responseMatches.map((r) => `HTTP ${r.status} response`),
      ];

      return {
        detected: true,
        name: waf.name,
        certainty: waf.certainty,
        signatures,
      };
    }
  }

  return null;
}
