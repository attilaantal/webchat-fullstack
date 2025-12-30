const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pidFile = path.join(root, 'backend.pid');

if (!fs.existsSync(pidFile)) {
  console.error('No pid file found at', pidFile);
  process.exit(1);
}

const pid = parseInt(fs.readFileSync(pidFile, 'utf8'), 10);
try {
  process.kill(pid);
  console.log('Stopped backend pid', pid);
} catch (e) {
  console.error('Failed to stop process', pid, e.message);
}

try { fs.unlinkSync(pidFile); } catch (e) {}
