const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const dist = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(dist)) {
  console.error('Falta dist/index.html. Execute npm run build antes de test:electron.');
  process.exit(1);
}

const electronBin = require('electron');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'pixelcut-electron-'));
const logFile = path.join(userData, 'boot.log');

const child = spawn(electronBin, ['.'], {
  cwd: path.join(__dirname, '..'),
  env: {
    ...process.env,
    PIXELCUT_USER_DATA: userData,
    FVE_BOOT_TEST: '1',
    ELECTRON_ENABLE_LOGGING: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let output = '';
const onData = (chunk) => {
  const text = chunk.toString();
  output += text;
  process.stdout.write(text);
};
child.stdout.on('data', onData);
child.stderr.on('data', onData);

const timer = setTimeout(() => {
  child.kill();
  cleanup();
  console.error('test-electron-boot: timeout');
  process.exit(1);
}, 70000);

function cleanup() {
  clearTimeout(timer);
  try { fs.rmSync(userData, { recursive: true, force: true }); } catch { /* ignore */ }
}

child.on('exit', (code) => {
  fs.writeFileSync(logFile, output, 'utf8');
  const ok = code === 0 && /ELECTRON BOOT OK/.test(output);
  cleanup();
  if (!ok) {
    console.error(`test-electron-boot: exit ${code}`);
    process.exit(code || 1);
  }
  process.exit(0);
});
