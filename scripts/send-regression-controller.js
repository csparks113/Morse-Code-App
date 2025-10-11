#!/usr/bin/env node
/**
 * send-regression-controller
 *
 * Bridges file-based commands into the interactive send regression harness so
 * we can drive the prompts asynchronously. A background workflow (e.g. this
 * agent) appends command objects to a control JSON file, and this controller
 * forwards them to the harness while mirroring stdout/stderr into a log file.
 *
 * Control file schema:
 * {
 *   "commands": [
 *     { "scenario": "S1", "action": "start" },
 *     { "scenario": "S1", "action": "finish" },
 *     { "scenario": "S1", "action": "note", "text": "Observations..." },
 *     { "scenario": "S2", "action": "skip" }
 *   ]
 * }
 *
 * Supported actions:
 *   - start  -> send newline (begin scenario)
 *   - finish -> send newline (finish scenario)
 *   - note   -> send provided text followed by newline
 *   - input  -> alias of note (sends text verbatim)
 *   - skip   -> sends "skip" + newline to bypass scenario
 *
 * Additional control flags:
 *   - terminate: true -> closes stdin once pending commands are flushed.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    args[key] = value;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const repoRoot = path.resolve(__dirname, '..');
const controlPath = path.resolve(
  args.control || path.join(__dirname, 'send-regression-control.json'),
);

const logsDir = path.resolve(repoRoot, 'docs', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = path.resolve(
  args.log || path.join(logsDir, `send-regression-console-${timestamp}.log`),
);

const pollIntervalMs = Number.parseInt(args.interval ?? '300', 10);

if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
  throw new Error(`Invalid poll interval: ${args.interval}`);
}

if (!fs.existsSync(controlPath)) {
  fs.mkdirSync(path.dirname(controlPath), { recursive: true });
  fs.writeFileSync(controlPath, JSON.stringify({ commands: [] }, null, 2));
}

const harnessPath = path.join(__dirname, 'run-send-regression.js');
const child = spawn(process.execPath, [harnessPath], {
  cwd: repoRoot,
  stdio: ['pipe', 'pipe', 'pipe'],
});

const logStream = fs.createWriteStream(logPath, { flags: 'a' });

function forward(chunk) {
  process.stdout.write(chunk);
  logStream.write(chunk);
}

child.stdout.on('data', forward);
child.stderr.on('data', forward);

let commandIndex = 0;
let stdinClosed = false;

const senders = {
  default() {
    child.stdin.write('\n');
  },
  note(cmd) {
    child.stdin.write(`${cmd.text ?? ''}\n`);
  },
  input(cmd) {
    child.stdin.write(`${cmd.text ?? ''}\n`);
  },
  skip() {
    child.stdin.write('skip\n');
  },
};

function processCommands() {
  let state;
  try {
    const raw = fs.readFileSync(controlPath, 'utf8');
    state = JSON.parse(raw);
  } catch (error) {
    console.error('[controller] Failed reading control file:', error.message);
    setTimeout(processCommands, pollIntervalMs);
    return;
  }

  const commands = Array.isArray(state.commands) ? state.commands : [];

  while (commandIndex < commands.length) {
    const command = commands[commandIndex];
    commandIndex += 1;
    const action = typeof command.action === 'string' ? command.action.toLowerCase() : '';
    const handler = senders[action] || senders.default;
    handler(command);
  }

  if (state.terminate && !stdinClosed) {
    stdinClosed = true;
    child.stdin.end();
  }

  if (!child.killed) {
    setTimeout(processCommands, pollIntervalMs);
  }
}

processCommands();

child.on('exit', (code, signal) => {
  logStream.end();
  const meta = {
    controlPath,
    logPath,
    timestamp,
    exitCode: code,
    signal,
  };
  try {
    fs.writeFileSync(
      path.join(__dirname, 'send-regression-controller-meta.json'),
      JSON.stringify(meta, null, 2),
    );
  } catch (error) {
    console.error('[controller] Failed to write meta file:', error.message);
  }

  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});

console.log(`[controller] logPath=${logPath}`);
console.log(`[controller] controlPath=${controlPath}`);

