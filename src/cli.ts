#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { packRepository, OutputFormat } from './core/packer.js';
import { startMcpServer } from './mcp/server.js';
import { copyToClipboard } from './core/clipboard.js';
import { getRepositoryDiff } from './core/gitdiff.js';
import { detectDependencies, formatDependencies } from './core/deps.js';
import { generateHtmlReport } from './core/html.js';

interface CliArgs {
  targetDir: string;
  outputFile?: string;
  format: OutputFormat;
  maxTokens?: number;
  treeOnly: boolean;
  outlineOnly: boolean;
  diffOnly: boolean;
  depsOnly: boolean;
  htmlReport: boolean;
  watchMode: boolean;
  prependPrompt?: string;
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
    outlineOnly: false,
    diffOnly: false,
    depsOnly: false,
    htmlReport: false,
    watchMode: false,
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
    } else if (arg === '--outline' || arg === '-s') {
      result.outlineOnly = true;
    } else if (arg === '--diff' || arg === '-d') {
      result.diffOnly = true;
    } else if (arg === '--deps') {
      result.depsOnly = true;
    } else if (arg === '--html') {
      result.htmlReport = true;
    } else if (arg === '--watch' || arg === '-w') {
      result.watchMode = true;
    } else if (arg === '--clipboard' || arg === '-c') {
      result.clipboard = true;
    } else if (arg === '--no-redact') {
      result.noSecretsRedaction = true;
    } else if (arg === '--prompt' || arg === '-p') {
      result.prependPrompt = args[++i];
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
\x1b[1mrepoflux\x1b[0m — Codebase Context Bundler & MCP Stdio Server

USAGE:
  $ npx repoflux [path] [options]

CORE OPTIONS:
  -o, --out <file>        Save output to file (default: repoflux-output.<format>)
  -f, --format <format>   Output format: xml, markdown, json (default: xml)
  -m, --max-tokens <num>  Cap context budget at N tokens
  -c, --clipboard         Copy generated context directly to system clipboard
  -p, --prompt <text>     Prepend custom prompt instructions to bundle

ANALYSIS & MODES:
  -s, --outline           Extract symbol outline (functions, classes, exports)
  -d, --diff              Only bundle files modified in uncommitted git diff
      --deps              Print dependency graph across Node, Rust, Python, Go
      --html              Generate standalone interactive HTML report
  -t, --tree              Only generate directory tree with token distribution
  -w, --watch             Watch directory and re-bundle on file modification
      --mcp               Run as Model Context Protocol stdio server for LLMs
      --no-redact         Disable automatic secret / API key redaction

GENERAL:
  -h, --help              Show help information
  -v, --version           Show version
`);
}

async function runBundler(args: CliArgs) {
  const targetPath = path.resolve(args.targetDir);

  if (args.depsOnly) {
    const deps = detectDependencies(targetPath);
    console.log(formatDependencies(deps));
    return;
  }

  let diffFiles: string[] | undefined;
  if (args.diffOnly) {
    const diff = getRepositoryDiff(targetPath);
    if (!diff.hasDiff) {
      console.log('No uncommitted git changes detected.');
      return;
    }
    diffFiles = diff.filesChanged;
    console.log(`Bundling ${diffFiles.length} files from git diff.`);
  }

  const start = Date.now();
  const result = await packRepository({
    rootDir: targetPath,
    format: args.format,
    maxTokens: args.maxTokens,
    redactSecrets: !args.noSecretsRedaction,
    outlineOnly: args.outlineOnly,
    diffFiles,
    prependPrompt: args.prependPrompt,
  });
  const elapsed = Date.now() - start;

  if (args.treeOnly) {
    console.log('\nDirectory Structure & Token Weight:\n');
    console.log(result.tree);
    console.log(`\nAnalyzed ${result.totalFiles} files in ${elapsed}ms`);
    return;
  }

  if (result.secretDetections.length > 0) {
    console.log(`Notice: Redacted credentials in ${result.secretDetections.length} files`);
  }

  if (args.htmlReport) {
    const htmlOut = args.outputFile || 'repoflux-report.html';
    const htmlContent = generateHtmlReport(result, path.basename(targetPath));
    fs.writeFileSync(path.resolve(htmlOut), htmlContent, 'utf8');
    console.log(`Generated HTML report in ${htmlOut} (${(Buffer.byteLength(htmlContent, 'utf8') / 1024).toFixed(1)} KB)`);
    return;
  }

  const ext = args.format === 'markdown' ? 'md' : args.format;
  const outPath = path.resolve(args.outputFile || `repoflux-output.${ext}`);

  fs.writeFileSync(outPath, result.output, 'utf8');

  console.log(`Bundled ${result.totalFiles} files into ${path.basename(outPath)} (${(result.totalBytes / 1024).toFixed(1)} KB)`);
  console.log(`Estimated context size: ~${result.totalTokens.toLocaleString()} tokens`);

  if (args.clipboard) {
    const copied = await copyToClipboard(result.output);
    if (copied) {
      console.log('Copied context bundle to clipboard.');
    }
  }

  console.log(`Completed in ${elapsed}ms`);

  if (result.budgetExceeded) {
    console.log(`Notice: Context truncated to stay within max token budget (${args.maxTokens})`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    console.log('1.2.1');
    process.exit(0);
  }

  if (args.mcp) {
    startMcpServer(path.resolve(args.targetDir));
    return;
  }

  if (args.watchMode) {
    console.log(`Watching directory for changes: ${path.resolve(args.targetDir)}`);
    await runBundler(args);

    let debounceTimer: NodeJS.Timeout | null = null;
    fs.watch(path.resolve(args.targetDir), { recursive: true }, (_eventType, filename) => {
      if (!filename || filename.includes('repoflux-output') || filename.includes('dist') || filename.includes('.git')) {
        return;
      }
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log(`\nChange detected in ${filename}. Re-bundling...`);
        runBundler(args).catch(console.error);
      }, 300);
    });
    return;
  }

  await runBundler(args);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
