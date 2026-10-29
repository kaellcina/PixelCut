const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { probe, runExport, extractWaveform } = require('./ffmpeg.cjs');
const projects = require('./projects.cjs');

app.setName('PixelCut');
app.setAppUserModelId('com.pixelcut.editor');

if (process.env.PIXELCUT_USER_DATA) {
  const isolated = path.resolve(process.env.PIXELCUT_USER_DATA);
  fs.mkdirSync(isolated, { recursive: true });
  app.setPath('userData', isolated);
}

const VIDEO_EXT = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'];
const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

let win;
let currentExport = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 420,
    minHeight: 560,
    backgroundColor: '#071225',
    title: 'PixelCut',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    autoHideMenuBar: true,
    show: !process.env.FVE_BOOT_TEST,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  if (process.env.FVE_SMOKE) {
    win.webContents.once('did-finish-load', () => require('./smoke.cjs')(win, app, process.env.FVE_SMOKE));
  }
  if (process.env.FVE_BOOT_TEST) {
    require('./boot-test.cjs')(win, app, { probe, extractWaveform, projects });
  }
  if (process.env.FVE_GUI_FLOW) {
    require('./gui-flow.cjs')(win, app);
  }

  let allowClose = false;
  win.on('close', (event) => {
    if (allowClose || process.env.FVE_SMOKE || process.env.FVE_BOOT_TEST || process.env.FVE_GUI_FLOW) return;
    event.preventDefault();
    win.webContents.send('app:closing');
    setTimeout(() => {
      if (!win.isDestroyed()) {
        allowClose = true;
        win.close();
      }
    }, 8000);
  });
  ipcMain.on('app:ready-to-close', () => {
    if (win.isDestroyed()) return;
    allowClose = true;
    win.close();
  });
}

async function importPaths(filePaths) {
  const items = [];
  for (const file of filePaths) {
    const ext = path.extname(file).slice(1).toLowerCase();
    try {
      if (IMAGE_EXT.includes(ext)) {
        let info = { width: 0, height: 0, duration: 5, hasVideo: true, hasAudio: false };
        try { info = { ...await probe(file), duration: 5, hasAudio: false }; } catch { /* still import as image */ }
        items.push({ path: file, name: path.basename(file), type: 'image', ...info, duration: 5 });
        continue;
      }
      const info = await probe(file);
      items.push({ path: file, name: path.basename(file), type: info.hasVideo ? 'video' : 'audio', ...info });
    } catch (e) {
      items.push({ path: file, name: path.basename(file), error: e.message });
    }
  }
  return items;
}

ipcMain.handle('media:import', async () => {
  const preset = String(process.env.FVE_GUI_MEDIA || '').split('|').map((item) => item.trim()).filter(Boolean);
  if (preset.length) return importPaths(preset);
  const res = await dialog.showOpenDialog(win, {
    title: 'Import media',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media', extensions: [...VIDEO_EXT, ...AUDIO_EXT, ...IMAGE_EXT] },
      { name: 'Video', extensions: VIDEO_EXT },
      { name: 'Audio', extensions: AUDIO_EXT },
      { name: 'Image', extensions: IMAGE_EXT },
    ],
  });
  if (res.canceled) return [];
  return importPaths(res.filePaths);
});

async function probeFile(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  if (IMAGE_EXT.includes(ext)) {
    let info = { width: 0, height: 0, duration: 5, hasVideo: true, hasAudio: false };
    try { info = { ...await probe(file), duration: 5, hasAudio: false }; } catch { /* still import as image */ }
    return { path: file, name: path.basename(file), type: 'image', ...info, duration: 5 };
  }
  const info = await probe(file);
  return { path: file, name: path.basename(file), type: info.hasVideo ? 'video' : 'audio', ...info };
}

ipcMain.handle('media:pick', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Localizar mídia',
    properties: ['openFile'],
    filters: [
      { name: 'Media', extensions: [...VIDEO_EXT, ...AUDIO_EXT, ...IMAGE_EXT] },
      { name: 'Video', extensions: VIDEO_EXT },
      { name: 'Audio', extensions: AUDIO_EXT },
      { name: 'Image', extensions: IMAGE_EXT },
    ],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  try {
    return await probeFile(res.filePaths[0]);
  } catch (e) {
    return { path: res.filePaths[0], name: path.basename(res.filePaths[0]), error: e.message };
  }
});

ipcMain.on('media:exists', (event, file) => {
  event.returnValue = projects.mediaExists(file);
});

ipcMain.handle('projects:fs', async (_e, method, args) => projects.dispatch(method, args));

ipcMain.handle('project:save', async (_e, json) => {
  const res = await dialog.showSaveDialog(win, {
    title: 'Save project',
    defaultPath: 'project.fve.json',
    filters: [{ name: 'Project', extensions: ['json'] }],
  });
  if (res.canceled) return null;
  fs.writeFileSync(res.filePath, json, 'utf8');
  return res.filePath;
});

ipcMain.handle('project:open', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Open project',
    properties: ['openFile'],
    filters: [{ name: 'Project', extensions: ['json'] }],
  });
  if (res.canceled) return null;
  return fs.readFileSync(res.filePaths[0], 'utf8');
});

ipcMain.handle('export:start', async (_e, project) => {
  const preset = process.env.FVE_GUI_EXPORT;
  let filePath = preset || null;
  if (!filePath) {
    const res = await dialog.showSaveDialog(win, {
      title: 'Export video',
      defaultPath: 'export.mp4',
      filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
    });
    if (res.canceled) return { canceled: true };
    filePath = res.filePath;
  }
  try {
    currentExport = runExport(project, filePath, (p) => win.webContents.send('export:progress', p));
    await currentExport.promise;
    return { ok: true, file: filePath };
  } catch (e) {
    if (currentExport?.canceled) return { canceled: true };
    return { ok: false, error: e.message };
  } finally {
    currentExport = null;
  }
});

ipcMain.handle('export:cancel', () => {
  if (!currentExport) return;
  currentExport.canceled = true;
  currentExport.cancel();
});
ipcMain.handle('shell:show', (_e, file) => shell.showItemInFolder(file));
ipcMain.handle('media:waveform', async (_e, file) => {
  try { return await extractWaveform(file); } catch { return null; }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
