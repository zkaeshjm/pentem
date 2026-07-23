import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import blessed from 'blessed';
import type { Widgets } from 'blessed';
import type { App, ScreenId, TUIScreen } from '../app.ts';
import { cleanStoppedScans, resumeScan, startScan, stopScan } from '../services/scanner.ts';
import { type SessionData, getReportContent, getSession, getSessionLogContent, listSessions, saveSessionOutput } from '../services/workspace.ts';
import { exportFindings } from '../services/collaboration/export.ts';

export class ScansScreen implements TUIScreen {
  id: ScreenId = 'scans';
  label = 'Scans';
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
      parent: this.box, top: 0, left: 0, width: '100%', height: 1,
      style: { fg: 'cyan', bold: true },
      content: ' [n] New Scan  [d] Details  [s] Stop  [Enter] Report  [v] Logs  [u] Resume  [x] Share  [o] Save  [c] Clean  [r] Refresh',
    });

    this.list = blessed.list({
      parent: this.box, top: 1, left: 0, width: '100%', height: '100%-2',
      style: { fg: 'white', bg: 'black', selected: { bg: 'blue', fg: 'white' }, item: { bg: 'black', fg: 'white' } },
      keys: true, vi: true, tags: true,
      scrollbar: { ch: ' ', style: { bg: 'blue' } },
    });

    this.refresh();
    this.list.focus();
    this.app.screen.render();
  }

  deactivate(): void {
    for (const m of this.modals) { try { m.detach(); m.destroy(); } catch {} }
    this.app.modalCount -= this.modals.length;
    if (this.app.modalCount < 0) this.app.modalCount = 0;
    this.modals = [];
    this.box?.detach();
    this.box?.destroy();
    this.box = null;
    this.list = null;
  }

  refresh(): void {
    if (!this.list) return;
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

  private getSelectedSessionId(): string | null {
    if (!this.list) return null;
    const idx = (this.list as any).selected as number;
    const item = this.list.getItem(idx);
    if (!item) return null;
    const m = item.getContent().match(/([a-z]+-\d+-[a-z0-9]+)/);
    return m?.[1] ?? null;
  }

  showDetails(): void {
    const sessionId = this.getSelectedSessionId();
    if (!sessionId) return;
    const s = getSession(sessionId);
    if (!s) return;

    const detailBox = blessed.box({
      parent: this.app.screen, top: 3, left: 'center', width: 70, height: 16,
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
        `{bold}Cost:{/bold} $${(s.metrics?.totalCost ?? 0).toFixed(4)}`,
        `{bold}Duration:{/bold} ${((s.metrics?.totalDurationMs ?? 0) / 1000).toFixed(1)}s`,
      ].join('\n'),
      tags: true, scrollable: true,
      scrollbar: { ch: ' ', style: { bg: 'yellow' } },
    });

    this.modals.push(detailBox);
    this.app.modalCount++;
    detailBox.key(['escape', 'd', 'D'], () => {
      this.app.lastEscapeClose = Date.now();
      detailBox.detach(); detailBox.destroy();
      this.modals = this.modals.filter((m) => m !== detailBox);
      this.app.modalCount--;
      this.list?.focus();
      this.app.screen.render();
    });
    detailBox.focus();
    this.app.screen.render();
  }

  stopSelected(): void {
    const sessionId = this.getSelectedSessionId();
    if (!sessionId) return;
    stopScan(sessionId);
    this.app.setStatus(`Stopped: ${sessionId}`);
    this.refresh();
  }

  showInputPrompt(): void {
    const inputBox = blessed.box({
      parent: this.app.screen, top: 'center', left: 'center', width: 60, height: 5,
      style: { bg: 'black', border: { type: 'line', fg: 6 } },
      border: { type: 'line', fg: 6 },
    });

    blessed.text({ parent: inputBox, top: 0, left: 2, content: 'Enter target URL to scan:', style: { fg: 'white', bold: true } });
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
      inputBox.detach(); inputBox.destroy();
      this.modals = this.modals.filter((m) => m !== inputBox);
      this.app.modalCount--;
      this.list?.focus();
      this.app.screen.render();
    };

    inputField.key(['return', 'enter'], async () => {
      const url = (inputField as any).getValue()?.trim();
      if (!url) return;
      this.app.lastEnterSubmit = Date.now();
      close();
      this.app.setStatus(`Starting scan on ${url}...`);
      const result = await startScan(url);
      if (result.success) this.app.setStatus(`Scan started: ${url}`);
      else this.app.setStatus(`Failed: ${result.error}`);
      this.refresh();
    });

    inputField.key(['escape'], () => { this.app.lastEscapeClose = Date.now(); close(); });
    inputField.focus();
    this.app.screen.render();
  }

  cleanStale(): void {
    cleanStoppedScans();
    this.app.setStatus('Cleaned stale Docker resources');
    this.refresh();
  }

  viewReport(): void {
    const sessionId = this.getSelectedSessionId();
    if (!sessionId) return;
    const content = getReportContent(sessionId);
    if (!content) { this.app.setStatus('No report found'); return; }
    this.showScrollableContent(content, `Report: ${sessionId}`);
  }

  viewLogs(): void {
    const sessionId = this.getSelectedSessionId();
    if (!sessionId) return;
    const logs = getSessionLogContent(sessionId);
    if (!logs) { this.app.setStatus('No logs found'); return; }
    this.showScrollableContent(logs, `Logs: ${sessionId}`);
  }

  private showScrollableContent(content: string, title: string): void {
    if (!this.box) return;
    this.list?.hide();

    const box = blessed.box({
      parent: this.box, top: 1, left: 0, width: '100%', height: '100%-2',
      style: { fg: 'white', bg: 'black' },
      content: content.length > 5000 ? `${content.slice(0, 5000)}\n\n... [truncated]` : content,
      tags: true, scrollable: true,
      scrollbar: { ch: ' ', style: { bg: 'white' } },
      keys: true, vi: true,
    });

    this.modals.push(box);
    this.app.modalCount++;
    box.key(['escape', 'b', 'B'], () => {
      this.app.lastEscapeClose = Date.now();
      box.detach(); box.destroy();
      this.modals = this.modals.filter((m) => m !== box);
      this.app.modalCount--;
      this.list?.show();
      this.list?.focus();
      this.app.screen.render();
    });
    box.focus();
    this.app.screen.render();
  }

  async resumeScan(): Promise<void> {
    const sessionId = this.getSelectedSessionId();
    if (!sessionId) return;
    const s = getSession(sessionId);
    if (!s || s.status === 'completed') { this.app.setStatus('Session already completed'); return; }
    this.app.setStatus(`Resuming scan: ${sessionId}`);
    const result = await resumeScan(sessionId);
    if (result.success) this.app.setStatus(`Scan resumed: ${sessionId}`);
    else this.app.setStatus(`Resume failed: ${result.error}`);
    this.refresh();
  }

  shareFindings(): void {
    const sessionId = this.getSelectedSessionId();
    if (!sessionId) return;
    this.showPathPrompt('Export findings to path:', async (outputPath) => {
      const s = getSession(sessionId);
      if (!s) { this.app.setStatus('Session not found'); return; }
      const ws = process.env.PENTEM_LOCAL
        ? path.resolve(process.cwd(), 'workspaces')
        : path.join(os.homedir(), '.pentem', 'workspaces');
      const sarifPath = path.join(ws, sessionId, 'audit', 'report.sarif');
      const findings: Array<{ type: string; severity: string; url: string; description: string; detail: string }> = [];
      if (fs.existsSync(sarifPath)) {
        try {
          const sarif = JSON.parse(fs.readFileSync(sarifPath, 'utf-8'));
          for (const r of (sarif?.runs?.[0]?.results ?? [])) {
            findings.push({
              type: r.ruleId || 'unknown',
              severity: r.level === 'error' ? 'high' : r.level === 'warning' ? 'medium' : 'low',
              url: r.locations?.[0]?.physicalLocation?.artifactLocation?.uri || s.targetUrl,
              description: r.message?.text?.split('\n')[0] || '',
              detail: r.message?.text || '',
            });
          }
        } catch {}
      }
      exportFindings(findings, s.targetUrl, sessionId, { outputPath, toolName: 'Pentem' });
      this.app.setStatus(`Findings exported to: ${outputPath}`);
    });
  }

  saveOutput(): void {
    const sessionId = this.getSelectedSessionId();
    if (!sessionId) return;
    this.showPathPrompt('Save all output to directory:', async (outputDir) => {
      const result = saveSessionOutput(sessionId, outputDir);
      if (result) this.app.setStatus(`Output saved to: ${result}`);
      else this.app.setStatus(`Failed to save session: ${sessionId}`);
    });
  }

  private showPathPrompt(label: string, onConfirm: (path: string) => Promise<void>): void {
    const inputBox = blessed.box({
      parent: this.app.screen, top: 'center', left: 'center', width: 70, height: 6,
      style: { bg: 'black', border: { type: 'line', fg: 6 } },
      border: { type: 'line', fg: 6 },
    });

    blessed.text({ parent: inputBox, top: 0, left: 2, content: label, style: { fg: 'white', bold: true } });
    blessed.text({ parent: inputBox, top: 1, left: 2, content: 'Enter path, then press Enter. Escape to cancel.', style: { fg: 'gray' } });

    const inputField = blessed.textbox({
      parent: inputBox, top: 3, left: 2, width: 64, height: 1,
      style: { bg: 'blue', fg: 'white', focus: { bg: 'green' } },
      inputOnFocus: true,
    });

    this.modals.push(inputBox);
    this.app.modalCount++;
    const close = () => {
      this.app.screen.grabKeys = false;
      inputBox.detach(); inputBox.destroy();
      this.modals = this.modals.filter((m) => m !== inputBox);
      this.app.modalCount--;
      this.list?.focus();
      this.app.screen.render();
    };

    inputField.key(['return', 'enter'], async () => {
      const val = (inputField as any).getValue()?.trim();
      if (!val) return;
      this.app.lastEnterSubmit = Date.now();
      close();
      await onConfirm(val);
    });

    inputField.key(['escape'], () => { this.app.lastEscapeClose = Date.now(); close(); });
    inputField.focus();
    this.app.screen.render();
  }
}
