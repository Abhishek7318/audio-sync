const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execSync } = require('child_process');

app.setName('Story Studio');

let mainWindow = null;
let pythonProcess = null;

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
const PYTHON_PORT = process.env.STORYREEL_PORT || 8765;

// Prepend bundled tools (e.g. ffmpeg) to PATH in production
if (app.isPackaged) {
  const bundledBin = path.join(process.resourcesPath, 'bin');
  if (fs.existsSync(bundledBin)) {
    process.env.PATH = `${bundledBin}${path.delimiter}${process.env.PATH || ''}`;
    console.log(`Configured PATH with bundled tools: ${bundledBin}`);
  }
}

function getBackendLogPath() {
  try {
    return path.join(app.getPath('userData'), 'backend.log');
  } catch (e) {
    return path.join(__dirname, '..', 'backend.log');
  }
}

function startPythonBackend() {
  let executable = '';
  let args = [];
  const isWin = process.platform === 'win32';

  if (app.isPackaged) {
    executable = path.join(
      process.resourcesPath,
      'backend_dist',
      'storyreel-backend',
      isWin ? 'storyreel-backend.exe' : 'storyreel-backend'
    );
    args = [];
  } else {
    executable = isWin
      ? path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe')
      : path.join(__dirname, '..', 'venv', 'bin', 'python');
    args = [path.join(__dirname, '..', 'backend', 'run.py')];
  }

  const logPath = getBackendLogPath();
  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) {
    try { fs.mkdirSync(logDir, { recursive: true }); } catch (e) {}
  }

  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  const logMsg = (msg) => {
    console.log(msg);
    try { logStream.write(`[${new Date().toISOString()}] ${msg}\n`); } catch (e) {}
  };

  logMsg(`=== Attempting to start Python backend on port ${PYTHON_PORT} ===`);
  logMsg(`Platform: ${process.platform} (${process.arch}), isPackaged: ${app.isPackaged}`);
  logMsg(`Target executable: ${executable}`);

  if (!fs.existsSync(executable)) {
    const errorMsg = `Backend executable not found at:\n${executable}\n\n` +
      (isWin
        ? `On Windows, the backend must be built using PyInstaller on a Windows machine (storyreel-backend.exe). If this installer was compiled on macOS, the Windows executable is missing.`
        : `Backend binary is missing from resources.`);

    logMsg(`ERROR: ${errorMsg}`);
    console.error(errorMsg);

    if (app.isPackaged) {
      dialog.showErrorBox('Story Studio Backend Missing', errorMsg);
    }
    return;
  }

  try {
    logMsg(`Spawning backend process: ${executable} ${args.join(' ')}`);
    pythonProcess = spawn(executable, args, {
      env: { ...process.env, STORYREEL_PORT: PYTHON_PORT.toString() },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (pythonProcess.stdout) {
      pythonProcess.stdout.pipe(logStream);
    }
    if (pythonProcess.stderr) {
      pythonProcess.stderr.pipe(logStream);
    }

    pythonProcess.on('error', (err) => {
      logMsg(`Backend process spawn error: ${err.message}`);
      console.error('Failed to start python backend:', err);
    });

    pythonProcess.on('exit', (code, signal) => {
      logMsg(`Backend process exited with code ${code} and signal ${signal}`);
      console.log(`Python backend exited with code ${code} and signal ${signal}`);
    });
  } catch (err) {
    logMsg(`Exception while starting backend: ${err.message}`);
    console.error('Error starting backend:', err);
  }
}

function waitForBackend(retries = 35, delay = 250) {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(`http://127.0.0.1:${PYTHON_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          console.log('StoryReel Backend is ready and responding!');
          return resolve(true);
        }
        retry();
      });

      req.on('error', () => {
        retry();
      });

      req.setTimeout(600, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (attempts >= retries) {
        console.warn('Backend readiness check timed out.');
        if (app.isPackaged) {
          const logPath = getBackendLogPath();
          dialog.showErrorBox(
            'Backend Engine Offline',
            `The local AI backend engine (http://127.0.0.1:${PYTHON_PORT}) did not respond in time.\n\n` +
            `Creating projects and running AI features will fail with "fetch failed" until the backend is running.\n\n` +
            `Log file location:\n${logPath}`
          );
        }
        return resolve(false);
      }
      setTimeout(check, delay);
    };

    check();
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Story Studio',
    backgroundColor: '#090a0f',
    frame: true,
    titleBarStyle: 'hiddenInset', // sleek macOS style
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allow loading local assets in dev
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('dialog:openDirectory', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    ...options
  });
  return result;
});

ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('shell:openPath', async (event, fullPath) => {
  return await shell.openPath(fullPath);
});

ipcMain.handle('shell:showItemInFolder', async (event, fullPath) => {
  shell.showItemInFolder(fullPath);
  return true;
});

const os = require('os');
const crypto = require('crypto');

function getDeviceHardwareId() {
  // 1. Check if we already have a saved hardware ID on disk in userData
  try {
    const idFilePath = path.join(app.getPath('userData'), 'device_id.json');
    if (fs.existsSync(idFilePath)) {
      const data = JSON.parse(fs.readFileSync(idFilePath, 'utf8'));
      if (data && data.machineId) {
        return data.machineId;
      }
    }
  } catch (err) {
    console.warn('Could not read saved device_id.json:', err);
  }

  // 2. Query OS permanent hardware identifier
  let rawHardwareId = '';
  if (process.platform === 'darwin') {
    try {
      // ioreg returns the immutable Apple hardware UUID
      const output = execSync('ioreg -rd1 -c IOPlatformExpertDevice', { encoding: 'utf8', timeout: 3000 });
      const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (match && match[1]) {
        rawHardwareId = `mac_${match[1].trim()}`;
      }
    } catch (e) {
      console.warn('Failed to query IOPlatformUUID:', e);
    }
  } else if (process.platform === 'win32') {
    try {
      // 1. Modern PowerShell Get-CimInstance (works reliably on Windows 10 & Windows 11)
      const output = execSync('powershell -NoProfile -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"', { encoding: 'utf8', timeout: 4000 });
      const uuid = output.trim();
      if (uuid && uuid.length > 5) {
        rawHardwareId = `win_${uuid}`;
      }
    } catch (e) {
      // 2. Fallback to wmic for older Windows
      try {
        const output = execSync('wmic csproduct get uuid', { encoding: 'utf8', timeout: 3000 });
        const lines = output.split('\r\n').filter(line => line.trim() !== '');
        if (lines.length > 1 && lines[1].trim()) {
          rawHardwareId = `win_${lines[1].trim()}`;
        }
      } catch (err2) {
        console.warn('Failed to query Windows UUID:', err2);
      }
    }
  }

  // Fallback if OS command fails
  if (!rawHardwareId) {
    rawHardwareId = `${os.platform()}_${os.arch()}_${os.homedir()}_${crypto.randomUUID()}`;
  }

  const machineId = crypto.createHash('sha256').update(rawHardwareId).digest('hex');

  // Save to userData/device_id.json so it NEVER changes on this computer
  try {
    const userDataDir = app.getPath('userData');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    const idFilePath = path.join(userDataDir, 'device_id.json');
    fs.writeFileSync(idFilePath, JSON.stringify({ machineId, rawHardwareId, createdAt: new Date().toISOString() }, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not save device_id.json:', err);
  }

  return machineId;
}

// Session persistence handlers
const getSessionFilePath = () => path.join(app.getPath('userData'), 'auth_session.json');

ipcMain.handle('system:getMachineId', () => getDeviceHardwareId());
ipcMain.handle('system:getDeviceName', () => os.hostname());

ipcMain.handle('system:saveAuthSession', (event, sessionData) => {
  try {
    const filePath = getSessionFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    console.error('Failed to save auth session:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('system:getAuthSession', () => {
  try {
    const filePath = getSessionFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
    return null;
  } catch (err) {
    console.error('Failed to read auth session:', err);
    return null;
  }
});

ipcMain.handle('system:clearAuthSession', () => {
  try {
    const filePath = getSessionFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (err) {
    console.error('Failed to clear auth session:', err);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(async () => {
  if (app.isPackaged) {
    startPythonBackend();
    await waitForBackend();
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (pythonProcess) {
    console.log('Terminating Python backend on quit...');
    if (process.platform === 'win32') {
      try {
        execSync(`taskkill /pid ${pythonProcess.pid} /T /F`);
      } catch (e) {
        try { pythonProcess.kill('SIGKILL'); } catch (err) {}
      }
    } else {
      pythonProcess.kill('SIGTERM');
    }
  }
});
