// Automated UI smoke test: FVE_SMOKE=<dir> electron .
// Loads <dir>/project.json, takes screenshots while editing/playing, writes them to <dir>.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ffmpegPath, buildExportArgs } = require('./ffmpeg.cjs');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function pngSize(file) {
  const buf = fs.readFileSync(file);
  const png = buf.length >= 24 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG';
  if (!png) throw new Error(`Captura PNG inválida: ${path.basename(file)}`);
  return { bytes: buf.length, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Writes one still. -i is the input; -vf, -frames:v and -update are image2 output options.
// -update before -i is rejected ("Option update not found"). Without -update, a bare
// filename warns that it is not an image-sequence pattern.
function cropStill(input, output, rect) {
  const src = pngSize(input);
  let x = Math.max(0, Math.round(rect.x));
  let y = Math.max(0, Math.round(rect.y));
  let w = Math.max(2, Math.round(rect.width));
  let h = Math.max(2, Math.round(rect.height));
  if (x + w > src.width) w = src.width - x;
  if (y + h > src.height) h = src.height - y;
  execFileSync(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', input,
    '-vf', `crop=${w}:${h}:${x}:${y}`,
    '-frames:v', '1',
    '-update', '1',
    output,
  ], { stdio: 'pipe' });
  const size = pngSize(output);
  if (size.bytes < 800 || size.width < 40 || size.height < 40) {
    throw new Error(`Recorte da prévia não foi gerado: ${path.basename(output)}`);
  }
  return size;
}

module.exports = async function smoke(win, app, dir) {
  const wc = win.webContents;
  const shot = async (name) => fs.writeFileSync(path.join(dir, name), (await win.capturePage()).toPNG());
  const run = (js) => wc.executeJavaScript(js);
  const clickTab = (label) => run(`[...document.querySelectorAll('.asset-tab')].find((b) => b.textContent === ${JSON.stringify(label)}).click()`);
  const errors = [];
  const result = {};
  wc.on('console-message', (_e, level, msg) => level >= 2 && errors.push(msg));
  try {
    await wait(800);
    result.emptyTimeline = await run(`!!document.querySelector('.timeline-dropzone') && !document.querySelector('.tl-scroll')`);
    await shot('0-empty.png');

    const project = fs.readFileSync(path.join(dir, 'project.json'), 'utf8');
    await run(`window.__fve.load(${project}); window.__fve.seek(1.5);`);
    await wait(1500);
    result.tracksAfterLoad = await run(`!document.querySelector('.timeline-dropzone') && !!document.querySelector('.tl-scroll')`);
    await shot('1-loaded.png');

    result.voice = await run(`window.__fve.voiceSelfTest(1.9)`);

    // Preview audio chains: [videoA, videoB] around the c1 -> c2 transition (overlap 2.4..3.0 s).
    const chains = async (t) => {
      await run(`window.__fve.seek(${t})`);
      await wait(500);
      return run(`window.__fve.audioChains()`);
    };
    result.chainsBefore = await chains(1.2);
    result.chainsDuringTransition = await chains(2.7);
    result.chainsAfterTransition = await chains(3.6);
    result.chainsBackToStart = await chains(0.5);

    // Rapid preset switching on c1 while playing: six toggles end back at ['robot'].
    // Same clip, new preset: the old chain stays on while the new one primes (src/previewAudio.js).
    await run(`window.__fve.play()`);
    for (const [i, effect] of ['thin', 'thick', 'robot', 'thin', 'thick', 'robot'].entries()) {
      await run(`window.__fve.dispatch({ type: 'toggleAudioEffect', track: 'video', id: 'c1', effect: '${effect}' })`);
      await wait(10);
      if (i === 0) result.chainsWhilePriming = await run(`window.__fve.audioChains()`);
      await wait(50);
    }
    result.audioLatencyPlaying = await run(`window.__fve.audioLatency()`);
    result.chainsRightAfterSwitching = await run(`window.__fve.audioChains()`);
    await wait(400);
    await run(`window.__fve.pause()`);
    result.chainsAfterSwitching = await run(`window.__fve.audioChains()`);

    await run(`window.__fve.seek(1.0)`);
    await wait(400);
    result.dragStart = await run(`(() => {
      const el = document.querySelector('.overlay-text');
      const stage = document.querySelector('.stage').getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const x0 = r.left + r.width / 2;
      const y0 = r.top + r.height / 2;
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x0, clientY: y0, button: 0, pointerId: 1 }));
      const tx = stage.left + stage.width / 2 + 3;
      const ty = stage.top + stage.height / 2 + 2;
      for (let i = 1; i <= 6; i += 1) {
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: x0 + (tx - x0) * i / 6, clientY: y0 + (ty - y0) * i / 6, pointerId: 1 }));
      }
      return { from: [el.style.left, el.style.top] };
    })()`);
    await wait(250);
    result.guidesWhileDragging = await run(`({ v: !!document.querySelector('.snap-guide-v'), h: !!document.querySelector('.snap-guide-h') })`);
    await shot('2-dragging.png');
    await run(`window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))`);
    await wait(250);
    result.dragEnd = await run(`(() => {
      const el = document.querySelector('.overlay-text');
      return { left: el.style.left, top: el.style.top, selected: el.classList.contains('is-selected'), guidesLeft: !!document.querySelector('.snap-guide') };
    })()`);

    // Edge snap: bring the text's left edge 4 px from the stage's left edge.
    result.edgeDrag = await run(`(() => {
      const el = document.querySelector('.overlay-text');
      const stage = document.querySelector('.stage').getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const x0 = r.left + r.width / 2;
      const y0 = r.top + r.height / 2;
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x0, clientY: y0, button: 0, pointerId: 2 }));
      const tx = stage.left + r.width / 2 + 4;
      const ty = stage.top + stage.height * 0.3;
      for (let i = 1; i <= 6; i += 1) {
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: x0 + (tx - x0) * i / 6, clientY: y0 + (ty - y0) * i / 6, pointerId: 2 }));
      }
      return { expectedLeft: ((r.width / 2) / stage.width * 100).toFixed(2) + '%' };
    })()`);
    await wait(250);
    result.edgeGuides = await run(`({ start: !!document.querySelector('.snap-guide-v.at-start'), center: !!document.querySelector('.snap-guide-v.at-center'), h: !!document.querySelector('.snap-guide-h') })`);
    await shot('2b-edge-snap.png');
    await run(`window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 }))`);
    await wait(250);
    result.edgeDragEnd = await run(`(() => {
      const el = document.querySelector('.overlay-text');
      const stage = document.querySelector('.stage').getBoundingClientRect();
      return { left: el.style.left, top: el.style.top, edgeGapPx: +(el.getBoundingClientRect().left - stage.left).toFixed(1) };
    })()`);

    await run(`window.__fve.select({ track: 'text', id: 't1' })`);
    await run(`window.__fve.seek(0.8); window.__fve.play();`);
    await wait(2000);
    await run(`window.__fve.pause()`);
    await wait(500);
    await shot('3-played.png');
    result.timecode = await run(`document.querySelector('.tc').textContent`);

    await clickTab('Efeitos');
    await wait(3000);
    await shot('4-effects.png');
    result.effectThumbs = await run(`(() => {
      const tiles = [...document.querySelectorAll('.library .feature-tile')];
      const scenes = tiles.filter((tile) => tile.querySelector('.demo-a .sun') && tile.querySelector('.demo-a .house'));
      const tile = tiles[0] && tiles[0].getBoundingClientRect();
      return {
        count: tiles.length,
        scenes: scenes.length,
        tileWidth: tile ? Math.round(tile.width) : 0,
        zoom: ['Zoom In', 'Zoom Out'].filter((name) => tiles.some((tile) => tile.querySelector('strong')?.textContent === name)),
      };
    })()`);
    await run(`(() => {
      const tile = [...document.querySelectorAll('.library .feature-tile')].find((el) => el.querySelector('strong')?.textContent === 'Zoom In');
      tile.scrollIntoView({ block: 'center' });
    })()`);
    await wait(500);
    await shot('4b-zoom.png');
    await run(`document.querySelectorAll('.library .feature-tile')[2].dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse', pointerId: 3 }))`);
    await wait(900);
    result.peek = await run(`(() => {
      const peek = document.querySelector('.fx-peek');
      if (!peek) return null;
      const r = peek.getBoundingClientRect();
      const lib = document.querySelector('.library').getBoundingClientRect();
      return { name: peek.querySelector('strong').textContent, compare: !!peek.querySelector('.mini-divider'), width: Math.round(r.width), rightOfLibrary: r.left >= lib.right };
    })()`);
    await shot('4b-effect-peek.png');
    result.demoIsolation = await run(`(() => {
      const grain = document.querySelector('[data-mark="grain"]');
      const cold = document.querySelector('[data-mark="cold"] .mini-layer');
      const night = document.querySelector('[data-mark="night"] .mini-layer');
      const layerOf = (el) => el ? { clip: getComputedStyle(el).clipPath, opacity: getComputedStyle(el).opacity } : null;
      return {
        stageDemos: document.querySelectorAll('.stage .demo-a, .stage .demo-b, .stage .mini-grain').length,
        timelineDemos: document.querySelectorAll('.tl-scroll .demo-a, .tl-scroll .fx-grain').length,
        grainLayers: grain ? grain.querySelectorAll('.fx-grain').length : 0,
        grainOpacity: grain && grain.querySelector('.fx-grain') ? getComputedStyle(grain.querySelector('.fx-grain')).opacity : '',
        cold: layerOf(cold),
        night: layerOf(night),
      };
    })()`);
    await run(`document.querySelectorAll('.library .feature-tile')[2].dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', pointerId: 3 }))`);
    await wait(200);
    result.peekHidden = await run(`!document.querySelector('.fx-peek')`);
    const peekNamed = async (name, file) => {
      await run(`(() => {
        const tile = [...document.querySelectorAll('.library .feature-tile')].find((el) => el.querySelector('strong')?.textContent === ${JSON.stringify(name)});
        tile.scrollIntoView({ block: 'nearest' });
      })()`);
      await wait(250);
      await run(`(() => {
        const tile = [...document.querySelectorAll('.library .feature-tile')].find((el) => el.querySelector('strong')?.textContent === ${JSON.stringify(name)});
        tile.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse', pointerId: 3 }));
      })()`);
      await wait(500);
      const info = await run(`(() => {
        const peek = document.querySelector('.fx-peek');
        if (!peek) return null;
        const treated = peek.querySelector('.mini-layer .demo-a');
        const grain = [...peek.querySelectorAll('.fx-grain')];
        return {
          name: peek.querySelector('strong')?.textContent || '',
          compare: !!peek.querySelector('.mini-divider'),
          scenesB: peek.querySelectorAll('.demo-b').length,
          clip: treated ? getComputedStyle(treated.parentElement).clipPath : '',
          grain: grain.length,
          grainOpacity: grain[0] ? getComputedStyle(grain[0]).opacity : '',
        };
      })()`);
      await shot(file);
      const rect = await run(`(() => {
        const peek = document.querySelector('.fx-peek .mini-video');
        if (!peek) return null;
        const r = peek.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })()`);
      if (!info || !rect || rect.width < 40) throw new Error(`Prévia ampliada de ${name} não abriu`);
      const view = await run(`[window.innerWidth, window.innerHeight]`);
      const full = pngSize(path.join(dir, file));
      const cropped = file.replace(/\.png$/, '-peek.png');
      info.capture = cropStill(path.join(dir, file), path.join(dir, cropped), {
        x: rect.x * full.width / view[0],
        y: rect.y * full.height / view[1],
        width: rect.width * full.width / view[0],
        height: rect.height * full.height / view[1],
      });
      info.capture.file = cropped;
      await run(`(() => {
        const tile = [...document.querySelectorAll('.library .feature-tile')].find((el) => el.querySelector('strong')?.textContent === ${JSON.stringify(name)});
        tile.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', pointerId: 3 }));
      })()`);
      await wait(220);
      return info;
    };
    result.coldPeek = await peekNamed('Frio', '4c-cold.png');
    result.nightPeek = await peekNamed('Noite', '4d-night.png');
    result.glitchPeek = await peekNamed('Glitch', '4e-glitch.png');
    result.pixelPeek = await peekNamed('Pixel', '4f-pixel.png');
    await clickTab('Trans');
    await wait(1400);
    result.transitionThumbs = await run(`(() => {
      const tiles = [...document.querySelectorAll('.library .feature-tile')];
      return { count: tiles.length, marked: new Set(tiles.map((tile) => tile.querySelector('[data-mark]')?.dataset.mark).filter(Boolean)).size };
    })()`);
    await shot('5-transitions.png');
    await run(`document.querySelectorAll('.library .feature-tile')[1].dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse', pointerId: 3 }))`);
    await wait(1200);
    result.transitionPeek = await run(`document.querySelector('.fx-peek strong')?.textContent || null`);
    await shot('5b-transition-peek.png');
    await run(`document.querySelectorAll('.library .feature-tile')[1].dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', pointerId: 3 }))`);

    await clickTab('Áudio');
    await wait(600);
    const audition = () => run(`(() => {
      const buttons = [...document.querySelectorAll('.listen-button')];
      return { buttons: buttons.length, disabled: buttons.filter((b) => b.disabled).length, hint: document.querySelector('.audition-hint')?.textContent || '' };
    })()`);
    await run(`window.__fve.select({ track: 'text', id: 't1' })`);
    await wait(200);
    result.auditionWithText = await audition();
    await run(`window.__fve.select({ track: 'video', id: 'c2' })`);
    await wait(200);
    result.auditionWithSilentClip = await audition();
    await run(`window.__fve.select({ track: 'video', id: 'c1' })`);
    await wait(200);
    result.auditionWithClip = await audition();
    result.audioMarks = await run(`new Set([...document.querySelectorAll('.audio-demo')].map((el) => el.dataset.mark)).size`);
    await shot('6-audio.png');
    await run(`window.__fve.select({ track: 'transition', id: 'c2' })`);
    await wait(1600);
    await shot('7-inspector-transition.png');
    result.inspector = await run(`(() => {
      const slider = document.querySelector('.inspector input[type=range]');
      return {
        libraryTiles: document.querySelectorAll('.library .feature-tile').length,
        inspectorThumbs: document.querySelectorAll('.inspector .mini-scene').length,
        inspectorGrids: document.querySelectorAll('.inspector .feature-tile').length,
        hint: document.querySelector('.inspector .catalog-intro')?.textContent || '',
        duration: slider ? slider.parentElement.querySelector('b')?.textContent : '',
        max: slider ? Number(slider.max) : null,
      };
    })()`);

    execFileSync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=0x2244aa:s=320x180:r=30:d=12',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=12',
      '-shortest', path.join(dir, 'long.mp4'),
    ], { stdio: 'pipe' });
    const longProject = {
      name: 'Long', width: 320, height: 180, fps: 30,
      media: [{ id: 'm', path: path.join(dir, 'long.mp4').replace(/\\/g, '/'), name: 'long.mp4', type: 'video', duration: 12, hasVideo: true, hasAudio: true, width: 320, height: 180 }],
      videoClips: [
        { id: 'a', mediaId: 'm', in: 0, out: 12 },
        { id: 'b', mediaId: 'm', in: 0, out: 12, transitionIn: { type: 'dissolve', duration: 0.6 } },
      ],
      overlayClips: [{ id: 'o', mediaId: 'm', start: 1, in: 0, out: 4, x: 0.5, y: 0.5, scale: 1, opacity: 0.8 }],
      textClips: [], audioClips: [],
    };
    await run(`window.__fve.pause(); window.__fve.load(${JSON.stringify(longProject)}); window.__fve.select({ track: 'transition', id: 'b' });`);
    await wait(700);
    result.longTransition = await run(`(() => {
      const slider = document.querySelector('.inspector input[type=range]');
      const max = Number(slider.max);
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setValue.call(slider, '4');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      return { beforeMax: max, shown: slider.parentElement.querySelector('b')?.textContent || '' };
    })()`);
    await wait(200);
    result.longTransition.after = await run(`document.querySelector('.inspector input[type=range]')?.parentElement.querySelector('b')?.textContent || ''`);
    await shot('8-long-transition.png');

    await run(`window.__fve.select({ track: 'overlay', id: 'o' });`);
    await wait(250);
    await run(`(() => {
      const tab = [...document.querySelectorAll('.insp-tabs button')].find((button) => button.textContent === 'Ajuste');
      tab?.click();
    })()`);
    await wait(200);
    await run(`(() => {
      const chip = [...document.querySelectorAll('.inspector .choice-chip')].find((button) => button.textContent === 'Fade In');
      chip.click();
    })()`);
    await wait(200);
    result.entrance = await run(`(() => {
      const chips = [...document.querySelectorAll('.inspector .choice-chip')].map((button) => button.textContent);
      const labels = [...document.querySelectorAll('.inspector .slider-field span')].map((field) => field.textContent);
      return { chips: chips.filter((name) => ['Nenhuma', 'Fade In', 'Scale In', 'Fade + Scale'].includes(name)), labels };
    })()`);
    await shot('9-entrance.png');

    const scrollerBox = await run(`(() => {
      const node = document.querySelector('.tl-scroll');
      const r = node.getBoundingClientRect();
      return { x: r.left + 80, y: r.top + 30 };
    })()`);
    for (let step = 0; step < 16; step += 1) {
      await run(`document.querySelector('.tl-scroll').dispatchEvent(new WheelEvent('wheel', { deltaY: -140, ctrlKey: true, clientX: ${scrollerBox.x}, clientY: ${scrollerBox.y}, bubbles: true, cancelable: true }))`);
      await wait(30);
    }
    await run(`window.__fve.seek(20);`);
    await wait(200);
    const playheadView = `(() => {
      const node = document.querySelector('.tl-scroll');
      const head = document.querySelector('.playhead').getBoundingClientRect();
      const view = node.getBoundingClientRect();
      return { scroll: Math.round(node.scrollLeft), top: node.scrollTop, visible: head.left > view.left + 8 && head.right < view.right - 8 };
    })()`;
    result.followBefore = await run(playheadView);
    await run(`window.__fve.play();`);
    await wait(1200);
    result.followDuring = await run(playheadView);
    await shot('10-follow.png');
    await run(`window.__fve.pause();`);

    const keyedPath = path.join(dir, 'keyed.mp4');
    execFileSync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=0x00ff00:s=320x180:r=30:d=1.2',
      '-vf', 'drawbox=x=0:y=0:w=24:h=180:color=red:t=fill,drawbox=x=120:y=40:w=80:h=100:color=0x3366ff:t=fill,drawbox=x=206:y=40:w=16:h=80:color=0x2b2026:t=fill,drawbox=x=248:y=120:w=24:h=20:color=0x9ca4b6:t=fill',
      '-frames:v', '36', keyedPath,
    ], { stdio: 'pipe' });
    const keyedProject = {
      name: 'Key', width: 320, height: 180, fps: 30,
      media: [{ id: 'k', path: keyedPath.replace(/\\/g, '/'), name: 'keyed.mp4', type: 'video', duration: 1.2, hasVideo: true, hasAudio: false, width: 320, height: 180 }],
      videoClips: [{ id: 'c', mediaId: 'k', in: 0, out: 1.2, zoom: { preset: 'zoomIn', from: 1, to: 2, duration: 1 }, chroma: { enabled: true, color: '#00ff00', similarity: 0.4 } }],
      overlayClips: [], textClips: [], audioClips: [],
    };
    const keyedExport = path.join(dir, 'keyed-export.mp4');
    const exportArgs = buildExportArgs(keyedProject, keyedExport, dir).args.filter((arg, index, list) => arg !== '-progress' && list[index - 1] !== '-progress');
    execFileSync(ffmpegPath, exportArgs, { stdio: 'pipe' });
    await run(`window.__fve.load(${JSON.stringify(keyedProject)}); window.__fve.pause();`);
    await wait(1200);
    const toneOf = (rgb) => {
      const [r, g, b] = rgb;
      if (r > 140 && r > g + 40 && r > b + 40) return 'red';
      if (g > 120 && g > r + 30 && g > b + 30) return 'green';
      if (b > 110 && b > r + 20 && b >= g) return 'blue';
      if (r < 70 && g < 70 && b < 70) return 'black';
      return `other(${rgb.join(',')})`;
    };
    const rgbOf = (file, x, y, ss) => {
      const raw = path.join(dir, `sample-${path.basename(file)}-${ss ?? 'still'}-${x}-${y}.rgb`);
      const args = ['-hide_banner', '-loglevel', 'error', '-y'];
      if (ss != null) args.push('-ss', String(ss));
      args.push('-i', file, '-frames:v', '1', '-vf', `crop=1:1:${Math.max(0, x)}:${Math.max(0, y)},format=rgb24`, '-f', 'rawvideo', raw);
      execFileSync(ffmpegPath, args, { stdio: 'pipe' });
      return [...fs.readFileSync(raw).subarray(0, 3)];
    };
    const previewAt = async (t, shotName) => {
      await run(`window.__fve.seek(${t});`);
      await wait(700);
      const view = await run(`(() => {
        const stage = document.querySelector('.stage').getBoundingClientRect();
        const canvas = document.querySelector('canvas.stage-video');
        const video = document.querySelector('video.stage-video');
        const shown = canvas || video;
        const matrix = shown ? getComputedStyle(shown).transform : '';
        const scale = /^matrix\\(([-0-9.]+)/.exec(matrix);
        return {
          stage: { x: stage.x, y: stage.y, width: stage.width, height: stage.height },
          canvas: !!canvas,
          videoVisibility: video ? getComputedStyle(video).visibility : '',
          scale: scale ? Number(scale[1]) : null,
          bitmap: (() => {
            if (!canvas) return null;
            try {
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              const y = Math.floor(canvas.height / 2);
              const left = ctx.getImageData(8, y, 1, 1).data;
              const mid = ctx.getImageData(Math.floor(canvas.width * 0.25), y, 1, 1).data;
              const at = (fx, fy) => [...ctx.getImageData(Math.round(fx * (canvas.width - 1)), Math.round(fy * (canvas.height - 1)), 1, 1).data];
              return { left: [...left], mid: [...mid], hair: at(214 / 320, 80 / 180), veil: at(260 / 320, 130 / 180), time: video ? video.currentTime : null, ready: video ? video.readyState : 0 };
            } catch (error) {
              return { error: error.name + ': ' + error.message };
            }
          })(),
        };
      })()`);
      await shot(shotName);
      const full = pngSize(path.join(dir, shotName));
      const screen = await run(`[window.innerWidth, window.innerHeight]`);
      const cropped = shotName.replace(/\.png$/, '-stage.png');
      cropStill(path.join(dir, shotName), path.join(dir, cropped), {
        x: view.stage.x * full.width / screen[0],
        y: view.stage.y * full.height / screen[1],
        width: view.stage.width * full.width / screen[0],
        height: view.stage.height * full.height / screen[1],
      });
      const size = pngSize(path.join(dir, cropped));
      const edge = rgbOf(path.join(dir, cropped), Math.round(size.width * 0.02), Math.round(size.height * 0.5));
      const center = rgbOf(path.join(dir, cropped), Math.round(size.width * 0.5), Math.round(size.height * 0.5));
      const plate = path.join(dir, `${shotName}.rgb`);
      execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(dir, cropped), '-f', 'rawvideo', '-pix_fmt', 'rgb24', plate], { stdio: 'pipe' });
      const pixels = fs.readFileSync(plate);
      let greens = 0;
      for (let i = 0; i < pixels.length; i += 3) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        if (g > 140 && g > r + 40 && g > b + 20) greens += 1;
      }
      return { ...view, edge: toneOf(edge), center: toneOf(center), edgeRgb: edge.join(','), centerRgb: center.join(','), greens };
    };
    const moments = [0.04, 0.5, 1];
    result.previewChromaZoom = [];
    result.exportChromaZoom = [];
    for (const [index, t] of moments.entries()) {
      const preview = await previewAt(t, `11-chroma-${index}.png`);
      const edge = rgbOf(keyedExport, 6, 90, t);
      const center = rgbOf(keyedExport, 160, 90, t);
      const exported = { t, edge: toneOf(edge), center: toneOf(center), edgeRgb: edge.join(','), centerRgb: center.join(',') };
      result.previewChromaZoom.push({ t, ...preview });
      result.exportChromaZoom.push(exported);
      if (preview.edge !== exported.edge || preview.center !== exported.center) {
        throw new Error(`Prévia e exportação divergem no zoom com chroma em ${t}s: prévia ${preview.edge}/${preview.center}, exportação ${exported.edge}/${exported.center}`);
      }
      if (preview.greens > 40) {
        throw new Error(`A prévia ainda tem franja verde no zoom com chroma em ${t}s (${preview.greens} pixels)`);
      }
      const hair = preview.bitmap && preview.bitmap.hair;
      const veil = preview.bitmap && preview.bitmap.veil;
      if (!hair || hair[3] < 200 || Math.max(hair[0], hair[1], hair[2]) < 15) {
        throw new Error(`O fio escuro sumiu no recorte em ${t}s (${hair && hair.join(',')})`);
      }
      if (!veil || veil[3] < 200 || Math.max(...veil.slice(0, 3)) < 80) {
        throw new Error(`O detalhe translúcido sumiu no recorte em ${t}s (${veil && veil.join(',')})`);
      }
    }
    const scales = result.previewChromaZoom.map((row) => row.scale);
    if (!scales[0] || Math.abs(scales[0] - 1) > 0.12 || Math.abs(scales[1] - 1.5) > 0.15 || Math.abs(scales[2] - 2) > 0.15) {
      throw new Error(`Escala do chroma não acompanha o zoom (${scales.join(', ')})`);
    }
    if (result.previewChromaZoom.some((row) => row.videoVisibility !== 'hidden' || !row.canvas)) {
      throw new Error('O clipe com chroma key não substituiu o vídeo pelo recorte');
    }
    await run(`window.__fve.dispatch({ type: 'update', track: 'video', id: 'c', patch: { chroma: null } }); window.__fve.seek(0.5);`);
    await wait(800);
    result.previewPlainZoom = await previewAt(0.5, '12-plain-zoom.png');
    if (result.previewPlainZoom.canvas || result.previewPlainZoom.videoVisibility !== 'visible') {
      throw new Error('O clipe sem chroma key passou a usar o canvas');
    }
    if (result.previewPlainZoom.edge !== 'green' || result.previewPlainZoom.center !== 'blue') {
      throw new Error(`Zoom sem chroma em 0,5s ficou ${result.previewPlainZoom.edge}/${result.previewPlainZoom.center}`);
    }
    if (Math.abs(result.previewPlainZoom.scale - 1.5) > 0.15) {
      throw new Error(`Zoom sem chroma aplicou a escala ${result.previewPlainZoom.scale}`);
    }
  } catch (e) {
    result.error = e.message;
  }
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify({ ...result, errors }, null, 2));
  app.exit(result.error ? 1 : 0);
};
