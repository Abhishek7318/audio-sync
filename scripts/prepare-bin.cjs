const fs = require('fs');
const path = require('path');

const ffmpegStaticPath = require('ffmpeg-static');
const isWin = process.platform === 'win32';
const targetDir = path.join(__dirname, '..', 'resources', 'bin');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const targetName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
const targetPath = path.join(targetDir, targetName);

if (ffmpegStaticPath && fs.existsSync(ffmpegStaticPath)) {
  console.log(`[Prepare Bin] Copying native ffmpeg from: ${ffmpegStaticPath} -> ${targetPath}`);
  fs.copyFileSync(ffmpegStaticPath, targetPath);
  if (!isWin) {
    fs.chmodSync(targetPath, 0o755);
  }
  console.log(`[Prepare Bin] Successfully bundled ${targetName}!`);
} else {
  console.warn(`[Prepare Bin] Warning: ffmpeg-static binary not found at ${ffmpegStaticPath}`);
}
