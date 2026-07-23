import type { HookPoint, PentemPlugin, PluginContext, PluginHookResult } from '@internal/pentem-shared';
import { describe, expect, it } from 'vitest';
import { PluginHost } from '../tui/services/plugin-sdk/host.ts';
import { PluginRegistry } from '../tui/services/plugin-sdk/registry.ts';

describe('PluginHost', () => {
  function createPlugin(name: string, result: Partial<PluginHookResult> = {}): PentemPlugin {
    return {
      manifest: {
        name,
        version: '1.0.0',
        description: '',
        type: 'notification',
        hooks: ['before-scan', 'after-scan', 'on-finding', 'on-error'],
      },
      async init(_ctx: PluginContext): Promise<void> {},
      async execute(_hook: HookPoint, _data?: unknown): Promise<PluginHookResult> {
        return { abort: false, notifications: [{ type: name, message: 'test', level: 'info' }], ...result };
      },
    };
  }

  it('should run hook across multiple plugins', async () => {
    const reg = new PluginRegistry();
    reg.register(createPlugin('a'));
    reg.register(createPlugin('b'));
    const host = new PluginHost(reg);
    const ctx: PluginContext = { scanId: 's1', targetUrl: 'http://test.com', config: {}, findings: [], report: '' };
    const result = await host.runHook('after-scan', ctx);
    expect(result.notifications).toHaveLength(2);
    expect(result.notifications.map((n) => n.type)).toEqual(['a', 'b']);
  });

  it('should aggregate abort signals', async () => {
    const reg = new PluginRegistry();
    reg.register(createPlugin('abort', { abort: true }));
    reg.register(createPlugin('normal'));
    const host = new PluginHost(reg);
    const ctx: PluginContext = { scanId: 's1', targetUrl: 'http://test.com', config: {}, findings: [], report: '' };
    const result = await host.runHook('before-scan', ctx);
    expect(result.abort).toBe(true);
  });

  it('should handle plugin errors gracefully', async () => {
    const reg = new PluginRegistry();
    reg.register({
      manifest: { name: 'broken', version: '1.0.0', description: '', type: 'notification', hooks: ['after-scan'] },
      async init() {},
      async execute() {
        throw new Error('plugin exploded');
      },
    });
    const host = new PluginHost(reg);
    const ctx: PluginContext = { scanId: 's1', targetUrl: 'http://test.com', config: {}, findings: [], report: '' };
    const result = await host.runHook('after-scan', ctx);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]!.type).toBe('plugin-error');
  });

  it('should call init on all plugins during onBeforeScan', async () => {
    const inits: string[] = [];
    const reg = new PluginRegistry();
    reg.register({
      manifest: { name: 'p1', version: '1.0.0', description: '', type: 'notification', hooks: ['before-scan'] },
      async init() {
        inits.push('p1');
      },
      async execute() {
        return {};
      },
    });
    const host = new PluginHost(reg);
    const ctx: PluginContext = { scanId: 's1', targetUrl: 'http://test.com', config: {}, findings: [], report: '' };
    await host.onBeforeScan(ctx);
    expect(inits).toEqual(['p1']);
  });
});
