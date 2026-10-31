const path = require('path');
const { pathToFileURL } = require('url');

process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'Warning' || !/MODULE_TYPELESS|reparsing/i.test(`${w.code} ${w.message}`)) console.warn(w); });

const load = (file) => import(pathToFileURL(path.join(__dirname, '..', 'src', file)).href);

let passed = 0;
function check(name, condition, detail = '') {
  if (!condition) throw new Error(`FAIL ${name}${detail ? `: ${detail}` : ''}`);
  passed += 1;
}

(async () => {
  const store = await load('store.js');
  const filmstrip = await load('filmstrip.js');
  const waveform = await load('waveform.js');
  const autosaveMod = await load('projects/autosave.js');

  check('mobile filmstrip stays under 24 frames', filmstrip.filmstripFrameCount(180, { compact: true }) === 24);
  check('desktop filmstrip stays under 36 frames', filmstrip.filmstripFrameCount(180, { compact: false }) === 36);
  check('short clips still get several thumbs', filmstrip.filmstripFrameCount(2, { compact: true }) >= 6);
  check('visible tiles stay capped on a long zoomed clip', filmstrip.filmstripTileCount(20000, 56, { compact: true }) === 24);
  check('desktop tiles stay capped', filmstrip.filmstripTileCount(20000, 56, { compact: false }) === 36);

  const prevWindow = global.window;
  global.window = { Capacitor: { isNativePlatform: () => true } };
  check('android skips in-page decode of native video', waveform.canDecodeWaveformInRenderer({ path: '/data/media/a.mp4', type: 'video' }) === false);
  check('android still allows dedicated audio files', waveform.canDecodeWaveformInRenderer({ path: '/data/media/a.m4a', type: 'audio' }) === true);
  global.window = prevWindow;

  const built = store.buildProjectFromImportedMedia([
    { name: 'cena.mp4', type: 'video', path: '/data/user/0/com.pixelcut.editor/files/media/cena.mp4', duration: 12, source: '/data/user/0/com.pixelcut.editor/files/media/cena.mp4' },
    { name: 'foto.jpg', type: 'image', path: '/data/user/0/com.pixelcut.editor/files/media/foto.jpg', duration: 5, source: '/data/user/0/com.pixelcut.editor/files/media/foto.jpg' },
    { name: 'fail.mp4', error: 'cancelado' },
  ]);
  check('picker project is named after the first file', built.name === 'cena');
  check('videos and photos land on the main track', built.videoClips.length === 2 && built.overlayClips.length === 0);
  check('failed picker rows are ignored', built.media.length === 2);
  check('owned android paths stay in the project', built.media[0].path.includes('/files/media/cena.mp4'));
  check('empty picker does not invent clips', store.buildProjectFromImportedMedia([]).videoClips.length === 0);

  let state = { past: [], present: built, future: [] };
  state = store.historyReducer(state, { type: 'load', project: built });
  check('opening a filled project does not create undo noise', state.past.length === 0);
  const clipId = built.videoClips[0].id;
  state = store.historyReducer(state, { type: 'delete', track: 'video', id: clipId });
  check('delete is undoable', state.past.length === 1 && state.present.videoClips.length === 1);
  state = store.historyReducer(state, { type: 'undo' });
  check('undo restores the main track', state.present.videoClips.length === 2 && state.present.videoClips[0].id === clipId);
  state = store.historyReducer(state, { type: 'redo' });
  check('redo reapplies the delete', state.present.videoClips.length === 1);

  const writes = [];
  const autosave = autosaveMod.createAutosave({
    delay: 0,
    save: async (payload) => { writes.push(payload.mark); },
  });
  autosave.schedule({ mark: 'after-edit' }, 'a');
  await autosave.flush();
  autosave.schedule({ mark: 'after-edit' }, 'a');
  await autosave.flush();
  check('identical timeline fingerprints do not rewrite autosave', writes.join() === 'after-edit');
  autosave.schedule({ mark: 'after-undo' }, 'b');
  await autosave.flush();
  check('undo/redo still persist the restored timeline', writes[writes.length - 1] === 'after-undo');

  // Toggle on -> off -> on inside one debounce: the lazy payload reads live state, like App.jsx does.
  let live = 'a';
  const toggled = [];
  const lazy = autosaveMod.createAutosave({ delay: 0, save: async (payload) => { toggled.push(payload.mark); } });
  lazy.schedule(() => ({ mark: live }), live);
  await lazy.flush();
  live = 'b';
  lazy.schedule(() => ({ mark: live }), live);
  live = 'a';
  lazy.schedule(() => ({ mark: live }), live);
  await lazy.flush();
  live = 'b';
  lazy.schedule(() => ({ mark: live }), live);
  await lazy.flush();
  check('reverting a queued edit and redoing it still saves the final state', toggled[toggled.length - 1] === 'b');

  const beta = store.buildProjectFromImportedMedia([{
    id: 'legacy',
    name: 'beta.mp4',
    type: 'video',
    path: '/data/user/0/com.pixelcut.editor/files/media/beta.mp4',
    source: '/data/user/0/com.pixelcut.editor/files/media/beta.mp4',
    duration: 8,
  }]);
  check('beta-shaped documents still pack a main clip', store.videoLayout(beta.videoClips).length === 1);

  const tracks = await load('timelineTracks.js');
  const videoOnly = {
    videoClips: [{ id: 'v1', mediaId: 'm', in: 0, out: 2, linkedAudio: true }],
    overlayClips: [],
    textClips: [],
    audioClips: [],
  };
  const vis = tracks.visibleTimelineTracks(videoOnly);
  check('empty overlay and text tracks stay collapsed', vis.video && vis.linked && !vis.overlay && !vis.overlay2 && !vis.text && !vis.audio);
  const withText = tracks.visibleTimelineTracks({ ...videoOnly, textClips: [{ id: 't', start: 0, duration: 1 }] });
  check('text track appears once it has a clip', withText.text === true);
  const stacked = tracks.visibleTimelineTracks({
    ...videoOnly,
    textClips: [
      { id: 't1', start: 0, duration: 3, lane: 0, text: 'A' },
      { id: 't2', start: 0, duration: 3, lane: 1, text: 'B' },
      { id: 't3', start: 0, duration: 3, lane: 2, text: 'C' },
    ],
  });
  check('overlapping texts use separate lanes', stacked.textRows.length === 3 && stacked.textRows[2].clips[0].id === 't3');

  const textLanes = await load('textLanes.js');
  check('a second overlapping title takes the next lane', textLanes.firstFreeTextLane([{ start: 1, duration: 3, lane: 0 }], 1, 3) === 1);
  const packed = textLanes.packedTextClips([
    { id: 'a', start: 0, duration: 3, lane: 0, text: 'A' },
    { id: 'b', start: 0, duration: 3, lane: 0, text: 'B' },
    { id: 'c', start: 0, duration: 3, lane: 0, text: 'C' },
  ]);
  check('legacy overlapping titles are unpacked onto three rows', packed.map((clip) => clip.lane).join() === '0,1,2');
  const playhead = await load('playheadView.js');
  check('reopening scrolls the ruler to the saved playhead', playhead.playheadScrollLeft(120, 56, 64, 400, 0.42) > 6000);
  check('playhead left of the viewport still needs follow', playhead.playheadNeedsFollow(80, 400, 360) === true);
  check('the playhead line is hittable away from the cap', playhead.isPlayheadHit(64 + 2 * 56, 2, 56, 64, true) === true);
  check('a 44px touch target still leaves clip bodies free', playhead.isPlayheadHit(64 + 2 * 56 + 40, 2, 56, 64, true) === false);
  check('touch hit is wider than mouse hit', playhead.playheadHitHalf(true) > playhead.playheadHitHalf(false));
  check('the middle of the timeline does not auto-scroll', playhead.edgeScrollDelta(200, 400) === 0);
  check('edge speed is progressive', Math.abs(playhead.edgeScrollDelta(0, 400)) > Math.abs(playhead.edgeScrollDelta(30, 400)));
  const rightEdge = playhead.scrubAutoScroll({
    viewportX: 390, viewWidth: 400, scrollLeft: 0, maxScroll: 8000,
    time: 5, duration: 120, pps: 56, headWidth: 64, touch: true,
  });
  check('right-edge scrub starts scrolling forward', rightEdge.delta > 0 && rightEdge.time > 5 && rightEdge.scrollLeft > 0);
  const held = playhead.scrubAutoScroll({
    viewportX: 390, viewWidth: 400, scrollLeft: rightEdge.scrollLeft, maxScroll: 8000,
    time: rightEdge.time, duration: 120, pps: 56, headWidth: 64, touch: true,
  });
  check('holding the edge keeps advancing time', held.time > rightEdge.time);
  const playX = playhead.playheadX(held.time, 56, 64);
  check('the playhead stays under the pointer while auto-scrolling', Math.abs((playX - held.scrollLeft) - 390) < 0.05);
  const atEnd = playhead.scrubAutoScroll({
    viewportX: 390, viewWidth: 400, scrollLeft: 8000, maxScroll: 8000,
    time: 120, duration: 120, pps: 56, headWidth: 64, touch: true,
  });
  check('scrubbing does not pass the project end', atEnd.time === 120 && atEnd.delta === 0 && atEnd.scrollLeft === 8000);
  const leftEdge = playhead.scrubAutoScroll({
    viewportX: 10, viewWidth: 400, scrollLeft: 200, maxScroll: 8000,
    time: 4, duration: 120, pps: 56, headWidth: 64, touch: false,
  });
  check('left-edge scrub scrolls backward', leftEdge.delta < 0 && leftEdge.time < 4);
  const atStart = playhead.scrubAutoScroll({
    viewportX: 10, viewWidth: 400, scrollLeft: 0, maxScroll: 8000,
    time: 0, duration: 120, pps: 56, headWidth: 64, touch: false,
  });
  check('scrubbing does not pass the project start', atStart.time === 0 && atStart.scrollLeft === 0);
  check('an off-screen playhead is not considered visible', playhead.playheadVisible(50, 400, 360) === false);
  const dragging = tracks.visibleTimelineTracks(videoOnly, { dragging: true });
  check('drag reveals droppable extra tracks', dragging.overlay && dragging.text && dragging.audio);

  const seekMod = await load('mediaSeek.js');
  check('playback does not coalesce live frames', seekMod.shouldCoalesceSeek(true) === false);
  const fake = {
    readyState: 2,
    currentTime: 0,
    listeners: {},
    addEventListener(name, fn) { this.listeners[name] = fn; },
    removeEventListener(name) { delete this.listeners[name]; },
  };
  const queue = seekMod.createSeekQueue();
  queue.attach(fake);
  queue.request(1.2);
  queue.request(1.8);
  queue.request(2.4);
  check('only the latest scrub target stays pending while a seek is in flight', fake.currentTime === 1.2);
  fake.listeners.seeked();
  check('the coalesced seek applies the last requested time', fake.currentTime === 2.4);
  fake.listeners.seeked();

  let cutState = { past: [], present: {
    name: 'cut', width: 1280, height: 720, fps: 30,
    media: [{ id: 'm', type: 'video', duration: 10, path: '/x.mp4' }],
    videoClips: [{ id: 'v', mediaId: 'm', in: 0, out: 10, speed: 1 }],
    overlayClips: [], textClips: [], audioClips: [],
  }, future: [] };
  cutState = store.historyReducer(cutState, { type: 'split', track: 'video', id: 'v', t: 2.5, newId: 'v2' });
  check('split at the playhead makes two clips', cutState.present.videoClips.length === 2 && cutState.present.videoClips[0].out === 2.5);
  cutState = store.historyReducer(cutState, { type: 'undo' });
  check('undo restores the uncut clip', cutState.present.videoClips.length === 1 && cutState.present.videoClips[0].out === 10);
  cutState = store.historyReducer(cutState, { type: 'redo' });
  check('redo reapplies the cut', cutState.present.videoClips.length === 2);
  const dur = store.projectDuration(cutState.present);
  check('the last clock value still maps to a clip', store.videoClipsAt(cutState.present, dur)[0]?.clip.id === 'v2');
  check('the last frame seeks before the decoder EOF', store.sourcePreviewTime({ in: 0, out: 10 }, 10, 0, 30) < 10);
  check('the first decoded frame is padded off exact in', store.sourcePreviewTime({ in: 0, out: 10 }, 0, 0, 30) > 0);
  const hardCut = {
    fps: 30,
    videoClips: [
      { id: 'a', in: 0, out: 2, speed: 1 },
      { id: 'b', in: 2, out: 5, speed: 1 },
    ],
  };
  const nudged = store.nudgePreviewTime(hardCut, 2);
  check('a hard cut previews the outgoing frame, not the incoming in', nudged < 2 && store.videoClipsAt(hardCut, nudged)[0]?.clip.id === 'a');
  cutState = store.historyReducer(cutState, { type: 'setTransition', id: 'v2', transition: { type: 'dissolve', duration: 0.4 } });
  cutState = store.historyReducer(cutState, { type: 'split', track: 'video', id: 'v2', t: 6, newId: 'v3' });
  cutState = store.historyReducer(cutState, { type: 'setTransition', id: 'v3', transition: { type: 'fadeblack', duration: 0.4 } });
  cutState = store.historyReducer(cutState, { type: 'split', track: 'video', id: 'v3', t: 8, newId: 'v4' });
  cutState = store.historyReducer(cutState, { type: 'setTransition', id: 'v4', transition: { type: 'wipeleft', duration: 0.4 } });
  check('three cuts keep three distinct transition types', cutState.present.videoClips[1].transitionIn?.type === 'dissolve' && cutState.present.videoClips[2].transitionIn?.type === 'fadeblack' && cutState.present.videoClips[3].transitionIn?.type === 'wipeleft');
  check('applying a preset uses the selected cut, not the nearest one', store.transitionApplyId(cutState.present, { track: 'transition', id: 'v3' }, 2.5) === 'v3');
  check('without a transition selection the playhead picks the nearest cut', store.transitionApplyId(cutState.present, { track: 'video', id: 'v' }, 7.5) === 'v4');
  check('a stale first-cut selection is ignored when none is selected', store.transitionApplyId(cutState.present, null, 7.5) === 'v4');
  cutState = store.historyReducer(cutState, { type: 'undo' });
  check('undo removes only the last transition', !cutState.present.videoClips[3].transitionIn && cutState.present.videoClips[2].transitionIn?.type === 'fadeblack');
  cutState = store.historyReducer(cutState, { type: 'redo' });
  check('redo restores the last transition type', cutState.present.videoClips[3].transitionIn?.type === 'wipeleft');

  const scrub = await load('audioScrub.js');
  const blips = [];
  const mediaEl = {
    paused: true,
    volume: 1,
    muted: true,
    play() { this.paused = false; blips.push('play'); return Promise.resolve(); },
    pause() { this.paused = true; blips.push('pause'); },
  };
  const scrubber = scrub.createAudioScrubber();
  const fast = scrubber.move({ mediaEl, timelineTime: 0, volume: 1, muted: false, playing: false, enabled: true });
  const fast2 = scrubber.move({ mediaEl, timelineTime: 8, volume: 1, muted: false, playing: false, enabled: true });
  check('fast playhead jumps do not stack audio blips', fast2.reason === 'fast' || fast.reason === 'off' || fast2.blip === false);
  scrubber.stop();
  const playing = scrubber.move({ mediaEl, timelineTime: 1, volume: 1, muted: false, playing: true, enabled: true });
  check('normal playback stops audio scrubbing', playing.blip === false);

  console.log(`STABILITY LOGIC OK (${passed} checks)`);
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
