import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../config-loader.ts';

export interface ConfigOptions {
  action: 'validate' | 'init';
  config?: string;
}

export async function configCommand(options: ConfigOptions): Promise<void> {
  if (options.action === 'validate') {
    try {
      const config = loadConfig(options.config);
      console.log('[pentem] Config is valid');
      console.log(JSON.stringify(config, null, 2));
    } catch (err) {
      console.error(`[pentem] Config error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  } else if (options.action === 'init') {
    const configPath = options.config ?? 'pentem.yaml';
    const template = `# Pentem Configuration
target:
  url: "https://your-target-app.com"
  # auth:
  #   type: form      # form | sso | apikey | basic
  #   username: admin
  #   password: "\${ENV:APP_PASSWORD}"
  #   totp_secret: "\${ENV:TOTP_SECRET}"
  # focus:
  #   include:
  #     - "/admin/**"
  #   exclude:
  #     - "/static/**"

pipeline:
  retry_preset: default      # default | fast | subscription
  max_concurrent: 3          # 1-5

# models:
#   small: haiku
#   medium: sonnet
#   large: opus
`;
    fs.writeFileSync(configPath, template, 'utf-8');
    console.log(`[pentem] Config template written to: ${configPath}`);
  }
}
