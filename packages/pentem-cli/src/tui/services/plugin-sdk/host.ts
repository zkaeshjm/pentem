import type { HookPoint, PentemPlugin, PluginContext, PluginHookResult } from '@internal/pentem-shared';
import type { PluginRegistry } from './registry.ts';

export interface AggregatedHookResult {
  abort: boolean;
  notifications: Array<{ type: string; message: string; level: string }>;
  metadata: Record<string, unknown>;
}

export class PluginHost {
  constructor(private registry: PluginRegistry) {}

  async runHook(hook: HookPoint, ctx: PluginContext): Promise<AggregatedHookResult> {
    const result: AggregatedHookResult = { abort: false, notifications: [], metadata: {} };

    for (const plugin of this.registry.getByHook(hook)) {
      try {
        const r = await plugin.execute(hook, ctx);
        if (r.abort) result.abort = true;
        if (r.notifications) result.notifications.push(...r.notifications);
        if (r.metadata) Object.assign(result.metadata, r.metadata);
      } catch (err) {
        result.notifications.push({
          type: 'plugin-error',
          message: `Plugin ${plugin.manifest.name} failed on hook ${hook}: ${err}`,
          level: 'error',
        });
      }
    }

    return result;
  }

  async onBeforeScan(ctx: PluginContext): Promise<AggregatedHookResult> {
    for (const plugin of this.registry.getAll()) {
      try {
        await plugin.init(ctx);
      } catch {}
    }
    return this.runHook('before-scan', ctx);
  }

  async onFinding(ctx: PluginContext, _data: unknown): Promise<AggregatedHookResult> {
    return this.runHook('on-finding', ctx);
  }

  async onAfterScan(ctx: PluginContext): Promise<AggregatedHookResult> {
    return this.runHook('after-scan', ctx);
  }

  async onError(ctx: PluginContext, _data: unknown): Promise<AggregatedHookResult> {
    return this.runHook('on-error', ctx);
  }
}
