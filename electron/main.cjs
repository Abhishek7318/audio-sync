const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let pythonProcess = null;

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
const PYTHON_PORT = process.env.STORYREEL_PORT || 8765;

function startPythonBackend() {
  const pythonExecutable = process.platform === 'win32'
    ? path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe')
    : path.join(__dirname, '..', 'venv', 'bin', 'python');

  const scriptPath = path.join(__dirname, '..', 'backend', 'run.py');

  try {
    console.log(`Spawning Python backend from: ${pythonExecutable}`);
    pythonProcess = spawn(pythonExecutable, [scriptPath], {
      env: { ...process.env, STORYREEL_PORT: PYTHON_PORT.toString() },
      stdio: 'inherit'
    });

    pythonProcess.on('error', (err) => {
      console.error('Failed to start python backend:', err);
    });

    pythonProcess.on('exit', (code, signal) => {
      console.log(`Python backend exited with code ${code} and signal ${signal}`);
    });
  } catch (err) {
    console.error('Error starting backend:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'StoryReel Studio',
    backgroundColor: '#090a0f',
    frame: true,
    titleBarStyle: 'hiddenInset', // sleek macOS style
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allow loading local assets in dev
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
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

app.whenReady().then(() => {
  if (isDev) {
    // In dev mode, concurrently might start python, but we ensure fallback
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
    pythonProcess.kill();
  }
});
