import type { HookPoint, PluginContext } from '@internal/pentem-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDiscordPlugin } from '../tui/services/plugin-sdk/builtins/discord-notification.ts';
import { createSlackPlugin } from '../tui/services/plugin-sdk/builtins/slack-notification.ts';
import { createWebhookPlugin } from '../tui/services/plugin-sdk/builtins/webhook-notification.ts';

const originalFetch = globalThis.fetch;

function makeContext(overrides?: Partial<PluginContext>): PluginContext {
  return {
    scanId: 'test-scan-123',
    targetUrl: 'http://example.com',
    config: {},
    findings: [
      { type: 'xss', severity: 'high', url: 'http://example.com/test', description: 'XSS found', detail: '' },
      { type: 'sqli', severity: 'critical', url: 'http://example.com/sqli', description: 'SQLi found', detail: '' },
    ],
    report: '# Report',
    ...overrides,
  };
}

describe('Notification Plugins', () => {
  describe('Slack Plugin', () => {
    it('should skip if no webhook URL configured', async () => {
      const plugin = createSlackPlugin();
      const ctx = makeContext({ config: {} });
      const result = await plugin.execute('after-scan', ctx);
      expect(result.notifications).toBeUndefined();
    });

    it('should send notification when webhook URL is set', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

      const plugin = createSlackPlugin();
      const ctx = makeContext({ config: { webhookUrl: 'https://hooks.slack.com/test' } });
      const result = await plugin.execute('after-scan', ctx);
      expect(result.notifications).toBeDefined();
      expect(result.notifications![0]!.type).toBe('slack');
    });

    it('should report error on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      const plugin = createSlackPlugin();
      const ctx = makeContext({ config: { webhookUrl: 'https://hooks.slack.com/test' } });
      const result = await plugin.execute('on-error', ctx);
      expect(result.notifications![0]!.type).toBe('slack-error');
    });

    it('should report error on fetch failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));
      const plugin = createSlackPlugin();
      const ctx = makeContext({ config: { webhookUrl: 'https://hooks.slack.com/test' } });
      const result = await plugin.execute('after-scan', ctx);
      expect(result.notifications![0]!.type).toBe('slack-error');
    });
  });

  describe('Discord Plugin', () => {
    it('should skip if no webhook URL', async () => {
      globalThis.fetch = vi.fn();
      const plugin = createDiscordPlugin();
      const ctx = makeContext({ config: {} });
      const result = await plugin.execute('after-scan', ctx);
      expect(result.notifications).toBeUndefined();
    });

    it('should send embed to Discord webhook', async () => {
      let sentBody: unknown = null;
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
        sentBody = JSON.parse(opts.body as string);
        return { ok: true };
      });
      const plugin = createDiscordPlugin();
      const ctx = makeContext({ config: { webhookUrl: 'https://discord.com/api/webhooks/test' } });
      const result = await plugin.execute('after-scan', ctx);
      expect(result.notifications![0]!.type).toBe('discord');
      expect((sentBody as Record<string, unknown>).embeds).toBeDefined();
    });
  });

  describe('Webhook Plugin', () => {
    it('should send generic POST', async () => {
      let sentBody: unknown = null;
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
        sentBody = JSON.parse(opts.body as string);
        return { ok: true };
      });
      const plugin = createWebhookPlugin();
      const ctx = makeContext({ config: { url: 'https://hook.example.com/scan' } });
      const result = await plugin.execute('after-scan', ctx);
      expect(result.notifications![0]!.type).toBe('webhook');
      expect((sentBody as Record<string, unknown>).event).toBe('after-scan');
      expect((sentBody as Record<string, unknown>).scanId).toBe('test-scan-123');
    });
  });

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });
});
