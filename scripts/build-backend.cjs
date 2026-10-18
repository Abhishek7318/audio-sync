const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWin = process.platform === 'win32';
const rootDir = path.join(__dirname, '..');

let pyinstallerBin = isWin
  ? path.join(rootDir, 'venv', 'Scripts', 'pyinstaller.exe')
  : path.join(rootDir, 'venv', 'bin', 'pyinstaller');

if (!fs.existsSync(pyinstallerBin)) {
  pyinstallerBin = 'pyinstaller';
}

console.log(`[Build Backend] Compiling backend via PyInstaller on platform: ${process.platform} (${process.arch})`);
console.log(`[Build Backend] Using PyInstaller: ${pyinstallerBin}`);

const args = [
  '--noconfirm',
  '--onedir',
  '--name', 'storyreel-backend',
  '--paths', 'backend',
  '--hidden-import', 'uvicorn',
  '--hidden-import', 'uvicorn.logging',
  '--hidden-import', 'uvicorn.loops',
  '--hidden-import', 'uvicorn.loops.auto',
  '--hidden-import', 'uvicorn.protocols',
  '--hidden-import', 'uvicorn.protocols.http',
  '--hidden-import', 'uvicorn.protocols.http.auto',
  '--hidden-import', 'uvicorn.protocols.websockets',
  '--hidden-import', 'uvicorn.protocols.websockets.auto',
  '--hidden-import', 'uvicorn.lifespan',
  '--hidden-import', 'uvicorn.lifespan.on',
  '--hidden-import', 'edge_tts',
  '--hidden-import', 'gtts',
  '--collect-all', 'uvicorn',
  '--collect-all', 'fastapi',
  '--collect-all', 'playwright',
  '--distpath', 'resources/backend_dist',
  'backend/run.py'
];

const result = spawnSync(pyinstallerBin, args, {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWin
});

if (result.error) {
  console.error('[Build Backend] Failed to run PyInstaller:', result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`[Build Backend] PyInstaller exited with status ${result.status}`);
  process.exit(result.status || 1);
}

console.log('[Build Backend] Python backend compiled successfully!');
process.exit(0);
