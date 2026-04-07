import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildDashboardDemoStandaloneHtml,
  getDashboardDemoExportFilename,
  listDashboardDemoArtifacts,
} from '../src/core/ui/dashboardDemoArtifacts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'docs', 'dashboard-demos');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildIndexHtml(artifacts) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Forge Dashboard Demo Exports</title>
  <style>
    :root {
      --bg: #f5f8fa;
      --panel: #ffffff;
      --border: #d8e1e8;
      --text: #182026;
      --muted: #5f6b7c;
      --primary: #137cbd;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    main {
      max-width: 980px;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 32px;
    }
    p.lead {
      margin: 0 0 24px;
      color: var(--muted);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 1px 2px rgba(16, 22, 26, 0.08);
    }
    .card h2 {
      margin: 0 0 6px;
      font-size: 18px;
    }
    .card p {
      margin: 0 0 16px;
      color: var(--muted);
      line-height: 1.5;
    }
    .card a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
    }
    .card a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <main>
    <h1>Forge Dashboard Demo Exports</h1>
    <p class="lead">Self-contained HTML exports generated from the built-in generic dashboard demo variants.</p>
    <section class="grid">
      ${artifacts.map((artifact) => `
        <article class="card">
          <h2>${escapeHtml(artifact.title)}</h2>
          <p>${escapeHtml(artifact.description || '')}</p>
          <a href="./${encodeURIComponent(artifact.filename)}" download="${escapeHtml(artifact.filename)}">Download HTML</a>
        </article>
      `).join('')}
    </section>
  </main>
</body>
</html>`;
}

await fs.mkdir(outputDir, { recursive: true });

const artifacts = listDashboardDemoArtifacts();

for (const artifact of artifacts) {
  const { html } = buildDashboardDemoStandaloneHtml(artifact.id);
  const filename = getDashboardDemoExportFilename(artifact.id);
  await fs.writeFile(path.join(outputDir, filename), html, 'utf8');
}

await fs.writeFile(path.join(outputDir, 'index.html'), buildIndexHtml(artifacts), 'utf8');

console.log(`Generated ${artifacts.length} dashboard demo exports in ${outputDir}`);
