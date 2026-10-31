const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { buildExportArgs } = require('../electron/ffmpeg.cjs');

process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name !== 'Warning' || !/MODULE_TYPELESS|reparsing/i.test(`${w.code} ${w.message}`)) console.warn(w);
});

const load = (file) => import(pathToFileURL(path.join(__dirname, '..', 'src', file)).href);

let passed = 0;
function check(name, condition, detail = '') {
  if (!condition) throw new Error(`FAIL ${name}${detail ? `: ${detail}` : ''}`);
  passed += 1;
}

const near = (a, b, eps = 1e-6) => Math.abs(Number(a) - Number(b)) <= eps;

function clip(id, seconds, extra = {}) {
  return {
    id,
    mediaId: 'm',
    in: 0,
    out: seconds,
    volume: 1,
    muted: false,
    linkedAudio: true,
    speed: 1,
    ...extra,
  };
}

function projectOf(videoClips, extra = {}) {
  return {
    name: 'Cortes',
    width: 1280,
    height: 720,
    fps: 30,
    media: [{ id: 'm', name: 'clip.mp4', type: 'video', duration: 30, path: 'C:/media/clip.mp4', hasAudio: true, hasVideo: true }],
    videoClips,
    overlayClips: [],
    textClips: [],
    audioClips: [],
    ...extra,
  };
}

function graphOf(project) {
  const built = buildExportArgs(project, path.join(os.tmpdir(), 'pc-trans.mp4'), os.tmpdir());
  return built.args[built.args.indexOf('-filter_complex') + 1] || '';
}

(async () => {
  const store = await load('store.js');
  const motion = await load('motion.js');
  const audio = await load('previewAudio.js');
  const plan = await load('platform/exportPlan.js');
  const { createMemoryStore } = await load('projects/memoryStore.js');
  const { createProjectRepository } = await load('projects/repository.js');

  const two = projectOf([clip('a', 4), clip('b', 4)]);
  const hard = store.projectDuration(two);
  check('two clips without a transition keep the summed duration', near(hard, 8));
  check('a hard cut does not invent overlap', store.videoLayout(two.videoClips)[1].overlap === 0);
  check('exclusive bodies meet at the cut', {
    first: store.clipExclusiveRange(store.videoLayout(two.videoClips), 0),
    second: store.clipExclusiveRange(store.videoLayout(two.videoClips), 1),
  }.first.end === 4 && store.clipExclusiveRange(store.videoLayout(two.videoClips), 1).start === 4);

  let state = { past: [], present: two, future: [] };
  state = store.historyReducer(state, { type: 'load', project: two });
  state = store.historyReducer(state, { type: 'setTransition', id: 'b', transition: { type: 'dissolve', duration: 1 } });
  const withFade = state.present;
  const faded = store.projectDuration(withFade);
  check('two clips with a 1s transition shorten the timeline by 1s', near(faded, 7) && near(hard - faded, 1));
  check('in/out points stay intact', withFade.videoClips[0].out === 4 && withFade.videoClips[1].in === 0 && withFade.videoClips[1].out === 4);
  check('the overlap equals the stored duration', near(store.videoLayout(withFade.videoClips)[1].overlap, 1));
  const band = store.transitionBand(store.videoLayout(withFade.videoClips)[1]);
  check('the transition band sits on the overlap', near(band.start, 3) && near(band.length, 1) && near(band.cut, 3.5) && band.active === true);
  const ex0 = store.clipExclusiveRange(store.videoLayout(withFade.videoClips), 0);
  const ex1 = store.clipExclusiveRange(store.videoLayout(withFade.videoClips), 1);
  check('exclusive clip bodies do not cover each other', near(ex0.end, band.start) && near(ex1.start, band.end) && ex0.length === 3 && ex1.length === 3);
  check('magnetic clip width follows time, not a min-pixel pad', near(store.clipLaneWidthPx(4, 8), 32) && near(store.clipLaneWidthPx(0.2, 8), 1.6));

  const hitsMid = store.videoClipsAt(withFade, 3.5);
  check('preview holds both clips during the overlap', hitsMid.length === 2 && hitsMid[0].clip.id === 'a' && hitsMid[1].clip.id === 'b');
  check('before the overlap only the outgoing clip is on stage', store.videoClipsAt(withFade, 2).length === 1 && store.videoClipsAt(withFade, 2)[0].clip.id === 'a');
  check('after the overlap only the incoming clip is on stage', store.videoClipsAt(withFade, 4.2).length === 1 && store.videoClipsAt(withFade, 4.2)[0].clip.id === 'b');
  const mix = motion.transitionMix('dissolve', 0.5);
  check('dissolve mixes both layers at mid-transition', near(mix.a.opacity, 0.5) && near(mix.b.opacity, 0.5));
  const heard = audio.mainTrackAudio(withFade, 3.5);
  check('audio follows the same overlap clock', heard.a.clipId === 'a' && heard.b.clipId === 'b' && near(heard.a.volume, 0.5) && near(heard.b.volume, 0.5));

  state = store.historyReducer(state, { type: 'setTransition', id: 'b', transition: { type: 'wipeleft', duration: 0.5 } });
  check('changing the type keeps the cut associated', state.present.videoClips[1].transitionIn.type === 'wipeleft');
  check('a shorter overlap restores timeline duration', near(store.projectDuration(state.present), 7.5));

  const three = projectOf([
    clip('a', 3),
    clip('b', 3, { transitionIn: { type: 'dissolve', duration: 0.4 } }),
    clip('c', 3, { transitionIn: { type: 'fadeblack', duration: 0.6 } }),
    clip('d', 3, { transitionIn: { type: 'slideleft', duration: 0.5 } }),
  ]);
  const threeDur = store.projectDuration(three);
  check('three-plus cuts stack distinct overlaps', near(threeDur, 12 - 0.4 - 0.6 - 0.5));
  const threeLayout = store.videoLayout(three.videoClips);
  check('consecutive transitions keep exclusive bodies', store.clipExclusiveRange(threeLayout, 1).length > 1.9);
  check('each cut keeps its own type', threeLayout[1].clip.transitionIn.type === 'dissolve' && threeLayout[2].clip.transitionIn.type === 'fadeblack' && threeLayout[3].clip.transitionIn.type === 'slideleft');
  check('markers stay on their own cuts', near(store.transitionBand(threeLayout[1]).cut, 3 - 0.2) && near(store.transitionBand(threeLayout[3]).cut, threeDur - 3 + 0.25));

  const shorts = projectOf([
    clip('a', 0.4),
    clip('b', 0.4, { transitionIn: { type: 'dissolve', duration: 5 } }),
  ]);
  const shortOverlap = store.videoLayout(shorts.videoClips)[1].overlap;
  check('short clips clamp overlap to available room', shortOverlap > 0 && shortOverlap < 0.2 && shortOverlap <= store.transitionRoom(shorts.videoClips[0], shorts.videoClips[1]));
  check('short clips still keep a positive exclusive body', store.clipExclusiveRange(store.videoLayout(shorts.videoClips), 0).length > 0.15);

  let edited = { past: [], present: three, future: [] };
  edited = store.historyReducer(edited, { type: 'load', project: three });
  const beforeRemove = store.projectDuration(edited.present);
  edited = store.historyReducer(edited, { type: 'delete', track: 'transition', id: 'c' });
  check('removing a transition restores that overlap to the clock', near(store.projectDuration(edited.present) - beforeRemove, 0.6) && !edited.present.videoClips[2].transitionIn);
  check('neighboring transitions survive the removal', edited.present.videoClips[1].transitionIn.type === 'dissolve' && edited.present.videoClips[3].transitionIn.type === 'slideleft');

  edited = store.historyReducer(edited, { type: 'undo' });
  check('undo puts the transition back', edited.present.videoClips[2].transitionIn?.type === 'fadeblack' && near(store.projectDuration(edited.present), beforeRemove));
  edited = store.historyReducer(edited, { type: 'redo' });
  check('redo removes it again', !edited.present.videoClips[2].transitionIn);

  edited = store.historyReducer(edited, { type: 'undo' });
  const repo = createProjectRepository(createMemoryStore());
  const created = await repo.createProject({ name: 'Cortes', project: edited.present });
  await repo.saveProject({ id: created.document.id, project: edited.present, playhead: 2.4 });
  const reopened = await repo.loadProject(created.document.id);
  check('reopening keeps every transition type and duration', (
    reopened.project.videoClips[1].transitionIn.type === 'dissolve'
    && reopened.project.videoClips[2].transitionIn.type === 'fadeblack'
    && reopened.project.videoClips[3].transitionIn.type === 'slideleft'
    && reopened.project.videoClips[2].transitionIn.duration === 0.6
  ));
  check('reopening keeps the packed duration', near(store.projectDuration(reopened.project), store.projectDuration(edited.present)));
  check('the playhead is restored', near(reopened.playhead, 2.4));

  const packed = store.projectDuration(withFade);
  const lastHits = store.videoClipsAt(withFade, packed);
  check('the last clock value still maps to a clip', lastHits[0]?.clip.id === 'b');
  const lastFrame = store.sourcePreviewTime(withFade.videoClips[1], packed, store.videoLayout(withFade.videoClips)[1].start, 30);
  check('the last preview frame stays before decoder EOF', lastFrame < withFade.videoClips[1].out);
  const nudged = store.nudgePreviewTime(two, 4);
  check('a hard cut still prefers the outgoing frame', nudged < 4);

  const firstOnly = store.historyReducer({ past: [], present: two, future: [] }, { type: 'setTransition', id: 'a', transition: { type: 'dissolve', duration: 1 } });
  check('the first clip cannot hold an incoming transition', !firstOnly.present.videoClips[0].transitionIn && near(store.projectDuration(firstOnly.present), 8));

  const xfadeGraph = graphOf(withFade);
  check('windows export uses the packed overlap', xfadeGraph.includes('xfade=transition=fade:duration=1.000') && xfadeGraph.includes('offset=3.000'));
  const mixed = projectOf([
    clip('a', 2),
    clip('b', 2),
    clip('c', 2, { transitionIn: { type: 'dissolve', duration: 0.5 } }),
  ]);
  const mixedGraph = graphOf(mixed);
  check('a hard cut next to a transition stays a concat, not a fake xfade', mixedGraph.includes('concat=n=2:v=1:a=0') && mixedGraph.includes('xfade=transition=fade:duration=0.500'));
  check('concat and xfade share a timebase so FFmpeg can mix them', mixedGraph.includes('settb=AVTB'));
  check('export does not invent overlap on the hard cut', !mixedGraph.includes('duration=0.040') && near(store.projectDuration(mixed), 5.5));
  check('windows export duration matches the editor clock', near(buildExportArgs(mixed, path.join(os.tmpdir(), 'pc-trans.mp4'), os.tmpdir()).total, 5.5));

  const android = plan.planMainExport({
    ...mixed,
    media: mixed.media.map((item) => ({
      ...item,
      source: '/data/user/0/com.pixelcut.editor/files/media/clip.mp4',
      path: 'https://localhost/_capacitor_file_/data/user/0/com.pixelcut.editor/files/media/clip.mp4',
    })),
  });
  check('android export uses the packed overlap', (
    near(android.durationMs / 1000, 5.5, 0.02)
    && android.items[2].transition === 'dissolve'
    && android.items[1].transition == null
    && android.composeOverlaps === true
  ));
  check('android keeps the hard cut without a fake overlap', android.items[1].overlapMs === 0 && android.transitions.length === 1);
  const androidFade = plan.planMainExport({
    ...mixed,
    media: mixed.media.map((item) => ({
      ...item,
      source: '/data/user/0/com.pixelcut.editor/files/media/clip.mp4',
      path: 'https://localhost/_capacitor_file_/data/user/0/com.pixelcut.editor/files/media/clip.mp4',
    })),
    videoClips: [
      clip('a', 2),
      clip('b', 2, { transitionIn: { type: 'fadeblack', duration: 0.5 } }),
      clip('c', 2, { transitionIn: { type: 'wipeleft', duration: 0.5 } }),
    ],
  });
  check('android encodes fade and wipe as distinct overlaps', (
    androidFade.items[1].transition === 'fadeblack'
    && androidFade.items[2].transition === 'wipeleft'
    && androidFade.transitions.length === 2
    && near(androidFade.durationMs / 1000, 5, 0.02)
  ));
  const androidSlide = plan.planMainExport({
    ...mixed,
    media: mixed.media.map((item) => ({
      ...item,
      source: '/data/user/0/com.pixelcut.editor/files/media/clip.mp4',
      path: 'https://localhost/_capacitor_file_/data/user/0/com.pixelcut.editor/files/media/clip.mp4',
    })),
    videoClips: [clip('a', 2), clip('b', 2, { transitionIn: { type: 'slideleft', duration: 0.5 } })],
  });
  check('android falls back to dissolve for slide and still packs duration', (
    androidSlide.items[1].transition === 'dissolve'
    && androidSlide.warnings.some((text) => /dissolver/i.test(text))
    && near(androidSlide.durationMs / 1000, 3.5, 0.02)
  ));

  const applyId = store.transitionApplyId(withFade, { track: 'transition', id: 'b' }, 0);
  check('the selected marker stays bound to its cut', applyId === 'b');

  console.log(`TRANSITION LOGIC OK (${passed} checks)`);
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
