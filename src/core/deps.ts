import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DependencyOverview {
  ecosystem: string;
  manifestFile: string;
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export function detectDependencies(rootDir: string): DependencyOverview[] {
  const overviews: DependencyOverview[] = [];

  // Node (package.json)
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      overviews.push({
        ecosystem: 'Node / JavaScript',
        manifestFile: 'package.json',
        dependencies: data.dependencies || {},
        devDependencies: data.devDependencies || {},
      });
    } catch {
      // Ignore parse failure
    }
  }

  // Rust (Cargo.toml)
  const cargoPath = path.join(rootDir, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    try {
      const content = fs.readFileSync(cargoPath, 'utf8');
      const deps: Record<string, string> = {};
      const lines = content.split('\n');
      let inDeps = false;
      for (const line of lines) {
        if (line.startsWith('[dependencies]')) {
          inDeps = true;
          continue;
        } else if (line.startsWith('[')) {
          inDeps = false;
        }
        if (inDeps && line.includes('=')) {
          const [k, v] = line.split('=').map((s) => s.trim());
          if (k && v) deps[k] = v.replace(/["']/g, '');
        }
      }
      overviews.push({
        ecosystem: 'Rust / Cargo',
        manifestFile: 'Cargo.toml',
        dependencies: deps,
      });
    } catch {
      // Ignore
    }
  }

  // Python (requirements.txt)
  const reqPath = path.join(rootDir, 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    try {
      const content = fs.readFileSync(reqPath, 'utf8');
      const deps: Record<string, string> = {};
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split(/[=<>~]/);
          deps[parts[0].trim()] = parts.slice(1).join('') || 'latest';
        }
      }
      overviews.push({
        ecosystem: 'Python / pip',
        manifestFile: 'requirements.txt',
        dependencies: deps,
      });
    } catch {
      // Ignore
    }
  }

  return overviews;
}

export function formatDependencies(overviews: DependencyOverview[]): string {
  if (overviews.length === 0) return 'No manifest files detected.';
  const lines: string[] = ['# Project Dependencies Manifest\n'];

  for (const item of overviews) {
    lines.push(`## ${item.ecosystem} (${item.manifestFile})`);
    const runtimeEntries = Object.entries(item.dependencies);
    if (runtimeEntries.length > 0) {
      lines.push('### Production:');
      for (const [name, ver] of runtimeEntries) {
        lines.push(`- ${name}: \`${ver}\``);
      }
    }
    if (item.devDependencies && Object.keys(item.devDependencies).length > 0) {
      lines.push('### Development:');
      for (const [name, ver] of Object.entries(item.devDependencies)) {
        lines.push(`- ${name}: \`${ver}\``);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
