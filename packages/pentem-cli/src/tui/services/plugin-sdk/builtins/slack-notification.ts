import type { HookPoint, PentemPlugin, PluginContext, PluginHookResult, PluginManifest } from '@internal/pentem-shared';

const manifest: PluginManifest = {
  name: 'slack-notification',
  version: '1.0.0',
  description: 'Send scan notifications to Slack via webhook',
  type: 'notification',
  hooks: ['after-scan', 'on-error'],
  configSchema: {
    webhookUrl: { type: 'string', required: true },
    channel: { type: 'string', required: false },
    username: { type: 'string', required: false },
    notifyOn: { type: 'array', items: { type: 'string' }, default: ['after-scan', 'on-error'] },
  },
};

function formatSlackMessage(ctx: PluginContext, event: string): Record<string, unknown> {
  const criticalCount = (ctx.findings as Array<{ severity: string }>).filter((f) => f.severity === 'critical').length;
  const highCount = (ctx.findings as Array<{ severity: string }>).filter((f) => f.severity === 'high').length;
  const total = ctx.findings.length;

  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: event === 'on-error' ? ' Pentem Scan Error' : ' Pentem Scan Complete' },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Target:*\n${ctx.targetUrl}` },
        { type: 'mrkdwn', text: `*Scan ID:*\n${ctx.scanId}` },
      ],
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Total Findings:* ${total}` },
        { type: 'mrkdwn', text: `*Critical:* ${criticalCount} | *High:* ${highCount}` },
      ],
    },
  ];

  if (event === 'on-error') {
    const errData = (ctx.metadata as Record<string, unknown>)?.error ?? 'Unknown error';
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Error:*\n\`\`\`${errData}\`\`\`` } });
  }

  blocks.push(
    { type: 'divider' },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `Pentem | ${new Date().toISOString()}` }] },
  );

  return { blocks, text: `Pentem Scan: ${total} findings (${criticalCount} critical, ${highCount} high)` };
}

export function createSlackPlugin(_config?: Record<string, unknown>): PentemPlugin {
  return {
    manifest,
    async init(_ctx: PluginContext): Promise<void> {},
    async execute(hook: HookPoint, data?: unknown): Promise<PluginHookResult> {
      const ctx = data as PluginContext;
      const webhookUrl = (ctx.config?.webhookUrl || process.env.SLACK_WEBHOOK_URL || '') as string;
      if (!webhookUrl) return {};

      try {
        const payload = formatSlackMessage(ctx, hook);
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          return {
            notifications: [{ type: 'slack-error', message: `Slack webhook returned ${resp.status}`, level: 'error' }],
          };
        }
        return { notifications: [{ type: 'slack', message: 'Notification sent to Slack', level: 'info' }] };
      } catch (err) {
        return { notifications: [{ type: 'slack-error', message: `Slack webhook failed: ${err}`, level: 'error' }] };
      }
    },
  };
}
