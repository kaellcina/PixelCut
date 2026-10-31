// Editor logic tests (no Electron, no FFmpeg run): preview audio planning, effect audition
// targeting and preview snapping. Imports the real renderer modules (ES modules) from src/.
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');
const { buildExportArgs } = require('../electron/ffmpeg.cjs');

// src/*.js are ES modules in a package without "type"; Node detects them but warns once per file.
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'Warning' || !/MODULE_TYPELESS|reparsing/i.test(`${w.code} ${w.message}`)) console.warn(w); });

const load = (file) => import(pathToFileURL(path.join(__dirname, '..', 'src', file)).href);

let passed = 0;
function check(name, condition, detail = '') {
  if (!condition) throw new Error(`FAIL ${name}${detail ? `: ${detail}` : ''}`);
  passed += 1;
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

function sampleProject() {
  const media = [
    { id: 'mv', path: 'C:/media/voice.mp4', name: 'voice.mp4', type: 'video', duration: 20, hasAudio: true, hasVideo: true },
    { id: 'mn', path: 'C:/media/silent.mp4', name: 'silent.mp4', type: 'video', duration: 20, hasAudio: false, hasVideo: true },
    { id: 'ma', path: 'C:/media/music.mp3', name: 'music.mp3', type: 'audio', duration: 30, hasAudio: true },
    { id: 'mi', path: 'C:/media/logo.png', name: 'logo.png', type: 'image', duration: 5, hasAudio: false },
  ];
  return {
    width: 1280, height: 720, fps: 30, media,
    videoClips: [
      { id: 'v1', mediaId: 'mv', in: 0, out: 3, volume: 1, audioEffects: ['robot'], speed: 1 },
      { id: 'v2', mediaId: 'mv', in: 4, out: 7, volume: 0.8, audioEffects: ['thin'], speed: 1, transitionIn: { type: 'dissolve', duration: 1 } },
      { id: 'v3', mediaId: 'mv', in: 8, out: 11, volume: 1, audioEffects: [], speed: 2, transitionIn: { type: 'slideleft', duration: 0.5 } },
      { id: 'v4', mediaId: 'mv', in: 12, out: 15, volume: 1, audioEffects: ['robot'], speed: 1 },
      { id: 'v5', mediaId: 'mv', in: 15, out: 17, volume: 1, audioEffects: ['robot'], speed: 1, muted: true, linkedAudio: false },
      { id: 'v6', mediaId: 'mn', in: 0, out: 2, volume: 1, audioEffects: [], speed: 1 },
    ],
    overlayClips: [{ id: 'o1', mediaId: 'mi', start: 0, in: 0, out: 5, speed: 1 }],
    textClips: [{ id: 't1', text: 'Oi', start: 0, duration: 2, x: 0.5, y: 0.5, size: 48 }],
    audioClips: [
      { id: 'a1', mediaId: 'ma', start: 2, in: 10, out: 18, volume: 0.6, effects: ['echo'], fadeIn: 1, fadeOut: 1, speed: 2 },
      { id: 'a2', mediaId: 'ma', start: 0, in: 0, out: 2, volume: 1, effects: ['robot'] },
    ],
  };
}

async function testMainTrackAudio(store, audio) {
  const p = sampleProject();
  const layout = store.videoLayout(p.videoClips);
  const [l1, l2, l3, l4, l5] = layout;

  const only1 = audio.mainTrackAudio(p, 1);
  check('A plays clip 1 with its own chain', only1.a.clipId === 'v1' && only1.a.effects.join() === 'robot' && near(only1.a.volume, 1));
  check('B is idle with no chain outside transitions', only1.b.clipId === null && only1.b.effects.length === 0 && only1.b.volume === 0);

  const mid = l2.start + l2.overlap / 2;
  const cross = audio.mainTrackAudio(p, mid);
  check('outgoing clip keeps its chain during the transition', cross.a.clipId === 'v1' && cross.a.effects.join() === 'robot');
  check('incoming clip gets its own chain during the transition', cross.b.clipId === 'v2' && cross.b.effects.join() === 'thin');
  check('chains are keyed per clip', cross.a.key !== cross.b.key);
  check('incoming clip plays from its own in point', near(cross.b.localTime, 4 + (mid - l2.start)));
  check('crossfade halves both volumes at the midpoint', near(cross.a.volume, 0.5) && near(cross.b.volume, 0.8 * 0.5));

  for (let i = 0; i <= 10; i += 1) {
    const t = l2.start + (l2.overlap * i) / 10 - 1e-9 * (i === 10);
    const s = audio.mainTrackAudio(p, t);
    const gains = s.a.volume / 1 + s.b.volume / 0.8;
    check(`crossfade gains sum to 1 (step ${i})`, near(gains, 1, 1e-6), String(gains));
  }

  const after = audio.mainTrackAudio(p, l2.start + l2.overlap + 0.2);
  check('after the transition the incoming clip moves to A with its chain', after.a.clipId === 'v2' && after.a.effects.join() === 'thin' && near(after.a.volume, 0.8));
  check('after the transition B drops its chain (no lingering effect)', after.b.key === 'idle' && after.b.effects.length === 0);

  const into3 = audio.mainTrackAudio(p, l3.start + l3.overlap / 2);
  check('incoming clip without effects gets an empty chain', into3.b.clipId === 'v3' && into3.b.effects.length === 0 && into3.a.effects.join() === 'thin');
  check('incoming clip time respects its speed', near(into3.b.localTime, 8 + (l3.overlap / 2) * 2));

  const at4 = audio.mainTrackAudio(p, l4.start + 0.1);
  check('identical effects on another clip still rebuild the chain (new key)', at4.a.effects.join() === 'robot' && at4.a.key === 'v4' && at4.a.key !== only1.a.key);
  check('hard cut has no incoming slot', at4.b.key === 'idle');

  const at5 = audio.mainTrackAudio(p, l5.start + 0.1);
  check('unlinked/muted clip is silent and carries no chain', at5.a.clipId === 'v5' && at5.a.volume === 0 && at5.a.effects.length === 0);

  check('plan does not mutate clip effect arrays', cross.b.effects !== p.videoClips[1].audioEffects);
}

function testExportMatchesPreview(store, audio) {
  const p = sampleProject();
  p.videoClips = p.videoClips.slice(0, 3);
  p.overlayClips = [];
  p.textClips = [];
  p.audioClips = [];
  const { args } = buildExportArgs(p, path.join(os.tmpdir(), 'pc-test-out.mp4'), os.tmpdir());
  const graph = args[args.indexOf('-filter_complex') + 1].split(';');
  const chainOf = (i) => graph.find((part) => part.startsWith(`[${i}:a]`)) || '';
  check('export clip 1 audio has only its robot chain', chainOf(0).includes('afftfilt') && !chainOf(0).includes('rubberband'));
  check('export clip 2 audio has only its thin chain', chainOf(1).includes('rubberband=pitch=1.9') && !chainOf(1).includes('afftfilt'));
  check('export clip 3 audio has no voice chain', !chainOf(2).includes('rubberband') && !chainOf(2).includes('afftfilt'));
  const layout = store.videoLayout(p.videoClips);
  const fades = graph.filter((part) => part.includes('acrossfade'));
  check('export crossfades audio on both transitions', fades.length === 2);
  check('export crossfade length equals the preview overlap',
    fades[0].includes(`acrossfade=d=${layout[1].overlap.toFixed(3)}`) && fades[1].includes(`acrossfade=d=${layout[2].overlap.toFixed(3)}`));
}

function testAudition(audio) {
  const p = sampleProject();
  check('no selection: no audition target', audio.auditionTarget(p, null) === null && audio.auditionPlan(p, null, 0, 'robot') === null);
  check('text selection: no audition target', audio.auditionTarget(p, { track: 'text', id: 't1' }) === null);
  check('image overlay: no audition target', audio.auditionTarget(p, { track: 'overlay', id: 'o1' }) === null);
  check('transition selection: no audition target', audio.auditionTarget(p, { track: 'transition', id: 'v2' }) === null);
  check('unknown clip id: no audition target', audio.auditionTarget(p, { track: 'audio', id: 'nope' }) === null);
  check('unlinked video: no audition target', audio.auditionTarget(p, { track: 'video', id: 'v5' }) === null);
  check('video without audio stream: no audition target', audio.auditionTarget(p, { track: 'video', id: 'v6' }) === null);

  // a1: start 2, in 10, out 18, speed 2 -> timeline length 4 s.
  const inside = audio.auditionPlan(p, { track: 'audio', id: 'a1' }, 3, 'robot');
  check('audition uses the selected audio clip media', inside.mediaPath === 'C:/media/music.mp3' && inside.clipId === 'a1');
  check('audition starts at the playhead inside the clip', near(inside.from, 10 + 1 * 2));
  check('audition keeps the clip speed', inside.rate === 2);
  check('audition stops at the clip end', near(inside.seconds, 3));
  check('audition adds the preset to the clip chain once', inside.effects.join() === 'echo,robot');
  check('audition follows the clip fade-out', near(inside.gainAt(2.5), 0.6 * 0.5) && near(inside.gainAt(0), 0.6));

  const outside = audio.auditionPlan(p, { track: 'audio', id: 'a1' }, 15, 'echo');
  check('audition outside the clip starts at its in point', near(outside.from, 10) && near(outside.seconds, 4));
  check('preset already on the clip is not duplicated', outside.effects.join() === 'echo');
  check('audition from the start follows the fade-in', near(outside.gainAt(0), 0) && near(outside.gainAt(0.5), 0.3));

  const video = audio.auditionPlan(p, { track: 'video', id: 'v2' }, 0, 'robot');
  check('linked video audition uses that clip media and chain', video.mediaPath === 'C:/media/voice.mp4' && video.effects.join() === 'thin,robot' && near(video.from, 4));
  check('linked video audition uses the clip volume', near(video.gainAt(1), 0.8));
}

function testSnap(snap) {
  const W = 640;
  const H = 360;
  const base = { halfW: 0.1, halfH: 0.05, stageW: W, stageH: H };
  const px = (n, size) => n / size;

  let r = snap.snapPosition({ ...base, x: 0.5 + px(5, W), y: 0.5 - px(4, H) });
  check('center snap on both axes', r.x === 0.5 && r.y === 0.5 && r.guides.v === 'center' && r.guides.h === 'center');

  r = snap.snapPosition({ ...base, x: 0.1 + px(6, W), y: 0.3 });
  check('left edge snap aligns the element edge with the stage', near(r.x, 0.1) && r.guides.v === 'start' && r.guides.h === null);

  r = snap.snapPosition({ ...base, x: 0.9 - px(6, W), y: 0.95 + px(3, H) });
  check('right and bottom edge snap', near(r.x, 0.9) && r.guides.v === 'end' && near(r.y, 0.95) && r.guides.h === 'end');

  r = snap.snapPosition({ ...base, x: 0.3, y: 0.05 - px(2, H) });
  check('top edge snap', near(r.y, 0.05) && r.guides.h === 'start' && r.x === 0.3 && r.guides.v === null);

  r = snap.snapPosition({ ...base, x: 0.5 + px(9, W), y: 0.1 + px(20, H) });
  check('outside tolerance: position unchanged and no guide', near(r.x, 0.5 + px(9, W)) && r.guides.v === null && r.guides.h === null);

  r = snap.snapPosition({ ...base, x: 0.5 + px(2, W), y: 0.5, disabled: true });
  check('Alt disables snapping', near(r.x, 0.5 + px(2, W)) && r.guides.v === null && r.guides.h === null);

  r = snap.snapPosition({ ...base, x: 1.4, y: -0.3, disabled: true });
  check('positions stay clamped to the stage', r.x === 1 && r.y === 0);

  r = snap.snapPosition({ ...base, halfW: 0.6, x: 0.6 + px(3, W), y: 0.5 });
  check('element wider than the stage only snaps to center', r.guides.v === null && near(r.x, 0.6 + px(3, W)));

  r = snap.snapPosition({ ...base, halfW: 0.5 - px(3, W), x: 0.5, y: 0.5 });
  check('ties prefer the center guide', r.guides.v === 'center');

  let maxJump = 0;
  for (let i = 0; i <= 2000; i += 1) {
    const x = i / 2000;
    const out = snap.snapPosition({ ...base, x, y: x });
    maxJump = Math.max(maxJump, Math.abs(out.x - x) * W, Math.abs(out.y - x) * H);
  }
  check('snapping never moves an element more than the tolerance', maxJump <= snap.SNAP_PX + 1e-9, `${maxJump.toFixed(2)} px`);
}

// Library demos must rest on the real preview treatment, and every item needs its own demonstration.
async function testEffectDemos() {
  const demos = await load('effectDemos.js');
  const catalog = await load('catalog.js');
  const motion = await load('motion.js');
  let clean = false;
  let full = false;
  for (let step = 0; step < 44; step += 1) {
    const amount = demos.demoAmount(step);
    if (amount === 0) clean = true;
    if (amount === 1) full = true;
  }
  check('an effect demo rests on the clean picture and on the full effect', clean && full);
  const green = catalog.hexToRgb('#00ff00');
  const black = catalog.hexToRgb('#000000');
  check('chroma green stays green, including a zero blue channel', green[0] === 0 && green[1] === 255 && green[2] === 0 && black[2] === 0);
  const matte = (pixel, similarity = 0.4) => catalog.chromaMatte(pixel[0], pixel[1], pixel[2], green, similarity);
  check('a scaled edge mixed with the screen is removed', matte([25, 176, 127]).alpha === 0 && matte([2, 247, 11]).alpha === 0);
  check('the solid subject stays opaque', matte([50, 99, 254]).alpha === 1);
  check('dark hair and a translucent gray detail stay', matte([43, 32, 38]).alpha === 1 && matte([156, 164, 182]).alpha === 1);
  const muted = matte([80, 95, 70], 0.4);
  check('a muted tone without enough chroma to be the screen stays', muted.alpha === 1 && muted.g === 95);
  check('a saturated green close to the screen is removed, matching export', matte([110, 150, 80], 0.32).alpha === 0);
  const glow = matte([248, 252, 0], 0.32);
  check('a semi-transparent edge stays and loses some screen green', glow.alpha > 0.5 && glow.alpha < 0.7 && glow.g < 252);
  check('an opaque subject is not darkened', matte([50, 99, 254]).g === 99);
  const phases = new Set();
  for (let step = 0; step < 46; step += 1) phases.add(demos.transitionDemo(step).phase);
  check('a transition demo shows the first shot, the change and the next shot', phases.has('a') && phases.has('mix') && phases.has('b') && phases.has('gap'));
  catalog.VIDEO_EFFECTS.forEach((effect) => {
    const exact = demos.effectTreatment(effect, 1);
    const off = demos.effectTreatment(effect, 0);
    check(`${effect.id} demo at rest is the real preview treatment`, exact.filter === (effect.filter || '') && exact.transform === (effect.transform || '') && exact.overlays.join() === (effect.overlay || ''));
    check(`${effect.id} demo starts from the untouched picture`, off.filter === '' && off.transform === '' && off.overlays.length === 0);
    const kind = demos.demoKind(effect.id);
    check(`${effect.id} has a demonstration of its own`, kind === 'amount' || kind === 'reveal' || kind === 'flip' || kind === 'tint');
    if (kind === 'tint') check(`${effect.id} fades the finished color treatment over the same picture`, demos.effectTreatment(effect, 1).filter === effect.filter);
    if (kind === 'amount' && effect.filter) {
      const mid = demos.effectTreatment(effect, 0.5);
      check(`${effect.id} eases in with the same kind of treatment`, mid.filter !== effect.filter && mid.filter.split('(')[0] === effect.filter.split('(')[0]);
    }
    if (kind === 'reveal') {
      check(`${effect.id} is shown whole, never at an in-between color`, demos.effectTreatment(effect, 0.5).filter === (effect.filter || ''));
    }
  });
  catalog.TRANSITIONS.forEach((item) => {
    const mix = motion.transitionMix(item.id, 0.45);
    check(`${item.id} demo uses the real transition`, mix && mix.a && mix.b);
  });
  const waves = new Set();
  catalog.AUDIO_EFFECTS.forEach((effect) => {
    const mark = demos.audioMark(effect.id);
    check(`${effect.id} has its own waveform`, !!mark && mark.paths.length > 0 && !waves.has(mark.paths[0]), mark && mark.paths[0]);
    if (mark) waves.add(mark.paths[0]);
  });
  check('pitch effects point up or down', ['thin', 'alien'].every((id) => demos.audioMark(id).pitch === 'up') && ['thick', 'monster', 'bass'].every((id) => demos.audioMark(id).pitch === 'down'));
  const hueOf = (filter) => {
    const match = String(filter).match(/hue-rotate\((-?\d+(?:\.\d+)?)deg\)/);
    return match ? Number(match[1]) : null;
  };
  const gradeProject = (effects) => ({
    width: 320, height: 180, fps: 30,
    media: [{ id: 'm', path: 'C:/media/a.mp4', hasAudio: false, hasVideo: true }],
    videoClips: [{ id: 'c', mediaId: 'm', in: 0, out: 1, effects }],
    overlayClips: [], textClips: [], audioClips: [],
  });
  const exportGraph = (effects) => {
    const { args } = buildExportArgs(gradeProject(effects), path.join(os.tmpdir(), 'pc-grade.mp4'), os.tmpdir());
    return args[args.indexOf('-filter_complex') + 1];
  };
  const cold = catalog.VIDEO_EFFECTS.find((item) => item.id === 'cold');
  const night = catalog.VIDEO_EFFECTS.find((item) => item.id === 'night');
  const coldHue = hueOf(cold.filter);
  const nightHue = hueOf(night.filter);
  check('Frio is a small cool shift', coldHue < 0 && coldHue > -40);
  check('Noite stays on the cool side of the wheel', nightHue < 0 && nightHue > -40);
  check('export Frio uses the preview hue', exportGraph(['cold']).includes(`hue=h=${coldHue}`));
  check('export Noite uses the preview hue and the same saturation', exportGraph(['night']).includes(`hue=h=${nightHue}`) && exportGraph(['night']).includes('saturation=0.65'));
  catalog.TEXT_ANIMS.forEach((anim) => {
    const shown = motion.textMotion({ text: 'Olá', animation: anim.id, duration: 3, animationDuration: 0.55, start: 0 }, 0.2);
    check(`${anim.id} text demo comes from the real motion`, shown && typeof shown.opacity === 'number' && typeof shown.text === 'string');
  });
}

function gradeProject(clips, overlays = []) {
  return {
    width: 320, height: 180, fps: 30,
    media: [{ id: 'm', path: 'C:/media/a.mp4', hasAudio: false, hasVideo: true, duration: 30 }],
    videoClips: clips,
    overlayClips: overlays,
    textClips: [],
    audioClips: [],
  };
}

async function testClipMotion(store) {
  const motion = await load('motion.js');
  const long = { id: 'a', mediaId: 'm', in: 0, out: 12 };
  const next = { id: 'b', mediaId: 'm', in: 0, out: 12, transitionIn: { type: 'dissolve', duration: 4 } };
  check('a long cut can hold a 4s transition', near(store.transitionOverlap(long, next), 4));
  check('a saved 0.5s transition stays 0.5s', near(store.transitionOverlap(long, { ...next, transitionIn: { type: 'dissolve', duration: 0.5 } }), 0.5));
  const short = { id: 's', mediaId: 'm', in: 0, out: 1, transitionIn: { type: 'dissolve', duration: 5 } };
  check('a transition cannot exceed the clips', store.transitionOverlap({ ...long, out: 1 }, short) < 0.5);
  const tiny = { id: 't', mediaId: 'm', in: 0, out: 0.3, transitionIn: { type: 'dissolve', duration: 5 } };
  check('a short cut does not invent extra overlap', store.transitionOverlap(tiny, tiny) <= 0.11);
  check('transition room never passes 5s', store.transitionRoom(long, next) <= 5);
  const graph = buildExportArgs(gradeProject([long, next]), path.join(os.tmpdir(), 'pc-zoom.mp4'), os.tmpdir()).args.join(' ');
  check('export uses the same 4s overlap', graph.includes('xfade=transition=fade:duration=4.000'));

  const zoomIn = { zoom: { preset: 'zoomIn', from: 1, to: 1.2, duration: 1 } };
  check('zoom in starts at 100%', near(motion.clipZoom(zoomIn, 0, 4), 1));
  check('zoom in ends at 120% and holds', near(motion.clipZoom(zoomIn, 1, 4), 1.2) && near(motion.clipZoom(zoomIn, 3, 4), 1.2));
  const zoomOut = { zoom: { preset: 'zoomOut', from: 1.2, to: 1, duration: 1 } };
  check('zoom out starts larger and settles at 100%', near(motion.clipZoom(zoomOut, 0, 4), 1.2) && near(motion.clipZoom(zoomOut, 1, 4), 1));
  check('a clip without zoom keeps scale 1', motion.clipZoom({}, 0.4, 4) === 1);

  const fade = { scale: 1, opacity: 0.5, enter: { type: 'fade', duration: 0.6, scale: 0.85 } };
  const faded = motion.overlayMotion(fade, 0, 3);
  const fadedEnd = motion.overlayMotion(fade, 0.6, 3);
  check('fade in starts clear and keeps the base opacity', near(faded.opacity, 0) && near(fadedEnd.opacity, 0.5) && near(faded.scale, 1));
  const curveClip = { scale: 1, opacity: 0.5, enter: { type: 'fade', duration: 1, scale: 1 } };
  const opacityAt = (local) => motion.overlayMotion(curveClip, local, 4).opacity;
  const eased = (local) => 0.5 * motion.smoothstep(local);
  check('fade curve matches smoothstep at the start, 25%, 50%, 75% and the end',
    near(opacityAt(0), 0) && near(opacityAt(0.25), eased(0.25)) && near(opacityAt(0.5), eased(0.5))
    && near(opacityAt(0.75), eased(0.75)) && near(opacityAt(1), 0.5));
  check('fade opacity stays on the base value after the entrance', near(opacityAt(1.2), 0.5) && near(opacityAt(3), 0.5));
  const scaled = { scale: 1, opacity: 1, enter: { type: 'scale', duration: 0.6, scale: 0.85 } };
  check('scale in starts at 85% and rests at the clip scale', near(motion.overlayMotion(scaled, 0, 3).scale, 0.85) && near(motion.overlayMotion(scaled, 0.6, 3).scale, 1));
  const both = { scale: 1, opacity: 1, enter: { type: 'both', duration: 0.6, scale: 0.85 } };
  check('fade and scale run together', near(motion.overlayMotion(both, 0, 3).opacity, 0) && near(motion.overlayMotion(both, 0, 3).scale, 0.85));
  check('an old overlay has no entrance', near(motion.overlayMotion({ scale: 0.4, opacity: 0.8 }, 0, 3).scale, 0.4) && near(motion.overlayMotion({ scale: 0.4, opacity: 0.8 }, 0, 3).opacity, 0.8));

  const zoomed = buildExportArgs(gradeProject([{ ...long, out: 2, zoom: zoomIn.zoom }]), path.join(os.tmpdir(), 'pc-zoom.mp4'), os.tmpdir()).args.join(' ');
  check('export zooms the clip from its center', zoomed.includes('zoompan=') && zoomed.includes("x='iw/2-(iw/zoom/2)'"));
  const plain = buildExportArgs(gradeProject([{ ...long, out: 2 }]), path.join(os.tmpdir(), 'pc-zoom.mp4'), os.tmpdir()).args.join(' ');
  check('a clip without zoom is not zoomed on export', !plain.includes('zoompan='));
  const entered = buildExportArgs(gradeProject([long], [{
    id: 'o', mediaId: 'm', start: 1, in: 0, out: 3, scale: 1, opacity: 1, x: 0.5, y: 0.5,
    enter: { type: 'both', duration: 0.6, scale: 0.85 },
  }]), path.join(os.tmpdir(), 'pc-zoom.mp4'), os.tmpdir()).args.join(' ');
  check('export fades with the preview smoothstep and scales the entrance', entered.includes('geq=') && entered.includes('alpha(X,Y)*1.000*') && entered.includes('eval=frame') && !entered.includes('fade=t=in'));
  const halfFade = buildExportArgs(gradeProject([long], [{
    id: 'o', mediaId: 'm', start: 0, in: 0, out: 3, scale: 1, opacity: 0.5, x: 0.5, y: 0.5,
    enter: { type: 'fade', duration: 1, scale: 1 },
  }]), path.join(os.tmpdir(), 'pc-zoom.mp4'), os.tmpdir()).args.join(' ');
  check('export multiplies the entrance by the base opacity', halfFade.includes('alpha(X,Y)*0.500*') && halfFade.includes('(T-0.000)/1.000'));
  const keyedZoom = buildExportArgs(gradeProject([{
    ...long, out: 2, zoom: zoomIn.zoom, chroma: { enabled: true, color: '#00ff00', similarity: 0.32 },
  }]), path.join(os.tmpdir(), 'pc-zoom.mp4'), os.tmpdir()).args.join(' ');
  check('a keyed clip keeps the centered zoom', keyedZoom.includes('zoompan=') && keyedZoom.includes('chromakey=0x00ff00'));
  check('a zoom without chroma is not keyed', zoomed.includes('zoompan=') && !zoomed.includes('chromakey='));

  const saved = gradeProject([long, { ...next, transitionIn: { type: 'dissolve', duration: 0.5 } }]);
  const loaded = store.historyReducer({ past: [], present: store.emptyProject(), future: [] }, { type: 'load', project: saved });
  check('opening a project keeps its transition duration', loaded.present.videoClips[1].transitionIn.duration === 0.5);
  const blob = 'blob:http://localhost/clip';
  check('a browser media address is left untouched', store.toFileUrl(blob) === blob && store.toFileUrl('https://localhost/a.mp4') === 'https://localhost/a.mp4');
  check('a Windows path still becomes a file URL', store.toFileUrl('C:\\media\\clip.mp4') === 'file:///C:/media/clip.mp4');
  const engine = await load('platform/mediaEngine.js');
  check('desktop export stays on ffmpeg', engine.engineFor('electron').ready === true && engine.engineFor('electron').id === 'ffmpeg');
  check('android main-track export is ready', engine.engineFor('android').ready === true && engine.engineFor('android').id === 'media3-transformer');
  check('browser export stays unavailable', engine.engineFor('browser').ready === false);
  check('android still does not claim the desktop effects', engine.ANDROID_NATIVE_GAPS.some((gap) => gap.id === 'transition') && engine.ANDROID_NATIVE_GAPS.some((gap) => gap.id === 'chroma') && engine.ANDROID_NATIVE_GAPS.length >= 8);
  const overlay = engine.ANDROID_NATIVE_GAPS.find((gap) => gap.id === 'overlay');
  check('overlays are not described as exported', overlay.android.includes('não entram'));
  const playback = 'https://localhost/_capacitor_file_/data/user/0/com.pixelcut.editor/files/media/a.mp4';
  check('android playback address is not rewritten', store.toFileUrl(playback) === playback);
}

function testWindowsExportDuration(store) {
  const media = [
    { id: 'mv', path: 'C:/media/v.mp4', name: 'v.mp4', type: 'video', duration: 8, hasAudio: true, hasVideo: true },
    { id: 'mi', path: 'C:/media/logo.png', name: 'logo.png', type: 'image', duration: 5, hasAudio: false },
    { id: 'ma', path: 'C:/media/music.mp3', name: 'music.mp3', type: 'audio', duration: 30, hasAudio: true },
  ];
  const video = { id: 'v1', mediaId: 'mv', in: 0, out: 3, volume: 1, muted: false, linkedAudio: true, speed: 1 };
  const overlay = { id: 'o1', mediaId: 'mi', start: 0, in: 0, out: 5, x: 0.5, y: 0.5, scale: 1, speed: 1 };
  const dashT = (args) => {
    const i = args.indexOf('-t');
    return i >= 0 ? Number(args[i + 1]) : NaN;
  };
  const graphOf = (project) => {
    const built = buildExportArgs(project, path.join(os.tmpdir(), 'pc-dur.mp4'), os.tmpdir());
    return { ...built, graph: built.args[built.args.indexOf('-filter_complex') + 1] };
  };

  const videoOnly = {
    width: 1280, height: 720, fps: 30, media,
    videoClips: [video], overlayClips: [], textClips: [], audioClips: [],
  };
  const videoGraph = graphOf(videoOnly);
  check('video-only export matches the 3s clip', near(store.projectDuration(videoOnly), 3) && near(videoGraph.total, 3) && near(dashT(videoGraph.args), 3));
  check('video-only export does not invent a tail canvas', !videoGraph.graph.includes('[vcanvas]') && !videoGraph.graph.includes('tpad='));

  const longOverlay = {
    ...videoOnly,
    overlayClips: [overlay],
  };
  const overlayGraph = graphOf(longOverlay);
  check('3s video + 5s overlay uses the timeline duration', near(store.projectDuration(longOverlay), 5) && near(store.exportDuration(longOverlay), 3));
  check('Windows FFmpeg -t follows projectDuration, not V1 alone', near(overlayGraph.total, 5) && near(dashT(overlayGraph.args), 5));
  check('overlay tail sits on a black canvas and does not freeze V1', overlayGraph.graph.includes('color=c=black') && overlayGraph.graph.includes('eof_action=pass') && !overlayGraph.graph.includes('tpad='));

  const longText = {
    ...videoOnly,
    textClips: [{ id: 't1', text: 'Oi', start: 0, duration: 5, x: 0.5, y: 0.85, size: 48, color: '#ffffff' }],
  };
  const textGraph = graphOf(longText);
  check('3s video + 5s text exports 5s', near(textGraph.total, 5) && near(dashT(textGraph.args), 5));

  const longAudio = {
    ...videoOnly,
    audioClips: [{ id: 'a1', mediaId: 'ma', start: 0, in: 0, out: 6, volume: 1, speed: 1 }],
  };
  const audioGraph = graphOf(longAudio);
  check('3s video + 6s audio exports 6s and mixes to the longest stream', near(audioGraph.total, 6) && audioGraph.graph.includes('duration=longest') && audioGraph.graph.includes('apad=whole_dur=6.000'));

  const inside = {
    ...videoOnly,
    overlayClips: [{ ...overlay, start: 1, out: 2 }],
  };
  const insideGraph = graphOf(inside);
  check('overlay inside V1 keeps a 3s file', near(store.projectDuration(inside), 3) && near(insideGraph.total, 3) && !insideGraph.graph.includes('[vcanvas]'));

  const first = { id: 'a', mediaId: 'mv', in: 0, out: 2, volume: 1, muted: false, linkedAudio: true, speed: 1 };
  const second = { id: 'b', mediaId: 'mv', in: 2, out: 4, volume: 1, muted: false, linkedAudio: true, speed: 1, transitionIn: { type: 'dissolve', duration: 0.5 } };
  const xfade = {
    width: 1280, height: 720, fps: 30, media,
    videoClips: [first, second], overlayClips: [], textClips: [], audioClips: [],
  };
  const xfadeGraph = graphOf(xfade);
  const expected = store.projectDuration(xfade);
  check('xfade duration is packed V1, not the sum of the clips', near(expected, 3.5) && near(xfadeGraph.total, 3.5) && !near(xfadeGraph.total, 4));
}

function source(id) {
  return `/data/user/0/com.pixelcut.editor/files/media/${id}.mp4`;
}

function media(id, extra = {}) {
  return {
    id, name: `${id}.mp4`, type: 'video', duration: 6, width: 1280, height: 720,
    hasAudio: true, hasVideo: true, source: source(id), path: `https://localhost/_capacitor_file_${source(id)}`,
    ...extra,
  };
}

function clip(id, mediaId, extra = {}) {
  return {
    id, mediaId, in: 0, out: 4, volume: 1, muted: false, linkedAudio: true,
    effects: [], effectParams: {}, audioEffects: [], speed: 1, chroma: { enabled: false },
    ...extra,
  };
}

async function testAndroidPlan(store) {
  const plan = await load('platform/exportPlan.js');
  const base = store.emptyProject();
  const first = clip('c1', 'a');
  const second = clip('c2', 'b', { in: 1, out: 3, transitionIn: { type: 'dissolve', duration: 1 } });
  const project = { ...base, width: 1279, height: 719, fps: 30, media: [media('a'), media('b')], videoClips: [first, second] };
  const exported = plan.planMainExport(project);
  const lengths = project.videoClips.reduce((sum, item) => sum + store.clipLength(item), 0);
  check('main-track clips stay in timeline order', exported.items.map((item) => item.name).join(',') === 'a.mp4,b.mp4');
  check('the cut uses the clip in and out points', exported.items[1].inMs === 1000 && exported.items[1].outMs === 3000 && exported.items[1].durationMs === 2000);
  check('android duration follows the packed timeline', exported.durationMs === Math.round(store.exportDuration(project) * 1000));
  check('a dissolve shortens the android file by the overlap', exported.durationMs < Math.round(lengths * 1000) && exported.items[1].transition === 'dissolve' && exported.items[1].overlapMs > 0);
  check('encoded dissolve is not listed as missing', !exported.warnings.includes(plan.EXPORT_LIMITS.transition) && exported.composeOverlaps === true);
  const hard = plan.planMainExport({ ...project, videoClips: [first, clip('c2', 'b', { in: 1, out: 3 })] });
  check('hard cuts stay concatenated', hard.composeOverlaps === false && hard.durationMs === Math.round(lengths * 1000) && hard.transitions.length === 0);
  const slide = plan.planMainExport({ ...project, videoClips: [first, clip('c2', 'b', { in: 1, out: 3, transitionIn: { type: 'slideleft', duration: 1 } })] });
  check('unsupported types fall back to dissolve and disclose it', slide.items[1].transition === 'dissolve' && slide.warnings.includes(plan.EXPORT_LIMITS.transition));
  const wipe = plan.planMainExport({ ...project, videoClips: [first, clip('c2', 'b', { in: 1, out: 3, transitionIn: { type: 'wipeleft', duration: 0.4 } })] });
  check('wipe is encoded with packed duration', wipe.items[1].transition === 'wipeleft' && wipe.composeOverlaps === true && !wipe.warnings.includes(plan.EXPORT_LIMITS.transition));
  check('the plan keeps the private file path', exported.items[0].source === source('a') && exported.items[0].keepAudio === true);
  check('output size matches an even editor frame', exported.width === 1278 && exported.height === 718 && exported.fps === 30);

  const fast = plan.planMainExport({ ...project, videoClips: [clip('c1', 'a', { in: 0, out: 4, speed: 2 })] });
  check('speed shortens the shown duration and stays on the item', fast.items[0].speed === 2 && fast.items[0].durationMs === 2000 && fast.items[0].outMs === 4000);

  const quiet = plan.planMainExport({ ...project, videoClips: [clip('c1', 'a', { muted: true, volume: 0.4 })] });
  check('a muted clip drops the original audio', quiet.items[0].keepAudio === false && !quiet.warnings.includes(plan.EXPORT_LIMITS.volume));
  const partial = plan.planMainExport({ ...project, videoClips: [clip('c1', 'a', { volume: 0.4 })] });
  check('partial volume is kept as original audio and disclosed', partial.items[0].keepAudio === true && partial.warnings.includes(plan.EXPORT_LIMITS.volume));
  const unlinked = plan.planMainExport({ ...project, videoClips: [clip('c1', 'a', { linkedAudio: false })] });
  check('unlinked video audio is not kept', unlinked.items[0].keepAudio === false && unlinked.warnings.includes(plan.EXPORT_LIMITS.audioTrack));
  const silent = plan.planMainExport({ ...project, media: [media('a', { hasAudio: false })], videoClips: [first] });
  check('a video without an audio track does not pretend to keep audio', silent.items[0].keepAudio === false);

  const picture = media('still', { name: 'still.png', type: 'image', duration: 5, hasAudio: false, source: source('still').replace('.mp4', '.png') });
  const imagePlan = plan.planMainExport({
    ...base,
    media: [picture],
    videoClips: [clip('c1', 'still', { in: 1, out: 3, speed: 2 })],
  });
  check('an image uses its shown duration and does not apply speed twice', imagePlan.items[0].type === 'image' && imagePlan.items[0].durationMs === 1000 && imagePlan.items[0].speed === 1 && imagePlan.items[0].keepAudio === false);

  const rich = plan.planMainExport({
    ...project,
    overlayClips: [{ id: 'o', mediaId: 'a', start: 0, in: 0, out: 2 }],
    textClips: [{ id: 't', text: 'UAU', start: 0, duration: 2 }],
    audioClips: [{ id: 'au', mediaId: 'a', start: 0, in: 0, out: 2 }],
    videoClips: [clip('c1', 'a', { effects: ['frio'], zoom: { preset: 'in' }, chroma: { enabled: true }, audioEffects: ['eco'] })],
  });
  check('only the main track becomes a sequence', rich.items.length === 1);
  check('omitted effects are warnings, not exported fields', ['effect', 'zoom', 'chroma', 'overlay', 'text', 'audioTrack', 'voice'].every((key) => rich.warnings.includes(plan.EXPORT_LIMITS[key])));

  let missing = '';
  try {
    plan.planMainExport({ ...base, media: [media('a', { source: undefined, path: 'blob:http://localhost/clip' })], videoClips: [first] });
  } catch (error) {
    missing = error.message;
  }
  check('a temporary blob address cannot be exported', missing.includes('a.mp4'));
  let empty = '';
  try {
    plan.planMainExport(base);
  } catch (error) {
    empty = error.message;
  }
  check('an empty main track is rejected', empty.includes('faixa principal'));
}

// Effect chain swaps (src/audioFx.js): new preset on the same clip primes first, new clip swaps at once.
function testChainSwap(audio) {
  check('preset change on the same clip holds the old chain while the new one primes', audio.swapHold('c1', 'c1') === audio.PRIME_SECONDS && audio.PRIME_SECONDS > 0);
  check('clip change swaps chains at once (no effect leaks into the next clip)', audio.swapHold('c1', 'c2') === 0 && audio.swapHold('c1', 'idle') === 0);
  check('swap hold plus crossfade stays short', audio.PRIME_SECONDS + audio.SWAP_SECONDS <= 0.05);
}

function testPlayback(playback) {
  const paused = playback.togglePlaybackState(true, 1.25, 3);
  check('pause keeps the current time and stops', paused.playing === false && near(paused.time, 1.25));
  const resumed = playback.togglePlaybackState(false, 1.25, 3);
  check('resume continues from the paused time', resumed.playing === true && near(resumed.time, 1.25));
  const ended = playback.togglePlaybackState(false, 2.98, 3);
  check('play at the end restarts from zero', ended.playing === true && ended.time === 0);
  const empty = playback.togglePlaybackState(false, 0, 0);
  check('an empty project does not start playback', empty.playing === false);
  const mid = playback.playbackStep(1, 0.5, 3);
  check('the clock advances inside the project', mid.ended === false && near(mid.time, 1.5));
  const end = playback.playbackStep(2.8, 0.4, 3);
  check('the clock stops at the project end', end.ended === true && near(end.time, 3));
  const session = playback.createPlaybackSession();
  const run = session.open();
  check('an open clock accepts a step', near(run.step(0, 0.2, 3).time, 0.2));
  session.close();
  check('a closed clock ignores a late step', run.step(0, 0.4, 3) === null);
  const next = session.open();
  check('a new clock runs after the previous one was closed', near(next.step(1, 0.1, 3).time, 1.1));
}

function testLeftTrimAndMove(store) {
  const media = { id: 'mv', path: 'C:/media/v.mp4', name: 'v.mp4', type: 'video', duration: 8, hasAudio: true, hasVideo: true };
  const base = {
    name: 't', width: 1280, height: 720, fps: 30, media: [media],
    videoClips: [
      { id: 'a', mediaId: 'mv', in: 0, out: 3, speed: 1 },
      { id: 'b', mediaId: 'mv', in: 0, out: 3, speed: 1 },
    ],
    overlayClips: [], textClips: [], audioClips: [],
  };
  let state = { past: [], present: base, future: [] };
  state = store.historyReducer(state, { type: 'beginGesture' });
  state = store.historyReducer(state, { type: 'update', track: 'video', id: 'a', patch: { in: 0.4 }, transient: true });
  const trimmed = state.present.videoClips[0];
  check('left trim changes the source in-point and keeps the out-point', trimmed.in === 0.4 && trimmed.out === 3 && state.present.videoClips[1].in === 0 && state.present.videoClips[1].out === 3);
  const layout = store.videoLayout(state.present.videoClips);
  check('left trim shortens the first clip and pulls the next one forward', near(layout[0].end, 2.6) && near(layout[1].start, 2.6) && near(layout[1].end - layout[1].start, 3));
  check('a playhead past the trimmed duration clamps to the new end', near(store.clampPlayhead(6, store.projectDuration(state.present)), store.projectDuration(state.present)));
  state = store.historyReducer(state, { type: 'cancelGesture' });
  check('escape restores the in-point after a left trim', state.present.videoClips[0].in === 0 && state.present.videoClips[0].out === 3);

  state = store.historyReducer(state, { type: 'beginGesture' });
  check('the insert index stays before the other clip midpoint', store.videoInsertIndex(state.present.videoClips, 'a', 1) === 0);
  check('the insert index moves past the other clip midpoint', store.videoInsertIndex(state.present.videoClips, 'a', 2) === 1);
  state = store.historyReducer(state, { type: 'moveVideo', id: 'a', toIndex: store.videoInsertIndex(state.present.videoClips, 'a', 2), transient: true });
  check('reorder keeps each clip source range', state.present.videoClips.map((clip) => clip.id).join() === 'b,a' && state.present.videoClips.every((clip) => clip.in === 0 && clip.out === 3));
  const moved = store.videoLayout(state.present.videoClips);
  check('reordered clips pack from the left and keep the same duration', moved[0].clip.id === 'b' && moved[1].clip.id === 'a' && near(moved[0].start, 0) && near(moved[1].end, 6));
  const stable = state.present;
  state = store.historyReducer(state, { type: 'moveVideo', id: 'a', toIndex: 1, transient: true });
  check('dropping a clip on its current slot keeps the same project', state.present === stable);
  state = store.historyReducer(state, { type: 'cancelGesture' });
  check('escape restores the original order', state.present.videoClips.map((clip) => clip.id).join() === 'a,b' && near(store.projectDuration(state.present), 6));
}

function testPlayheadAfterTrim(store) {
  const media = { id: 'mv', path: 'C:/media/v.mp4', name: 'v.mp4', type: 'video', duration: 8, hasAudio: true, hasVideo: true };
  const base = {
    name: 't', width: 1280, height: 720, fps: 30, media: [media],
    videoClips: [
      { id: 'a', mediaId: 'mv', in: 0, out: 3, speed: 1 },
      { id: 'b', mediaId: 'mv', in: 1, out: 4, speed: 1 },
      { id: 'c', mediaId: 'mv', in: 2, out: 5, speed: 1 },
    ],
    overlayClips: [{ id: 'o', mediaId: 'mv', start: 2.5, in: 0, out: 1, speed: 1 }],
    textClips: [{ id: 't', text: 'Oi', start: 4, duration: 1 }],
    audioClips: [],
  };
  const before = store.videoLayout(base.videoClips);
  check('three main clips pack from the left', near(before[0].start, 0) && near(before[1].start, 3) && near(before[2].end, 9));

  let state = { past: [], present: base, future: [] };
  state = store.historyReducer(state, { type: 'beginGesture' });
  state = store.historyReducer(state, { type: 'update', track: 'video', id: 'b', patch: { out: 2 }, transient: true });
  state = store.historyReducer(state, { type: 'endGesture' });
  const next = state.present;
  const layout = store.videoLayout(next.videoClips);
  check('only the middle clip source out-point changes', next.videoClips[0].out === 3 && next.videoClips[1].in === 1 && next.videoClips[1].out === 2 && next.videoClips[2].in === 2 && next.videoClips[2].out === 5);
  check('the following main clip closes the gap and keeps its own length', near(layout[1].start, 3) && near(layout[2].start, 4) && near(layout[2].end - layout[2].start, 3));
  check('overlay and text stay on their own time', next.overlayClips[0].start === 2.5 && next.textClips[0].start === 4);
  const duration = store.projectDuration(next);
  check('project duration is the packed end', near(duration, 7));
  check('a playhead left at the old end clamps to the new duration', store.formatTime(store.clampPlayhead(9, duration)) === '00:07.00');
  check('a playhead still inside the project is unchanged', near(store.clampPlayhead(3.5, duration), 3.5));
  check('the old over-long counter is clamped', store.formatTime(store.clampPlayhead(3, 1.98)) === '00:01.98');
}

(async () => {
  const store = await load('store.js');
  const audio = await load('previewAudio.js');
  const snap = await load('snap.js');
  const playback = await load('playback.js');
  testPlayback(playback);
  testLeftTrimAndMove(store);
  testPlayheadAfterTrim(store);
  await testMainTrackAudio(store, audio);
  testExportMatchesPreview(store, audio);
  testAudition(audio);
  testChainSwap(audio);
  testSnap(snap);
  await testEffectDemos();
  await testClipMotion(store);
  testWindowsExportDuration(store);
  await testAndroidPlan(store);
  console.log(`EDITOR LOGIC OK (${passed} checks)`);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
