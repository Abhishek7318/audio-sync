const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWin = process.platform === 'win32';
const rootDir = path.join(__dirname, '..');

// Find Python binary in venv
let pythonBin = isWin
  ? path.join(rootDir, 'venv', 'Scripts', 'python.exe')
  : path.join(rootDir, 'venv', 'bin', 'python');

if (!fs.existsSync(pythonBin)) {
  // Fallback to system python
  pythonBin = isWin ? 'python' : 'python3';
}

console.log(`[Dev Backend] Starting backend with: ${pythonBin}`);
const runPy = path.join(rootDir, 'backend', 'run.py');
const child = spawn(pythonBin, [runPy], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWin
});

child.on('error', (err) => {
  console.error(`[Dev Backend] Failed to spawn Python backend: ${err.message}`);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
