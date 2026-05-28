import blessed from 'blessed';
import type { Widgets } from 'blessed';
import type { App, ScreenId, TUIScreen } from '../app.ts';
import { type SessionData, listSessions } from '../services/workspace.ts';

export class DashboardScreen implements TUIScreen {
  id: ScreenId = 'dashboard';
  label = 'Dashboard';
  private box: Widgets.BoxElement;
  private list: Widgets.ListElement;
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
      content: ' Running Scans',
    });

    this.list = blessed.list({
      parent: this.box,
      top: 1,
      left: 0,
      width: '100%',
      height: '100%-2',
      style: { fg: 'white', bg: 'black', selected: { bg: 'blue', fg: 'white' }, item: { bg: 'black', fg: 'white' } },
      keys: true,
      vi: true,
      tags: true,
      scrollbar: { ch: ' ', style: { bg: 'blue' } },
    });
  }

  activate(): void {
    this.box.show();
    this.refresh();
    this.list.focus();
    this.app.screen.render();
  }
  deactivate(): void {
    this.box.hide();
  }

  refresh(): void {
    const running = listSessions().filter((s) => s.status === 'in_progress');
    this.list.setItems(
      running.length === 0
        ? [' No active scans. Switch to Scans tab [2] to start one.']
        : running.map((s) => this.formatSession(s)),
    );
  }

  private formatSession(s: SessionData): string {
    const elapsed = s.startedAt ? Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 1000) : 0;
    return ` {bold}${s.sessionId.slice(0, 20).padEnd(20)}{/bold} | ${s.targetUrl.slice(0, 30).padEnd(30)} | ${s.currentPhase.padEnd(15)} | ${s.completedAgents.length} agents | ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
  }
}
