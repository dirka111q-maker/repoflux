<p align="center">
  <h1 align="center">⚡ repoflux</h1>
  <p align="center">
    <strong>Lightning-fast, AST-aware repository bundler & live MCP context server for AI pair programming.</strong>
  </p>
  <p align="center">
    <a href="https://github.com/apple-sauce/repoflux/actions"><img src="https://img.shields.io/badge/build-passing-brightgreen?style=flat-square" alt="Build Status"></a>
    <a href="https://www.npmjs.com/package/repoflux"><img src="https://img.shields.io/badge/npm-v1.0.0-blue?style=flat-square" alt="NPM Version"></a>
    <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-purple?style=flat-square" alt="MCP Compatible"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  </p>
</p>

---

**repoflux** solves the single biggest bottleneck in LLM-assisted software engineering: **context overhead and safety**.

Feeding messy codebases into ChatGPT, Codex, Claude, or Cursor causes truncation, prompt inflation, and catastrophic API key leaks. **repoflux** analyzes your repository in milliseconds, maps token weights, scrubs leaked credentials, and compiles a clean, token-budgeted representation.

It also doubles as a native **Model Context Protocol (MCP)** server, giving Claude Desktop, Cursor, and agentic IDEs direct live access to your codebase.

---

## 🚀 Quick Start

Run instantly without installation:

```bash
# Bundle your current repository into an LLM-ready context
npx repoflux

# Preview directory structure with token weights
npx repoflux --tree

# Output as clean Markdown with a 32,000 token budget cap
npx repoflux -f markdown -m 32000 -o prompt_context.md
```

Or install globally:

```bash
npm install -g repoflux
```

---

## ✨ Features

- 🏎️ **Zero-Dependency Core:** Pure TypeScript engine running at sub-60ms speeds across multi-thousand file repositories.
- 🔒 **Automated Secret Redaction:** Automatically detects and redacts OpenAI, Anthropic, AWS, Slack, GitHub, Stripe tokens, JWTs, and private keys before LLMs see them.
- 📊 **Token-Aware Tree:** Visualizes file weights and distribution so you can trim bloated files before pasting into ChatGPT/Codex.
- 🎯 **Token Budgeting:** Specify `--max-tokens` to guarantee your bundle never exceeds model context windows (e.g., 32k, 128k, 200k).
- 🧩 **Native MCP Server:** Run `repoflux --mcp` to expose `get_repo_map`, `pack_codebase`, and `audit_secrets` directly to Claude Desktop & Cursor.
- 🛡️ **Intelligent .gitignore:** Automatically respects `.gitignore` rules and rejects binary files, lockfiles, node_modules, and build outputs.

---

## 🛠️ CLI Options

| Flag | Short | Description | Default |
|---|---|---|---|
| `--out` | `-o` | Output file path | `repoflux-output.<format>` |
| `--format` | `-f` | Format (`xml`, `markdown`, `json`) | `xml` |
| `--max-tokens` | `-m` | Maximum context token budget limit | Unlimited |
| `--tree` | `-t` | Print directory tree with token allocations | `false` |
| `--mcp` | | Launch MCP JSON-RPC server over stdio | `false` |
| `--no-redact` | | Disable automatic API key/secret masking | `false` |
| `--help` | `-h` | Display usage instructions | |

---

## 🔌 Using with Claude Desktop & Cursor (MCP)

Add **repoflux** to your `claude_desktop_config.json` or Cursor MCP settings:

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

Now Claude or Codex can invoke:
- `get_repo_map`: Read the token footprint of any directory.
- `pack_codebase`: Pull clean, token-bounded codebase snapshots into the chat.
- `audit_secrets`: Check for hardcoded API keys and credentials in PRs.

---

## 🧪 Development & Testing

```bash
# Clone the repository
git clone https://github.com/apple-sauce/repoflux.git
cd repoflux

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run unit tests
npm test
```

---

## 📄 License

MIT © [apple sauce](LICENSE)
