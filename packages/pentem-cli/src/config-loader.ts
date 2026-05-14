import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface LoadedConfig {
  target: {
    url: string;
    auth?: {
      type: 'form' | 'sso' | 'apikey' | 'basic';
      username?: string;
      password?: string;
      totpSecret?: string;
      loginUrl?: string;
      apiKeyHeader?: string;
      apiKeyValue?: string;
      cookieString?: string;
    };
    focus?: {
      include?: string[];
      exclude?: string[];
    };
  };
  pipeline: {
    retryPreset: 'default' | 'fast' | 'subscription';
    maxConcurrent: number;
  };
  provider?: {
    type: 'anthropic' | 'bedrock' | 'vertex' | 'custom';
  };
  models?: {
    small?: string;
    medium?: string;
    large?: string;
  };
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{ENV:([^}]+)\}/g, (_, name) => {
    return process.env[name] ?? '';
  });
}

function resolveEnvVarsDeep(obj: unknown): unknown {
  if (typeof obj === 'string') return resolveEnvVars(obj);
  if (Array.isArray(obj)) return obj.map(resolveEnvVarsDeep);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = resolveEnvVarsDeep(v);
    }
    return result;
  }
  return obj;
}

export function loadConfig(configPath?: string): LoadedConfig {
  const resolvedPath = configPath ?? findConfigPath();

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    return {
      target: { url: '' },
      pipeline: { retryPreset: 'default', maxConcurrent: 3 },
    };
  }

  const raw = fs.readFileSync(resolvedPath, 'utf-8');
  const parsed = parseYaml(raw) as Record<string, unknown>;
  const resolved = resolveEnvVarsDeep(parsed) as LoadedConfig;

  validateConfig(resolved);
  return resolved;
}

function findConfigPath(): string | undefined {
  const candidates = [
    process.env.PENTEM_CONFIG,
    path.join(process.cwd(), 'pentem.yaml'),
    path.join(process.cwd(), 'pentem.yml'),
    path.join(process.cwd(), '.pentem.yaml'),
    path.join(process.cwd(), '.pentem.yml'),
    path.join(os.homedir(), '.pentem', 'config.yaml'),
    path.join(os.homedir(), '.pentem', 'config.toml'),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function validateConfig(config: LoadedConfig): void {
  const errors: string[] = [];

  if (!config.target?.url) {
    errors.push('target.url is required');
  } else {
    try {
      new URL(config.target.url);
    } catch {
      errors.push('target.url must be a valid URL');
    }
  }

  if (config.pipeline) {
    if (!['default', 'fast', 'subscription'].includes(config.pipeline.retryPreset)) {
      errors.push('pipeline.retryPreset must be one of: default, fast, subscription');
    }
    if (config.pipeline.maxConcurrent < 1 || config.pipeline.maxConcurrent > 5) {
      errors.push('pipeline.maxConcurrent must be between 1 and 5');
    }
  }

  if (config.target?.auth?.type && !['form', 'sso', 'apikey', 'basic'].includes(config.target.auth.type)) {
    errors.push('target.auth.type must be one of: form, sso, apikey, basic');
  }

  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n${errors.join('\n')}`);
  }
}
