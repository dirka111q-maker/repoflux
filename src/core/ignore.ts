import * as fs from 'node:fs';
import * as path from 'node:path';

const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  'coverage',
  '.nyc_output',
  '*.log',
  '.repofluxignore',
  '.DS_Store',
  'Thumbs.db',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  '*.min.js',
  '*.min.css',
  '*.map',
  // Binary / Media files
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.svg',
  '*.ico',
  '*.webp',
  '*.pdf',
  '*.zip',
  '*.tar',
  '*.gz',
  '*.7z',
  '*.exe',
  '*.dll',
  '*.so',
  '*.dylib',
  '*.woff',
  '*.woff2',
  '*.ttf',
  '*.eot',
  '*.mp3',
  '*.mp4',
  '*.wav',
  '*.sqlite',
  '*.db',
];

export class IgnoreFilter {
  private rules: Array<{ pattern: string; isNegated: boolean; regex: RegExp }> = [];

  constructor(rootDir: string) {
    this.addPatterns(DEFAULT_IGNORE_PATTERNS);
    this.loadFile(path.join(rootDir, '.gitignore'));
    this.loadFile(path.join(rootDir, '.repofluxignore'));
  }

  private loadFile(filePath: string) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            this.addPattern(trimmed);
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  public addPatterns(patterns: string[]) {
    for (const p of patterns) {
      this.addPattern(p);
    }
  }

  public addPattern(pattern: string) {
    let clean = pattern.trim().replace(/\\/g, '/');
    if (!clean) return;

    const isNegated = clean.startsWith('!');
    if (isNegated) {
      clean = clean.substring(1);
    }

    if (clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }

    // Convert glob pattern to regex
    const regexStr = clean
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '§§')
      .replace(/\*/g, '[^/]*')
      .replace(/§§/g, '.*');

    const regex = new RegExp(`(^|/)${regexStr}($|/)`);
    this.rules.push({ pattern: clean, isNegated, regex });
  }

  public ignores(relPath: string): boolean {
    const normalized = relPath.replace(/\\/g, '/');
    let ignored = false;

    for (const rule of this.rules) {
      if (rule.regex.test(normalized)) {
        ignored = !rule.isNegated;
      }
    }

    return ignored;
  }
}
