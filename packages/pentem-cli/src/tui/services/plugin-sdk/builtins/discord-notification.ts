import type { HookPoint, PentemPlugin, PluginContext, PluginHookResult, PluginManifest } from '@internal/pentem-shared';

const manifest: PluginManifest = {
  name: 'discord-notification',
  version: '1.0.0',
  description: 'Send scan notifications to Discord via webhook',
  type: 'notification',
  hooks: ['after-scan', 'on-error'],
  configSchema: {
    webhookUrl: { type: 'string', required: true },
    username: { type: 'string', required: false },
    notifyOn: { type: 'array', items: { type: 'string' }, default: ['after-scan', 'on-error'] },
  },
};

export function createDiscordPlugin(_config?: Record<string, unknown>): PentemPlugin {
  return {
    manifest,
    async init(_ctx: PluginContext): Promise<void> {},
    async execute(hook: HookPoint, data?: unknown): Promise<PluginHookResult> {
      const ctx = data as PluginContext;
      const webhookUrl = (ctx.config?.webhookUrl || process.env.DISCORD_WEBHOOK_URL || '') as string;
      if (!webhookUrl) return {};

      const criticalCount = (ctx.findings as Array<{ severity: string }>).filter(
        (f) => f.severity === 'critical',
      ).length;
      const highCount = (ctx.findings as Array<{ severity: string }>).filter((f) => f.severity === 'high').length;
      const total = ctx.findings.length;

      const color = hook === 'on-error' ? 0xff0000 : criticalCount > 0 ? 0xff4444 : highCount > 0 ? 0xffaa00 : 0x00ff00;

      const embed: Record<string, unknown> = {
        title: hook === 'on-error' ? ' Pentem Scan Error' : ' Pentem Scan Complete',
        color,
        fields: [
          { name: 'Target', value: ctx.targetUrl, inline: true },
          { name: 'Scan ID', value: ctx.scanId, inline: true },
          { name: 'Findings', value: `${total} total | ${criticalCount} critical | ${highCount} high`, inline: false },
        ],
        timestamp: new Date().toISOString(),
      };

      try {
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] }),
        });
        if (!resp.ok) {
          return {
            notifications: [
              { type: 'discord-error', message: `Discord webhook returned ${resp.status}`, level: 'error' },
            ],
          };
        }
        return { notifications: [{ type: 'discord', message: 'Notification sent to Discord', level: 'info' }] };
      } catch (err) {
        return {
          notifications: [{ type: 'discord-error', message: `Discord webhook failed: ${err}`, level: 'error' }],
        };
      }
    },
  };
}
