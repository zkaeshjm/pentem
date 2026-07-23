export type PluginType = 'scan' | 'report' | 'notification' | 'checkpoint' | 'transport';
export type HookPoint = 'before-scan' | 'after-phase' | 'on-finding' | 'after-scan' | 'on-error' | 'on-report';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  type: PluginType;
  hooks: HookPoint[];
  configSchema?: Record<string, unknown>;
}

export interface PluginContext {
  scanId: string;
  targetUrl: string;
  config: Record<string, unknown>;
  findings: unknown[];
  phase?: string;
  report?: string;
  metadata?: Record<string, unknown>;
}

export interface PluginHookResult {
  abort?: boolean;
  modifiedFindings?: unknown[];
  notifications?: Array<{ type: string; message: string; level: string }>;
  metadata?: Record<string, unknown>;
}

export interface PentemPlugin {
  manifest: PluginManifest;
  init(ctx: PluginContext): Promise<void>;
  execute(hook: HookPoint, data?: unknown): Promise<PluginHookResult>;
}
