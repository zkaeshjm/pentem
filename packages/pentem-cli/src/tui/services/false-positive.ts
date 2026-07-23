interface Finding {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  url: string;
  description: string;
  detail: string;
}

interface FpHeuristic {
  name: string;
  check: (finding: Finding) => { isFp: boolean; reason: string } | null;
}

const FP_HEURISTICS: FpHeuristic[] = [
  {
    name: 'Error-based injection without DB',
    check: (f) => {
      if (f.type === 'sqli' && f.detail.toLowerCase().includes('error')) {
        if (f.detail.toLowerCase().includes('sqlite_error') && !f.detail.toLowerCase().includes('mysql')) {
          return { isFp: false, reason: '' };
        }
        if (f.detail.includes('HTTP 200') && f.detail.includes('HTTP 500')) {
          return { isFp: true, reason: 'Error-based detection without behavioral confirmation' };
        }
      }
      return null;
    },
  },
  {
    name: 'Reflected XSS in non-rendered context',
    check: (f) => {
      if (f.type === 'xss' && f.detail.toLowerCase().includes('reflected')) {
        if (f.detail.includes('Content-Type: image') || f.detail.includes('Content-Type: binary')) {
          return { isFp: true, reason: 'Payload reflected in non-rendering content type' };
        }
      }
      return null;
    },
  },
  {
    name: 'Generic path existence without content',
    check: (f) => {
      if (f.description?.toLowerCase().includes('path') && f.detail?.includes('200')) {
        if (f.detail?.includes('Content-Length: 0') || f.detail?.includes('content-length: 0')) {
          return { isFp: true, reason: 'Path returned 200 but body was empty (directory listing default)' };
        }
      }
      return null;
    },
  },
  {
    name: 'Header present without exploitable config',
    check: (f) => {
      if (f.type === 'insecure-config') {
        if (f.detail?.includes('x-powered-by') || f.detail?.includes('server')) {
          if (!f.detail?.includes('version')) {
            return { isFp: true, reason: 'Header exposed without version information (low risk)' };
          }
        }
      }
      return null;
    },
  },
];

export function analyzeFalsePositives(findings: Finding[]): Array<Finding & { isFp: boolean; fpReason?: string }> {
  return findings.map((finding) => {
    for (const heuristic of FP_HEURISTICS) {
      const result = heuristic.check(finding);
      if (result?.isFp) {
        return { ...finding, isFp: true, fpReason: result.reason };
      }
    }
    return { ...finding, isFp: false };
  });
}
