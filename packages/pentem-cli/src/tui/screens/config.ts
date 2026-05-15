import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const blessed = require('blessed');

import type { Widgets } from 'blessed';
import type { App, ScreenId, TUIScreen } from '../app.ts';
import { getConfigContent, getConfigPath, writeConfig } from '../services/workspace.ts';

export class ConfigScreen implements TUIScreen {
  id: ScreenId = 'config';
  label = 'Config';
  private box: Widgets.BoxElement;
  private textarea: Widgets.TextareaElement | null = null;
  private app: App;

  constructor(parent: Widgets.BoxElement, app: App) {
    this.app = app;
    this.box = blessed.box({ parent, top: 0, left: 0, width: '100%', height: '100%', style: { bg: 'black' } });

    blessed.text({
      parent: this.box,
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: { fg: 'cyan', bold: true },
      content: ' [Ctrl+S] Save  [r] Reload  [Esc] Exit Edit',
    });

    const content = getConfigContent();
    const configPath = getConfigPath();

    if (!content || !configPath) {
      blessed.text({
        parent: this.box,
        top: 3,
        left: 2,
        content: ' No configuration file found.\n\n Run "pentem config init" to create one.',
        style: { fg: 'yellow' },
      });
      return;
    }

    blessed.text({
      parent: this.box,
      top: 1,
      left: 0,
      content: ` ${configPath}`,
      style: { fg: 'green' },
    });

    this.textarea = blessed.textarea({
      parent: this.box,
      top: 2,
      left: 0,
      width: '100%',
      height: '100%-3',
      style: { bg: 'black', fg: 'white', focus: { bg: '#0a0a0a' } },
      content,
      keys: true,
      vi: true,
      scrollable: true,
      scrollbar: { ch: ' ', style: { bg: 'blue' } },
      inputOnFocus: true,
    });

    this.textarea!.key(['C-s'], () => this.save());
    this.app.screen.key(['r', 'R'], () => {
      if (!this.textarea) return;
      this.reload();
    });
  }

  activate(): void {
    this.box.show();
    this.textarea?.focus();
    this.app.screen.render();
  }
  deactivate(): void {
    this.box.hide();
  }

  refresh(): void {}

  private save(): void {
    const c = this.textarea?.getValue();
    if (!c) return;
    if (writeConfig(c)) this.app.setStatus('Configuration saved');
    else this.app.setStatus('Failed to save configuration');
  }

  private reload(): void {
    const c = getConfigContent();
    if (c && this.textarea) {
      this.textarea.setValue(c);
      this.app.setStatus('Configuration reloaded');
    }
  }
}
