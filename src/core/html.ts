import { PackResult } from './packer.js';

export function generateHtmlReport(result: PackResult, repoName: string): string {
  const treeEscaped = result.tree.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const totalTokens = result.totalTokens.toLocaleString();
  const totalFiles = result.totalFiles;
  const totalKb = (result.totalBytes / 1024).toFixed(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>repoflux Report: ${repoName}</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --accent: #58a6ff;
      --success: #3fb950;
      --warning: #d29922;
    }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    h1 { margin: 0; font-size: 24px; color: #fff; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      background: rgba(88, 166, 255, 0.15);
      color: var(--accent);
      font-size: 13px;
      font-weight: 600;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .card-title { font-size: 13px; color: #8b949e; text-transform: uppercase; margin-bottom: 6px; }
    .card-value { font-size: 28px; font-weight: 700; color: #fff; }
    .section-title { font-size: 18px; margin: 24px 0 12px; color: #fff; }
    pre {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 13px;
      line-height: 1.45;
    }
    .alerts {
      background: rgba(210, 153, 34, 0.1);
      border: 1px solid var(--warning);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>repoflux Context Report: ${repoName}</h1>
      <p style="margin: 4px 0 0; color: #8b949e; font-size: 14px;">Deterministic context analysis and token distribution</p>
    </div>
    <span class="badge">v1.2.0</span>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-title">Estimated Tokens</div>
      <div class="card-value">${totalTokens}</div>
    </div>
    <div class="card">
      <div class="card-title">Total Files</div>
      <div class="card-value">${totalFiles}</div>
    </div>
    <div class="card">
      <div class="card-title">Payload Size</div>
      <div class="card-value">${totalKb} KB</div>
    </div>
    <div class="card">
      <div class="card-title">Secrets Redacted</div>
      <div class="card-value" style="color: ${result.secretDetections.length > 0 ? 'var(--warning)' : 'var(--success)'};">
        ${result.secretDetections.length}
      </div>
    </div>
  </div>

  ${result.secretDetections.length > 0 ? `
  <div class="alerts">
    <strong>Security Notice:</strong> Redacted leaked credentials in ${result.secretDetections.length} files.
    <ul>
      ${result.secretDetections.map((d) => `<li>${d.file}: ${d.matches.map((m) => m.type).join(', ')}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  <div class="section-title">Directory Tree & Token Weights</div>
  <pre>${treeEscaped}</pre>
</body>
</html>`;
}
