import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PentemPlugin } from '@internal/pentem-shared';
import { createDiscordPlugin } from './builtins/discord-notification.ts';
import { createEmailPlugin } from './builtins/email-notification.ts';
import { createSlackPlugin } from './builtins/slack-notification.ts';
import { createWebhookPlugin } from './builtins/webhook-notification.ts';
import { PluginRegistry } from './registry.ts';

export class PluginLoader {
  constructor(private registry: PluginRegistry) {}

  async loadBuiltins(): Promise<void> {
    this.tryRegister(() => createSlackPlugin());
    this.tryRegister(() => createDiscordPlugin());
    this.tryRegister(() => createWebhookPlugin());
    this.tryRegister(() => createEmailPlugin());
  }

  async loadFromDirectory(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      if (fs.statSync(fullPath).isDirectory()) continue;
      if (!entry.endsWith('.ts') && !entry.endsWith('.js') && !entry.endsWith('.mjs')) continue;
      try {
        const mod = await import(fullPath);
        const plugin = mod.default || mod.plugin;
        if (plugin && typeof plugin === 'object' && plugin.manifest) {
          this.registry.register(plugin);
        }
      } catch {}
    }
  }

  async loadFromPackage(name: string): Promise<void> {
    try {
      const mod = await import(name);
      const plugin = mod.default || mod.plugin;
      if (plugin && typeof plugin === 'object' && plugin.manifest) {
        this.registry.register(plugin);
      }
    } catch {}
  }

  private tryRegister(factory: () => PentemPlugin): void {
    try {
      this.registry.register(factory());
    } catch {}
  }

  static async loadAll(config?: { pluginDirs?: string[]; pluginPackages?: string[] }): Promise<PluginRegistry> {
    const registry = new PluginRegistry();
    const loader = new PluginLoader(registry);
    await loader.loadBuiltins();
    if (config?.pluginDirs) {
      for (const dir of config.pluginDirs) {
        await loader.loadFromDirectory(dir);
      }
    }
    if (config?.pluginPackages) {
      for (const pkg of config.pluginPackages) {
        await loader.loadFromPackage(pkg);
      }
    }
    return registry;
  }
}
