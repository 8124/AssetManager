#!/usr/bin/env node
/**
 * Dev launcher: 启动 vite dev server，把 stdout/stderr 加时间戳前缀
 * 写到 logs/<name>.std.log + 当前 stdout；负责子进程组管理与端口孤儿清理。
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const LOG_DIR = process.env.LOG_DIR || 'logs';
const CLIENT_DEV_PORT = process.env.CLIENT_DEV_PORT || '8001';

fs.mkdirSync(LOG_DIR, { recursive: true });

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

function log(msg) {
  const line = `[${timestamp()}] [dev] ${msg}\n`;
  try { process.stdout.write(line); } catch {}
}

/** 清理端口占用：lsof -ti:<port> | kill -9 */
function killOrphansByPort(port) {
  try {
    const out = execSync(`lsof -ti:${port}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (!out) return [];
    const pids = out.split('\n').filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 'SIGKILL');
        log(`killed orphan pid=${pid} on :${port}`);
      } catch {}
    }
    return pids;
  } catch {
    return [];
  }
}

const managed = [];

function startProcess({ name, command, args, logFileName }) {
  const logFd = logFileName
    ? fs.openSync(path.join(LOG_DIR, logFileName), 'a')
    : null;

  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    cwd: ROOT,
    env: process.env,
    detached: true,
  });

  const pipeLines = (stream) => {
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    rl.on('line', (line) => {
      const msg = `[${timestamp()}] [${name}] ${line}\n`;
      try { process.stdout.write(msg); } catch {}
      if (logFd != null) {
        try { fs.writeSync(logFd, msg); } catch {}
      }
    });
  };
  pipeLines(child.stdout);
  pipeLines(child.stderr);

  managed.push({ name, child });
  return child;
}

/** 检测 Ollama 是否已在运行（用 127.0.0.1 避免 localhost 解析到 IPv6） */
function isOllamaRunning() {
  try {
    execSync('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:11434/api/tags', {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    });
    return true;
  } catch {
    return false;
  }
}

/** 杀掉所有 ollama 进程 */
function killOllamaProcesses() {
  try {
    execSync('pkill -f "ollama serve"', { stdio: 'ignore' });
    log('killed ollama serve process');
  } catch {}
  try {
    execSync('pkill -f "ollama_llama_server"', { stdio: 'ignore' });
    log('killed ollama model runner process');
  } catch {}
}

killOrphansByPort(CLIENT_DEV_PORT);

// 启动 Ollama（如果未运行）—— 单独管理，不加入 managed 列表，避免它的退出连锁触发 shutdown
let ollamaChild = null;
let weStartedOllama = false;
if (!isOllamaRunning()) {
  log('starting ollama serve...');
  weStartedOllama = true;
  ollamaChild = spawn('ollama', ['serve'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    cwd: ROOT,
    env: process.env,
    detached: true,
  });
  const ollamaLogFd = fs.openSync(path.join(LOG_DIR, 'ollama.std.log'), 'a');
  const pipeLines = (stream) => {
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    rl.on('line', (line) => {
      const msg = `[${timestamp()}] [ollama] ${line}\n`;
      try { process.stdout.write(msg); } catch {}
      try { fs.writeSync(ollamaLogFd, msg); } catch {}
    });
  };
  pipeLines(ollamaChild.stdout);
  pipeLines(ollamaChild.stderr);

  // ollama 退出时单独处理，不触发全局 cleanup
  ollamaChild.on('exit', (code) => {
    if (isOllamaRunning()) {
      // 端口还在监听，说明是因为端口冲突秒退的，本来就在跑，不算我们启动成功
      weStartedOllama = false;
      log('ollama serve exited (port conflict, already running externally)');
    } else {
      log(`ollama serve exited with code ${code}`);
    }
  });

  // 等待就绪
  let retries = 0;
  const waitOllama = setInterval(() => {
    retries++;
    if (isOllamaRunning()) {
      clearInterval(waitOllama);
      log('ollama serve ready');
    } else if (retries > 15) {
      clearInterval(waitOllama);
      log('ollama not ready after timeout, continuing anyway');
    }
  }, 500);
} else {
  log('ollama already running, skip starting');
}

startProcess({
  name: 'client',
  command: 'npx',
  args: ['vite', '--port', CLIENT_DEV_PORT, '--host', '0.0.0.0'],
  logFileName: 'client.std.log',
});

let stopping = false;
function cleanup(signal) {
  if (stopping) return;
  stopping = true;
  log(`cleanup triggered by ${signal}`);

  for (const { child } of managed) {
    if (!child.pid) continue;
    try { process.kill(-child.pid, signal || 'SIGTERM'); } catch {}
  }
  setTimeout(() => {
    for (const { child } of managed) {
      if (!child.pid) continue;
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }
    // 只杀掉我们自己启动的 ollama，不影响用户手动启动的实例
    if (weStartedOllama && ollamaChild && ollamaChild.pid) {
      try { process.kill(-ollamaChild.pid, 'SIGTERM'); } catch {}
      setTimeout(() => {
        try { process.kill(-ollamaChild.pid, 'SIGKILL'); } catch {}
      }, 1000);
    }
    killOrphansByPort(CLIENT_DEV_PORT);
    process.exit(0);
  }, 2000);
}

process.on('SIGINT', () => cleanup('SIGTERM'));
process.on('SIGTERM', () => cleanup('SIGTERM'));
// pkill 杀父 npm 后会收 SIGHUP（controlling tty 关闭）；
// Node 默认直接退出不跑 handler，注册 handler 触发 cleanup
process.on('SIGHUP', () => cleanup('SIGTERM'));

Promise.race(
  managed.map(({ child }) => new Promise((r) => child.on('exit', r))),
).then(() => cleanup('SIGTERM'));
