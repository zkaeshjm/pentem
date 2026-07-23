import type { HookPoint, PentemPlugin, PluginContext, PluginHookResult, PluginManifest } from '@internal/pentem-shared';

const manifest: PluginManifest = {
  name: 'webhook-notification',
  version: '1.0.0',
  description: 'Send scan notifications to a generic webhook URL',
  type: 'notification',
  hooks: ['after-scan', 'on-error', 'on-finding'],
  configSchema: {
    url: { type: 'string', required: true },
    method: { type: 'string', enum: ['POST', 'PUT'], default: 'POST' },
    headers: { type: 'object', required: false },
    notifyOn: { type: 'array', items: { type: 'string' }, default: ['after-scan', 'on-error'] },
  },
};

export function createWebhookPlugin(_config?: Record<string, unknown>): PentemPlugin {
  return {
    manifest,
    async init(_ctx: PluginContext): Promise<void> {},
    async execute(hook: HookPoint, data?: unknown): Promise<PluginHookResult> {
      const ctx = data as PluginContext;
      const webhookUrl = (ctx.config?.url || process.env.WEBHOOK_URL || '') as string;
      if (!webhookUrl) return {};

      const method = (ctx.config?.method as string) || 'POST';
      const extraHeaders = (ctx.config?.headers as Record<string, string>) || {};

      const payload = {
        event: hook,
        scanId: ctx.scanId,
        targetUrl: ctx.targetUrl,
        timestamp: new Date().toISOString(),
        findings: ctx.findings,
        totalFindings: (ctx.findings as unknown[]).length,
        report: ctx.report,
        phase: ctx.phase,
      };

      try {
        const resp = await fetch(webhookUrl, {
          method,
          headers: { 'Content-Type': 'application/json', ...extraHeaders },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          return {
            notifications: [{ type: 'webhook-error', message: `Webhook returned ${resp.status}`, level: 'error' }],
          };
        }
        return { notifications: [{ type: 'webhook', message: `Webhook sent (${resp.status})`, level: 'info' }] };
      } catch (err) {
        return { notifications: [{ type: 'webhook-error', message: `Webhook failed: ${err}`, level: 'error' }] };
      }
    },
  };
}
