# Pentem — Autonomous Agentic AI & Manual Penetration Testing Framework

```
  ██████╗ ███████╗███╗   ██╗████████╗███████╗███╗   ███╗
  ██╔══██╗██╔════╝████╗  ██║╚══██╔══╝██╔════╝████╗ ████║
  ██████╔╝█████╗  ██╔██╗ ██║   ██║   █████╗  ██╔████╔██║
  ██╔═══╝ ██╔══╝  ██║╚██╗██║   ██║   ██╔══╝  ██║╚██╔╝██║
  ██║     ███████╗██║ ╚████║   ██║   ███████╗██║ ╚═╝ ██║
  ╚═╝     ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝     ╚═╝
  Agentic AI Penetration Tester
```

Pentem is an **autonomous penetration testing framework** with two modes:

- **Agentic AI Mode** — Uses LLM agents (Anthropic Claude / OpenAI GPT-4o) to autonomously probe, analyze, and exploit vulnerabilities
- **Manual Mode** — No API key needed. Built-in HTTP scanner with WAF detection, false positive filtering, attack chain correlation, and compliance mapping

---

## Table of Contents

- [Quick Start](#quick-start)
- [Setup Guide](#setup-guide)
- [All Commands](#all-commands)
- [Features](#features)
- [Notifications](#notifications)
- [Plugin SDK](#plugin-sdk)
- [CI/CD Integration](#cicd-integration)
- [Collaboration & Sharing](#collaboration--sharing)
- [Configuration](#configuration)
- [Architecture](#architecture)

---

## Quick Start

### One-liner Install

**Windows (EXE):**
```powershell
irm https://raw.githubusercontent.com/zkaeshjm/pentem/main/scripts/install-exe.ps1 | iex
```

**macOS / Linux:**
```bash
npm install -g pentem-pentest
```

**Android (Termux):**
```bash
curl -fsSL https://raw.githubusercontent.com/zkaeshjm/pentem/main/scripts/termux-install.sh | bash
```

### From Source

```powershell
git clone https://github.com/zkaeshjm/pentem.git
cd pentem
.\scripts\install.ps1

# Launch TUI (interactive - recommended)
pentem

# Manual scan (no API key needed)
pentem scan --manual https://example.com

# AI agentic scan (set API key first)
$env:ANTHROPIC_API_KEY = "sk-ant-..."
pentem scan https://example.com
```

---

## Setup Guide

### Prerequisites

| Dependency | Version | Notes |
|------------|---------|-------|
| **Node.js** | >= 20 | Required for source install |
| **pnpm** | >= 8 | `npm install -g pnpm` |
| **Git** | any | For cloning the repo |

**Windows:** Prebuilt EXE available — no Node.js needed.
**Termux:** Use the installer script which handles everything.

### Install from Source (Full Dev Setup)

```powershell
# Clone
git clone https://github.com/zkaeshjm/pentem.git
cd pentem

# Install all dependencies (monorepo)
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Typecheck
pnpm typecheck

# Lint
pnpm lint
```

### AI Provider Setup

Set one of these environment variables:

```powershell
# Anthropic Claude (recommended)
$env:ANTHROPIC_API_KEY = "sk-ant-..."
$env:ANTHROPIC_MODEL = "claude-sonnet-4-20250514"

# OpenAI / compatible
$env:OPENAI_API_KEY = "sk-..."
$env:OPENAI_MODEL = "gpt-4o"
$env:OPENAI_BASE_URL = "https://api.openai.com/v1"

# AWS Bedrock
$env:AWS_ACCESS_KEY_ID = "AKIA..."
$env:AWS_SECRET_ACCESS_KEY = "..."
$env:AWS_REGION = "us-east-1"

# Google Vertex AI
$env:VERTEX_PROJECT_ID = "my-project"
$env:VERTEX_API_KEY = "..."
$env:VERTEX_LOCATION = "us-central1"
```

Or configure interactively via the TUI (Run `pentem`, press 1-3 to set provider).

### YAML Config File

Create `pentem.yaml` in your project directory or `~/.pentem/config.yaml`:

```yaml
targets:
  - url: https://example.com
    scope:
      allowedDomains: ["example.com", "api.example.com"]
      excludePaths: ["/logout", "/static/*"]
auth:
  type: form
  loginUrl: https://example.com/login
  username: testuser
  password: testpass
rateLimit:
  requestsPerSecond: 10
  burstSize: 20
  concurrency: 3
notifications:
  slack-notification:
    webhookUrl: https://hooks.slack.com/...
  discord-notification:
    webhookUrl: https://discord.com/api/webhooks/...
team:
  teamName: "Security Team"
  members:
    - name: "Alice"
      email: "alice@example.com"
```

---

## All Commands

### Terminal UI

```powershell
pentem              # Launch interactive TUI (recommended)
pentem tui          # Same as above
```

### Scanning

```powershell
# AI Agentic Scan (requires API key)
pentem scan https://example.com

# Manual Scan (no API key needed)
pentem scan --manual https://example.com

# Save report to file
pentem scan --manual https://example.com --output ./report.md

# Save raw HTTP logs
pentem scan --manual https://example.com --save-logs ./logs

# CI/CD integration (SARIF + exit codes)
pentem scan --manual https://example.com --sarif --exit-code

# Restrict scan scope
pentem scan https://example.com --scope api.example.com,admin.example.com

# Send notifications on completion
pentem scan --manual https://example.com --notify slack,discord

# Export findings as portable JSON
pentem scan --manual https://example.com --share ./results.json

# Schedule recurring scans
pentem schedule add https://example.com --interval daily --notify slack
```

### Session Management

```powershell
pentem list                           # List all scan sessions
pentem status <session-id>            # Check scan status
pentem report <session-id>            # View full report
pentem report <session-id> --logs     # View raw request/response logs
pentem report <session-id> --output ./report.md   # Save report to file
pentem report <session-id> --save ./output        # Save all session data
pentem resume <session-id>            # Resume an incomplete scan
```

### Collaboration & Sharing

```powershell
pentem share <session-id>                          # Export findings as portable JSON
pentem share <session-id> --output ./results.json  # Save to specific file
pentem scan --manual <url> --share ./results.json  # Share during scan
```

### Scheduling

```powershell
pentem schedule add https://example.com --interval daily     # Schedule daily scan
pentem schedule add https://example.com --interval hourly    # Schedule hourly scan
pentem schedule add https://example.com --interval weekly    # Schedule weekly scan
pentem schedule list                                         # List all scheduled scans
pentem schedule remove <id>                                  # Remove a scheduled scan
pentem schedule run-due                                      # Run all due scans
pentem schedule import ./targets.txt                         # Bulk import targets
```

### Configuration

```powershell
pentem config validate            # Validate your YAML config
pentem config init                # Create a config template
pentem config validate --config ./path/to/config.yaml  # Validate specific file
```

### Help

```powershell
pentem --help   # Show help
pentem -h       # Same
```

---

## Features

### Agentic AI Mode

| Feature | Description |
|---------|-------------|
| **Autonomous 5-phase pipeline** | Pre-recon → Recon → Vulnerability Analysis → Exploitation → Report |
| **Multiple LLM providers** | Anthropic Claude, OpenAI GPT-4o, AWS Bedrock, Google Vertex AI, any OpenAI-compatible API |
| **Model selection** | Choose from available models or enter a custom model name |
| **Vulnerability types** | SQLi, XSS, Auth Bypass, Authorization Bypass, SSRF |
| **Progress tracking** | Real-time agent progress in TUI and CLI |
| **Session resume** | Resume interrupted scans with `pentem resume` |
| **Cost tracking** | Per-agent cost, turn count, and duration metrics |

### Manual Mode (No AI)

| Feature | Description |
|---------|-------------|
| **Zero dependencies** | No API key, no Docker, no setup required |
| **HTTP crawler** | Probes 28+ common paths (admin, api, .env, backup, .git, etc.) |
| **Security headers** | Checks HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| **SQL injection** | Tests 5+ SQLi patterns and detects error-based indicators |
| **XSS detection** | Tests reflected XSS with multiple payloads |
| **Technology fingerprinting** | Detects server, framework, cookies, auth headers |
| **WAF detection** | Identifies 9 WAFs: Cloudflare, AWS WAF, CloudFront, Akamai, ModSecurity, F5 BIG-IP, Imperva, Sucuri, StackPath |
| **Scope enforcement** | Domain/path allowlist/blocklist, port filtering, request validation |
| **Rate limiting** | Token bucket algorithm, per-target throttling, concurrency control |
| **Auth session management** | Cookie persistence, header injection, auto-login across phases |
| **API schema ingestion** | OpenAPI/Swagger v2/v3 auto-discovery (11 paths), GraphQL introspection |
| **Cloud scanner** | AWS S3 bucket detection, GCP storage, Azure Blob public access checks |

### Reporting & Analysis

| Feature | Description |
|---------|-------------|
| **Markdown reports** | Structured report with findings by severity, summary, recommendations |
| **Request logs** | Full HTTP request/response log with headers, body preview |
| **SARIF 2.1.0 output** | Standard format for CI/CD pipeline integration |
| **Exit codes** | 0 (none/low), 10 (medium), 20 (high), 30 (critical) |
| **HTML report** | Styled HTML output with findings table |
| **JSON report** | Machine-readable JSON output |

### Vulnerability Analysis

| Feature | Description |
|---------|-------------|
| **Vulnerability types** | SQLi, XSS, Auth Bypass, AuthZ Bypass, SSRF, CSRF, LFI, XXE, SSTI, Business Logic, Race Condition, Deserialization, Insecure Config, Information Disclosure |
| **False positive detection** | 4 heuristic rules (error-based SQLi, non-rendering XSS, empty body paths, header leakage) |
| **Attack chain correlation** | 9 chain patterns: Information Disclosure → Compromise, SSRF → Pivot, XSS → Hijacking, Auth Bypass → Privesc, LFI → RCE, CSRF → State Change, etc. |
| **Compliance mapping** | PCI-DSS v4.0, HIPAA Security Rule, SOC 2 Type II, ISO/IEC 27001, GDPR, OWASP ASVS 4.0, NIST CSF 2.0, CIS Controls |

### Infrastructure Testing

| Feature | Description |
|---------|-------------|
| **Cloud infrastructure scanner** | AWS S3 bucket public access, GCP storage bucket discovery, Azure Blob container enumeration |
| **WAF bypass** | WAF fingerprinting with bypass header injection |

---

## Notifications

Pentem can send scan completion notifications via multiple channels.

### Environment Variables

```powershell
# Slack
$env:SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/..."

# Discord
$env:DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/..."

# Generic webhook
$env:WEBHOOK_URL = "https://hooks.example.com/scan-results"

# Email (SMTP) — requires `npm install nodemailer`
$env:SMTP_HOST = "smtp.example.com"
$env:SMTP_PORT = "587"
$env:SMTP_USERNAME = "user"
$env:SMTP_PASSWORD = "pass"
$env:SMTP_FROM = "pentem@example.com"
$env:SMTP_TO = "security@example.com"
```

### CLI Usage

```powershell
# Send to Slack and Discord on completion
pentem scan --manual https://example.com --notify slack,discord

# Send to webhook
pentem scan --manual https://example.com --notify webhook

# Send email
pentem scan --manual https://example.com --notify email
```

### YAML Config

```yaml
notifications:
  slack-notification:
    webhookUrl: https://hooks.slack.com/...
    channel: "#security-alerts"
  discord-notification:
    webhookUrl: https://discord.com/api/webhooks/...
  email-notification:
    smtpHost: smtp.example.com
    smtpPort: 587
    username: user
    password: pass
    from: pentem@example.com
    to: security@example.com
```

---

## Plugin SDK

Pentem has a built-in Plugin SDK for extending functionality. Plugins hook into the scan lifecycle.

### Built-in Plugins

| Plugin | Type | Hooks | Purpose |
|--------|------|-------|---------|
| `slack-notification` | notification | after-scan, on-error | Send scan results to Slack |
| `discord-notification` | notification | after-scan, on-error | Send scan results to Discord |
| `webhook-notification` | notification | after-scan, on-error, on-finding | Generic HTTP webhook |
| `email-notification` | notification | after-scan, on-error | Email via SMTP (requires nodemailer) |

### Writing a Custom Plugin

```typescript
import type { PentemPlugin, PluginManifest, PluginContext, PluginHookResult, HookPoint } from '@internal/pentem-shared';

const manifest: PluginManifest = {
  name: 'my-custom-plugin',
  version: '1.0.0',
  description: 'Does something useful',
  type: 'scan',        // 'scan' | 'report' | 'notification' | 'checkpoint' | 'transport'
  hooks: ['after-scan', 'on-finding'],
};

export default {
  manifest,
  async init(ctx: PluginContext): Promise<void> {
    // Setup your plugin here
  },
  async execute(hook: HookPoint, data?: unknown): Promise<PluginHookResult> {
    const ctx = data as PluginContext;
    // Do something during the scan lifecycle
    return {
      notifications: [{ type: 'custom', message: 'Done!', level: 'info' }],
    };
  },
} satisfies PentemPlugin;
```

### Loading Custom Plugins

Set the `pluginDirs` or `pluginPackages` in your YAML config:

```yaml
plugins:
  directories:
    - ./pentem-plugins
  packages:
    - pentem-plugin-example
```

Or load programmatically:

```typescript
import { PluginLoader, PluginHost } from 'pentem';

const registry = await PluginLoader.loadAll({
  pluginDirs: ['./my-plugins'],
  pluginPackages: ['my-npm-plugin'],
});
const host = new PluginHost(registry);
```

---

## CI/CD Integration

Pentem integrates with CI/CD pipelines via SARIF output and exit codes.

### GitHub Actions Example

```yaml
name: Pentem Security Scan
on: [push, pull_request]

jobs:
  pentem-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Pentem Scan
        id: pentem
        continue-on-error: true
        run: |
          npx pentem-pentest scan --manual https://your-staging.com \
            --sarif \
            --exit-code \
            --output ./report.md

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: /home/runner/.pentem/workspaces/*/audit/report.sarif

      - name: Fail on Critical/High
        if: steps.pentem.outputs.exitcode >= 20
        run: exit 1
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No findings or only low-severity findings |
| 10 | Medium-severity findings present |
| 20 | High-severity findings present |
| 30 | Critical-severity findings present |

---

## Collaboration & Sharing

### Export Findings

```powershell
# From a completed scan session
pentem share scan-manual-1712345678-abc123

# Specify output path
pentem share scan-manual-1712345678-abc123 --output ./shared-results.json
```

### Import Findings

The shared format (`pentem-share-v1`) is a portable JSON file that can be imported by other tools:

```json
{
  "format": "pentem-share-v1",
  "generatedAt": "2026-07-24T01:00:00.000Z",
  "targetUrl": "https://example.com",
  "scanId": "manual-1712345678-abc123",
  "tool": "Pentem",
  "summary": { "total": 12, "critical": 1, "high": 3, "medium": 5, "low": 3 },
  "findings": [
    { "type": "xss", "severity": "high", "url": "https://example.com/search", "description": "Reflected XSS", "detail": "..." }
  ]
}
```

### Team Configuration

```yaml
team:
  teamName: "Security Team"
  members:
    - name: "Alice"
      email: "alice@example.com"
      role: "lead"
    - name: "Bob"
      email: "bob@example.com"
      role: "member"
```

---

## Scheduling

Schedule recurring scans for continuous security monitoring:

```powershell
# Add a daily scan
pentem schedule add https://example.com --interval daily

# Add with notifications
pentem schedule add https://example.com --interval weekly --notify slack

# List all scheduled scans
pentem schedule list

# Remove a schedule
pentem schedule remove <schedule-id>

# Run all due scans now
pentem schedule run-due

# Bulk import targets from a file (one URL per line)
pentem schedule import ./targets.txt

# Bulk import with interval
pentem schedule import ./targets.txt --interval hourly
```

---

## Configuration Reference

All configuration options for `pentem.yaml`:

```yaml
# Target configuration
targets:
  - url: https://example.com
    scope:
      allowedDomains:
        - example.com
        - api.example.com
      excludePaths:
        - /logout
        - /static/*
      blockPaths:
        - /admin/secret
      includePaths:
        - /api/*
        - /graphql

# Authentication
auth:
  type: form                          # form | basic | apikey | sso
  loginUrl: https://example.com/login
  username: testuser
  password: testpass
  totpSecret: ""                      # Optional TOTP for 2FA
  apiKeyHeader: X-API-Key
  apiKeyValue: your-api-key
  cookieString: "session=abc; token=xyz"

# AI Provider
provider:
  type: anthropic                     # anthropic | openai | bedrock | vertex
  model: claude-sonnet-4-20250514
  baseUrl: ""                         # Optional: OpenAI-compatible endpoint

# Rate Limiting
rateLimit:
  requestsPerSecond: 10
  burstSize: 20
  concurrency: 3

# Scope & Safety
safety:
  maxRequests: 1000
  maxDepth: 3
  dangerousMethods: ["DELETE", "PUT"]
  blockList: ["internal.example.com"]

# Notifications
notifications:
  slack-notification:
    webhookUrl: https://hooks.slack.com/...
  discord-notification:
    webhookUrl: https://discord.com/api/webhooks/...

# Plugins
plugins:
  directories:
    - ./pentem-plugins
  packages:
    - pentem-custom-plugin

# Team
team:
  teamName: "Security Team"
  members:
    - name: "Alice"
      email: "alice@example.com"
```

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                   Pentem CLI                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Dashboard │  │  Scans   │  │ Reports  │  │  Config  │ │
│  └─────┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│        │             │             │              │       │
│  ┌─────┴─────────────┴─────────────┴──────────────┴─────┐ │
│  │              Keyboard Dispatch (Mode-gated)          │ │
│  └────────────────────────┬────────────────────────────┘ │
│                           │                              │
│  ┌────────────────────────┴────────────────────────────┐ │
│  │                Scanner Service                      │ │
│  │  ┌─────────────────┐  ┌──────────────────────────┐  │ │
│  │  │  ManualScanner  │  │  DirectAgentPipeline     │  │ │
│  │  │  (HTTP crawler  │  │  (5-phase AI agent       │  │ │
│  │  │   + patterns)   │  │   pipeline)              │  │ │
│  │  └─────────────────┘  └──────────────────────────┘  │ │
│  └────────────────────────┬────────────────────────────┘ │
│                           │                              │
│  ┌────────────────────────┴────────────────────────────┐ │
│  │           Core Services                             │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │ │
│  │  │  Auth    │ │  Scope   │ │  Rate    │ │  WAF   │ │ │
│  │  │ Session  │ │  Enforce │ │  Limiter │ │ Detect │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │ │
│  │  │   API    │ │  Cloud   │ │  Plugin  │ │  SARIF │ │ │
│  │  │  Schema  │ │ Scanner  │ │   SDK    │ │ Output │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │ │
│  └─────────────────────────────────────────────────────┘ │
│                           │                              │
│  ┌────────────────────────┴────────────────────────────┐ │
│  │          Analysis Pipeline                          │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │ │
│  │  │   FP     │ │  Attack  │ │Compliance│ │  Chain │ │ │
│  │  │Analysis  │ │  Chains  │ │ Mapping  │ │  Viz   │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │ │
│  └────────────────────────┬────────────────────────────┘ │
│                           │                              │
│  ┌────────────────────────┴────────────────────────────┐ │
│  │           Notifications & Sharing                   │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │ │
│  │  │  Slack   │ │  Discord │ │  Webhook │ │  Email │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

### Package Structure

```
pentem/
├── packages/
│   ├── pentem-cli/           # CLI + TUI application
│   │   ├── src/
│   │   │   ├── commands/     # CLI command handlers
│   │   │   ├── tui/          # Terminal UI (blessed.js)
│   │   │   │   ├── screens/  # UI screen components
│   │   │   │   └── services/ # Core services
│   │   │   │       ├── plugin-sdk/     # Plugin system
│   │   │   │       ├── collaboration/  # Sharing & team
│   │   │   │       └── builtins/       # Built-in plugins
│   │   │   └── tests/        # Test suite (vitest)
│   │   └── package.json
│   ├── pentem-shared/        # Shared types & utilities
│   │   └── src/
│   │       ├── agent-types.ts
│   │       ├── config-types.ts
│   │       ├── scope.ts      # Scope enforcement
│   │       ├── rate-limiter.ts
│   │       ├── compliance.ts # Framework mappings
│   │       └── plugin-types.ts
│   └── pentem-worker/        # Temporal worker
│       ├── src/
│       │   ├── activities/   # Temporal activities
│       │   ├── agents/       # AI agent runners
│       │   ├── workflows/    # Temporal workflows
│       │   └── plugins/      # Worker plugins
│       └── package.json
├── prompts/                  # AI agent prompt templates
├── scripts/                  # Build & install scripts
├── turbo.json                # Turborepo config
└── pnpm-lock.yaml
```

### Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Monorepo** | pnpm + Turborepo | Fast installs, shared types, parallel builds |
| **CLI Framework** | blessed.js | Terminal UI without heavy dependencies |
| **AI SDK** | Claude Agent SDK + OpenAI SDK | First-class support for both major providers |
| **Workflow Engine** | Temporal.io (worker) | Durable execution for long-running scans |
| **Plugin System** | Simple class-based | TypeScript-first, no heavy framework |
| **Testing** | Vitest | Fast, ESM-native, minimal config |
| **Linting** | Biome | All-in-one formatter + linter, fast |

---

## License

MIT
