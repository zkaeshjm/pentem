export type ComplianceFramework =
  | 'pci-dss'
  | 'hipaa'
  | 'soc2'
  | 'iso-27001'
  | 'gdpr'
  | 'owasp-asvs'
  | 'nist-csf'
  | 'cis-controls';

export interface ComplianceRequirement {
  framework: ComplianceFramework;
  controlId: string;
  controlName: string;
  description: string;
}

export interface ComplianceMapping {
  vulnerabilityType: string;
  requirements: ComplianceRequirement[];
}

const COMPLIANCE_MAPPINGS: ComplianceMapping[] = [
  {
    vulnerabilityType: 'sqli',
    requirements: [
      {
        framework: 'pci-dss',
        controlId: '6.5.1',
        controlName: 'SQL Injection',
        description: 'Protect against SQL injection',
      },
      {
        framework: 'owasp-asvs',
        controlId: '5.3.7',
        controlName: 'Input Validation',
        description: 'Verify input validation and encoding',
      },
      {
        framework: 'iso-27001',
        controlId: 'A.14.2.5',
        controlName: 'System security testing',
        description: 'Security testing in development',
      },
      {
        framework: 'nist-csf',
        controlId: 'PR.AC-4',
        controlName: 'Access Permissions',
        description: 'Access permissions and authorizations',
      },
      {
        framework: 'hipaa',
        controlId: '164.306(a)',
        controlName: 'Security Standards',
        description: 'General security standards',
      },
    ],
  },
  {
    vulnerabilityType: 'xss',
    requirements: [
      {
        framework: 'pci-dss',
        controlId: '6.5.7',
        controlName: 'Cross-Site Scripting',
        description: 'Protect against XSS',
      },
      {
        framework: 'owasp-asvs',
        controlId: '5.1.1',
        controlName: 'Output Encoding',
        description: 'Verify output encoding',
      },
      {
        framework: 'soc2',
        controlId: 'CC7.1',
        controlName: 'System Operations',
        description: 'Detection and response to security events',
      },
    ],
  },
  {
    vulnerabilityType: 'auth-bypass',
    requirements: [
      {
        framework: 'pci-dss',
        controlId: '8.3.1',
        controlName: 'Authentication',
        description: 'Secure authentication mechanisms',
      },
      {
        framework: 'owasp-asvs',
        controlId: '2.1.1',
        controlName: 'Verification',
        description: 'Verify authentication requirements',
      },
      {
        framework: 'iso-27001',
        controlId: 'A.9.4.2',
        controlName: 'Access Control',
        description: 'Secure log-on procedures',
      },
      {
        framework: 'nist-csf',
        controlId: 'PR.AC-7',
        controlName: 'Authentication',
        description: 'Identity and authentication management',
      },
    ],
  },
  {
    vulnerabilityType: 'authz-bypass',
    requirements: [
      {
        framework: 'pci-dss',
        controlId: '7.2.1',
        controlName: 'Access Control',
        description: 'Access control systems',
      },
      {
        framework: 'owasp-asvs',
        controlId: '4.1.1',
        controlName: 'Access Control',
        description: 'Verify access control enforcement',
      },
      {
        framework: 'soc2',
        controlId: 'CC6.1',
        controlName: 'Logical Access',
        description: 'Logical and physical access controls',
      },
    ],
  },
  {
    vulnerabilityType: 'ssrf',
    requirements: [
      {
        framework: 'owasp-asvs',
        controlId: '13.1.3',
        controlName: 'SSRF Protection',
        description: 'Verify SSRF protections',
      },
      {
        framework: 'nist-csf',
        controlId: 'PR.AC-5',
        controlName: 'Network Integrity',
        description: 'Network integrity protections',
      },
    ],
  },
  {
    vulnerabilityType: 'csrf',
    requirements: [
      {
        framework: 'owasp-asvs',
        controlId: '13.2.1',
        controlName: 'CSRF Protection',
        description: 'Verify CSRF protections',
      },
      {
        framework: 'pci-dss',
        controlId: '6.5.5',
        controlName: 'CSRF',
        description: 'Protect against cross-site request forgery',
      },
    ],
  },
  {
    vulnerabilityType: 'lfi',
    requirements: [
      {
        framework: 'owasp-asvs',
        controlId: '12.3.1',
        controlName: 'File Inclusion',
        description: 'Verify file inclusion protections',
      },
      {
        framework: 'pci-dss',
        controlId: '6.5.1',
        controlName: 'Injection',
        description: 'Protect against injection flaws',
      },
    ],
  },
  {
    vulnerabilityType: 'xxe',
    requirements: [
      {
        framework: 'owasp-asvs',
        controlId: '13.1.1',
        controlName: 'XML Processing',
        description: 'Verify XML external entity protections',
      },
      {
        framework: 'pci-dss',
        controlId: '6.5.1',
        controlName: 'Injection',
        description: 'Protect against injection flaws',
      },
    ],
  },
  {
    vulnerabilityType: 'ssti',
    requirements: [
      {
        framework: 'owasp-asvs',
        controlId: '5.5.1',
        controlName: 'Template Injection',
        description: 'Verify template injection protections',
      },
    ],
  },
  {
    vulnerabilityType: 'insecure-config',
    requirements: [
      {
        framework: 'pci-dss',
        controlId: '2.2',
        controlName: 'Configuration Standards',
        description: 'Develop configuration standards',
      },
      {
        framework: 'cis-controls',
        controlId: '4.1',
        controlName: 'Configuration Management',
        description: 'Maintain secure configurations',
      },
    ],
  },
  {
    vulnerabilityType: 'information-disclosure',
    requirements: [
      {
        framework: 'gdpr',
        controlId: 'Art. 32',
        controlName: 'Security of Processing',
        description: 'Implement appropriate security measures',
      },
      {
        framework: 'pci-dss',
        controlId: '6.5.5',
        controlName: 'Information Leakage',
        description: 'Prevent information leakage',
      },
    ],
  },
];

export function getComplianceForVulnType(vulnType: string): ComplianceRequirement[] {
  const mapping = COMPLIANCE_MAPPINGS.find((m) => m.vulnerabilityType === vulnType);
  return mapping?.requirements ?? [];
}

export function getComplianceForAllVulns(): ComplianceMapping[] {
  return COMPLIANCE_MAPPINGS;
}

export function getAllFrameworks(): ComplianceFramework[] {
  return ['pci-dss', 'hipaa', 'soc2', 'iso-27001', 'gdpr', 'owasp-asvs', 'nist-csf'];
}

export function getFrameworkDisplayName(framework: ComplianceFramework): string {
  const names: Record<ComplianceFramework, string> = {
    'pci-dss': 'PCI DSS v4.0',
    hipaa: 'HIPAA Security Rule',
    soc2: 'SOC 2 Type II',
    'iso-27001': 'ISO/IEC 27001',
    gdpr: 'GDPR',
    'owasp-asvs': 'OWASP ASVS 4.0',
    'nist-csf': 'NIST CSF 2.0',
    'cis-controls': 'CIS Controls',
  };
  return names[framework];
}
