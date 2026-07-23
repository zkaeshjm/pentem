import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import blessed from 'blessed';
import type { Widgets } from 'blessed';
import type { App, ScreenId, TUIScreen } from '../app.ts';
import { getReportContent, getSession, getSessionLogContent, listReports } from '../services/workspace.ts';
import { exportFindings } from '../services/collaboration/export.ts';

export class ReportsScreen implements TUIScreen {
  id: ScreenId = 'reports';
  label = 'Reports';
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
      content: ' [Enter] View Report  [v] View Logs  [s] Save to File  [S] Share  [r] Refresh',
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
    this.app.screen.grabKeys = false;
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
    const reports = listReports();
    this.list.setItems(
      reports.length === 0
        ? [' No reports found. Complete a scan to generate one.']
        : reports.map(
            (r) => ` {bold}${r.sessionId.slice(0, 20).padEnd(20)}{/bold} | ${r.targetUrl.slice(0, 35).padEnd(35)} | ${(r.fileSize / 1024).toFixed(1)} KB`,
          ),
    );
  }

  private getSelectedSessionId(): string | null {
    if (!this.list) return null;
    const idx = (this.list as any).selected as number;
    const item = this.list.getItem(idx);
    if (!item) return null;
    const m = item.getContent().match(/([a-z]+-\d+-[a-z0-9]+)/);
    return m?.[1] ?? null;
  }

  showReport(): void {
    const sessionId = this.getSelectedSessionId();
    if (!sessionId) return;
    const content = getReportContent(sessionId);
    if (!content) { this.app.setStatus('No report content found'); return; }
    this.showScrollableContent(content, `Report: ${sessionId}`);
  }

  showLogs(): void {
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

  saveToFile(): void {
    const sessionId = this.getSelectedSessionId();
    if (!sessionId) { this.app.setStatus('Select a report first'); return; }
    this.showPathPrompt('Save report to path:', async (outputPath) => {
      const content = getReportContent(sessionId);
      if (content) {
        fs.writeFileSync(outputPath, content, 'utf-8');
        this.app.setStatus(`Report saved to: ${outputPath}`);
      } else {
        this.app.setStatus('No report content found');
      }
    });
  }

  shareFindings(): void {
    const sessionId = this.getSelectedSessionId();
    if (!sessionId) { this.app.setStatus('Select a report first'); return; }
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
