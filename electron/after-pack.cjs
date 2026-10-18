const { execSync } = require('child_process');
const path = require('path');

exports.default = async function(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`[afterPack] Applying clean ad-hoc codesign on: ${appPath}`);
  
  try {
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
    console.log(`[afterPack] Ad-hoc signature successfully applied.`);
  } catch (err) {
    console.error(`[afterPack] Codesign error:`, err);
  }
};

module.exports = exports.default;
