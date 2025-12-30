const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const pidFile = path.join(root, 'frontend.pid');
const outLog = path.join(root, 'frontend.out.log');
const errLog = path.join(root, 'frontend.err.log');

if (fs.existsSync(pidFile)) {
  try {
    const existing = parseInt(fs.readFileSync(pidFile, 'utf8'), 10);
    process.kill(existing, 0);
    console.error(`Frontend already running (pid=${existing}). Stop it first or remove ${pidFile}`);
    process.exit(1);
  } catch (e) {
    // not running, continue
  }
}

const out = fs.openSync(outLog, 'a');
const err = fs.openSync(errLog, 'a');


// spawn the local vite binary via node for better cross-platform behavior
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const cmd = process.execPath; // node
const args = [viteBin];

const child = spawn(cmd, args, {
  cwd: root,
  detached: true,
  stdio: ['ignore', out, err]
});

child.unref();

fs.writeFileSync(pidFile, String(child.pid));
console.log(`Started frontend (pid=${child.pid}), pid written to ${pidFile}`);
