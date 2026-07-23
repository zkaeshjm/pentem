export interface PentemConfig {
  target: TargetConfig;
  pipeline: PipelineConfig;
  provider: ProviderConfig;
  models?: ModelConfig;
  scope?: ScopeConfig;
  safety?: SafetyConfig;
  rateLimit?: RateLimitConfig;
}

export interface TargetConfig {
  url: string;
  auth?: AuthConfig;
  focus?: FocusConfig;
}

export interface AuthConfig {
  type: 'form' | 'sso' | 'apikey' | 'basic';
  username?: string;
  password?: string;
  totpSecret?: string;
  loginUrl?: string;
  apiKeyHeader?: string;
  apiKeyValue?: string;
  cookieString?: string;
}

export interface FocusConfig {
  include?: string[];
  exclude?: string[];
}

export interface PipelineConfig {
  retryPreset: 'default' | 'fast' | 'subscription';
  maxConcurrent: number;
}

export interface ProviderConfig {
  type: 'anthropic' | 'bedrock' | 'vertex' | 'custom';
  anthropic?: { apiKey?: string };
  bedrock?: { region?: string; profile?: string };
  vertex?: { projectId?: string; location?: string };
  custom?: { baseUrl: string; apiKey?: string };
}

export interface ModelConfig {
  small?: string;
  medium?: string;
  large?: string;
}

export interface ScopeConfig {
  allowedDomains?: string[];
  allowedPaths?: string[];
  excludedDomains?: string[];
  excludedPaths?: string[];
  allowedPorts?: number[];
  allowedSchemes?: string[];
  maxDepth?: number;
}

export interface SafetyConfig {
  dryRun: boolean;
  requireExploitApproval: boolean;
  maxRedirects: number;
  maxResponseSize: number;
  timeout: number;
  allowDestructiveActions: boolean;
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  burstSize: number;
  concurrency: number;
}
