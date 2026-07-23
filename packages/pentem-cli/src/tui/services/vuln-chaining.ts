interface Finding {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  url: string;
  description: string;
  detail: string;
}

export interface AttackChain {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  steps: Array<{
    findingIndex: number;
    description: string;
  }>;
  impact: string;
  likelihood: 'low' | 'medium' | 'high';
}

const CHAIN_RULES: Array<{
  name: string;
  description: string;
  impact: string;
  likelihood: 'low' | 'medium' | 'high';
  severity: 'low' | 'medium' | 'high' | 'critical';
  requires: string[];
  optional?: string[];
}> = [
  {
    name: 'Information Disclosure → Full Compromise',
    description: 'Information leakage enables targeted exploitation leading to full system compromise',
    impact: 'Complete compromise of target application and underlying infrastructure',
    likelihood: 'medium',
    severity: 'critical',
    requires: ['information-disclosure', 'sqli'],
    optional: ['auth-bypass'],
  },
  {
    name: 'SSRF → Internal Network Pivot',
    description: 'SSRF vulnerability exploited to access internal services and pivot into internal network',
    impact: 'Access to internal network services, cloud metadata, and potential lateral movement',
    likelihood: 'high',
    severity: 'critical',
    requires: ['ssrf'],
    optional: ['information-disclosure'],
  },
  {
    name: 'XSS → Session Hijacking',
    description: 'Cross-site scripting used to steal session tokens and hijack user accounts',
    impact: 'Account takeover, data theft, and privilege escalation',
    likelihood: 'high',
    severity: 'high',
    requires: ['xss'],
    optional: ['authz-bypass'],
  },
  {
    name: 'Auth Bypass → Privilege Escalation',
    description: 'Authentication bypass combined with authorization flaws to gain admin access',
    impact: 'Unauthorized administrative access to the application',
    likelihood: 'high',
    severity: 'critical',
    requires: ['auth-bypass', 'authz-bypass'],
  },
  {
    name: 'LFI → Remote Code Execution',
    description: 'Local file inclusion exploited to achieve remote code execution via log poisoning or PHP wrappers',
    impact: 'Full remote code execution on the server',
    likelihood: 'medium',
    severity: 'critical',
    requires: ['lfi'],
    optional: ['sqli'],
  },
  {
    name: 'CSRF → State-Changing Actions',
    description: 'Cross-site request forgery combined with authenticated session to perform unauthorized actions',
    impact: 'Unauthorized state-changing operations performed on behalf of victims',
    likelihood: 'medium',
    severity: 'high',
    requires: ['csrf'],
    optional: ['xss'],
  },
  {
    name: 'SSTI → Server-Side Compromise',
    description: 'Server-side template injection exploited to execute arbitrary code on the server',
    impact: 'Remote code execution and full server compromise',
    likelihood: 'medium',
    severity: 'critical',
    requires: ['ssti'],
  },
  {
    name: 'XXE → SSRF Chain',
    description: 'XML External Entity processing used to bypass SSRF protections and access internal resources',
    impact: 'Internal network access, file disclosure, and denial of service',
    likelihood: 'medium',
    severity: 'high',
    requires: ['xxe', 'ssrf'],
  },
  {
    name: 'Insecure Config → Information Disclosure',
    description: 'Insecure configurations expose sensitive information that enables further attacks',
    impact: 'Sensitive data exposure enabling targeted exploitation',
    likelihood: 'high',
    severity: 'medium',
    requires: ['insecure-config'],
    optional: ['information-disclosure'],
  },
];

export function findAttackChains(findings: Finding[]): AttackChain[] {
  const chains: AttackChain[] = [];
  const findingTypes = new Set(findings.map((f) => f.type));

  for (let i = 0; i < CHAIN_RULES.length; i++) {
    const rule = CHAIN_RULES[i];
    if (!rule) continue;
    const hasAllRequired = rule.requires.every((t) => findingTypes.has(t));
    if (!hasAllRequired) continue;

    const matchedRequired = rule.requires.flatMap((t) =>
      findings
        .map((f, idx) => ({ f, idx }))
        .filter(({ f }) => f.type === t)
        .map(({ idx }) => idx),
    );

    const matchedOptional = (rule.optional ?? []).flatMap((t) =>
      findings
        .map((f, idx) => ({ f, idx }))
        .filter(({ f }) => f.type === t)
        .map(({ idx }) => idx),
    );

    const steps = [
      ...matchedRequired.map((idx) => {
        const f = findings[idx];
        return {
          findingIndex: idx,
          description: f ? `[${f.severity.toUpperCase()}] ${f.type}: ${f.description}` : '',
        };
      }),
      ...matchedOptional.map((idx) => {
        const f = findings[idx];
        return {
          findingIndex: idx,
          description: f ? `[${f.severity.toUpperCase()}] ${f.type}: ${f.description}` : '',
        };
      }),
    ];

    chains.push({
      id: `CHAIN-${String(i + 1).padStart(3, '0')}`,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      steps,
      impact: rule.impact,
      likelihood: rule.likelihood,
    });
  }

  return chains;
}
