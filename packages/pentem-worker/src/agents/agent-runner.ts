import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentCategory, AgentResult, AgentType, ModelTier } from '@internal/pentem-shared';
import { AGENT_MAX_TURNS } from '@internal/pentem-shared';
import { Context } from '@temporalio/activity';
import { AuditService } from '../audit/audit-service.js';
import { loadPrompt, renderLoginPartials, substituteVars } from './prompts/loader.js';

const TIER_TO_MODEL: Record<ModelTier, string> = {
  small: process.env.PENTEM_MODEL_SMALL ?? 'haiku',
  medium: process.env.PENTEM_MODEL_MEDIUM ?? 'sonnet',
  large: process.env.PENTEM_MODEL_LARGE ?? 'opus',
};

export async function runAgent(
  agentType: AgentType,
  category: AgentCategory,
  targetUrl: string,
  configJson: string,
  auditDir: string,
  tier: ModelTier = 'medium',
  vulnResult?: AgentResult,
): Promise<AgentResult> {
  const audit = new AuditService(auditDir);
  const parsedConfig = JSON.parse(configJson);
  const authConfig = parsedConfig.target?.auth;

  const agentLabel = `${category}-${agentType}`;
  const prompt = loadPrompt(agentType, category);
  const loginPartials = renderLoginPartials(authConfig);

  const rendered = substituteVars(prompt, {
    target_url: targetUrl,
    config_context: configJson,
    login_instructions: loginPartials,
    vuln_analysis: vulnResult
      ? `## Vulnerability Analysis\n${vulnResult.analysisPath}\n\nExploitation Queue: ${vulnResult.exploitationQueuePath}\n`
      : '',
  });

  await audit.savePromptSnapshot(agentLabel, rendered);
  await audit.log(agentLabel, 'Starting agent execution');

  let turnCount = 0;
  const startTime = Date.now();
  const deliverables: string[] = [];

  try {
    const agentSession = query({
      prompt: rendered,
      options: {
        maxTurns: AGENT_MAX_TURNS,
        allowedTools: ['Bash', 'Read', 'Write', 'Glob', 'Grep'],
        model: TIER_TO_MODEL[tier],
      },
    });

    for await (const message of agentSession) {
      await audit.log(agentLabel, `Message: ${message.type}`);

      if (++turnCount % 20 === 0) {
        Context.current().heartbeat({ turnCount, duration: Date.now() - startTime });
      }

      if (message.type === 'result') {
        const duration = Date.now() - startTime;
        await audit.log(agentLabel, `Agent completed in ${duration}ms with ${turnCount} turns`);
        return {
          analysisPath: `${auditDir}/${agentLabel}/deliverables/analysis.md`,
          exploitationQueuePath: `${auditDir}/${agentLabel}/deliverables/queue.json`,
          deliverables,
          turnCount,
          cost: (message as { cost?: number }).cost ?? 0,
          durationMs: duration,
        };
      }
    }

    throw new Error('Agent stream ended without result');
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    await audit.log(agentLabel, `Agent failed: ${errorMsg}`);
    return {
      analysisPath: '',
      exploitationQueuePath: '',
      deliverables,
      turnCount,
      cost: 0,
      durationMs: duration,
      error: errorMsg,
    };
  }
}
