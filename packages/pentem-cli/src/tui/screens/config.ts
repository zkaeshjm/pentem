import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import blessed from 'blessed';
import type { Widgets } from 'blessed';
import type { App, ScreenId, TUIScreen } from '../app.ts';
import { loadConfig } from '../../config-loader.ts';
import { detectFromEnvOrConfig } from '../services/providers-config.ts';
import { getConfigContent, getConfigPath, writeConfig } from '../services/workspace.ts';

export class ConfigScreen implements TUIScreen {
  id: ScreenId = 'config';
  label = 'Config';
  private parent: Widgets.BoxElement;
  private box: Widgets.BoxElement | null = null;
  private app: App;
  private modals: Widgets.BoxElement[] = [];

  constructor(parent: Widgets.BoxElement, app: App) {
    this.parent = parent;
    this.app = app;
  }

  activate(): void {
    this.box = blessed.box({ parent: this.parent, top: 0, left: 0, width: '100%', height: '100%', style: { bg: 'black' } });
    this.renderInfo();
    this.app.screen.render();
  }

  deactivate(): void {
    this.app.screen.grabKeys = false;
    for (const m of this.modals) { try { m.detach(); m.destroy(); } catch {} }
    this.app.modalCount -= this.modals.length;
    if (this.app.modalCount < 0) this.app.modalCount = 0;
    this.modals = [];
    this.box?.detach();
    this.box?.destroy();
    this.box = null;
  }

  refresh(): void {
    this.deactivate();
    this.activate();
  }

  private renderInfo(): void {
    if (!this.box) return;

    blessed.text({
      parent: this.box, top: 0, left: 0, width: '100%', height: 1,
      style: { fg: 'cyan', bold: true },
      content: ' [e] Edit Config  [i] Init Default  [v] Validate  [r] Refresh',
    });

    const configPath = getConfigPath();
    const provider = detectFromEnvOrConfig();

    const infoLines: string[] = [];
    if (provider.configured) {
      infoLines.push(` Provider: ${provider.provider.toUpperCase()}  [CONFIGURED]`);
      infoLines.push(` Model: ${provider.model || 'default'}`);
    } else {
      infoLines.push(' Provider: None');
    }
    infoLines.push('');
    if (configPath) {
      infoLines.push(` Config: ${configPath}`);
    } else {
      infoLines.push(' Config: No config file found. Press [i] to create one.');
    }

    blessed.box({
      parent: this.box, top: 1, left: 1, width: '100%-2', height: 5,
      style: { fg: 'white', bg: 'black' },
      content: infoLines.join('\n'),
      tags: true,
    });
  }

  startEdit(): void {
    const content = getConfigContent();
    const configPath = getConfigPath();
    if (!content || !configPath) {
      this.app.setStatus('No config file. Press [i] to init a default one.');
      return;
    }

    this.deactivate();
    this.box = blessed.box({ parent: this.parent, top: 0, left: 0, width: '100%', height: '100%', style: { bg: 'black' } });

    blessed.text({
      parent: this.box, top: 0, left: 0, width: '100%', height: 1,
      style: { fg: 'cyan', bold: true },
      content: ' [Ctrl+S] Save  [r] Reload  [Esc] Exit Edit',
    });

    const textarea = blessed.textarea({
      parent: this.box, top: 1, left: 0, width: '100%', height: '100%-2',
      style: { bg: 'black', fg: 'white', focus: { bg: '#0a0a0a' } },
      content,
      keys: true, vi: true, scrollable: true,
      scrollbar: { ch: ' ', style: { bg: 'blue' } },
      inputOnFocus: true,
    });

    textarea.key(['C-s'], () => {
      const c = textarea.getValue();
      if (c && writeConfig(c)) this.app.setStatus('Configuration saved');
      else this.app.setStatus('Failed to save configuration');
    });

    textarea.key(['escape'], () => {
      this.app.lastEscapeClose = Date.now();
      this.app.screen.grabKeys = false;
      this.refresh();
    });
    textarea.focus();
    this.app.screen.render();
    this.app.setStatus('Editing config — Ctrl+S to save, Esc to exit');
  }

  initDefault(): void {
    const configPath = getConfigPath() || path.join(os.homedir(), '.pentem', 'config.yaml');
    if (fs.existsSync(configPath)) {
      this.app.setStatus('Config file already exists. Press [r] to reload.');
      return;
    }
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    const defaultConfig = `# Pentem Configuration
target:
  url: ""
  auth:
    type: form
pipeline:
  retryPreset: default
  maxConcurrent: 3
provider:
  type: anthropic
models:
  # medium: claude-sonnet-4-20250514
`;
    fs.writeFileSync(configPath, defaultConfig, 'utf-8');
    this.app.setStatus(`Default config created at: ${configPath}`);
    this.refresh();
  }

  validate(): void {
    const configPath = getConfigPath();
    if (!configPath || !fs.existsSync(configPath)) {
      this.showPopup('No config file found. Press [i] to init one.', false);
      return;
    }
    try {
      loadConfig(configPath);
      this.showPopup('Configuration is valid', true);
    } catch (err) {
      this.showPopup(String(err), false);
    }
  }

  private showPopup(message: string, success: boolean): void {
    const box = blessed.box({
      parent: this.app.screen, top: 'center', left: 'center', width: 60, height: message.split('\n').length + 4,
      style: { bg: 'black', border: { type: 'line', fg: success ? 2 : 1 } },
      border: { type: 'line', fg: success ? 2 : 1 },
      content: `\n ${success ? 'OK' : 'Error'}: ${message.replace(/\n/g, '\n ')}`,
      tags: true,
    });

    this.modals.push(box);
    this.app.modalCount++;
    const close = () => { box.detach(); box.destroy(); this.modals = this.modals.filter((m) => m !== box); this.app.modalCount--; this.app.screen.render(); };
    box.key(['escape', 'v', 'V'], () => { this.app.lastEscapeClose = Date.now(); close(); });
    box.focus();
    this.app.screen.render();
  }
}
