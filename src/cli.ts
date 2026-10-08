#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { packRepository, OutputFormat } from './core/packer.js';
import { startMcpServer } from './mcp/server.js';
import { copyToClipboard } from './core/clipboard.js';

interface CliArgs {
  targetDir: string;
  outputFile?: string;
  format: OutputFormat;
  maxTokens?: number;
  treeOnly: boolean;
  clipboard: boolean;
  mcp: boolean;
  noSecretsRedaction: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    targetDir: '.',
    format: 'xml',
    treeOnly: false,
    clipboard: false,
    mcp: false,
    noSecretsRedaction: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.version = true;
    } else if (arg === '--mcp') {
      result.mcp = true;
    } else if (arg === '--tree' || arg === '-t') {
      result.treeOnly = true;
    } else if (arg === '--clipboard' || arg === '-c') {
      result.clipboard = true;
    } else if (arg === '--no-redact') {
      result.noSecretsRedaction = true;
    } else if (arg === '--format' || arg === '-f') {
      const val = args[++i];
      if (val === 'xml' || val === 'markdown' || val === 'json') {
        result.format = val;
      }
    } else if (arg === '--max-tokens' || arg === '-m') {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val)) result.maxTokens = val;
    } else if (arg === '--out' || arg === '-o') {
      result.outputFile = args[++i];
    } else if (!arg.startsWith('-')) {
      result.targetDir = arg;
    }
  }

  return result;
}

function printHelp() {
  console.log(`
\x1b[1m\x1b[36m⚡ repoflux\x1b[0m — High-speed repo bundler & MCP context engine for LLMs

\x1b[1mUSAGE:\x1b[0m
  $ npx repoflux [path] [options]

\x1b[1mOPTIONS:\x1b[0m
  -o, --out <file>        Save output to file (default: repoflux-output.<format>)
  -f, --format <format>   Output format: xml, markdown, json (default: xml)
  -m, --max-tokens <num>  Cap context budget at N tokens
  -t, --tree              Only generate directory tree with token distribution
  -c, --clipboard         Copy generated context directly to clipboard
      --mcp               Run as a Model Context Protocol stdio server for Claude/Cursor
      --no-redact         Disable automatic secret / API key redaction
  -h, --help              Show help information
  -v, --version           Show version

\x1b[1mEXAMPLES:\x1b[0m
  $ npx repoflux                     # Bundle current repo into repoflux-output.xml
  $ npx repoflux -c                  # Bundle and copy directly to clipboard
  $ npx repoflux --tree              # Inspect token footprint per file
  $ npx repoflux -f markdown -o ctx.md # Pack as clean Markdown
  $ npx repoflux --mcp               # Connect to Claude Desktop or Cursor MCP
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    console.log('1.1.0');
    process.exit(0);
  }

  if (args.mcp) {
    startMcpServer(path.resolve(args.targetDir));
    return;
  }

  const targetPath = path.resolve(args.targetDir);
  console.log(`\x1b[36m⚡ Analyzing codebase:\x1b[0m ${targetPath}`);

  const start = Date.now();
  const result = await packRepository({
    rootDir: targetPath,
    format: args.format,
    maxTokens: args.maxTokens,
    redactSecrets: !args.noSecretsRedaction,
  });
  const elapsed = Date.now() - start;

  if (args.treeOnly) {
    console.log('\n\x1b[1mDirectory Structure & Token Weight:\x1b[0m\n');
    console.log(result.tree);
    console.log(`\n\x1b[32m✔ Analyzed ${result.totalFiles} files in ${elapsed}ms\x1b[0m`);
    return;
  }

  if (result.secretDetections.length > 0) {
    console.log(`\x1b[33m⚠️ Redacted ${result.secretDetections.length} secrets/credentials for security\x1b[0m`);
  }

  const ext = args.format === 'markdown' ? 'md' : args.format;
  const outPath = path.resolve(args.outputFile || `repoflux-output.${ext}`);

  fs.writeFileSync(outPath, result.output, 'utf8');

  console.log(`\x1b[32m✔ Bundled ${result.totalFiles} files into \x1b[1m${path.basename(outPath)}\x1b[0m (${(result.totalBytes / 1024).toFixed(1)} KB)`);
  console.log(`\x1b[36m📊 Estimated context size:\x1b[0m ~${result.totalTokens.toLocaleString()} tokens`);

  if (args.clipboard) {
    const copied = await copyToClipboard(result.output);
    if (copied) {
      console.log(`\x1b[35m📋 Copied context directly to system clipboard!\x1b[0m`);
    } else {
      console.log(`\x1b[33m⚠️ Could not access system clipboard\x1b[0m`);
    }
  }

  console.log(`\x1b[90m⏱ Completed in ${elapsed}ms\x1b[0m`);

  if (result.budgetExceeded) {
    console.log(`\x1b[33m⚠️ Context truncated to stay within max token budget (${args.maxTokens})\x1b[0m`);
  }
}

main().catch((err) => {
  console.error('\x1b[31mError:\x1b[0m', err.message);
  process.exit(1);
});
