// Starts the Storm Shift server fresh: first stops anything already listening
// on the port (a server left running from an earlier session serves old routes,
// e.g. 404s on new vendor/ files), then runs server/server.js.
// Usage: npm run fresh   (PORT env var respected, default 3000)
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;

function listeningPids(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        const cols = line.trim().split(/\s+/);
        // Proto  Local  Foreign  State  PID
        if (cols.length >= 5 && cols[3] === 'LISTENING' && cols[1].endsWith(':' + port)) pids.add(cols[4]);
      }
      return [...pids].filter((p) => p !== '0' && p !== String(process.pid));
    }
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
    return out.split(/\s+/).filter(Boolean);
  } catch {
    return []; // lsof exits 1 when nothing is listening
  }
}

const pids = listeningPids(PORT);
for (const pid of pids) {
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    else process.kill(Number(pid), 'SIGTERM');
    console.log(`Stopped old server on port ${PORT} (pid ${pid}).`);
  } catch (e) {
    console.warn(`Could not stop pid ${pid} on port ${PORT}: ${e.message}`);
  }
}
if (pids.length) await new Promise((r) => setTimeout(r, 500)); // let the OS free the port

const child = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
