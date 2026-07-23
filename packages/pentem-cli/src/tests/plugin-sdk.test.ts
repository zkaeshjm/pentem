import type { HookPoint, PentemPlugin, PluginContext, PluginHookResult, PluginManifest } from '@internal/pentem-shared';
import { describe, expect, it } from 'vitest';
import { PluginRegistry } from '../tui/services/plugin-sdk/registry.ts';

function createMockPlugin(name: string, hooks: HookPoint[]): PentemPlugin {
  return {
    manifest: { name, version: '1.0.0', description: 'test', type: 'notification', hooks },
    async init(_ctx: PluginContext): Promise<void> {},
    async execute(_hook: HookPoint, _data?: unknown): Promise<PluginHookResult> {
      return { notifications: [{ type: name, message: 'test', level: 'info' }] };
    },
  };
}

describe('PluginRegistry', () => {
  it('should register and retrieve plugins', () => {
    const r = new PluginRegistry();
    const p = createMockPlugin('test-plugin', ['after-scan']);
    r.register(p);
    expect(r.get('test-plugin')).toBe(p);
    expect(r.count).toBe(1);
  });

  it('should throw on duplicate registration', () => {
    const r = new PluginRegistry();
    r.register(createMockPlugin('dup', ['after-scan']));
    expect(() => r.register(createMockPlugin('dup', ['after-scan']))).toThrow();
  });

  it('should get plugins by hook point', () => {
    const r = new PluginRegistry();
    r.register(createMockPlugin('p1', ['after-scan']));
    r.register(createMockPlugin('p2', ['on-finding']));
    r.register(createMockPlugin('p3', ['after-scan', 'on-error']));
    expect(r.getByHook('after-scan')).toHaveLength(2);
    expect(r.getByHook('on-finding')).toHaveLength(1);
    expect(r.getByHook('on-error')).toHaveLength(1);
    expect(r.getByHook('before-scan')).toHaveLength(0);
  });

  it('should remove plugins', () => {
    const r = new PluginRegistry();
    r.register(createMockPlugin('p1', ['after-scan']));
    expect(r.remove('p1')).toBe(true);
    expect(r.count).toBe(0);
    expect(r.remove('nonexistent')).toBe(false);
  });

  it('should clear all plugins', () => {
    const r = new PluginRegistry();
    r.register(createMockPlugin('p1', []));
    r.register(createMockPlugin('p2', []));
    r.clear();
    expect(r.count).toBe(0);
  });
});
