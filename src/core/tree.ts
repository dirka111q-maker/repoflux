import * as path from 'node:path';

export interface FileEntrySummary {
  relPath: string;
  sizeBytes: number;
  tokens: number;
}

interface TreeNode {
  name: string;
  isDir: boolean;
  sizeBytes?: number;
  tokens?: number;
  children: Map<string, TreeNode>;
}

export function generateAsciiTree(entries: FileEntrySummary[]): string {
  const root: TreeNode = {
    name: '.',
    isDir: true,
    children: new Map(),
  };

  // Build tree
  for (const entry of entries) {
    const parts = entry.relPath.replace(/\\/g, '/').split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          isDir: !isLast,
          sizeBytes: isLast ? entry.sizeBytes : undefined,
          tokens: isLast ? entry.tokens : undefined,
          children: new Map(),
        });
      }
      current = current.children.get(part)!;
    }
  }

  const lines: string[] = ['.'];
  renderNode(root, '', lines);
  return lines.join('\n');
}

function renderNode(node: TreeNode, prefix: string, lines: string[]) {
  const entries = Array.from(node.children.values()).sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });

  for (let i = 0; i < entries.length; i++) {
    const item = entries[i];
    const isLastChild = i === entries.length - 1;
    const branch = isLastChild ? '└── ' : '├── ';
    const nextPrefix = prefix + (isLastChild ? '    ' : '│   ');

    if (item.isDir) {
      lines.push(`${prefix}${branch}${item.name}/`);
      renderNode(item, nextPrefix, lines);
    } else {
      const tokenStr = item.tokens !== undefined ? ` (~${item.tokens.toLocaleString()} tokens)` : '';
      lines.push(`${prefix}${branch}${item.name}${tokenStr}`);
    }
  }
}
