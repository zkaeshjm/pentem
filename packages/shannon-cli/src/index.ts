#!/usr/bin/env node

import { configCommand } from './commands/config-cmd.ts';
import { listCommand } from './commands/list.ts';
import { reportCommand } from './commands/report.ts';
import { resumeCommand } from './commands/resume.ts';
import { scanCommand } from './commands/scan.ts';
import { statusCommand } from './commands/status.ts';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  switch (command) {
    case 'scan': {
      const url = args[1];
      if (!url) {
        console.error('Usage: shannon scan <target-url> [--config <path>]');
        process.exit(1);
      }
      const configIndex = args.indexOf('--config');
      const config = configIndex >= 0 ? args[configIndex + 1] : undefined;
      await scanCommand({ url, config });
      break;
    }

    case 'resume': {
      const sessionId = args[1];
      if (!sessionId) {
        console.error('Usage: shannon resume <session-id>');
        process.exit(1);
      }
      await resumeCommand({ sessionId });
      break;
    }

    case 'status': {
      const sessionId = args[1];
      if (!sessionId) {
        console.error('Usage: shannon status <session-id>');
        process.exit(1);
      }
      await statusCommand({ sessionId });
      break;
    }

    case 'report': {
      const sessionId = args[1];
      if (!sessionId) {
        console.error('Usage: shannon report <session-id> [--output <path>]');
        process.exit(1);
      }
      const outputIndex = args.indexOf('--output');
      const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
      await reportCommand({ sessionId, output });
      break;
    }

    case 'list':
      await listCommand();
      break;

    case 'config': {
      const subcommand = args[1]?.toLowerCase();
      if (subcommand === 'validate') {
        const configIndex = args.indexOf('--config');
        const config = configIndex >= 0 ? args[configIndex + 1] : undefined;
        await configCommand({ action: 'validate', config });
      } else if (subcommand === 'init') {
        const configIndex = args.indexOf('--config');
        const config = configIndex >= 0 ? args[configIndex + 1] : undefined;
        await configCommand({ action: 'init', config });
      } else {
        console.error('Usage: shannon config <validate|init> [--config <path>]');
        process.exit(1);
      }
      break;
    }

    case '--help':
    case '-h':
    case undefined:
      console.log(
        `
Shannon — Autonomous White-Box Penetration Testing Framework

Usage:
  shannon scan <target-url>          Start a scan
  shannon resume <session-id>        Resume a scan
  shannon status <session-id>        Check scan status
  shannon report <session-id>        View final report
  shannon list                       List workspaces
  shannon config validate            Validate config
  shannon config init                Initialize config

Environment:
  SHANNON_LOCAL=1                   Enable local mode
  ANTHROPIC_API_KEY                 Anthropic API key
  CLAUDE_CODE_USE_BEDROCK=1         Use AWS Bedrock
  CLAUDE_CODE_USE_VERTEX=1          Use GCP Vertex AI
  ANTHROPIC_BASE_URL                Custom API proxy URL
      `.trim(),
      );
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "shannon --help" for usage');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[shannon] Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
