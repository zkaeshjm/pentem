export interface ShannonConfig {
  target: TargetConfig;
  pipeline: PipelineConfig;
  provider: ProviderConfig;
  models?: ModelConfig;
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
