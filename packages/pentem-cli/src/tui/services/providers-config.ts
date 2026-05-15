import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface PersistentConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export const ANTHROPIC_MODELS = [
  'claude-opus-4-20250514',
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-haiku-20240307',
] as const;

export const OPENAI_MODELS = [
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4o',
  'gpt-4o-mini',
  'o3-mini',
  'o4-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
] as const;

function configDir(): string {
  const d = path.join(os.homedir(), '.pentem');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function configPath(): string {
  return path.join(configDir(), 'config.yaml');
}

export function loadPersistedConfig(): PersistentConfig | null {
  const p = configPath();
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    // Simple YAML-like parser for our key-value pairs
    const lines = raw.split('\n');
    const cfg: Partial<PersistentConfig> = {};
    for (const line of lines) {
      const m = line.match(/^\s*(\w+):\s*(.+)\s*$/);
      if (m?.[1] && m[2]) (cfg as Record<string, string>)[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    if (cfg.provider && cfg.apiKey) return cfg as PersistentConfig;
    return null;
  } catch {
    return null;
  }
}

export function savePersistedConfig(cfg: PersistentConfig): void {
  const content = [
    `provider: ${cfg.provider}`,
    `apiKey: ${cfg.apiKey}`,
    `model: ${cfg.model}`,
    cfg.baseUrl ? `baseUrl: ${cfg.baseUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  fs.writeFileSync(configPath(), content, 'utf-8');
}

export function clearPersistedConfig(): void {
  const p = configPath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export function detectFromEnvOrConfig(): {
  configured: boolean;
  provider: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  error?: string;
} {
  // Check env vars first
  let provider = '';
  let apiKey = '';
  let model = '';
  let baseUrl = '';
  const configured: Array<{ provider: string; apiKey: string; model: string; baseUrl: string }> = [];

  if (process.env.ANTHROPIC_API_KEY) {
    configured.push({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || process.env.PENTEM_MODEL || 'claude-sonnet-4-20250514',
      baseUrl: process.env.ANTHROPIC_BASE_URL || '',
    });
  }
  if (process.env.OPENAI_API_KEY) {
    configured.push({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || process.env.PENTEM_MODEL || 'gpt-4o',
      baseUrl: process.env.OPENAI_BASE_URL || '',
    });
  }

  // If no env vars, check config file
  if (configured.length === 0) {
    const persisted = loadPersistedConfig();
    if (persisted) {
      configured.push({
        provider: persisted.provider,
        apiKey: persisted.apiKey,
        model: persisted.model,
        baseUrl: persisted.baseUrl || '',
      });
      // Load into env for downstream use
      if (persisted.provider === 'anthropic') {
        process.env.ANTHROPIC_API_KEY = persisted.apiKey;
        if (persisted.model) process.env.ANTHROPIC_MODEL = persisted.model;
      } else {
        process.env.OPENAI_API_KEY = persisted.apiKey;
        if (persisted.model) process.env.OPENAI_MODEL = persisted.model;
      }
    }
  }

  if (configured.length === 0) {
    return {
      configured: false,
      provider: '',
      error: 'No provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.',
    };
  }
  if (configured.length > 1) {
    return {
      configured: false,
      provider: configured[0].provider,
      error: `Multiple providers detected (${configured.map((c) => c.provider).join(', ')}). Use only one.`,
    };
  }

  const { provider: p, apiKey: k, model: m, baseUrl: b } = configured[0];
  provider = p;
  apiKey = k;
  model = m;
  baseUrl = b;

  return { configured: true, provider, apiKey, model, baseUrl };
}

export function getModelsForProvider(provider: string): readonly string[] {
  if (provider === 'anthropic') return ANTHROPIC_MODELS;
  if (provider === 'openai') return OPENAI_MODELS;
  return [];
}
