import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const docsDir = path.join(repoRoot, 'docs', 'dashboard-demos');
const outputDir = path.join(repoRoot, 'output', 'playwright', 'dashboard-demos');

const shouldInstallBrowser = process.argv.includes('--install-browser');
const screenshotTargets = [
  { slug: 'index', path: 'index.html' },
  { slug: 'performance', path: 'performance-dashboard-demo.html' },
  { slug: 'operations', path: 'operations-dashboard-demo.html' },
  { slug: 'quality', path: 'quality-dashboard-demo.html' },
];

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      ...options,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
      }
    });
  });
}

function createStaticServer(rootDir) {
  return http.createServer(async (req, res) => {
    try {
      const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
      const filePath = path.resolve(rootDir, relative);
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      const body = await fs.readFile(filePath);
      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      res.end(body);
    } catch (error) {
      res.writeHead(404);
      res.end('Not found');
    }
  });
}

async function ensureArtifacts() {
  await run('npm', ['run', 'generate:dashboard-demos']);
}

async function maybeInstallBrowser() {
  if (!shouldInstallBrowser) {
    return;
  }
  await run('npx', ['playwright', 'install', 'chromium']);
}

async function captureScreenshots(baseUrl) {
  await fs.mkdir(outputDir, { recursive: true });
  for (const target of screenshotTargets) {
    await run('npx', [
      'playwright',
      'screenshot',
      '--browser=chromium',
      '--viewport-size=1440,1200',
      '--wait-for-timeout=1200',
      '--full-page',
      `${baseUrl}/${target.path}`,
      path.join(outputDir, `${target.slug}.png`),
    ]);
  }
}

async function writeManifest() {
  const entries = await Promise.all(screenshotTargets.map(async (target) => ({
    id: target.slug,
    html: target.path,
    screenshot: `${target.slug}.png`,
  })));
  await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(entries, null, 2), 'utf8');
}

await ensureArtifacts();
await maybeInstallBrowser();

const server = createStaticServer(docsDir);

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  await captureScreenshots(baseUrl);
  await writeManifest();

  console.log(`Dashboard demo smoke artifacts written to ${outputDir}`);
} catch (error) {
  const message = String(error?.message || error);
  if (message.includes('Executable doesn\'t exist') || message.includes('browserType.launch')) {
    console.error('Chromium is not installed for Playwright. Run `npm run smoke:dashboard-demos -- --install-browser` once to install it.');
  }
  throw error;
} finally {
  await new Promise((resolve) => server.close(resolve));
}
