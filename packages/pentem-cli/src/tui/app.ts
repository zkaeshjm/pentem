import * as path from 'node:path';
import * as os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const blessed = require('blessed');

import type { Screen, Widgets } from 'blessed';

import { listSessions, listReports, getReportContent, getConfigContent, getSessionLogContent, saveSessionOutput } from './services/workspace.ts';
import { startScan, validateUrl } from './services/scanner.ts';
import { ManualScanner } from './services/manual-scanner.ts';
import {
  detectFromEnvOrConfig,
  savePersistedConfig,
  clearPersistedConfig,
  getModelsForProvider,
} from './services/providers-config.ts';

// ─── STATE ─────────────────────────────────────────────────────
type Mode =
  | 'setup' | 'api-key-input' | 'model-select'
  | 'dashboard' | 'scans' | 'reports' | 'config'
  | 'new-scan-input' | 'manual-scan-input' | 'manual-scan-result'
  | 'agentic-progress';

let mode: Mode = 'setup';
let screen: Screen;
let contentBox: Widgets.BoxElement;
let statusBar: Widgets.BoxElement;
let pendingProvider = '';
let pendingApiKey = '';
let refreshInterval: ReturnType<typeof setInterval> | null = null;

const HEADER = ' ██████╗ ███████╗███╗   ██╗████████╗███████╗███╗   ███╗  v0.1.0';
const SUB    = ' ██╔══██╗██╔════╝████╗  ██║╚══██╔══╝██╔════╝████╗ ████║  Agentic AI & Manual Penetration Tester';

// ─── HELPERS ────────────────────────────────────────────────────

function status(msg: string): void {
  statusBar.setContent(` ${msg}`);
  screen.render();
}

function clear(): void {
  contentBox.setContent('');
  for (const c of [...(contentBox.children || [])]) {
    try { c.detach(); c.destroy(); } catch {}
  }
}

function go(m: Mode): void {
  mode = m;
  const provider = detectFromEnvOrConfig();
  if (!provider.configured && !['setup', 'api-key-input', 'model-select', 'config', 'manual-scan-input', 'dashboard', 'scans', 'reports'].includes(m)) {
    mode = 'setup';
  }
  clear();
  switch (mode) {
    case 'setup':        renderSetup(); break;
    case 'api-key-input': renderApiKeyInput(pendingProvider); break;
    case 'model-select':  renderModelSelect(); break;
    case 'dashboard':    renderDashboard(); break;
    case 'scans':        renderScans(); break;
    case 'reports':      renderReports(); break;
    case 'config':       renderConfig(); break;
    case 'new-scan-input': renderNewScanInput(); break;
    case 'manual-scan-result':
    case 'agentic-progress': break;
  }
  screen.render();
}

// ─── TAB BAR ────────────────────────────────────────────────────

function renderTabs(active: number): void {
  const tabs = ['[1] Dashboard', '[2] Scans', '[3] Reports', '[4] Config'];
  const tabBar = blessed.box({ parent: contentBox, top: 0, left: 0, width: '100%', height: 1, style: { bg: 'blue' } });
  if (active === -1) { screen.render(); return; }
  let x = 0;
  for (let i = 0; i < tabs.length; i++) {
    blessed.text({
      parent: tabBar, top: 0, left: x, width: tabs[i].length + 1, height: 1,
      content: tabs[i],
      style: i === active ? { bg: 'cyan', fg: 'black', bold: true } : { bg: 'blue', fg: 'white' },
    });
    x += tabs[i].length + 1;
  }
}

// ─── SETUP SCREEN ──────────────────────────────────────────────

function renderSetup(): void {
  const lines = [
    '',
    '   ╔═══════════════════════════════════════════════╗',
    '   ║          Pentem — Choose Your Mode           ║',
    '   ╠═══════════════════════════════════════════════╣',
    '   ║  [1] Agentic AI —  Requires an LLM API key   ║',
    '   ║      The AI agent autonomously analyzes,     ║',
    '   ║      probes, and exploits vulnerabilities    ║',
    '   ║                                               ║',
    '   ║  [2] Manual —  No API key needed             ║',
    '   ║      Built-in HTTP crawler + pattern scanner  ║',
    '   ║      Checks headers, paths, SQLi, XSS        ║',
    '   ║                                               ║',
    '   ║  [3] Config —  View/edit configuration       ║',
    '   ╚═══════════════════════════════════════════════╝',
    '',
    '   Press 1, 2, or 3 to continue.',
  ];
  status('Select mode — [1] Agentic AI  [2] Manual  [3] Config');
  blessed.text({ parent: contentBox, top: 1, left: 0, content: lines.join('\n'), style: { fg: 'yellow' }, tags: true });
}

// ─── API KEY INPUT ──────────────────────────────────────────────

function renderApiKeyInput(providerType: string): void {
  const label = providerType === 'anthropic' ? 'Anthropic (Claude)' : 'OpenAI (GPT-4o / compatible)';
  const envVar = providerType === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';

  blessed.text({ parent: contentBox, top: 3, left: 2, content: `Enter ${label} API Key:`, style: { fg: 'cyan', bold: true } });
  blessed.text({ parent: contentBox, top: 4, left: 2, content: `Sets ${envVar} for this session`, style: { fg: 'gray' } });
  blessed.text({ parent: contentBox, top: 5, left: 2, content: 'Paste your key, then press Enter to confirm / Escape to go back', style: { fg: 'gray' } });

  const inp = blessed.textbox({
    parent: contentBox, top: 7, left: 2, width: 76, height: 1,
    style: { bg: 'blue', fg: 'white', focus: { bg: 'green' } },
    inputOnFocus: true,
  });

  inp.focus();
  screen.render();

  inp.key(['return', 'enter'], () => {
    const val = inp.getValue().trim();
    if (!val) return;
    pendingApiKey = val;
    pendingProvider = providerType;
    // Clear other provider env to avoid conflict
    if (providerType === 'anthropic') delete process.env.OPENAI_API_KEY;
    else delete process.env.ANTHROPIC_API_KEY;
    // Store in env
    if (providerType === 'anthropic') process.env.ANTHROPIC_API_KEY = val;
    else process.env.OPENAI_API_KEY = val;
    // Show model selection
    go('model-select');
  });

  inp.key(['escape'], () => {
    go('setup');
  });
}

// ─── MODEL SELECT ──────────────────────────────────────────────

function renderModelSelect(): void {
  const models = getModelsForProvider(pendingProvider);
  const label = pendingProvider === 'anthropic' ? 'Anthropic' : 'OpenAI';

  blessed.text({ parent: contentBox, top: 2, left: 2, content: `Select ${label} Model:`, style: { fg: 'cyan', bold: true } });
  blessed.text({ parent: contentBox, top: 3, left: 2, content: `API key set: ${pendingApiKey.slice(0, 8)}...${pendingApiKey.slice(-4)}`, style: { fg: 'green' } });
  blessed.text({ parent: contentBox, top: 4, left: 2, content: 'Pick a model or type a custom name. Press Enter to confirm.', style: { fg: 'gray' } });

  models.forEach((m, i) => {
    blessed.text({ parent: contentBox, top: 6 + i, left: 2, content: `  ${i + 1}. ${m}`, style: { fg: 'white' } });
  });

  const customLabel = `  ${models.length + 1}. Custom model (type name)`;
  blessed.text({ parent: contentBox, top: 6 + models.length, left: 2, content: customLabel, style: { fg: 'gray' } });

  const inp = blessed.textbox({
    parent: contentBox, top: 8 + models.length, left: 2, width: 76, height: 1,
    style: { bg: 'blue', fg: 'white', focus: { bg: 'green' } },
    inputOnFocus: true,
  });

  blessed.text({ parent: contentBox, top: 10 + models.length, left: 2, content: 'Enter model name or number (1-9), then press Enter', style: { fg: 'gray' } });

  inp.focus();
  screen.render();

  inp.key(['return', 'enter'], () => {
    const raw = inp.getValue().trim();
    let model = raw;

    // Check if user entered a number
    const num = parseInt(raw, 10);
    if (num >= 1 && num <= models.length) {
      model = models[num - 1];
    } else if (num === models.length + 1 || raw === '') {
      // Custom — let user type later, or use default
      model = '';
    }

    // Use default if not specified
    if (!model) {
      model = pendingProvider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o';
    }

    // Save to env
    if (pendingProvider === 'anthropic') process.env.ANTHROPIC_MODEL = model;
    else process.env.OPENAI_MODEL = model;

    // Persist to config file
    savePersistedConfig({
      provider: pendingProvider,
      apiKey: pendingApiKey,
      model,
    });

    status(`${pendingProvider.toUpperCase()} configured — Model: ${model}`);
    go('dashboard');
  });

  inp.key(['escape'], () => {
    go('api-key-input');
  });
}

// ─── DASHBOARD ─────────────────────────────────────────────────

function renderDashboard(): void {
  renderTabs(0);
  blessed.text({ parent: contentBox, top: 1, left: 1, content: ' Scanner', style: { fg: 'cyan', bold: true } });

  const provider = detectFromEnvOrConfig();

  if (!provider.configured) {
    blessed.text({ parent: contentBox, top: 3, left: 2, content: ' No API key configured.', style: { fg: 'red', bold: true } });
    blessed.text({ parent: contentBox, top: 4, left: 2, content: ' Press 1 to set up AI, 2 for manual scan, Tab for tabs.', style: { fg: 'yellow' } });
    screen.render();
    return;
  }

  blessed.text({ parent: contentBox, top: 2, left: 1, content: ` Provider: ${provider.provider.toUpperCase()}  |  Model: ${provider.model}  |  Key: ${provider.apiKey ? provider.apiKey.slice(0, 8) + '...' + provider.apiKey.slice(-4) : ''}`, style: { fg: 'green' } });
  blessed.text({ parent: contentBox, top: 3, left: 1, content: ' [n] New Agentic Scan  [m] New Manual Scan  [Tab] Browse', style: { fg: 'cyan' } });

  const sessions = listSessions();
  const running = sessions.filter((s) => s.status === 'in_progress');
  const completed = sessions.filter((s) => s.status !== 'in_progress');

  if (running.length > 0) {
    blessed.text({ parent: contentBox, top: 5, left: 1, content: ` ⏳ Running: ${running.length} scan(s) — auto-refreshes every 3s`, style: { fg: 'yellow', bold: true } });
    running.forEach((s, i) => {
      const e = s.startedAt ? Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 1000) : 0;
      const type = s.sessionId.startsWith('manual') ? 'MANUAL' : 'AGENTIC';
      blessed.text({ parent: contentBox, top: 6 + i, left: 2, content: ` ${type} | ${s.targetUrl.slice(0, 30).padEnd(30)} | Phase: ${s.currentPhase.padEnd(15)} | ${Math.floor(e / 60)}m ${e % 60}s`, style: { fg: 'white' } });
    });
  } else {
    blessed.text({ parent: contentBox, top: 5, left: 1, content: ' No active scans. [n] New AI scan | [m] New manual scan', style: { fg: 'gray' } });
  }

  if (completed.length > 0) {
    blessed.text({ parent: contentBox, top: 6 + running.length + 1, left: 1, content: ` ✅ Completed: ${completed.length} scan(s) — [2] Scans to view`, style: { fg: 'green', bold: true } });
  }
  screen.render();
}

// ─── NEW SCAN INPUT ────────────────────────────────────────────

function renderNewScanInput(): void {
  blessed.text({ parent: contentBox, top: 3, left: 2, content: 'Enter target URL or IP to scan:', style: { fg: 'cyan', bold: true } });
  blessed.text({ parent: contentBox, top: 4, left: 2, content: 'Example: https://example.com', style: { fg: 'gray' } });
  blessed.text({ parent: contentBox, top: 5, left: 2, content: 'Press Enter to start, Escape to cancel', style: { fg: 'gray' } });

  const inp = blessed.textbox({
    parent: contentBox, top: 7, left: 2, width: 76, height: 1,
    style: { bg: 'blue', fg: 'white', focus: { bg: 'green' } },
    inputOnFocus: true,
  });

  inp.focus();
  screen.render();

  inp.key(['return', 'enter'], async () => {
    const url = inp.getValue().trim();
    if (!url) return;
    if (!validateUrl(url)) { status('Invalid URL'); return; }

    status(`Starting agentic scan on ${url}...`);
    const result = await startScan(url, false);
    if (result.success) {
      status(`Agentic scan started: ${url} — Session: ${result.sessionId}`);
    } else {
      status(`Failed: ${result.error}`);
    }
    go('dashboard');
  });

  inp.key(['escape'], () => go('dashboard'));
}

// ─── SCANS ──────────────────────────────────────────────────────

function renderScans(): void {
  renderTabs(1);
  blessed.text({ parent: contentBox, top: 1, left: 1, content: ' All Sessions', style: { fg: 'cyan', bold: true } });

  const sessions = listSessions();
  if (sessions.length === 0) {
    blessed.text({ parent: contentBox, top: 3, left: 2, content: ' No sessions yet. Press [n] or [m] from Dashboard.', style: { fg: 'gray' } });
    screen.render();
    return;
  }

  sessions.forEach((s, i) => {
    const c = s.status === 'in_progress' ? '{yellow-fg}' : s.status === 'completed' ? '{green-fg}' : '{red-fg}';
    const type = s.sessionId.startsWith('manual') ? 'MANUAL' : 'AI';
    const line = ` ${i + 1}. [${type}] ${s.targetUrl.slice(0, 35).padEnd(35)} | ${c}${s.status.padEnd(12)}{/} | ${s.currentPhase || '-'}`;
    blessed.text({ parent: contentBox, top: 2 + i, left: 1, content: line, style: { fg: 'white' }, tags: true });
  });
  screen.render();
}

// ─── REPORTS ───────────────────────────────────────────────────

let reportViewMode: 'list' | 'view' = 'list';
let currentReportId = '';

function renderReports(): void {
  renderTabs(2);
  reportViewMode = 'list';
  currentReportId = '';
  blessed.text({ parent: contentBox, top: 1, left: 1, content: ' Reports  —  [1-9] Select  [Enter] View  [s] Save  [v] View Logs', style: { fg: 'cyan', bold: true } });
  const reports = listReports();
  if (reports.length === 0) {
    blessed.text({ parent: contentBox, top: 3, left: 2, content: ' No reports yet. Complete a scan to generate one.', style: { fg: 'gray' } });
    screen.render();
    return;
  }
  reports.forEach((r, i) => {
    blessed.text({ parent: contentBox, top: 2 + i, left: 1, content: ` ${i + 1}. ${r.targetUrl.slice(0, 35).padEnd(35)} | ${(r.fileSize / 1024).toFixed(1)} KB | ${r.sessionId.slice(0, 20)}`, style: { fg: 'white' } });
  });
  screen.render();
}

function renderReportContent(reportId: string): void {
  clear();
  reportViewMode = 'view';
  currentReportId = reportId;

  blessed.text({ parent: contentBox, top: 0, left: 1, content: ' Report  —  [b] Back to List  [s] Save to File  [v] Raw Logs', style: { fg: 'cyan', bold: true } });

  const content = getReportContent(reportId);
  if (!content) {
    blessed.text({ parent: contentBox, top: 2, left: 2, content: ' Report not found.', style: { fg: 'red' } });
    screen.render();
    return;
  }

  // Show report in a scrollable box
  const box = blessed.box({
    parent: contentBox, top: 1, left: 0, width: '100%', height: '100%-2',
    content, style: { fg: 'white', bg: 'black' },
    tags: true, scrollable: true,
    scrollbar: { ch: ' ', style: { bg: 'white' } },
    keys: true, vi: true,
  });

  box.focus();
  screen.render();
}

function renderLogContent(reportId: string): void {
  clear();
  currentReportId = reportId;

  blessed.text({ parent: contentBox, top: 0, left: 1, content: ' Raw Logs  —  [b] Back to Report  [s] Save to File', style: { fg: 'cyan', bold: true } });

  const logs = getSessionLogContent(reportId);
  const display = logs || ' No logs found for this session.';

  const box = blessed.box({
    parent: contentBox, top: 1, left: 0, width: '100%', height: '100%-2',
    content: display, style: { fg: 'white', bg: 'black' },
    tags: true, scrollable: true,
    scrollbar: { ch: ' ', style: { bg: 'white' } },
    keys: true, vi: true,
  });

  box.focus();
  screen.render();
}

// ─── REPORT ID PROMPT ──────────────────────────────────────────

function showReportIdPrompt(action: 'view' | 'save'): void {
  clear();
  const label = action === 'view' ? 'View' : 'Save';
  blessed.text({ parent: contentBox, top: 3, left: 2, content: `Enter Session ID to ${label}:`, style: { fg: 'cyan', bold: true } });
  blessed.text({ parent: contentBox, top: 4, left: 2, content: 'Example: manual-1234567890-abc123', style: { fg: 'gray' } });
  blessed.text({ parent: contentBox, top: 5, left: 2, content: 'Find session IDs via pentem list or check Scans tab', style: { fg: 'gray' } });

  const inp = blessed.textbox({
    parent: contentBox, top: 7, left: 2, width: 76, height: 1,
    style: { bg: 'blue', fg: 'white', focus: { bg: 'green' } },
    inputOnFocus: true,
  });

  inp.focus();
  screen.render();

  inp.key(['return', 'enter'], () => {
    const id = inp.getValue().trim();
    if (!id) return;
    if (action === 'view') {
      const content = getReportContent(id);
      if (content) {
        renderReportContent(id);
      } else {
        status(`No report found for session: ${id}`);
        renderReports();
      }
    } else {
      const outDir = path.join(process.cwd(), `pentem-report-${id}`);
      const result = saveSessionOutput(id, outDir);
      if (result) {
        status(`Saved to: ${result}`);
      } else {
        status(`Failed to save session: ${id}`);
      }
      renderReports();
    }
  });

  inp.key(['escape'], () => renderReports());
}

// ─── CONFIG ────────────────────────────────────────────────────

function renderConfig(): void {
  renderTabs(3);
  blessed.text({ parent: contentBox, top: 1, left: 1, content: ' Configuration', style: { fg: 'cyan', bold: true } });

  const provider = detectFromEnvOrConfig();
  const cfg = getConfigContent();

  const lines: string[] = [];

  if (provider.configured) {
    lines.push(` Provider: ${provider.provider.toUpperCase()}  [CONFIGURED]`);
    lines.push(` API Key: ${provider.apiKey ? provider.apiKey.slice(0, 8) + '...' + provider.apiKey.slice(-4) : ''}`);
    lines.push(` Model: ${provider.model || 'default'}`);
  } else {
    lines.push(' Provider: None');
    lines.push(' No API key configured. Return to main menu to set one.');
  }

  lines.push('');
  lines.push(' Env vars checked:');
  lines.push('   ANTHROPIC_API_KEY  — Anthropic Claude');
  lines.push('   OPENAI_API_KEY     — OpenAI GPT-4o / compatible');
  lines.push('   ANTHROPIC_MODEL    — Claude model name');
  lines.push('   OPENAI_MODEL       — OpenAI model name');
  lines.push('');

  if (cfg) {
    lines.push(' Config file (~/.pentem/config.yaml):');
    cfg.split('\n').slice(0, 10).forEach((l) => lines.push(`  ${l}`));
  }

  lines.push('');
  lines.push(' [r] Reset configuration  [Esc] Back to menu');

  blessed.text({ parent: contentBox, top: 2, left: 1, content: lines.join('\n'), style: { fg: 'white' }, tags: true });
  screen.render();
}

// ─── MANUAL SCAN ───────────────────────────────────────────────

async function renderManualScanInput(): Promise<void> {
  mode = 'manual-scan-input';
  clear();
  blessed.text({ parent: contentBox, top: 3, left: 2, content: 'Manual Scan — No API key needed', style: { fg: 'cyan', bold: true } });
  blessed.text({ parent: contentBox, top: 4, left: 2, content: 'Enter target URL:', style: { fg: 'white' } });
  blessed.text({ parent: contentBox, top: 5, left: 2, content: 'Press Enter to start, Escape to cancel', style: { fg: 'gray' } });

  const inp = blessed.textbox({
    parent: contentBox, top: 7, left: 2, width: 76, height: 1,
    style: { bg: 'blue', fg: 'white', focus: { bg: 'green' } },
    inputOnFocus: true,
  });

  inp.focus();
  screen.render();

  inp.key(['return', 'enter'], async () => {
    const url = inp.getValue().trim();
    if (!url) return;
    if (!validateUrl(url)) { status('Invalid URL'); return; }

    status(`Manual scanning ${url}...`);
    const result = await startScan(url, true);
    if (result.success) {
      status(`Manual scan started: ${url} — check Scans tab for report`);
    } else {
      status(`Failed: ${result.error}`);
    }
    go('dashboard');
  });

  inp.key(['escape'], () => go('dashboard'));
}

// ─── KEYBOARD DISPATCH ────────────────────────────────────────

function refreshCurrentView(): void {
  const inputModes = ['api-key-input', 'model-select', 'new-scan-input', 'manual-scan-input', 'setup'];
  if (inputModes.includes(mode)) return;

  // Update status with running scan info
  const sessions = listSessions();
  const running = sessions.filter((s) => s.status === 'in_progress');
  if (running.length > 0) {
    status(`⏳ ${running.length} scan(s) running — ${running.map((s) => s.currentPhase).join(', ')} — [r] Refresh`);
  } else {
    status(`Ready — [1-4] Tabs  [n] AI Scan  [m] Manual Scan  [q] Quit`);
  }

  clear();
  switch (mode) {
    case 'dashboard': renderDashboard(); break;
    case 'scans':     renderScans(); break;
    case 'reports':   renderReports(); break;
    case 'config':    renderConfig(); break;
  }
  screen.render();
}

function setupKeyboard(): void {
  screen.key(['q', 'Q', 'C-c'], () => { screen.destroy(); process.exit(0); });

  screen.key(['tab'], () => {
    if (['api-key-input', 'model-select', 'new-scan-input', 'manual-scan-input'].includes(mode)) return;
    const tabOrder: Mode[] = ['dashboard', 'scans', 'reports', 'config'];
    const idx = tabOrder.indexOf(mode);
    if (idx >= 0) go(tabOrder[(idx + 1) % 4]);
    else go('dashboard');
  });

  // Number keys — different behavior based on current mode
  screen.key(['1'], () => {
    if (mode === 'setup') {
      pendingProvider = 'anthropic';
      go('api-key-input');
      return;
    }
    if (['api-key-input', 'model-select', 'new-scan-input', 'manual-scan-input'].includes(mode)) return;
    go('dashboard');
  });

  screen.key(['2'], () => {
    if (mode === 'setup') {
      renderManualScanInput();
      return;
    }
    if (['api-key-input', 'model-select', 'new-scan-input', 'manual-scan-input'].includes(mode)) return;
    go('scans');
  });

  screen.key(['3'], () => {
    if (mode === 'setup') { go('config'); return; }
    if (['api-key-input', 'model-select', 'new-scan-input', 'manual-scan-input'].includes(mode)) return;
    go('reports');
  });

  screen.key(['4'], () => {
    if (['api-key-input', 'model-select', 'new-scan-input', 'manual-scan-input'].includes(mode)) return;
    go('config');
  });

  screen.key(['n', 'N'], () => {
    if (['api-key-input', 'model-select', 'new-scan-input', 'manual-scan-input'].includes(mode)) return;
    const provider = detectFromEnvOrConfig();
    if (!provider.configured) { status('Set up an API key first (press 1 at menu)'); return; }
    go('new-scan-input');
  });

  screen.key(['m', 'M'], () => {
    if (['api-key-input', 'model-select', 'new-scan-input', 'manual-scan-input'].includes(mode)) return;
    renderManualScanInput();
  });

  screen.key(['escape'], () => {
    if (mode === 'reports' && reportViewMode === 'view') {
      renderReports();
      return;
    }
    if (['api-key-input', 'model-select', 'new-scan-input', 'manual-scan-input'].includes(mode)) {
      go('setup');
      return;
    }
    const provider = detectFromEnvOrConfig();
    go(provider.configured ? 'dashboard' : 'setup');
  });

  // Reports tab shortcuts
  screen.key(['v', 'V'], () => {
    if (mode !== 'reports') return;
    if (reportViewMode === 'view' && currentReportId) {
      renderLogContent(currentReportId);
      return;
    }
    // Show prompt to enter session ID
    showReportIdPrompt('view');
  });

  screen.key(['s', 'S'], () => {
    if (mode !== 'reports') return;
    showReportIdPrompt('save');
  });

  screen.key(['b', 'B'], () => {
    if (mode === 'reports' && reportViewMode === 'view') {
      renderReports();
    }
  });

  screen.key(['r', 'R'], () => {
    if (mode === 'config') {
      clearPersistedConfig();
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_MODEL;
      delete process.env.OPENAI_MODEL;
      status('Configuration reset');
      go('setup');
      return;
    }
    refreshCurrentView();
  });
}

function startAutoRefresh(): void {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(refreshCurrentView, 3000);
}

// ─── EXPORT ─────────────────────────────────────────────────────

export async function startTUI(): Promise<void> {
  screen = blessed.screen({
    smartCSR: true,
    title: 'Pentem - AI Agentic & Manual Penetration Tester',
    cursor: { artificial: true, shape: 'line', blink: true, color: null },
    fullUnicode: true,
  });

  blessed.box({ parent: screen, top: 0, left: 0, width: '100%', height: 2, style: { fg: 'cyan', bg: 'black', bold: true }, content: `${HEADER}\n${SUB}`, tags: true });
  contentBox = blessed.box({ parent: screen, top: 2, left: 0, width: '100%', height: '100%-4', style: { bg: 'black' } });
  statusBar = blessed.box({ parent: screen, bottom: 0, left: 0, width: '100%', height: 1, style: { bg: 'blue', fg: 'white' }, content: '' });

  setupKeyboard();
  startAutoRefresh();

  const provider = detectFromEnvOrConfig();
  if (provider.configured) {
    status(`Ready — ${provider.provider.toUpperCase()} | Model: ${provider.model}`);
    go('dashboard');
  } else {
    status('Choose mode — [1] Agentic AI  [2] Manual  [3] Config');
    go('setup');
  }

  screen.render();
}
