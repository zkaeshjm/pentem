# pentem

Autonomous white-box penetration testing framework powered by LLM agents.

Pentem uses AI agents (Claude) to automatically discover, analyze, and exploit security vulnerabilities in web applications. It runs a multi-phase pipeline orchestrated by [Temporal.io](https://temporal.io/), with each phase delegating to specialized agents that have access to real security tools and browser automation.

## Features

- **Fully autonomous** — from reconnaissance to exploitation to reporting
- **Multi-phase pipeline**: Pre-Recon → Recon → Vulnerability Analysis → Exploitation → Report
- **Parallel agent execution** — 5 vulnerability/exploit agent pairs run concurrently
- **Durable workflows** — survives process restarts via Temporal; supports resume
- **Multiple auth types** — form login, SSO, API keys, basic auth with optional TOTP
- **Configurable scope** — include/exclude URL patterns to focus testing
- **Multiple LLM providers** — Anthropic, AWS Bedrock, GCP Vertex, or custom proxy
- **Real security tools** — nmap, subfinder, WhatWeb, schemathesis, Playwright
- **Plugin system** — extensible checkpoints, external findings, and report output

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  pentem CLI                                             │
│  (user-facing, runs on host)                            │
│                                                         │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐             │
│  │  scan    │  │  status   │  │  report  │  ...         │
│  └──────────┘  └───────────┘  └──────────┘             │
└──────────────────────┬──────────────────────────────────┘
                       │ docker compose
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Docker host                                            │
│  ┌────────────────────┐  ┌────────────────────────────┐│
│  │  Temporal Server   │  │  pentem-worker             ││
│  │  (workflow engine) │◄─┤  ┌──────────────────────┐  ││
│  └────────────────────┘  │  │  Pipeline Workflow    │  ││
│                          │  │  ├─ Pre-Recon         │  ││
│                          │  │  ├─ Recon             │  ││
│                          │  │  ├─ Vuln (5 agents)   │  ││
│                          │  │  ├─ Exploit (5 agents)│  ││
│                          │  │  └─ Report            │  ││
│                          │  └──────────────────────┘  ││
│                          └────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Packages

| Package | Description |
|---------|-------------|
| `packages/pentem-cli` | CLI tool (`pentem` command) — user entry point |
| `packages/pentem-worker` | Temporal worker that executes the pipeline |
| `packages/pentem-shared` | Shared types, constants, and utilities |

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 10.8
- **Docker** (for running the worker)
- An **Anthropic API key** (or Bedrock/Vertex credentials)

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run a scan
export ANTHROPIC_API_KEY=sk-...
pentem scan https://target-app.com
```

## CLI Usage

```
pentem scan <target-url> [--config <path>]
pentem resume <session-id>
pentem status <session-id>
pentem report <session-id> [--output <path>]
pentem list
pentem config validate [--config <path>]
pentem config init [--config <path>]
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key for Anthropic |
| `CLAUDE_CODE_USE_BEDROCK=1` | Use AWS Bedrock |
| `CLAUDE_CODE_USE_VERTEX=1` | Use GCP Vertex AI |
| `ANTHROPIC_BASE_URL` | Custom API proxy URL |
| `PENTEM_LOCAL=1` | Enable local development mode |
| `PENTEM_MODEL_SMALL` | Model for quick tasks (default: haiku) |
| `PENTEM_MODEL_MEDIUM` | Model for standard tasks (default: sonnet) |
| `PENTEM_MODEL_LARGE` | Model for complex tasks (default: opus) |
| `PENTEM_PROMPTS_DIR` | Custom prompts directory |

### Modes

- **Default (npx mode)**: Pulls a pre-built image, uses `~/.pentem/` as workspace
- **Local mode** (`PENTEM_LOCAL=1`): Builds the Docker image locally from source

## Configuration

Pentem can be configured via YAML file. By default it looks for `pentem.yaml`, `.pentem.yaml`, or `~/.pentem/config.yaml`.

```yaml
target:
  url: "https://target-app.com"
  auth:
    type: form                  # form | sso | apikey | basic
    username: "admin"
    password: "secret"
    totpSecret: "BASE32SECRET"
    loginUrl: "https://target-app.com/login"
  focus:
    include: ["/api/**"]
    exclude: ["/static/**"]

pipeline:
  retryPreset: default          # default | fast | subscription
  maxConcurrent: 3

provider:
  type: anthropic              # anthropic | bedrock | vertex | custom

models:
  small: haiku
  medium: sonnet
  large: opus
```

Generate a config template:
```bash
pentem config init
```

## Pipeline Phases

| Phase | Activities | Description |
|-------|-----------|-------------|
| **Pre-Recon** | nmap, subfinder, WhatWeb, source analysis | Network scanning, subdomain discovery, fingerprinting |
| **Recon** | Browser exploration (Playwright), API mapping | Interactive mapping of the application |
| **Vulnerability** | SQLi, XSS, Auth Bypass, Authz Bypass, SSRF (parallel) | Agent-driven vulnerability discovery |
| **Exploitation** | SQLi, XSS, Auth Bypass, Authz Bypass, SSRF (parallel) | Agent-driven exploitation of confirmed findings |
| **Report** | Report assembly | Generates a comprehensive markdown report |

## Development

```bash
pnpm install
pnpm build          # build all packages
pnpm build:cli      # build only CLI
pnpm build:worker   # build only worker
pnpm typecheck      # type-check all packages
pnpm lint           # auto-fix lint issues
pnpm lint:check     # check lint only
pnpm clean          # remove dist directories
```

### Local Development Mode

```bash
export PENTEM_LOCAL=1
pnpm build:worker
pentem scan https://target-app.com
```

This builds the worker image locally and runs the full stack via Docker Compose.
