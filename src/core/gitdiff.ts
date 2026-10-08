import { execSync } from 'node:child_process';
import * as path from 'node:path';

export interface GitDiffResult {
  hasDiff: boolean;
  branch: string;
  filesChanged: string[];
  diffContent: string;
}

export function getRepositoryDiff(rootDir: string, targetRef: string = 'HEAD'): GitDiffResult {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
    
    // Check uncommitted changes first (working directory + staged)
    let diff = execSync('git diff HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
    
    // If working tree is clean, get diff against parent or specified target
    if (!diff && targetRef) {
      diff = execSync(`git diff ${targetRef}~1 ${targetRef}`, { cwd: rootDir, encoding: 'utf8' }).trim();
    }

    const filesRaw = execSync('git diff --name-only HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
    const filesChanged = filesRaw ? filesRaw.split('\n').map((f) => f.trim()).filter(Boolean) : [];

    return {
      hasDiff: diff.length > 0,
      branch,
      filesChanged,
      diffContent: diff,
    };
  } catch {
    return {
      hasDiff: false,
      branch: 'unknown',
      filesChanged: [],
      diffContent: '',
    };
  }
}
