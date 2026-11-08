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
const OLLAMA_PORT = process.env.OLLAMA_PORT || '11434';

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

/**
 * 判断 11434 端口是否已被监听。
 *
 * 不要用 `curl /api/tags` 判活：Ollama 正在加载模型/内存紧张时接口会阻塞几秒，
 * 2 秒超时的 curl 会误判成「没启动」，于是这里又起一个 serve → 绑定失败 →
 * 打印 "ollama not ready after timeout"。用 lsof 看端口只依赖内核，不会误判。
 */
function isOllamaRunning() {
  try {
    const out = execSync(`lsof -ti:${OLLAMA_PORT}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

/** 端口在监听 ≠ 接口已就绪：额外做一次短超时确认，仅用于日志，不阻塞启动 */
function isOllamaApiReady() {
  try {
    const code = execSync(
      `curl -s -m 3 -o /dev/null -w "%{http_code}" http://127.0.0.1:${OLLAMA_PORT}/api/tags`,
      { stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 },
    )
      .toString()
      .trim();
    return code === '200';
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
    // 默认上下文只有 4096，思考型模型"想完就没地方写答案"。
    // 由这里启动时顺手提到 8192；若 Ollama.app 已在跑则此设置不生效（需 launchctl setenv）。
    env: { ...process.env, OLLAMA_CONTEXT_LENGTH: process.env.OLLAMA_CONTEXT_LENGTH || '8192' },
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

  // 等待就绪：先看端口（可靠），再看接口（仅提示）
  let retries = 0;
  const waitOllama = setInterval(() => {
    retries++;
    if (isOllamaRunning()) {
      clearInterval(waitOllama);
      log(
        isOllamaApiReady()
          ? 'ollama serve ready'
          : 'ollama 端口已监听，接口尚未响应（可能正在加载模型），不影响前端启动',
      );
    } else if (retries > 40) {
      clearInterval(waitOllama);
      log(`警告：${OLLAMA_PORT} 端口 20 秒内未监听，AI 助手会显示离线；检查 Ollama 是否安装/被拦截`);
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
