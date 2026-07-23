import * as path from 'node:path';
import blessed from 'blessed';
import type { Widgets } from 'blessed';
import type { App, ScreenId, TUIScreen } from '../app.ts';
import { type SessionData, getSession, listSessions } from '../services/workspace.ts';
import { startScan, validateUrl } from '../services/scanner.ts';

export class DashboardScreen implements TUIScreen {
  id: ScreenId = 'dashboard';
  label = 'Dashboard';
  private parent: Widgets.BoxElement;
  private box: Widgets.BoxElement | null = null;
  private list: Widgets.ListElement | null = null;
  private app: App;
  private modals: Widgets.BoxElement[] = [];

  constructor(parent: Widgets.BoxElement, app: App) {
    this.parent = parent;
    this.app = app;
  }

  activate(): void {
    this.box = blessed.box({ parent: this.parent, top: 0, left: 0, width: '100%', height: '100%', style: { bg: 'black' } });

    blessed.text({
      parent: this.box,
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: { fg: 'cyan', bold: true },
      content: ' [n] New AI Scan  [m] New Manual Scan  [Enter] Details  [r] Refresh',
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

    this.refresh();
    this.list.focus();
    this.app.screen.render();
  }

  deactivate(): void {
    this.closeAll();
    this.box?.detach();
    this.box?.destroy();
    this.box = null;
    this.list = null;
  }

  closeAll(): void {
    for (const m of this.modals) {
      try { m.detach(); m.destroy(); } catch {}
    }
    this.app.modalCount -= this.modals.length;
    if (this.app.modalCount < 0) this.app.modalCount = 0;
    this.modals = [];
  }

  refresh(): void {
    if (!this.list) return;
    const running = listSessions().filter((s) => s.status === 'in_progress');
    this.list.setItems(
      running.length === 0
        ? [' No active scans. Press [n] for AI scan or [m] for manual scan.']
        : running.map((s) => this.formatSession(s)),
    );
  }

  private formatSession(s: SessionData): string {
    const elapsed = s.startedAt ? Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 1000) : 0;
    return ` {bold}${s.sessionId.slice(0, 20).padEnd(20)}{/bold} | ${s.targetUrl.slice(0, 30).padEnd(30)} | ${s.currentPhase.padEnd(15)} | ${s.completedAgents.length} agents | ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
  }

  showSessionDetails(): void {
    if (!this.list) return;
    const idx = (this.list as any).selected as number;
    const item = this.list.getItem(idx);
    if (!item) return;
    const m = item.getContent().match(/([a-z]+-\d+-[a-z0-9]+)/);
    if (!m) return;
    const s = getSession(m[1]!);
    if (!s) return;

    const detailBox = blessed.box({
      parent: this.app.screen,
      top: 3,
      left: 'center',
      width: 70,
      height: 14,
      style: { bg: 'black', border: { type: 'line', fg: 3 } },
      border: { type: 'line', fg: 3 },
      content: [
        `{bold}Session:{/bold} ${s.sessionId}`,
        `{bold}Target:{/bold} ${s.targetUrl}`,
        `{bold}Status:{/bold} ${s.status}`,
        `{bold}Phase:{/bold} ${s.currentPhase}`,
        `{bold}Started:{/bold} ${s.startedAt}`,
        s.completedAt ? `{bold}Completed:{/bold} ${s.completedAt}` : '',
        '',
        `{bold}Agents:{/bold} ${s.completedAgents.length} completed, ${s.failedAgents.length} failed`,
        s.failedAgents.length > 0 ? `{bold}Errors:{/bold} ${(s.failedAgents as any[]).map((f: any) => f.agent).join(', ')}` : '',
        '',
        `{bold}Duration:{/bold} ${((s.metrics?.totalDurationMs ?? 0) / 1000).toFixed(1)}s`,
      ].join('\n'),
      tags: true,
      scrollable: true,
      scrollbar: { ch: ' ', style: { bg: 'yellow' } },
    });

    this.modals.push(detailBox);
    this.app.modalCount++;
    detailBox.key(['escape', 'd', 'D'], () => {
      this.app.lastEscapeClose = Date.now();
      detailBox.detach();
      detailBox.destroy();
      this.modals = this.modals.filter((m) => m !== detailBox);
      this.app.modalCount--;
      this.list?.focus();
      this.app.screen.render();
    });
    detailBox.focus();
    this.app.screen.render();
  }

  showNewAiScanInput(): void {
    this.showInputPrompt('Enter target URL for AI scan:', 'ai');
  }

  showNewManualScanInput(): void {
    this.showInputPrompt('Enter target URL for manual scan:', 'manual');
  }

  private showInputPrompt(label: string, scanType: 'ai' | 'manual'): void {
    const inputBox = blessed.box({
      parent: this.app.screen,
      top: 'center',
      left: 'center',
      width: 60,
      height: 5,
      style: { bg: 'black', border: { type: 'line', fg: 6 } },
      border: { type: 'line', fg: 6 },
    });

    blessed.text({ parent: inputBox, top: 0, left: 2, content: label, style: { fg: 'white', bold: true } });
    blessed.text({ parent: inputBox, top: 1, left: 2, content: 'Press Enter to start, Escape to cancel', style: { fg: 'gray' } });

    const inputField = blessed.textbox({
      parent: inputBox, top: 2, left: 2, width: 54, height: 1,
      style: { bg: 'blue', fg: 'white', focus: { bg: 'green' } },
      inputOnFocus: true,
    });

    this.modals.push(inputBox);
    this.app.modalCount++;
    const close = () => {
      this.app.screen.grabKeys = false;
      inputBox.detach();
      inputBox.destroy();
      this.modals = this.modals.filter((m) => m !== inputBox);
      this.app.modalCount--;
      this.list?.focus();
      this.app.screen.render();
    };

    inputField.key(['return', 'enter'], async () => {
      const url = (inputField as any).getValue()?.trim();
      if (!url) return;
      if (!validateUrl(url)) { this.app.setStatus('Invalid URL'); return; }
      this.app.lastEnterSubmit = Date.now();
      close();
      this.app.setStatus(`Starting ${scanType} scan on ${url}...`);
      const result = await startScan(url, scanType === 'manual');
      if (result.success) this.app.setStatus(`${scanType} scan started: ${url}`);
      else this.app.setStatus(`Failed: ${result.error}`);
      this.refresh();
    });

    inputField.key(['escape'], () => { this.app.lastEscapeClose = Date.now(); close(); });
    inputField.focus();
    this.app.screen.render();
  }

}
