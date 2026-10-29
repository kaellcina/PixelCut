const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ffmpegPath, assertPixelCutBinaries } = require('./ffmpeg.cjs');

module.exports = function bootTest(win, app, { probe, extractWaveform, projects }) {
  const timeout = setTimeout(() => {
    console.error('FVE_BOOT_TEST timeout');
    app.exit(1);
  }, 60000);

  const fail = (error) => {
    clearTimeout(timeout);
    console.error('FVE_BOOT_TEST', error && error.stack ? error.stack : error);
    app.exit(1);
  };

  const consoleLines = [];
  win.webContents.on('console-message', (_e, level, msg) => {
    consoleLines.push({ level, msg: String(msg || '') });
  });

  win.webContents.once('did-finish-load', async () => {
    try {
      const isolation = await win.webContents.executeJavaScript(`({
        api: typeof window.api,
        projectFs: typeof window.api && typeof window.api.projectFs,
        require: typeof window.require,
        process: typeof window.process,
        electron: typeof window.electron,
      })`);
      if (isolation.api !== 'object' || isolation.projectFs !== 'function') {
        throw new Error(`preload API ausente: ${JSON.stringify(isolation)}`);
      }
      if (isolation.require !== 'undefined' || isolation.process !== 'undefined' || isolation.electron !== 'undefined') {
        throw new Error(`renderer não está isolado: ${JSON.stringify(isolation)}`);
      }

      const listed = await win.webContents.executeJavaScript(`window.api.projectFs('list', [''])`);
      if (!Array.isArray(listed)) throw new Error('projects:fs list não devolveu um array');

      const id = `p-boot-${Date.now()}`;
      const rel = `${id}/project.json`;
      await win.webContents.executeJavaScript(
        `window.api.projectFs('writeAtomic', ${JSON.stringify([rel, '{"schemaVersion":1,"id":"boot"}\\n'])})`,
      );
      const readBack = await win.webContents.executeJavaScript(
        `window.api.projectFs('readText', ${JSON.stringify([rel])})`,
      );
      if (!readBack || !String(readBack).includes('boot')) throw new Error('IPC write/read falhou');
      await win.webContents.executeJavaScript(`window.api.projectFs('remove', ${JSON.stringify([id])})`);
      const gone = await win.webContents.executeJavaScript(
        `window.api.projectFs('exists', ${JSON.stringify([rel])})`,
      );
      if (gone) throw new Error('IPC remove não apagou o projeto de teste');

      const bins = assertPixelCutBinaries();
      const clip = path.join(app.getPath('userData'), 'boot-probe.mp4');
      const generated = spawnSync(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'lavfi', '-i', 'color=c=0x2244aa:s=320x180:r=30:d=1',
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
        '-shortest', clip,
      ], { encoding: 'utf8' });
      if (generated.status !== 0) {
        throw new Error(`ffmpeg de boot falhou: ${generated.stderr || generated.error}`);
      }
      const info = await probe(clip);
      if (!info || !info.hasVideo || !(info.duration > 0.5)) {
        throw new Error(`probe falhou: ${JSON.stringify(info)}`);
      }
      const wave = await extractWaveform(clip);
      if (!wave || !Array.isArray(wave.peaks) || wave.peaks.length < 8) {
        throw new Error(`waveform inválida: ${JSON.stringify(wave && { peaks: wave.peaks && wave.peaks.length, duration: wave.duration })}`);
      }

      const existsViaIpc = await win.webContents.executeJavaScript(
        `window.api.mediaExists(${JSON.stringify(clip)})`,
      );
      if (existsViaIpc !== true) throw new Error('media:exists IPC falhou');

      const root = projects.root();
      if (!root || !fs.existsSync(root) || !root.startsWith(path.resolve(app.getPath('userData')))) {
        throw new Error(`userData isolado inesperado: ${root}`);
      }

      const dup = consoleLines.find((line) => /already registered/i.test(line.msg));
      if (dup) throw new Error(`aviso Capacitor inesperado: ${dup.msg}`);

      console.log(`ELECTRON BOOT OK electron=${process.versions.electron} chrome=${process.versions.chrome} node=${process.versions.node} ffmpeg=${bins.ffmpegSha} ffprobe=${bins.ffprobeSha}`);
      clearTimeout(timeout);
      app.exit(0);
    } catch (error) {
      fail(error);
    }
  });

  win.webContents.once('did-fail-load', (_e, code, desc) => {
    fail(new Error(`falha a carregar UI (${code}) ${desc}`));
  });
};
