import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ReportOutputPlugin {
  write(reportPath: string, format: 'markdown' | 'json' | 'html'): Promise<void>;
}

function parseMarkdownReport(content: string): Record<string, unknown> {
  const lines = content.split('\n');
  const report: Record<string, unknown> = {
    title: '',
    target: '',
    sessionId: '',
    date: '',
    sections: [],
  };

  let currentSection = '';
  let currentSubSection = '';
  const sections: Array<{ heading: string; subSections: Array<{ heading: string; content: string }> }> = [];

  for (const line of lines) {
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      currentSection = line.replace(/^#\s+/, '').trim();
      if (!report.title) report.title = currentSection;
      sections.push({ heading: currentSection, subSections: [] });
    } else if (line.startsWith('## ')) {
      currentSubSection = line.replace(/^##\s+/, '').trim();
      const sec = sections.length > 0 ? sections[sections.length - 1] : undefined;
      if (sec) {
        sec.subSections.push({ heading: currentSubSection, content: '' });
      }
    } else if (line.startsWith('**Target:**')) {
      report.target = line.replace('**Target:**', '').trim();
    } else if (line.startsWith('**Session:**')) {
      report.sessionId = line.replace('**Session:**', '').trim();
    } else if (line.startsWith('**Date:**')) {
      report.date = line.replace('**Date:**', '').trim();
    } else if (sections.length > 0) {
      const last = sections[sections.length - 1];
      if (last && last.subSections.length > 0) {
        const lastSub = last.subSections[last.subSections.length - 1];
        if (lastSub) {
          lastSub.content += `${line}\n`;
        }
      }
    }
  }

  report.sections = sections;
  return report;
}

function markdownToHtml(markdown: string): string {
  let html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/---/g, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  html = `<p>${html}</p>`;
  return html;
}

export class ReportOutputPluginImpl implements ReportOutputPlugin {
  async write(reportPath: string, format: 'markdown' | 'json' | 'html'): Promise<void> {
    if (!fs.existsSync(reportPath)) {
      throw new Error(`Report file not found: ${reportPath}`);
    }

    const content = fs.readFileSync(reportPath, 'utf-8');
    const dir = path.dirname(reportPath);
    const baseName = path.basename(reportPath, path.extname(reportPath));

    switch (format) {
      case 'json': {
        const jsonPath = path.join(dir, `${baseName}.json`);
        const parsed = parseMarkdownReport(content);
        fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2), 'utf-8');
        break;
      }
      case 'html': {
        const htmlPath = path.join(dir, `${baseName}.html`);
        const bodyHtml = markdownToHtml(content);
        const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pentem Security Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #333; }
  h1 { border-bottom: 2px solid #e63946; padding-bottom: 0.5rem; }
  h2 { color: #1d3557; margin-top: 2rem; }
  h3 { color: #457b9d; }
  pre { background: #f1faee; padding: 1rem; border-radius: 4px; overflow-x: auto; }
  code { background: #f1faee; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
  li { margin: 0.25rem 0; }
  hr { border: none; border-top: 1px solid #ccc; margin: 2rem 0; }
  strong { color: #e63946; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
        fs.writeFileSync(htmlPath, fullHtml, 'utf-8');
        break;
      }
      case 'markdown':
        break;
    }
  }
}

export class NoopReportOutputPlugin implements ReportOutputPlugin {
  async write(_reportPath: string, _format: 'markdown' | 'json' | 'html'): Promise<void> {}
}
