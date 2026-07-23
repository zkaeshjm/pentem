import blessed from 'blessed';
import type { Widgets } from 'blessed';

import { detectFromEnvOrConfig, getModelsForProvider, savePersistedConfig } from './services/providers-config.ts';
import { startScan, validateUrl } from './services/scanner.ts';
import { DashboardScreen } from './screens/dashboard.ts';
import { ScansScreen } from './screens/scans.ts';
import { ReportsScreen } from './screens/reports.ts';
import { ConfigScreen } from './screens/config.ts';

export interface App {
  screen: Widgets.Screen;
  setStatus(msg: string): void;
  modalCount: number;
  lastEnterSubmit: number;
  lastEscapeClose: number;
}

export type ScreenId = 'dashboard' | 'scans' | 'reports' | 'config';

export interface TUIScreen {
  id: ScreenId;
  label: string;
  activate(): void;
  deactivate(): void;
  refresh(): void;
}

type Mode =
  | 'setup' | 'api-key-input' | 'model-select'
  | 'dashboard' | 'scans' | 'reports' | 'config'
  | 'new-scan-input' | 'manual-scan-input';

let mode: Mode = 'setup';
let screen: Widgets.Screen;
let contentBox: Widgets.BoxElement;
let statusBar: Widgets.BoxElement;
let pendingProvider = '';
let pendingApiKey = '';
let refreshInterval: ReturnType<typeof setInterval> | null = null;

let dashboardScreen: DashboardScreen;
let scansScreen: ScansScreen;
let reportsScreen: ReportsScreen;
let configScreen: ConfigScreen;

const app: App = {
  get screen() { return screen; },
  setStatus: (msg: string) => { statusBar.setContent(` ${msg}`); screen.render(); },
  modalCount: 0,
  lastEnterSubmit: 0,
  lastEscapeClose: 0,
};

const HEADER = ' ██████╗ ███████╗███╗   ██╗████████╗███████╗███╗   ███╗  v0.1.0';
const SUB = ' ██╔══██╗██╔════╝████╗  ██║╚══██╔══╝██╔════╝████╗ ████║  Agentic AI & Manual Penetration Tester';

const TAB_MODES: Mode[] = ['dashboard', 'scans', 'reports', 'config'];
const INPUT_MODES: Mode[] = ['setup', 'api-key-input', 'model-select', 'new-scan-input', 'manual-scan-input'];

function status(msg: string): void { app.setStatus(msg); }

function clear(): void {
  contentBox.setContent('');
  for (const c of [...(contentBox.children || [])]) {
    try { c.detach(); c.destroy(); } catch {}
  }
}

function getScreen(id: ScreenId): TUIScreen {
  switch (id) {
    case 'dashboard': return dashboardScreen;
    case 'scans': return scansScreen;
    case 'reports': return reportsScreen;
    case 'config': return configScreen;
  }
}

function go(m: Mode): void {
  screen.grabKeys = false;
  const prevMode = mode;
  const prevIsTab = TAB_MODES.includes(prevMode);
  const newIsTab = TAB_MODES.includes(m);

  // Provider gate
  const provider = detectFromEnvOrConfig();
  if (!provider.configured && !['setup', 'api-key-input', 'model-select', 'config', 'manual-scan-input', 'dashboard', 'scans', 'reports'].includes(m)) {
    m = 'setup';
  }

  mode = m;

  // Deactivate previous tab screen
  if (prevIsTab) {
    getScreen(prevMode as ScreenId).deactivate();
  }

  // Clear only when transitioning between tab ↔ modal (screens rebuild themselves)
  if (prevIsTab !== newIsTab) {
    clear();
  }

  if (newIsTab) {
    getScreen(m as ScreenId).activate();
    screen.render();
    return;
  }

  clear();
  switch (mode) {
    case 'setup': renderSetup(); break;
    case 'api-key-input': renderApiKeyInput(pendingProvider); break;
    case 'model-select': renderModelSelect(); break;
    case 'new-scan-input': renderNewScanInput(); break;
    case 'manual-scan-input': renderManualScanInput(); break;
    default: renderSetup(); break;
  }
  screen.render();
}

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

function renderApiKeyInput(providerType: string): void {
  const label = providerType === 'anthropic' ? 'Anthropic (Claude)' : 'OpenAI (GPT-4o / compatible)';
  const envVar = providerType === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
  const lines = [
    '',
    `Enter ${label} API Key:`,
    `Sets ${envVar} for this session`,
    'Paste your key, then press Enter to confirm / Escape to go back',
  ];
  lines.forEach((l, i) => {
    blessed.text({ parent: contentBox, top: 3 + i, left: 2, content: l, style: { fg: i === 0 ? 'cyan' : i === 1 ? 'gray' : 'gray' } });
  });

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
    app.lastEnterSubmit = Date.now();
    app.screen.grabKeys = false;
    pendingApiKey = val;
    pendingProvider = providerType;
    if (providerType === 'anthropic') process.env.OPENAI_API_KEY = undefined;
    else process.env.ANTHROPIC_API_KEY = undefined;
    if (providerType === 'anthropic') process.env.ANTHROPIC_API_KEY = val;
    else process.env.OPENAI_API_KEY = val;
    go('model-select');
  });
  inp.key(['escape'], () => { app.lastEscapeClose = Date.now(); app.screen.grabKeys = false; go('setup'); });
}

function renderModelSelect(): void {
  const models = getModelsForProvider(pendingProvider);
  const label = pendingProvider === 'anthropic' ? 'Anthropic' : 'OpenAI';

  blessed.text({ parent: contentBox, top: 2, left: 2, content: `Select ${label} Model:`, style: { fg: 'cyan', bold: true } });
  blessed.text({ parent: contentBox, top: 3, left: 2, content: `API key set: ${pendingApiKey.slice(0, 8)}...${pendingApiKey.slice(-4)}`, style: { fg: 'green' } });
  blessed.text({ parent: contentBox, top: 4, left: 2, content: 'Pick a model or type a custom name. Press Enter to confirm.', style: { fg: 'gray' } });

  models.forEach((m, i) => {
    blessed.text({ parent: contentBox, top: 6 + i, left: 2, content: `  ${i + 1}. ${m}`, style: { fg: 'white' } });
  });
  blessed.text({ parent: contentBox, top: 6 + models.length, left: 2, content: `  ${models.length + 1}. Custom model (type name)`, style: { fg: 'gray' } });

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
    const num = Number.parseInt(raw, 10);
    if (num >= 1 && num <= models.length) model = models[num - 1]!;
    else if (num === models.length + 1 || raw === '') model = '';
    if (!model) model = pendingProvider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o';
    if (pendingProvider === 'anthropic') process.env.ANTHROPIC_MODEL = model;
    else process.env.OPENAI_MODEL = model;
    app.lastEnterSubmit = Date.now();
    app.screen.grabKeys = false;
    savePersistedConfig({ provider: pendingProvider, apiKey: pendingApiKey, model });
    status(`${pendingProvider.toUpperCase()} configured — Model: ${model}`);
    go('dashboard');
  });
  inp.key(['escape'], () => { app.lastEscapeClose = Date.now(); app.screen.grabKeys = false; go('api-key-input'); });
}

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
    app.lastEnterSubmit = Date.now();
    app.screen.grabKeys = false;
    status(`Starting agentic scan on ${url}...`);
    const result = await startScan(url, false);
    if (result.success) status(`Agentic scan started: ${url} — Session: ${result.sessionId}`);
    else status(`Failed: ${result.error}`);
    go('dashboard');
  });
  inp.key(['escape'], () => { app.lastEscapeClose = Date.now(); app.screen.grabKeys = false; go('dashboard'); });
}

function renderManualScanInput(): void {
  mode = 'manual-scan-input';
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
    app.lastEnterSubmit = Date.now();
    app.screen.grabKeys = false;
    status(`Manual scanning ${url}...`);
    const result = await startScan(url, true);
    if (result.success) status(`Manual scan started: ${url} — check Scans tab for report`);
    else status(`Failed: ${result.error}`);
    go('dashboard');
  });
  inp.key(['escape'], () => { app.lastEscapeClose = Date.now(); app.screen.grabKeys = false; go('dashboard'); });
}

function refreshCurrentView(): void {
  if (INPUT_MODES.includes(mode)) return;

  if (mode === 'scans') { scansScreen.refresh(); screen.render(); return; }
  if (mode === 'reports') { reportsScreen.refresh(); screen.render(); return; }

  const provider = detectFromEnvOrConfig();
  const sessions = require('./services/workspace.ts').listSessions();
  const running = sessions.filter((s: any) => s.status === 'in_progress');
  if (running.length > 0) status(`⏳ ${running.length} scan(s) running — [r] Refresh`);
  else status('Ready — [1-4] Tabs  [n] AI Scan  [m] Manual Scan  [q] Quit');

  if (mode === 'dashboard') { dashboardScreen.refresh(); screen.render(); return; }

  clear();
  if (TAB_MODES.includes(mode)) {
    getScreen(mode as ScreenId).activate();
  }
  screen.render();
}

function setupKeyboard(): void {
  screen.key(['q', 'Q', 'C-c'], () => { screen.destroy(); process.exit(0); });

  screen.key(['tab'], () => {
    if (INPUT_MODES.includes(mode)) return;
    const idx = TAB_MODES.indexOf(mode as ScreenId);
    const nextMode = TAB_MODES[(idx + 1) % 4]!;
    go(nextMode);
  });

  screen.key(['1'], () => {
    if (mode === 'setup') { pendingProvider = 'anthropic'; go('api-key-input'); return; }
    if (INPUT_MODES.includes(mode)) return;
    go('dashboard');
  });
  screen.key(['2'], () => {
    if (mode === 'setup') { go('manual-scan-input'); return; }
    if (INPUT_MODES.includes(mode)) return;
    go('scans');
  });
  screen.key(['3'], () => {
    if (mode === 'setup') { go('config'); return; }
    if (INPUT_MODES.includes(mode)) return;
    go('reports');
  });
  screen.key(['4'], () => {
    if (INPUT_MODES.includes(mode)) return;
    go('config');
  });

  screen.key(['n', 'N'], () => {
    if (INPUT_MODES.includes(mode)) return;
    if (mode === 'dashboard') { dashboardScreen.showNewAiScanInput(); return; }
    if (mode === 'scans') { scansScreen.showInputPrompt(); return; }
    const provider = detectFromEnvOrConfig();
    if (!provider.configured) { status('Set up an API key first (press 1 at menu)'); return; }
    go('new-scan-input');
  });

  screen.key(['m', 'M'], () => {
    if (INPUT_MODES.includes(mode)) return;
    if (mode === 'dashboard') { dashboardScreen.showNewManualScanInput(); return; }
    go('manual-scan-input');
  });

  screen.key(['d', 'D'], () => {
    if (mode === 'dashboard') { dashboardScreen.showSessionDetails(); return; }
    if (mode === 'scans') { scansScreen.showDetails(); return; }
  });

  screen.key(['s', 'S'], () => {
    if (mode === 'scans') { scansScreen.stopSelected(); return; }
  });

  screen.key(['o', 'O'], () => {
    if (mode === 'reports') { reportsScreen.saveToFile(); return; }
    if (mode === 'scans') { scansScreen.saveOutput(); return; }
  });

  screen.key(['x', 'X'], () => {
    if (mode === 'scans') { scansScreen.shareFindings(); return; }
    if (mode === 'reports') { reportsScreen.shareFindings(); return; }
  });

  screen.key(['c', 'C'], () => {
    if (mode === 'scans') { scansScreen.cleanStale(); return; }
  });

  screen.key(['u', 'U'], () => {
    if (mode === 'scans') { scansScreen.resumeScan(); return; }
  });

  screen.key(['v', 'V'], () => {
    if (mode === 'scans') { scansScreen.viewReport(); return; }
    if (mode === 'reports') { reportsScreen.showLogs(); return; }
    if (mode === 'config') { configScreen.validate(); return; }
  });

  screen.key(['i', 'I'], () => {
    if (mode === 'config') { configScreen.initDefault(); return; }
  });

  screen.key(['e', 'E'], () => {
    if (mode === 'config') { configScreen.startEdit(); return; }
  });

  screen.key(['r', 'R'], () => {
    if (INPUT_MODES.includes(mode)) return;
    if (mode === 'config') {
      configScreen.refresh();
      status('Configuration reloaded');
      return;
    }
    refreshCurrentView();
  });

  screen.key(['enter', 'return'], () => {
    if (Date.now() - app.lastEnterSubmit < 100) { app.lastEnterSubmit = 0; return; }
    if (mode === 'dashboard') { dashboardScreen.showSessionDetails(); return; }
    if (mode === 'scans') { scansScreen.viewLogs(); return; }
    if (mode === 'reports') { reportsScreen.showReport(); return; }
  });

  screen.key(['b', 'B'], () => {
    if (app.modalCount > 0) return;
    if (mode === 'scans' || mode === 'reports') {
      go(mode === 'scans' ? 'dashboard' : (TAB_MODES[Math.max(0, TAB_MODES.indexOf(mode as ScreenId) - 1)]!));
    }
  });

  screen.key(['escape'], () => {
    if (Date.now() - app.lastEscapeClose < 100) { app.lastEscapeClose = 0; return; }
    screen.grabKeys = false;
    if (INPUT_MODES.includes(mode)) { go('setup'); return; }
    const provider = detectFromEnvOrConfig();
    go(provider.configured ? 'dashboard' : 'setup');
  });
}

function startAutoRefresh(): void {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(refreshCurrentView, 3000);
}

export async function startTUI(): Promise<void> {
  screen = blessed.screen({
    smartCSR: true,
    title: 'Pentem - AI Agentic & Manual Penetration Tester',
    cursor: { artificial: true, shape: 'line', blink: true } as any,
    fullUnicode: true,
  });

  screen.enableInput();

  blessed.box({
    parent: screen, top: 0, left: 0, width: '100%', height: 2,
    style: { fg: 'cyan', bg: 'black', bold: true },
    content: `${HEADER}\n${SUB}`,
    tags: true,
  });

  contentBox = blessed.box({
    parent: screen, top: 2, left: 0, width: '100%', height: '100%-4',
    style: { bg: 'black' },
  });

  statusBar = blessed.box({
    parent: screen, bottom: 0, left: 0, width: '100%', height: 1,
    style: { bg: 'blue', fg: 'white' },
    content: '',
  });

  dashboardScreen = new DashboardScreen(contentBox, app);
  scansScreen = new ScansScreen(contentBox, app);
  reportsScreen = new ReportsScreen(contentBox, app);
  configScreen = new ConfigScreen(contentBox, app);

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
