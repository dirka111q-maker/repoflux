import * as fs from 'node:fs';
import * as path from 'node:path';
import { IgnoreFilter } from './ignore.js';
import { estimateTokens } from './tokenizer.js';
import { sanitizeSecrets, SecretMatch } from './secrets.js';
import { generateAsciiTree, FileEntrySummary } from './tree.js';

import { extractSymbols, formatOutline } from './symbols.js';

export type OutputFormat = 'markdown' | 'xml' | 'json';

export interface PackOptions {
  rootDir: string;
  format?: OutputFormat;
  maxTokens?: number;
  redactSecrets?: boolean;
  customIgnores?: string[];
  includePatterns?: string[];
  outlineOnly?: boolean;
  prependPrompt?: string;
  diffFiles?: string[];
}

export interface PackResult {
  output: string;
  totalFiles: number;
  totalTokens: number;
  totalBytes: number;
  tree: string;
  secretDetections: Array<{ file: string; matches: SecretMatch[] }>;
  budgetExceeded: boolean;
}

export async function packRepository(options: PackOptions): Promise<PackResult> {
  const rootDir = path.resolve(options.rootDir);
  const format = options.format || 'xml';
  const maxTokens = options.maxTokens ?? Infinity;
  const redactSecrets = options.redactSecrets ?? true;

  const ignoreFilter = new IgnoreFilter(rootDir);
  if (options.customIgnores) {
    ignoreFilter.addPatterns(options.customIgnores);
  }

  const fileSummaries: FileEntrySummary[] = [];
  const packedFiles: Array<{ relPath: string; content: string; tokens: number }> = [];
  const secretDetections: Array<{ file: string; matches: SecretMatch[] }> = [];

  // Recursive directory crawler
  function scan(dir: string) {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      const relPath = path.relative(rootDir, fullPath);

      if (ignoreFilter.ignores(relPath)) {
        continue;
      }

      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (stat.isFile()) {
        // Quick binary check (look for null bytes in first 1024 bytes)
        const fd = fs.openSync(fullPath, 'r');
        const buffer = Buffer.alloc(Math.min(1024, stat.size));
        fs.readSync(fd, buffer, 0, buffer.length, 0);
        fs.closeSync(fd);

        if (buffer.includes(0)) {
          // Binary file, skip content
          continue;
        }

        try {
          let content = fs.readFileSync(fullPath, 'utf8');

          let matches: SecretMatch[] = [];
          if (redactSecrets) {
            const res = sanitizeSecrets(content);
            content = res.sanitized;
            matches = res.detections;
          }

          if (matches.length > 0) {
            secretDetections.push({ file: relPath, matches });
          }

          const tokens = estimateTokens(content);
          fileSummaries.push({ relPath, sizeBytes: stat.size, tokens });
          packedFiles.push({ relPath, content, tokens });
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  scan(rootDir);

  // Filter by diff if diffFiles provided
  let filesToProcess = packedFiles;
  if (options.diffFiles && options.diffFiles.length > 0) {
    const normDiffs = new Set(options.diffFiles.map((f) => f.replace(/\\/g, '/')));
    filesToProcess = packedFiles.filter((f) => normDiffs.has(f.relPath.replace(/\\/g, '/')));
  }

  const tree = generateAsciiTree(fileSummaries);

  // If outlineOnly, extract symbols instead of full content
  if (options.outlineOnly) {
    const outlines = filesToProcess.map((f) => extractSymbols(f.relPath, f.content));
    const outlineOutput = formatOutline(outlines);
    return {
      output: options.prependPrompt ? `${options.prependPrompt}\n\n${outlineOutput}` : outlineOutput,
      totalFiles: filesToProcess.length,
      totalTokens: estimateTokens(outlineOutput),
      totalBytes: Buffer.byteLength(outlineOutput, 'utf8'),
      tree,
      secretDetections,
      budgetExceeded: false,
    };
  }

  // Sort files predictably
  filesToProcess.sort((a, b) => a.relPath.localeCompare(b.relPath));
  fileSummaries.sort((a, b) => a.relPath.localeCompare(b.relPath));

  let currentTokenCount = estimateTokens(tree);
  let totalBytes = 0;
  let budgetExceeded = false;
  const includedFiles: typeof filesToProcess = [];

  for (const file of filesToProcess) {
    totalBytes += Buffer.byteLength(file.content, 'utf8');
    if (currentTokenCount + file.tokens > maxTokens) {
      budgetExceeded = true;
      break;
    }
    currentTokenCount += file.tokens;
    includedFiles.push(file);
  }

  let output = '';

  if (format === 'xml') {
    output = formatXml(rootDir, tree, includedFiles, budgetExceeded, maxTokens);
  } else if (format === 'json') {
    output = JSON.stringify(
      {
        repository: path.basename(rootDir),
        stats: {
          totalFiles: includedFiles.length,
          estimatedTokens: currentTokenCount,
          budgetExceeded,
        },
        tree,
        files: includedFiles.map((f) => ({ path: f.relPath, tokens: f.tokens, content: f.content })),
      },
      null,
      2
    );
  } else {
    output = formatMarkdown(rootDir, tree, includedFiles, budgetExceeded, maxTokens);
  }

  if (options.prependPrompt) {
    output = `${options.prependPrompt}\n\n${output}`;
  }

  return {
    output,
    totalFiles: includedFiles.length,
    totalTokens: estimateTokens(output),
    totalBytes,
    tree,
    secretDetections,
    budgetExceeded,
  };
}

function formatXml(
  rootDir: string,
  tree: string,
  files: Array<{ relPath: string; content: string }>,
  budgetExceeded: boolean,
  maxTokens: number
): string {
  const parts: string[] = [];
  parts.push(`<repository name="${path.basename(rootDir)}">`);
  parts.push(`  <summary>`);
  parts.push(`    <files_count>${files.length}</files_count>`);
  if (budgetExceeded) {
    parts.push(`    <notice>Token budget (${maxTokens}) reached. Truncated remaining files.</notice>`);
  }
  parts.push(`  </summary>`);
  parts.push(`  <directory_structure>`);
  parts.push(`<![CDATA[\n${tree}\n]]>`);
  parts.push(`  </directory_structure>`);
  parts.push(`  <files>`);

  for (const f of files) {
    parts.push(`    <file path="${f.relPath}">`);
    parts.push(`<![CDATA[\n${f.content}\n]]>`);
    parts.push(`    </file>`);
  }

  parts.push(`  </files>`);
  parts.push(`</repository>`);
  return parts.join('\n');
}

function formatMarkdown(
  rootDir: string,
  tree: string,
  files: Array<{ relPath: string; content: string }>,
  budgetExceeded: boolean,
  maxTokens: number
): string {
  const parts: string[] = [];
  parts.push(`# Repository Context: ${path.basename(rootDir)}\n`);
  if (budgetExceeded) {
    parts.push(`> ⚠️ **Notice**: Truncated at token budget limit of ${maxTokens.toLocaleString()} tokens.\n`);
  }
  parts.push(`## Directory Tree\n\`\`\`\n${tree}\n\`\`\`\n`);
  parts.push(`## Files Content\n`);

  for (const f of files) {
    const ext = path.extname(f.relPath).slice(1) || 'txt';
    parts.push(`### \`${f.relPath}\`\n\`\`\`${ext}\n${f.content}\n\`\`\`\n`);
  }

  return parts.join('\n');
}
