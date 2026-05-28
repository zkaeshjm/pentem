import blessed from 'blessed';
import type { Widgets } from 'blessed';
import type { App, ScreenId, TUIScreen } from '../app.ts';
import { getReportContent, listReports } from '../services/workspace.ts';

export class ReportsScreen implements TUIScreen {
  id: ScreenId = 'reports';
  label = 'Reports';
  private box: Widgets.BoxElement;
  private list: Widgets.ListElement;
  private reportBox: Widgets.ScrollableBoxElement | null = null;
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
      content: ' [Enter] View Report  [b] Back to List',
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

    this.app.screen.key(['return'], () => {
      if (!this.reportBox) this.showReport();
    });
    this.app.screen.key(['b', 'B'], () => {
      if (this.reportBox) this.showList();
    });
  }

  activate(): void {
    this.box.show();
    this.refresh();
    this.list.focus();
    this.app.screen.render();
  }
  deactivate(): void {
    this.showList();
    this.box.hide();
  }

  refresh(): void {
    if (this.reportBox) return;
    const reports = listReports();
    this.list.setItems(
      reports.length === 0
        ? [' No reports found. Complete a scan to generate one.']
        : reports.map(
            (r) =>
              ` {bold}${r.sessionId.slice(0, 20).padEnd(20)}{/bold} | ${r.targetUrl.slice(0, 35).padEnd(35)} | ${(r.fileSize / 1024).toFixed(1)} KB`,
          ),
    );
  }

  private showReport(): void {
    // biome-ignore lint/suspicious/noExplicitAny: blessed.ListElement.selected exists at runtime
    const idx = (this.list as any).selected as number;
    const item = this.list.getItem(idx);
    if (!item) return;
    const m = item.getContent().match(/(scan-\d+-[a-z0-9]+)/);
    if (!m) return;

    const content = getReportContent(m[1]!);
    if (!content) {
      this.app.setStatus('No report content found');
      return;
    }

    this.list.hide();
    const preview = content.length > 4000 ? `${content.slice(0, 4000)}\n\n... [truncated]` : content;

    this.reportBox = blessed.box({
      parent: this.box,
      top: 1,
      left: 0,
      width: '100%',
      height: '100%-2',
      style: { bg: 'black', fg: 'white' },
      content: preview,
      tags: true,
      scrollable: true,
      scrollbar: { ch: ' ', style: { bg: 'white' } },
      keys: true,
      vi: true,
    });

    this.reportBox!.focus();
    this.app.screen.render();
  }

  private showList(): void {
    this.reportBox?.detach();
    this.reportBox?.destroy();
    this.reportBox = null;
    this.list.show();
    this.list.focus();
    this.app.screen.render();
  }
}
