import blessed from 'blessed';
import type { Widgets } from 'blessed';
import type { App, ScreenId, TUIScreen } from '../app.ts';
import { cleanStoppedScans, scanEvents, startScan, stopScan } from '../services/scanner.ts';
import { type SessionData, getSession, listSessions } from '../services/workspace.ts';

export class ScansScreen implements TUIScreen {
  id: ScreenId = 'scans';
  label = 'Scans';
  private box: Widgets.BoxElement;
  private list: Widgets.ListElement;
  private statusText: Widgets.TextElement;
  private inputBox: Widgets.BoxElement | null = null;
  private inputField: Widgets.BoxElement | null = null;
  private detailBox: Widgets.BoxElement | null = null;
  private isInputMode = false;
  private app: App;

  constructor(parent: Widgets.BoxElement, app: App) {
    this.app = app;
    this.box = blessed.box({ parent, top: 0, left: 0, width: '100%', height: '100%', style: { bg: 'black' } });

    this.statusText = blessed.text({
      parent: this.box,
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: { fg: 'cyan', bold: true },
      content: ' [n] New Scan  [d] Details  [s] Stop  [c] Clean  [r] Refresh',
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

    this.app.screen.key(['n', 'N'], () => {
      if (this.isInputMode) return;
      this.showInputPrompt();
    });
    this.app.screen.key(['d', 'D'], () => {
      if (this.isInputMode) return;
      this.showDetails();
    });
    this.app.screen.key(['s', 'S'], () => {
      if (this.isInputMode) return;
      this.stopSelected();
    });
    this.app.screen.key(['c', 'C'], () => {
      if (this.isInputMode) return;
      this.cleanStale();
    });
    this.app.screen.key(['r', 'R'], () => {
      if (this.isInputMode) return;
      this.refresh();
    });
  }

  activate(): void {
    this.box.show();
    this.refresh();
    this.list.focus();
    this.app.screen.render();
  }
  deactivate(): void {
    this.closePrompt();
    this.closeDetail();
    this.box.hide();
  }

  refresh(): void {
    const sessions = listSessions();
    this.list.setItems(
      sessions.length === 0
        ? [' No sessions found. Press [n] to start a new scan.']
        : sessions.map((s) => this.formatSession(s)),
    );
  }

  private formatSession(s: SessionData): string {
    const c = s.status === 'in_progress' ? '{yellow-fg}' : s.status === 'completed' ? '{green-fg}' : '{red-fg}';
    return ` {bold}${s.sessionId.slice(0, 20).padEnd(20)}{/bold} | ${s.targetUrl.slice(0, 30).padEnd(30)} | ${c}${s.status.padEnd(12)}{/} | ${s.currentPhase.padEnd(15)}`;
  }

  private showInputPrompt(): void {
    if (this.inputBox) return;
    this.isInputMode = true;

    this.inputBox = blessed.box({
      parent: this.app.screen,
      top: 'center',
      left: 'center',
      width: 60,
      height: 5,
      style: { bg: 'black', border: { type: 'line', fg: 'cyan' } },
      border: { type: 'line', fg: 'cyan' },
    });

    blessed.text({
      parent: this.inputBox!,
      top: 0,
      left: 2,
      content: 'Enter target URL to scan:',
      style: { fg: 'white', bold: true },
    });

    blessed.text({
      parent: this.inputBox!,
      top: 1,
      left: 2,
      content: 'Press Enter to start, Escape to cancel',
      style: { fg: 'gray' },
    });

    this.inputField = blessed.textbox({
      parent: this.inputBox!,
      top: 2,
      left: 2,
      width: 54,
      height: 1,
      style: { bg: 'blue', fg: 'white', focus: { bg: 'green' } },
      inputOnFocus: true,
    });

    this.app.screen.key(['escape'], () => {
      if (this.isInputMode) this.closePrompt();
    });
    this.inputField!.key(['return'], () => this.handleStart());

    this.inputField!.focus();
    this.app.screen.render();
  }

  private closePrompt(): void {
    this.inputBox?.detach();
    this.inputBox?.destroy();
    this.inputBox = null;
    this.inputField = null;
    this.isInputMode = false;
    this.list.focus();
    this.app.screen.render();
  }

  private async handleStart(): Promise<void> {
    // biome-ignore lint/suspicious/noExplicitAny: blessed.textarea type not in @types/blessed
    const url = (this.inputField as any)?.getValue()?.trim();
    if (!url) return;
    this.closePrompt();
    this.app.setStatus(`Starting scan on ${url}...`);

    const result = await startScan(url);
    if (result.success) {
      this.app.setStatus(`Scan started: ${url}`);
    } else {
      this.app.setStatus(`Failed: ${result.error}`);
    }
    this.refresh();
  }

  private stopSelected(): void {
    // biome-ignore lint/suspicious/noExplicitAny: blessed.ListElement.selected exists at runtime
    const idx = (this.list as any).selected as number;
    const item = this.list.getItem(idx);
    if (!item) return;
    const m = item.getContent().match(/(scan-\d+-[a-z0-9]+)/);
    if (!m) return;
    stopScan(m[1]!);
    this.app.setStatus(`Stopped: ${m[1]!}`);
    this.refresh();
  }

  private showDetails(): void {
    // biome-ignore lint/suspicious/noExplicitAny: blessed.ListElement.selected exists at runtime
    const idx = (this.list as any).selected as number;
    const item = this.list.getItem(idx);
    if (!item) return;
    const m = item.getContent().match(/(scan-\d+-[a-z0-9]+)/);
    if (!m) return;

    const s = getSession(m[1]!);
    if (!s) return;

    this.closeDetail();
    this.detailBox = blessed.box({
      parent: this.app.screen,
      top: 3,
      left: 'center',
      width: 70,
      height: 16,
      style: { bg: 'black', border: { type: 'line', fg: 'yellow' } },
      border: { type: 'line', fg: 'yellow' },
      content: [
        `{bold}Session:{/bold} ${s.sessionId}`,
        `{bold}Target:{/bold} ${s.targetUrl}`,
        `{bold}Status:{/bold} ${s.status}`,
        `{bold}Phase:{/bold} ${s.currentPhase}`,
        `{bold}Started:{/bold} ${s.startedAt}`,
        s.completedAt ? `{bold}Completed:{/bold} ${s.completedAt}` : '',
        '',
        `{bold}Agents:{/bold} ${s.completedAgents.length} completed, ${s.failedAgents.length} failed`,
        s.failedAgents.length > 0 ? `{bold}Errors:{/bold} ${s.failedAgents.map((f) => f.agent).join(', ')}` : '',
        '',
        `{bold}Cost:{/bold} $${(s.metrics?.totalCost ?? 0).toFixed(4)}`,
        `{bold}Duration:{/bold} ${((s.metrics?.totalDurationMs ?? 0) / 1000).toFixed(1)}s`,
      ].join('\n'),
      tags: true,
      scrollable: true,
      scrollbar: { ch: ' ', style: { bg: 'yellow' } },
    });

    this.detailBox!.key(['escape', 'd', 'D'], () => this.closeDetail());
    this.detailBox!.focus();
    this.app.screen.render();
  }

  private closeDetail(): void {
    this.detailBox?.detach();
    this.detailBox?.destroy();
    this.detailBox = null;
    this.list.focus();
    this.app.screen.render();
  }

  private cleanStale(): void {
    cleanStoppedScans();
    this.app.setStatus('Cleaned stale Docker resources');
    this.refresh();
  }
}
