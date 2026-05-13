import type { AgentResult } from '@internal/shannon-shared';
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/index.js';

const { runNmapScan, runSubfinder, runWhatWeb, runSourceAnalysis } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 minutes',
  heartbeatTimeout: '5 minutes',
  retry: {
    maximumAttempts: 5,
    initialInterval: '10 seconds',
    backoffCoefficient: 2,
  },
});

const { runBrowserExploration, runApiMapping } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 minutes',
  heartbeatTimeout: '5 minutes',
});

// Vuln agent activities with long timeouts
const vulnActivities = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 hours',
  heartbeatTimeout: '60 minutes',
  retry: {
    maximumAttempts: 5,
    initialInterval: '30 seconds',
    backoffCoefficient: 2,
  },
});

// Exploit agent activities with long timeouts
const exploitActivities = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 hours',
  heartbeatTimeout: '60 minutes',
  retry: {
    maximumAttempts: 5,
    initialInterval: '30 seconds',
    backoffCoefficient: 2,
  },
});

const { assembleReport } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
});

export interface WorkflowParams {
  sessionId: string;
  targetUrl: string;
  configJson: string;
  auditDir: string;
  workspacePath: string;
  modelTier?: string;
  resumeFrom?: Record<string, boolean>;
  repoPath?: string;
}

export interface WorkflowResult {
  sessionId: string;
  success: boolean;
  reportPath?: string;
  agentResults: Record<string, AgentResult>;
  error?: string;
}

export async function shannonPipeline(params: WorkflowParams): Promise<WorkflowResult> {
  const { sessionId, targetUrl, configJson, auditDir, workspacePath, modelTier, resumeFrom, repoPath } = params;
  const phaseResults: Record<string, string> = {};
  const agentResults: Record<string, AgentResult> = {};

  const isResumed = (agentLabel: string): boolean => {
    return resumeFrom?.[agentLabel] === true;
  };

  // =======================
  // PHASE 1: Pre-Recon (sequential)
  // =======================
  if (!isResumed('phase1')) {
    const nmap = await runNmapScan({ targetUrl, auditDir });
    phaseResults['pre-recon-nmap'] = nmap;

    const subfinder = await runSubfinder({ targetUrl, auditDir });
    phaseResults['pre-recon-subfinder'] = subfinder;

    const whatweb = await runWhatWeb({ targetUrl, auditDir });
    phaseResults['pre-recon-whatweb'] = whatweb;

    const source = await runSourceAnalysis({ targetUrl, auditDir, repoPath });
    phaseResults['pre-recon-source'] = source;
  }

  // =======================
  // PHASE 2: Recon (sequential)
  // =======================
  if (!isResumed('phase2')) {
    const browser = await runBrowserExploration({ targetUrl, auditDir });
    phaseResults['recon-browser'] = browser;

    const api = await runApiMapping({ targetUrl, auditDir });
    phaseResults['recon-api'] = api;
  }

  // =======================
  // PHASE 3+4: Vuln + Exploit pairs (parallel, no sync barrier between vuln and exploit)
  // =======================
  const agentPairs = [
    { vuln: 'sqli' as const, exploit: 'sqli' as const },
    { vuln: 'xss' as const, exploit: 'xss' as const },
    { vuln: 'auth-bypass' as const, exploit: 'auth-bypass' as const },
    { vuln: 'authz-bypass' as const, exploit: 'authz-bypass' as const },
    { vuln: 'ssrf' as const, exploit: 'ssrf' as const },
  ] as const;

  const pairResults = await Promise.all(
    agentPairs.map(async (pair) => {
      const vulnLabel = `vuln-${pair.vuln}`;
      const exploitLabel = `exploit-${pair.exploit}`;

      let vulnResult: AgentResult;
      if (isResumed(vulnLabel)) {
        vulnResult = {
          analysisPath: '',
          exploitationQueuePath: '',
          deliverables: [],
          turnCount: 0,
          cost: 0,
          durationMs: 0,
        };
      } else {
        switch (pair.vuln) {
          case 'sqli':
            vulnResult = await vulnActivities.vulnAgentSqli({
              targetUrl,
              configJson,
              auditDir,
              workspacePath,
              sessionId,
              modelTier,
            });
            break;
          case 'xss':
            vulnResult = await vulnActivities.vulnAgentXss({
              targetUrl,
              configJson,
              auditDir,
              workspacePath,
              sessionId,
              modelTier,
            });
            break;
          case 'auth-bypass':
            vulnResult = await vulnActivities.vulnAgentAuthBypass({
              targetUrl,
              configJson,
              auditDir,
              workspacePath,
              sessionId,
              modelTier,
            });
            break;
          case 'authz-bypass':
            vulnResult = await vulnActivities.vulnAgentAuthzBypass({
              targetUrl,
              configJson,
              auditDir,
              workspacePath,
              sessionId,
              modelTier,
            });
            break;
          case 'ssrf':
            vulnResult = await vulnActivities.vulnAgentSsrf({
              targetUrl,
              configJson,
              auditDir,
              workspacePath,
              sessionId,
              modelTier,
            });
            break;
        }
      }

      let exploitResult: AgentResult;
      if (isResumed(exploitLabel)) {
        exploitResult = {
          analysisPath: '',
          exploitationQueuePath: '',
          deliverables: [],
          turnCount: 0,
          cost: 0,
          durationMs: 0,
        };
      } else {
        switch (pair.exploit) {
          case 'sqli':
            exploitResult = await exploitActivities.exploitAgentSqli({
              targetUrl,
              configJson,
              auditDir,
              workspacePath,
              sessionId,
              modelTier,
              vulnResult,
            });
            break;
          case 'xss':
            exploitResult = await exploitActivities.exploitAgentXss({
              targetUrl,
              configJson,
              auditDir,
              workspacePath,
              sessionId,
              modelTier,
              vulnResult,
            });
            break;
          case 'auth-bypass':
            exploitResult = await exploitActivities.exploitAgentAuthBypass({
              targetUrl,
              configJson,
              auditDir,
              workspacePath,
              sessionId,
              modelTier,
              vulnResult,
            });
            break;
          case 'authz-bypass':
            exploitResult = await exploitActivities.exploitAgentAuthzBypass({
              targetUrl,
              configJson,
              auditDir,
              workspacePath,
              sessionId,
              modelTier,
              vulnResult,
            });
            break;
          case 'ssrf':
            exploitResult = await exploitActivities.exploitAgentSsrf({
              targetUrl,
              configJson,
              auditDir,
              workspacePath,
              sessionId,
              modelTier,
              vulnResult,
            });
            break;
        }
      }

      return { pair, vulnResult, exploitResult };
    }),
  );

  // Collect all agent results
  for (const result of pairResults) {
    agentResults[`vuln-${result.pair.vuln}`] = result.vulnResult;
    agentResults[`exploit-${result.pair.exploit}`] = result.exploitResult;
  }

  // =======================
  // PHASE 5: Report (sequential)
  // =======================
  const reportPath = await assembleReport({
    targetUrl,
    auditDir,
    sessionId,
    agentResults: Object.fromEntries(
      Object.entries(agentResults).map(([key, r]) => [
        key,
        {
          category: key.startsWith('vuln') ? 'vulnerability' : 'exploitation',
          analysisFile: r.analysisPath,
          exploitFile: r.exploitationQueuePath,
          deliverables: r.deliverables,
          turnCount: r.turnCount,
          durationMs: r.durationMs,
          error: r.error,
        },
      ]),
    ),
    phaseResults,
  });

  return {
    sessionId,
    success: true,
    reportPath,
    agentResults,
  };
}
