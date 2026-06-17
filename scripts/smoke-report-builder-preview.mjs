import net from "node:net";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const viteBin = path.join(repoRoot, "node_modules", "vite", "bin", "vite.js");
const runnerScript = path.join(repoRoot, "scripts", "run-report-builder-preview-scenarios.mjs");

function spawnChild(command, args, options = {}) {
  return spawn(command, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
    },
    stdio: "inherit",
    ...options,
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

function waitForExit(child, label) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const scenarioArgs = process.argv.slice(2);
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const previewUrl = `${baseUrl}/report-builder-preview.html`;
  const viteChild = spawnChild(process.execPath, ["--no-warnings", viteBin, "--host", "127.0.0.1", "--port", String(port)]);

  try {
    await waitForServer(previewUrl, 30000);
    const runnerArgs = ["--base-url", baseUrl, ...scenarioArgs];
    const runnerChild = spawnChild(process.execPath, ["--no-warnings", runnerScript, ...runnerArgs]);
    await waitForExit(runnerChild, "preview scenario runner");
  } finally {
    viteChild.kill("SIGTERM");
    try {
      await waitForExit(viteChild, "preview vite server");
    } catch (_) {
      // Best effort shutdown.
    }
  }
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});
