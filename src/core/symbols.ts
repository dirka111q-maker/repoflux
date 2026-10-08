import * as path from 'node:path';

export interface SymbolOutline {
  file: string;
  symbols: Array<{
    kind: 'function' | 'class' | 'interface' | 'type' | 'export' | 'def' | 'struct';
    name: string;
    line: number;
    signature: string;
  }>;
}

/**
 * Fast regex-based symbol and declaration extractor across common languages:
 * TypeScript, JavaScript, Python, Go, Rust.
 */
export function extractSymbols(filePath: string, content: string): SymbolOutline {
  const ext = path.extname(filePath).toLowerCase();
  const lines = content.split('\n');
  const symbols: SymbolOutline['symbols'] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//') || line.startsWith('#') || line.startsWith('/*')) {
      continue;
    }

    const lineNum = i + 1;

    // TypeScript / JavaScript
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) {
      if (line.match(/^export\s+(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/)) {
        const name = RegExp.$1;
        symbols.push({ kind: 'function', name, line: lineNum, signature: line.slice(0, 100) });
      } else if (line.match(/^(?:export\s+)?(?:abstract\s+)?class\s+([a-zA-Z0-9_$]+)/)) {
        const name = RegExp.$1;
        symbols.push({ kind: 'class', name, line: lineNum, signature: line.slice(0, 100) });
      } else if (line.match(/^(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)/)) {
        const name = RegExp.$1;
        symbols.push({ kind: 'interface', name, line: lineNum, signature: line.slice(0, 100) });
      } else if (line.match(/^(?:export\s+)?type\s+([a-zA-Z0-9_$]+)\s*=/)) {
        const name = RegExp.$1;
        symbols.push({ kind: 'type', name, line: lineNum, signature: line.slice(0, 100) });
      } else if (line.match(/^export\s+(?:const|let|var)\s+([a-zA-Z0-9_$]+)/)) {
        const name = RegExp.$1;
        symbols.push({ kind: 'export', name, line: lineNum, signature: line.slice(0, 100) });
      }
    }

    // Python
    if (ext === '.py') {
      if (line.match(/^def\s+([a-zA-Z0-9_]+)\s*\(/)) {
        const name = RegExp.$1;
        symbols.push({ kind: 'def', name, line: lineNum, signature: line.slice(0, 100) });
      } else if (line.match(/^class\s+([a-zA-Z0-9_]+)/)) {
        const name = RegExp.$1;
        symbols.push({ kind: 'class', name, line: lineNum, signature: line.slice(0, 100) });
      }
    }

    // Go
    if (ext === '.go') {
      if (line.match(/^func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)\s*\(/)) {
        const name = RegExp.$1;
        symbols.push({ kind: 'function', name, line: lineNum, signature: line.slice(0, 100) });
      } else if (line.match(/^type\s+([a-zA-Z0-9_]+)\s+struct/)) {
        const name = RegExp.$1;
        symbols.push({ kind: 'struct', name, line: lineNum, signature: line.slice(0, 100) });
      } else if (line.match(/^type\s+([a-zA-Z0-9_]+)\s+interface/)) {
        const name = RegExp.$1;
        symbols.push({ kind: 'interface', name, line: lineNum, signature: line.slice(0, 100) });
      }
    }

    // Rust
    if (ext === '.rs') {
      if (line.match(/^(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/)) {
        const name = RegExp.$1;
        symbols.push({ kind: 'function', name, line: lineNum, signature: line.slice(0, 100) });
      } else if (line.match(/^(?:pub\s+)?struct\s+([a-zA-Z0-9_]+)/)) {
        const name = RegExp.$1;
        symbols.push({ kind: 'struct', name, line: lineNum, signature: line.slice(0, 100) });
      }
    }
  }

  return { file: filePath, symbols };
}

export function formatOutline(outlines: SymbolOutline[]): string {
  const lines: string[] = ['# Codebase Symbol Outline\n'];

  for (const outline of outlines) {
    if (outline.symbols.length === 0) continue;
    lines.push(`## ${outline.file}`);
    for (const sym of outline.symbols) {
      lines.push(`- [L${sym.line}] ${sym.kind} ${sym.name}: \`${sym.signature}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}
