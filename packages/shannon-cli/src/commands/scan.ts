import { loadConfig } from '../config-loader.ts';
import { generateSessionId, generateTaskQueue, runLocal, runNpx } from '../modes/index.ts';
import { detectProvider } from '../providers.ts';

export interface ScanOptions {
  config?: string;
  url: string;
}

export async function scanCommand(options: ScanOptions): Promise<void> {
  const provider = detectProvider();
  if (!provider.configured) {
    console.error(`[shannon] Provider error: ${provider.validationError}`);
    process.exit(1);
  }
  console.log(`[shannon] Using provider: ${provider.type}`);

  if (options.config) {
    try {
      loadConfig(options.config);
    } catch (err) {
      console.error(`[shannon] Config error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  try {
    new URL(options.url);
  } catch {
    console.error('[shannon] Invalid target URL');
    process.exit(1);
  }

  const isLocal = !!process.env.SHANNON_LOCAL;
  console.log(`[shannon] Mode: ${isLocal ? 'local' : 'npx'}`);

  if (isLocal) {
    await runLocal(options.url, options.config);
  } else {
    await runNpx(options.url, options.config);
  }
}
