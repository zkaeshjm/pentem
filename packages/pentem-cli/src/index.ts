#!/usr/bin/env node

import { configCommand } from './commands/config-cmd.ts';
import { listCommand } from './commands/list.ts';
import { reportCommand } from './commands/report.ts';
import { resumeCommand } from './commands/resume.ts';
import { scanCommand } from './commands/scan.ts';
import { shareCommand } from './commands/share.ts';
import { statusCommand } from './commands/status.ts';
import { tuiCommand } from './commands/tui.ts';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  switch (command) {
    case 'scan': {
      const manual = args.includes('--manual') || args.includes('-m');
      const configIndex = args.indexOf('--config');
      const config = configIndex >= 0 ? args[configIndex + 1] : undefined;
      const saveLogsIndex = args.indexOf('--save-logs');
      const saveLogs = saveLogsIndex >= 0 ? args[saveLogsIndex + 1] : undefined;
      const outputIndex = args.indexOf('--output');
      const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
      const notifyIndex = args.indexOf('--notify');
      const notify = notifyIndex >= 0 ? args[notifyIndex + 1] : undefined;
      const shareIndex = args.indexOf('--share');
      const share = shareIndex >= 0 ? args[shareIndex + 1] : undefined;
      const sarif = args.includes('--sarif');
      const exitCode = args.includes('--exit-code');
      const scopeIndex = args.indexOf('--scope');
      const scope = scopeIndex >= 0 ? args[scopeIndex + 1] : undefined;
      // URL is the first non-flag argument (skip command at args[0])
      const url = args
        .slice(1)
        .find(
          (a) =>
            a !== '--manual' &&
            a !== '-m' &&
            !a.startsWith('--config') &&
            a !== config &&
            !a.startsWith('--save-logs') &&
            a !== saveLogs &&
            !a.startsWith('--output') &&
            a !== output &&
            !a.startsWith('--notify') &&
            a !== notify &&
            !a.startsWith('--share') &&
            a !== share &&
            !a.startsWith('--sarif') &&
            !a.startsWith('--exit-code') &&
            !a.startsWith('--scope') &&
            a !== scope &&
            !a.startsWith('-'),
        );
      if (!url) {
        console.error('Usage: pentem scan <target-url> [--manual] [--output <path>] [--save-logs <dir>] [--notify slack,discord] [--share ./output.json]');
        process.exit(1);
      }
      await scanCommand({ url, config, manual, saveLogs, output, notify, share, sarif, exitCode, scope });
      break;
    }

    case 'resume': {
      const sessionId = args[1];
      if (!sessionId) {
        console.error('Usage: pentem resume <session-id>');
        process.exit(1);
      }
      await resumeCommand({ sessionId });
      break;
    }

    case 'status': {
      const sessionId = args[1];
      if (!sessionId) {
        console.error('Usage: pentem status <session-id>');
        process.exit(1);
      }
      await statusCommand({ sessionId });
      break;
    }

    case 'report': {
      const sessionId = args[1];
      if (!sessionId) {
        console.error('Usage: pentem report <session-id> [--output <path>] [--logs] [--save <dir>]');
        process.exit(1);
      }
      const logs = args.includes('--logs');
      const saveIndex = args.indexOf('--save');
      const save = saveIndex >= 0 ? args[saveIndex + 1] : undefined;
      const outputIndex = args.indexOf('--output');
      const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
      await reportCommand({ sessionId, output, logs, save });
      break;
    }

    case 'tui':
    case 'ui':
      await tuiCommand();
      break;

    case 'list':
      await listCommand();
      break;

    case 'share': {
      const sessionId = args[1];
      const outputIndex = args.indexOf('--output');
      const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
      if (!sessionId) {
        console.error('Usage: pentem share <session-id> [--output <file>]');
        process.exit(1);
      }
      await shareCommand({ sessionId, output: outputFile });
      break;
    }

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
        console.error('Usage: pentem config <validate|init> [--config <path>]');
        process.exit(1);
      }
      break;
    }

    case undefined:
      await tuiCommand();
      break;

    case '--help':
    case '-h':
      console.log(
        `
  ██████╗ ███████╗███╗   ██╗████████╗███████╗███╗   ███╗
  ██╔══██╗██╔════╝████╗  ██║╚══██╔══╝██╔════╝████╗ ████║
  ██████╔╝█████╗  ██╔██╗ ██║   ██║   █████╗  ██╔████╔██║
  ██╔═══╝ ██╔══╝  ██║╚██╗██║   ██║   ██╔══╝  ██║╚██╔╝██║
  ██║     ███████╗██║ ╚████║   ██║   ███████╗██║ ╚═╝ ██║
  ╚═╝     ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝     ╚═╝
  Agentic AI Penetration Tester

Usage:
  pentem                            Launch Terminal UI (recommended)
  pentem tui                        Launch Terminal UI
  pentem scan <target-url>          CLI scan (requires API key env var)

Commands:
  pentem scan <url>                 Start an AI agent penetration test
  pentem scan --manual <url>        Manual scan (no API key needed)
   pentem scan --manual <url> --output ./report.md  Save report to file
   pentem scan --manual <url> --save-logs ./logs    Save all logs to dir
   pentem scan <url> --notify slack,discord         Send notifications on completion
   pentem scan <url> --share ./results.json         Export findings as shareable JSON
   pentem share <session-id>                        Export findings from completed scan
  pentem resume <session-id>        Resume a scan
  pentem status <session-id>        Check scan status
  pentem report <session-id>        View full report in terminal
  pentem report <session-id> --logs View raw request/response logs
  pentem report <session-id> --output ./report.md  Save report to file
  pentem report <session-id> --save ./output       Save all session data
  pentem list                       List all sessions
  pentem config validate            Validate YAML config
  pentem config init                Create config template

Modes:
  AI Agentic Mode ─────────────────────────────────
  Set ANTHROPIC_API_KEY or OPENAI_API_KEY for AI
  Agents autonomously probe, analyze & exploit

  Manual Mode ─────────────────────────────────────
  No API key needed. Built-in HTTP crawler +
  pattern scanner checks headers, paths, SQLi, XSS

Quick Start:
  pentem                  Launch TUI
  [1] Set API key        → [n] New scan → Enter URL → AI tests
  [2] Manual scan        → Enter URL → Scanner tests headers, paths, SQLi, XSS
      `.trim(),
      );
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "pentem --help" for usage');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[pentem] Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
