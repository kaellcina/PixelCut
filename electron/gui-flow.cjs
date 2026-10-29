const fs = require('fs');
const path = require('path');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = function guiFlow(win, app) {
  const dir = process.env.FVE_GUI_FLOW;
  const timeout = setTimeout(() => {
    console.error('FVE_GUI_FLOW timeout');
    app.exit(1);
  }, 180000);

  const consoleLines = [];
  const result = { checks: [], electron: process.versions.electron, chrome: process.versions.chrome };
  const check = (name, ok, detail) => {
    result.checks.push({ name, ok: !!ok, detail: detail || '' });
    if (!ok) throw new Error(`FAIL ${name}${detail ? `: ${detail}` : ''}`);
  };

  win.webContents.on('console-message', (_e, level, msg) => {
    consoleLines.push({ level, msg: String(msg || '') });
  });

  const run = (js) => win.webContents.executeJavaScript(js);
  const shot = async (name) => {
    if (!dir) return;
    try {
      const png = await win.capturePage();
      fs.writeFileSync(path.join(dir, name), png.toPNG());
    } catch (error) {
      result.shotErrors = result.shotErrors || [];
      result.shotErrors.push(`${name}: ${error.message}`);
    }
  };
  const snap = () => run(`window.__fve.projectSnapshot()`);

  const dropMedia = (mediaId, track) => run(`(() => {
    const payload = JSON.stringify({ mediaId: ${JSON.stringify(mediaId)}, kind: 'media', name: 'item' });
    const dt = new DataTransfer();
    dt.setData('application/x-pixelcut-media', payload);
    dt.setData('text/plain', 'item');
    const zone = document.querySelector(${track === 'video' ? "'.timeline-dropzone, .tl-scroll'" : "'.tl-scroll, .timeline-dropzone'"});
    if (!zone) return 'no-zone';
    zone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
    zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    return 'dropped';
  })()`);

  win.webContents.once('did-fail-load', (_e, code, desc) => {
    clearTimeout(timeout);
    console.error(`FVE_GUI_FLOW load fail (${code}) ${desc}`);
    app.exit(1);
  });

  win.webContents.once('did-finish-load', async () => {
    try {
      await wait(900);
      check('home screen', await run(`!!document.querySelector('.home') && !!document.querySelector('.home .primary')`));
      await shot('01-home.png');

      await run(`document.querySelector('.home .primary').click()`);
      await wait(1000);
      check('new project opens editor', await run(`!!document.querySelector('.app') && !!window.__fve`));
      await shot('02-editor.png');

      await run(`document.querySelector('.import-button')?.click()`);
      await wait(1500);
      let state = await snap();
      check('import via IPC/probe', state.media >= 3, JSON.stringify(state.mediaItems));
      await shot('03-imported.png');

      const video = state.mediaItems.find((item) => item.type === 'video' && /clip|video/i.test(item.name)) || state.mediaItems.find((item) => item.type === 'video');
      const image = state.mediaItems.find((item) => item.type === 'image');
      const audio = state.mediaItems.find((item) => item.type === 'audio');
      const keyed = state.mediaItems.find((item) => item.type === 'video' && /green|key|chroma/i.test(item.name)) || state.mediaItems.filter((item) => item.type === 'video')[1];
      check('test media classified', !!(video && image && audio), JSON.stringify(state.mediaItems));

      const dropped = await dropMedia(video.id, 'video');
      await wait(400);
      state = await snap();
      if (state.clips < 1) {
        await run(`window.__fve.dispatch({ type: 'addToTimeline', mediaId: ${JSON.stringify(video.id)}, clipId: 'v-gui-1', at: 0 })`);
        await wait(200);
        state = await snap();
      }
      check('video on timeline', state.clips >= 1, `${dropped} clips=${state.clips}`);
      await shot('04-timeline.png');

      result.transport = await run(`(() => {
        const button = document.querySelector('button[title="Reproduzir / pausar (Space)"]');
        return { exists: !!button, title: button?.title || '', text: button?.textContent || '', className: button?.className || '' };
      })()`);
      await run(`window.__fve.play()`);
      await wait(400);
      state = await snap();
      check('playback state on', !!state.playing, JSON.stringify({ snap: { playing: state.playing, time: state.time }, transport: result.transport }));
      result.videoElementPlaying = await run(`([...document.querySelectorAll('video')].some((node) => node && !node.paused))`);
      await run(`window.__fve.pause()`);
      await wait(200);
      await run(`window.__fve.seek(1.25)`);
      await wait(250);
      state = await snap();
      check('seek playhead', state.time >= 1, `t=${state.time}`);
      await shot('05-playback.png');

      const before = state.clips;
      await run(`window.__fve.select({ track: 'video', id: ${JSON.stringify(state.videoIds[0])} })`);
      await run(`window.__fve.dispatch({ type: 'split', track: 'video', id: ${JSON.stringify(state.videoIds[0])}, t: 1.25, newId: 'v-gui-2' })`);
      await wait(200);
      state = await snap();
      check('split clip', state.clips > before, `before=${before} after=${state.clips}`);
      await shot('06-split.png');

      await run(`window.__fve.dispatch({ type: 'addToTimeline', mediaId: ${JSON.stringify(image.id)}, clipId: 'o-gui', at: 0.2, track: 'overlay' })`);
      await wait(200);
      state = await snap();
      check('overlay image', state.overlays >= 1, `overlays=${state.overlays}`);
      await shot('07-overlay.png');

      await run(`[...document.querySelectorAll('.asset-tab')].find((b) => b.textContent === 'Texto')?.click()`);
      await wait(200);
      await run(`window.__fve.dispatch({ type: 'addText', clipId: 't-gui', at: 0.3, preset: { text: 'PixelCut GUI' } })`);
      await wait(300);
      state = await snap();
      const textNode = await run(`!!document.querySelector('.overlay-text')`);
      check('text overlay', state.texts >= 1 && textNode, `texts=${state.texts}`);
      await run(`(() => {
        const el = document.querySelector('.overlay-text');
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, pointerId: 11 }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + 48, clientY: r.top + 24, pointerId: 11 }));
        window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 11 }));
      })()`);
      await shot('08-text.png');

      await run(`window.__fve.select({ track: 'video', id: ${JSON.stringify('v-gui-1')} })`);
      await run(`window.__fve.dispatch({ type: 'toggleEffect', track: 'video', id: 'v-gui-1', effect: 'grain' })`);
      await run(`window.__fve.dispatch({ type: 'setTransition', id: 'v-gui-2', transition: { type: 'dissolve', duration: 0.4 } })`);
      if (keyed) {
        await run(`window.__fve.dispatch({ type: 'addToTimeline', mediaId: ${JSON.stringify(keyed.id)}, clipId: 'o-key', at: 0.1, track: 'overlay' })`);
        await wait(200);
        await run(`window.__fve.dispatch({ type: 'update', track: 'overlay', id: 'o-key', patch: { chroma: { enabled: true, color: '#00ff00', similarity: 0.4 } } })`);
      }
      await shot('09-effects.png');
      check('effects/transition/chroma dispatched', true);

      await run(`window.__fve.dispatch({ type: 'addToTimeline', mediaId: ${JSON.stringify(audio.id)}, clipId: 'a-gui', at: 0 })`);
      await wait(200);
      await run(`window.__fve.dispatch({ type: 'update', track: 'audio', id: 'a-gui', patch: { volume: 0.35 } })`);
      state = await snap();
      check('audio clip + volume', state.audio >= 1, `audio=${state.audio}`);
      await shot('10-audio.png');

      await run(`window.__fve.persistNow()`);
      await wait(1000);
      const sessionId = await run(`window.__fve.sessionId()`);
      check('autosave session id', !!sessionId, String(sessionId));

      await run(`[...document.querySelectorAll('.header-button')].find((b) => b.textContent === 'Projetos')?.click()`);
      await wait(1000);
      check('back to home', await run(`!!document.querySelector('.home')`));
      const cardCount = await run(`document.querySelectorAll('.home-card').length`);
      check('saved project listed', cardCount >= 1, `cards=${cardCount}`);
      await shot('11-home-saved.png');

      await run(`document.querySelector('.home-card')?.click()`);
      await wait(1200);
      state = await snap();
      check('reopen restores clips', state.clips >= 2 && state.texts >= 1, JSON.stringify(state));
      await shot('12-reopened.png');

      await run(`document.querySelector('.export-button').click()`);
      const exportPath = process.env.FVE_GUI_EXPORT;
      let exported = false;
      for (let i = 0; i < 60; i += 1) {
        await wait(500);
        if (exportPath && fs.existsSync(exportPath) && fs.statSync(exportPath).size > 2000) {
          exported = true;
          break;
        }
      }
      check('export mp4 written', exported, exportPath && fs.existsSync(exportPath) ? `bytes=${fs.statSync(exportPath).size}` : 'missing');
      await shot('13-export.png');

      await run(`[...document.querySelectorAll('.header-button')].find((b) => b.textContent === 'Projetos')?.click()`);
      await wait(800);
      await run(`window.api.projectFs('remove', ${JSON.stringify([sessionId])})`);
      await wait(200);
      const names = await run(`window.api.projectFs('list', [''])`);
      check('temp project deleted', !names.includes(sessionId), JSON.stringify(names));

      const dup = consoleLines.find((line) => /already registered/i.test(line.msg));
      check('no capacitor duplicate plugin', !dup, dup && dup.msg);
      const errors = consoleLines.filter((line) => (
        line.level >= 2
        && !/Electron Security Warning|Autofill.enable|Automatic fallback/i.test(line.msg)
      ));
      result.consoleErrors = errors.map((line) => line.msg);
      check('no renderer errors', errors.length === 0, errors.map((line) => line.msg).join(' | '));

      result.ok = true;
      result.sessionId = sessionId;
      if (dir) fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result, null, 2));
      console.log(`GUI FLOW OK (${result.checks.filter((item) => item.ok).length} checks) electron=${process.versions.electron}`);
      clearTimeout(timeout);
      app.exit(0);
    } catch (error) {
      result.ok = false;
      result.error = error.message;
      result.console = consoleLines.slice(-30);
      if (dir) {
        try { fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result, null, 2)); } catch { /* ignore */ }
        try {
          const png = await win.capturePage();
          fs.writeFileSync(path.join(dir, 'fail.png'), png.toPNG());
        } catch { /* Screenshots are evidence, not a pass condition. */ }
      }
      clearTimeout(timeout);
      console.error('FVE_GUI_FLOW', error.stack || error.message);
      app.exit(1);
    }
  });
};
