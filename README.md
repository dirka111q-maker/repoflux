# repoflux

Deterministic repository context bundler and Model Context Protocol (MCP) server for language model workflows.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)](https://github.com/dirka111q-maker/repoflux/actions)
[![NPM Version](https://img.shields.io/badge/npm-v1.2.0-blue?style=flat-square)](https://www.npmjs.com/package/repoflux)
[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-purple?style=flat-square)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

repoflux packages entire codebases into structured, token-bounded context payloads for Claude, OpenAI Codex, Cursor, and ChatGPT. It scans repositories, parses AST declarations, calculates exact BPE token weights, strips credentials, and hosts an stdio MCP server for agentic IDEs.

---

## Installation & Quick Start

Execute directly via npx:

```bash
# Bundle repository into default XML context
npx repoflux

# Copy prompt context directly to clipboard
npx repoflux -c

# Extract symbol outlines (functions, classes, interfaces) without loading file bodies
npx repoflux -s

# Only pack files changed in uncommitted git diff
npx repoflux -d

# Generate interactive HTML report with token distributions
npx repoflux --html

# Inspect project dependencies across Node, Rust, Python, Go
npx repoflux --deps

# Run live watch mode to regenerate bundle on file save
npx repoflux -w
```

Or install globally:

```bash
npm install -g repoflux
```

---

## Technical Capabilities

- **Zero-Dependency Architecture:** Written in native TypeScript with no external runtime dependencies, providing sub-50ms execution.
- **Symbol Outline Extraction (`-s`):** Parses declarations and function signatures across TypeScript, JavaScript, Python, Go, and Rust without bloating context windows.
- **Git Diff Scoping (`-d`):** Isolates uncommitted changes or recent commit deltas for pull request code reviews.
- **Automated Credential Redaction:** Scans files against regex patterns for OpenAI, Anthropic, AWS, GitHub, Stripe, and private keys, replacing them with redaction placeholders.
- **Deterministic Token Budgeting (`-m`):** Estimates BPE subword tokens using cl100k/o200k calibrated heuristics and enforces hard budget ceilings.
- **Model Context Protocol (MCP):** Connects to Claude Desktop, Codex, and Cursor as an stdio server with tools for repo mapping, symbol inspection, and diff analysis.
- **HTML Visualizer (`--html`):** Compiles an offline, single-file HTML report with token distribution statistics and code trees.
- **Exclusion Engine:** Parses `.gitignore` and `.repofluxignore` alongside standard build and binary file exclusions.

---

## Command-Line Interface

| Option | Flag | Description | Default |
|---|---|---|---|
| `--out` | `-o` | Output file path | `repoflux-output.<format>` |
| `--format` | `-f` | Serialization format (`xml`, `markdown`, `json`) | `xml` |
| `--max-tokens` | `-m` | Hard token budget limit | Unlimited |
| `--clipboard` | `-c` | Copy output bundle directly to system clipboard | `false` |
| `--outline` | `-s` | Extract function and class signatures only | `false` |
| `--diff` | `-d` | Filter bundle to modified files from git diff | `false` |
| `--deps` | | Print dependency graph across package manifests | `false` |
| `--html` | | Generate self-contained HTML inspection report | `false` |
| `--watch` | `-w` | Watch filesystem and re-bundle on save | `false` |
| `--prompt` | `-p` | Prepend custom instructions or system prompt | None |
| `--tree` | `-t` | Print directory tree with token distribution | `false` |
| `--mcp` | | Launch MCP JSON-RPC server over stdio | `false` |
| `--no-redact` | | Disable automatic credential sanitization | `false` |

---

## Model Context Protocol (MCP) Configuration

Add repoflux to `claude_desktop_config.json` or your Cursor MCP settings:

```json
{
  "mcpServers": {
    "repoflux": {
      "command": "npx",
      "args": ["-y", "repoflux", "--mcp"]
    }
  }
}
```

### Available MCP Tools

- `get_repo_map`: Returns ASCII directory tree with per-file token allocations.
- `pack_codebase`: Returns full sanitized repository context bounded by token limits.
- `get_symbol_outline`: Returns AST function and class outlines.
- `get_git_diff`: Extracts current diff for review workflows.
- `get_dependencies`: Returns dependency manifest details.
- `audit_secrets`: Audits repository files for leaked credentials.

---

## Test Suite & Verification

```bash
# Build TypeScript
npm run build

# Run native test runner
npm test
```

---

## License

MIT License (c) 2026 apple sauce
