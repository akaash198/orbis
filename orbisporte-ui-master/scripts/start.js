const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const tempRoot = path.join(projectRoot, '.tmp');

fs.mkdirSync(tempRoot, { recursive: true });

process.env.TEMP = tempRoot;
process.env.TMP = tempRoot;
process.env.TMPDIR = tempRoot;
process.env.HOME = projectRoot;
process.env.USERPROFILE = projectRoot;

const reactScripts = require.resolve('react-scripts/bin/react-scripts.js');
const child = spawn(process.execPath, [reactScripts, 'start'], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
