import { spawn } from 'node:child_process';

/**
 * Cross-platform clipboard writer with zero external npm dependencies.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    let proc;

    if (process.platform === 'win32') {
      // Use clip.exe on Windows
      proc = spawn('clip.exe');
    } else if (process.platform === 'darwin') {
      // pbcopy on macOS
      proc = spawn('pbcopy');
    } else {
      // xclip or wl-copy on Linux
      proc = spawn('xclip', ['-selection', 'clipboard']);
    }

    proc.on('error', () => {
      resolve(false);
    });

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.stdin.write(text);
    proc.stdin.end();
  });
}
