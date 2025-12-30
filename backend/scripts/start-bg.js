const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const pidFile = path.join(root, 'backend.pid');
const outLog = path.join(root, 'backend.out.log');
const errLog = path.join(root, 'backend.err.log');

if (fs.existsSync(pidFile)) {
  try {
    const existing = parseInt(fs.readFileSync(pidFile, 'utf8'), 10);
    process.kill(existing, 0);
    console.error(`Backend already running (pid=${existing}). Stop it first or remove ${pidFile}`);
    process.exit(1);
  } catch (e) {
    // not running, continue
  }
}

const out = fs.openSync(outLog, 'a');
const err = fs.openSync(errLog, 'a');

const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  detached: true,
  stdio: ['ignore', out, err]
});

child.unref();

fs.writeFileSync(pidFile, String(child.pid));
console.log(`Started backend (pid=${child.pid}), pid written to ${pidFile}`);
