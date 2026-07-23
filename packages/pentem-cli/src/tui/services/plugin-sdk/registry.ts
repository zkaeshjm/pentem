import type { HookPoint, PentemPlugin } from '@internal/pentem-shared';

export class PluginRegistry {
  private plugins = new Map<string, PentemPlugin>();

  register(plugin: PentemPlugin): void {
    if (this.plugins.has(plugin.manifest.name)) {
      throw new Error(`Plugin already registered: ${plugin.manifest.name}`);
    }
    this.plugins.set(plugin.manifest.name, plugin);
  }

  get(name: string): PentemPlugin | undefined {
    return this.plugins.get(name);
  }

  getAll(): PentemPlugin[] {
    return [...this.plugins.values()];
  }

  getByHook(hook: HookPoint): PentemPlugin[] {
    return this.getAll().filter((p) => p.manifest.hooks.includes(hook));
  }

  remove(name: string): boolean {
    return this.plugins.delete(name);
  }

  clear(): void {
    this.plugins.clear();
  }

  get count(): number {
    return this.plugins.size;
  }
}
