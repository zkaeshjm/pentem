# Pentem — Autonomous Agentic AI & Manual Penetration Testing Framework

```
  ██████╗ ███████╗███╗   ██╗████████╗███████╗███╗   ███╗
  ██╔══██╗██╔════╝████╗  ██║╚══██╔══╝██╔════╝████╗ ████║
  ██████╔╝█████╗  ██╔██╗ ██║   ██║   █████╗  ██╔████╔██║
  ██╔═══╝ ██╔══╝  ██║╚██╗██║   ██║   ██╔══╝  ██║╚██╔╝██║
  ██║     ███████╗██║ ╚████║   ██║   ███████╗██║ ╚═╝ ██║
  ╚═╝     ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝     ╚═╝
```

Pentem is an **autonomous penetration testing framework** with two modes:

- **🤖 Agentic AI Mode** — Uses LLM agents (Anthropic Claude / OpenAI GPT-4o) to autonomously probe, analyze, and exploit vulnerabilities
- **🔧 Manual Mode** — No API key needed. Built-in HTTP crawler + pattern scanner checks headers, paths, SQLi, XSS

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
# Install
.\scripts\install.ps1

# Launch TUI (interactive)
pentem

# Manual scan (no API key needed)
pentem scan --manual https://example.com

# AI agentic scan (set API key first)
$env:ANTHROPIC_API_KEY = "sk-ant-..."
pentem scan https://example.com
```

---

## Terminal UI

```
┌─────────────────────────────────────────────────────────────────┐
│  ██████╗ ███████╗███╗   ██╗████████╗███████╗███╗   ███╗       │
│  ██╔══██╗██╔════╝████╗  ██║╚══██╔══╝██╔════╝████╗ ████║       │
│  Agentic AI & Manual Penetration Tester     v0.1.0              │
├─────────────────────────────────────────────────────────────────┤
│ [1] Dashboard  [2] Scans  [3] Reports  [4] Config               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ╔═══════════════════════════════════════════════╗              │
│   ║          Pentem — Choose Your Mode           ║              │
│   ╠═══════════════════════════════════════════════╣              │
│   ║  [1] Agentic AI —  Requires an LLM API key   ║              │
│   ║      The AI agent autonomously analyzes,     ║              │
│   ║      probes, and exploits vulnerabilities    ║              │
│   ║                                               ║              │
│   ║  [2] Manual —  No API key needed             ║              │
│   ║      Built-in HTTP crawler + pattern scanner  ║              │
│   ║      Checks headers, paths, SQLi, XSS        ║              │
│   ║                                               ║              │
│   ║  [3] Config —  View/edit configuration       ║              │
│   ╚═══════════════════════════════════════════════╝              │
│                                                                  │
│   Press 1, 2, or 3 to continue.                                 │
├─────────────────────────────────────────────────────────────────┤
│ Select mode — [1] Agentic AI  [2] Manual  [3] Config            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

### 🤖 Agentic AI Mode
| Feature | Description |
|---------|-------------|
| **Autonomous scanning** | AI agents probe, analyze, and exploit targets across 5 phases |
| **Multiple LLM providers** | Anthropic Claude, OpenAI GPT-4o, any OpenAI-compatible provider |
| **Model selection** | Choose from available models or enter custom model name |
| **Phases** | Pre-recon → Recon → Vulnerability Analysis → Exploitation → Report |
| **Vulnerability types** | SQLi, XSS, Auth Bypass, Authorization Bypass, SSRF |
| **Progress tracking** | Real-time agent progress shown in TUI and CLI |

### 🔧 Manual Mode (No AI)
| Feature | Description |
|---------|-------------|
| **Zero dependencies** | No API key, no Docker, no setup required |
| **HTTP crawler** | Probes 28+ common paths (admin, api, .env, backup, etc.) |
| **Security headers** | Checks HSTS, CSP, X-Frame-Options, X-Content-Type-Options, etc. |
| **SQL injection** | Tests 5+ SQLi patterns and detects indicators |
| **XSS detection** | Tests reflected XSS with multiple payloads |
| **Technology fingerprinting** | Detects server, framework, cookies |
| **40+ HTTP requests** | Full request/response log captured |

### 📊 Reports & Logging
| Feature | Command |
|---------|---------|
| **View full report** | `pentem report <session-id>` |
| **View raw request logs** | `pentem report <session-id> --logs` |
| **Save report to file** | `pentem report <session-id> --output ./report.md` |
| **Save all session data** | `pentem report <session-id> --save ./output-dir` |
| **Save during scan** | `pentem scan --manual <url> --save-logs ./logs` |
| **Export during scan** | `pentem scan --manual <url> --output ./report.md` |

---

## Commands

```powershell
# TUI
pentem                          # Launch the Terminal UI
pentem tui                      # Launch the Terminal UI

# Scanning
pentem scan <url>               # AI agentic scan (needs API key)
pentem scan --manual <url>      # Manual scan (no API key)
pentem scan --manual <url> --output ./report.md    # Save report
pentem scan --manual <url> --save-logs ./logs      # Save all logs

# Session management
pentem list                     # List all scan sessions
pentem status <session-id>      # Check scan status
pentem report <session-id>      # View full report in terminal
pentem report <session-id> --logs    # View raw HTTP request logs
pentem report <session-id> --output ./report.md   # Save to file
pentem report <session-id> --save ./output         # Save all data
pentem resume <session-id>      # Resume a scan

# Configuration
pentem config validate          # Validate YAML config
pentem config init              # Create config template
```

---

## AI Provider Setup

### Option 1: Environment variables
```powershell
# Anthropic (recommended)
$env:ANTHROPIC_API_KEY = "sk-ant-..."
$env:ANTHROPIC_MODEL = "claude-sonnet-4-20250514"

# OpenAI / compatible
$env:OPENAI_API_KEY = "sk-..."
$env:OPENAI_MODEL = "gpt-4o"
$env:OPENAI_BASE_URL = "https://api.openai.com/v1"  # optional
```

### Option 2: TUI (interactive)
1. Run `pentem`
2. Press `1` (Anthropic) or `2` (OpenAI)
3. Paste your API key
4. Select or type a model name
5. Config is saved to `~/.pentem/config.yaml` for next launch

---

## Manual Scan Output Example

```
╔══════════════════════════════════════════╗
║    Pentem Manual Security Scan          ║
╚══════════════════════════════════════════╝
  Target: https://example.com

  Probing 28 common paths...
    /robots.txt      404  /admin  404  /api  404  ...
    Done — 0 exposed path(s) found

  Testing 5 SQL injection patterns...
    No SQL injection indicators detected

  Testing 4 XSS patterns...
    No XSS indicators detected
  ───────────────────────────────────────
  Findings: 3 MEDIUM, 6 LOW
    🟡 Missing HSTS header
    🟡 Missing CSP header
    🟡 Missing X-Frame-Options header
    🔵 Server: cloudflare
    ...
```

---

## Architecture

### Standalone Windows EXE
A prebuilt `pentem.exe` (~87 MB) is available on [GitHub Releases](https://github.com/zkaeshjm/pentem/releases).
No Node.js installation required — the EXE bundles the entire Node.js runtime and all dependencies.

Build it yourself with:
```powershell
.\scripts\build-exe.ps1
```

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
│  │           Providers Config + Persistence            │ │
│  │  (ANTHROPIC_API_KEY / OPENAI_API_KEY → config.yaml) │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

---

## License

MIT
