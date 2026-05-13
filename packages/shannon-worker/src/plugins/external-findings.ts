export interface ExternalFinding {
  source: string;
  vulnerabilityType: string;
  targetUrl: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: string;
}

export interface ExternalFindingsPlugin {
  fetch(sessionId: string, targetUrl: string): Promise<ExternalFinding[]>;
}

export class NoopExternalFindingsPlugin implements ExternalFindingsPlugin {
  async fetch(_sessionId: string, _targetUrl: string): Promise<ExternalFinding[]> {
    return [];
  }
}
