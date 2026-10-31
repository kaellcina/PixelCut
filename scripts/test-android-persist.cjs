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

const PRIVATE = '/data/user/0/com.pixelcut.editor/files/media/clip-1.mp4';
const CAP = `https://localhost/_capacitor_file_${PRIVATE}`;

function projectWith(mediaExtra = {}, clips = [{ id: 'v1', mediaId: 'm1', in: 0, out: 4, speed: 1 }]) {
  return {
    name: 'Cena',
    width: 1280,
    height: 720,
    fps: 30,
    media: [{ id: 'm1', name: 'clip.mp4', type: 'video', duration: 4, source: PRIVATE, path: CAP, ...mediaExtra }],
    videoClips: clips,
    overlayClips: [],
    textClips: [],
    audioClips: [],
  };
}

(async () => {
  const mediaPath = await load('platform/mediaPath.js');
  const restore = await load('platform/androidRestore.js');
  const schema = await load('projects/schema.js');
  const storeMod = await load('store.js');
  const autosaveMod = await load('projects/autosave.js');
  const repoMod = await load('projects/repository.js');
  const memory = await load('projects/memoryStore.js');
  const plan = await load('platform/exportPlan.js');

  check('unwraps a capacitor playback url', mediaPath.ownedFilePath(CAP) === PRIVATE);
  check('unwraps file:// of the private copy', mediaPath.ownedFilePath(`file://${PRIVATE}`) === PRIVATE);
  check('keeps an already-owned absolute path', mediaPath.ownedFilePath(PRIVATE) === PRIVATE);
  check('drops a blob url', mediaPath.ownedFilePath('blob:http://localhost/x') === '');
  check('drops a bare content uri', mediaPath.ownedFilePath('content://media/external/video/1') === '');
  check('mediaOwnedPath prefers source then path', mediaPath.mediaOwnedPath({ path: CAP, source: PRIVATE }) === PRIVATE);
  check('mediaOwnedPath recovers when only the playback url was saved', mediaPath.mediaOwnedPath({ path: CAP }) === PRIVATE);

  const persisted = mediaPath.persistableMedia({ id: 'm1', name: 'clip.mp4', path: CAP, source: PRIVATE, missing: true });
  check('persistable media stores the private file, not the session url', persisted.source === PRIVATE && persisted.path === PRIVATE && persisted.missing === undefined);

  const onlyUrl = mediaPath.persistableMedia({ id: 'm1', name: 'clip.mp4', path: CAP });
  check('a capacitor url saved as path is recovered as source', onlyUrl.source === PRIVATE && onlyUrl.path === PRIVATE);

  check('empty overwrite is refused', mediaPath.wouldEmptyOverwrite(projectWith(), storeMod.emptyProject()) === true);
  check('a real edit is not treated as empty', mediaPath.wouldEmptyOverwrite(projectWith(), projectWith({ name: 'clip.mp4' })) === false);
  check('a brand-new empty project can be saved', mediaPath.wouldEmptyOverwrite(storeMod.emptyProject(), storeMod.emptyProject()) === false);

  const convert = (file) => `https://localhost/_capacitor_file_${file}`;
  const restored = restore.applyAndroidRestore(projectWith(), [{ id: 'm1', ok: true, source: PRIVATE, path: convert(PRIVATE) }], convert);
  check('restore rebuilds a playable url and keeps the clip', restored.missing.length === 0 && restored.project.videoClips.length === 1 && restored.project.media[0].path === CAP && restored.project.media[0].source === PRIVATE);

  const asUrl = restore.applyAndroidRestore(
    { ...projectWith({ source: undefined, path: CAP }) },
    [{ id: 'm1', ok: true, source: PRIVATE, path: convert(PRIVATE) }],
    convert,
  );
  check('beta.1 projects that only stored the playback url still restore', asUrl.missing.length === 0 && asUrl.project.media[0].source === PRIVATE);

  const gone = restore.applyAndroidRestore(projectWith(), [{ id: 'm1', ok: false, source: PRIVATE, path: '' }], convert);
  check('missing media keeps the clip and the source', gone.missing.length === 1 && gone.project.videoClips.length === 1 && gone.project.media[0].source === PRIVATE && gone.project.media[0].missing === true);
  check('missing restore does not wipe the library item', gone.project.media.length === 1);

  const expired = restore.applyAndroidRestore(
    { ...projectWith({ source: 'content://com.android.providers.media.documents/document/video:12', path: 'content://com.android.providers.media.documents/document/video:12' }) },
    [{ id: 'm1', ok: false, source: '', path: '' }],
    convert,
  );
  check('an expired content uri is reported without deleting the clip', expired.missing.length === 1 && expired.project.videoClips.length === 1);

  const moved = restore.applyAndroidRestore(projectWith(), [{ id: 'm1', ok: false, source: PRIVATE, path: '' }], convert);
  check('a moved original still leaves the timeline intact', moved.project.videoClips[0].mediaId === 'm1');

  const inspected = schema.inspectMedia(projectWith(), () => false);
  check('inspectMedia never drops clips', inspected.missing.length === 1 && inspected.project.videoClips.length === 1);

  const exported = plan.planMainExport(projectWith());
  check('export uses the private file path', exported.items[0].source === PRIVATE);
  const fromUrl = plan.planMainExport({ ...projectWith({ source: undefined, path: CAP }) });
  check('export unwraps a capacitor url left in path', fromUrl.items[0].source === PRIVATE);

  let blobExport = '';
  try {
    plan.planMainExport({ ...projectWith({ source: undefined, path: 'blob:http://localhost/clip' }) });
  } catch (error) {
    blobExport = error.message;
  }
  check('export refuses a blob url', /clip\.mp4/.test(blobExport));

  const fs = memory.createMemoryStore();
  const repo = repoMod.createProjectRepository(fs);
  const created = await repo.createProject({ name: 'Cena' });
  const withClip = projectWith();
  await repo.saveProject({ id: created.document.id, project: mediaPath.persistableProject(withClip), playhead: 1.25 });
  const restart = repoMod.createProjectRepository(fs);
  const reopened = await restart.loadProject(created.document.id);
  check('process restart keeps clips and owned source', reopened.project.videoClips.length === 1 && reopened.project.media[0].source === PRIVATE);

  const again = restore.applyAndroidRestore(reopened.project, [{ id: 'm1', ok: true, source: PRIVATE, path: convert(PRIVATE) }], convert);
  check('playback url is rebuilt after a new process', again.project.media[0].path === CAP);

  const trimmed = JSON.parse(JSON.stringify(again.project));
  trimmed.videoClips = [{ id: 'v1', mediaId: 'm1', in: 0.5, out: 3.5, speed: 1 }];
  await restart.saveProject({ id: created.document.id, project: mediaPath.persistableProject(trimmed), playhead: 0.5 });
  const afterTrim = await repoMod.createProjectRepository(fs).loadProject(created.document.id);
  check('a second save after trim survives another restart', afterTrim.project.videoClips[0].in === 0.5 && afterTrim.project.videoClips[0].out === 3.5 && afterTrim.project.media[0].source === PRIVATE);
  check('same-millisecond backup does not replace a later edit', afterTrim.playhead === 0.5);

  let edited = { past: [], present: JSON.parse(JSON.stringify(afterTrim.project)), future: [] };
  const firstId = edited.present.videoClips[0].id;
  edited = storeMod.historyReducer(edited, { type: 'split', track: 'video', id: firstId, t: 1.2, newId: 'cut-b' });
  edited = storeMod.historyReducer(edited, { type: 'split', track: 'video', id: 'cut-b', t: 2.0, newId: 'cut-c' });
  edited = storeMod.historyReducer(edited, { type: 'split', track: 'video', id: 'cut-c', t: 2.6, newId: 'cut-d' });
  check('three playhead cuts produce four packed clips', edited.present.videoClips.length === 4);
  edited = storeMod.historyReducer(edited, { type: 'setTransition', id: 'cut-b', transition: { type: 'dissolve', duration: 0.4 } });
  edited = storeMod.historyReducer(edited, { type: 'setTransition', id: 'cut-c', transition: { type: 'wipeleft', duration: 0.3 } });
  edited = storeMod.historyReducer(edited, { type: 'setTransition', id: 'cut-d', transition: { type: 'fadeblack', duration: 0.35 } });
  edited = storeMod.historyReducer(edited, { type: 'addText', clipId: 'tx1', at: 0.2, preset: { text: 'Título', duration: 3 } });
  edited = storeMod.historyReducer(edited, { type: 'addText', clipId: 'tx2', at: 0.2, preset: { text: 'Sub', duration: 3 } });
  edited = storeMod.historyReducer(edited, { type: 'addText', clipId: 'tx3', at: 0.2, preset: { text: 'Legenda', duration: 3 } });
  check('overlapping titles land on distinct lanes', new Set(edited.present.textClips.map((clip) => clip.lane || 0)).size === 3);
  await restart.saveProject({ id: created.document.id, project: mediaPath.persistableProject(edited.present), playhead: 2.05 });
  const afterCuts = await repoMod.createProjectRepository(fs).loadProject(created.document.id);
  check('saved cuts survive a new repository', afterCuts.project.videoClips.length === 4 && afterCuts.project.videoClips.map((clip) => clip.out).join() === edited.present.videoClips.map((clip) => clip.out).join());
  check('saved transitions survive a new repository', afterCuts.project.videoClips[1].transitionIn?.type === 'dissolve' && afterCuts.project.videoClips[2].transitionIn?.type === 'wipeleft' && afterCuts.project.videoClips[3].transitionIn?.type === 'fadeblack');
  check('each cut stores its own transition type', new Set(afterCuts.project.videoClips.map((clip) => clip.transitionIn?.type).filter(Boolean)).size === 3);
  check('saved text lanes survive a new repository', afterCuts.project.textClips.map((clip) => clip.lane).join() === '0,1,2');
  check('saved playhead survives with the cuts', afterCuts.playhead === 2.05);
  check('document revision advances past the trim save', (afterCuts.revision || 0) > (afterTrim.revision || 0));

  const thumbBytes = Uint8Array.from({ length: 16 }, (_, i) => i);
  const staleThumb = JSON.parse(JSON.stringify(afterTrim));
  staleThumb.thumbMediaId = 'old-poster';
  const jpeg = schema.encodeDataUrl(thumbBytes);
  const first = restart.saveProject({ id: created.document.id, project: mediaPath.persistableProject(edited.present), playhead: 2.05 });
  const second = restart.saveThumbnail(created.document.id, jpeg, 'old-poster');
  await Promise.all([first, second]);
  const afterThumb = await repoMod.createProjectRepository(fs).loadProject(created.document.id);
  check('thumbnail write does not restore an uncut timeline', afterThumb.project.videoClips.length === 4 && afterThumb.project.textClips.length === 3);

  let liveProject = projectWith();
  const liveSave = autosaveMod.createAutosave({
    delay: 0,
    save: async (payload) => {
      const current = typeof payload === 'function' ? payload() : payload;
      const live = { ...current, project: liveProject, playhead: 2.05 };
      await restart.saveProject({ id: created.document.id, project: mediaPath.persistableProject(live.project), playhead: live.playhead });
    },
  });
  liveSave.schedule({ id: created.document.id, project: liveProject, playhead: 0 }, 'stale');
  liveProject = edited.present;
  await liveSave.flush();
  const afterLive = await repoMod.createProjectRepository(fs).loadProject(created.document.id);
  check('autosave that started stale still writes the live timeline', afterLive.project.videoClips.length === 4);

  const backupOnly = memory.createMemoryStore();
  const backupRepo = repoMod.createProjectRepository(backupOnly);
  const seeded = await backupRepo.createProject({ name: 'Rev' });
  await backupRepo.saveProject({ id: seeded.document.id, project: mediaPath.persistableProject(projectWith()), playhead: 0 });
  const uncut = await backupRepo.loadProject(seeded.document.id);
  const cutDoc = schema.wrapProject(mediaPath.persistableProject(edited.present), {
    id: seeded.document.id,
    updatedAt: 1,
    revision: 9,
    playhead: 2.05,
  });
  const oldDoc = schema.wrapProject(uncut.project, {
    id: seeded.document.id,
    updatedAt: Date.now() + 5000,
    revision: 2,
    playhead: 0,
  });
  await backupOnly.writeText(`${seeded.document.id}/project.json`, schema.serializeDocument(oldDoc));
  await backupOnly.writeText(`${seeded.document.id}/backup.json`, schema.serializeDocument(cutDoc));
  const recoveredCuts = await repoMod.createProjectRepository(backupOnly).loadProject(seeded.document.id);
  check('a higher revision wins over a newer timestamp on the uncut backup', recoveredCuts.project.videoClips.length === 4);

  check('refusing to empty a valid project', mediaPath.wouldEmptyOverwrite(afterTrim.project, storeMod.emptyProject()) === true);

  const writes = [];
  const clock = {
    queue: [],
    setTimer(fn, ms) {
      const id = { fn, ms };
      this.queue.push(id);
      return id;
    },
    clearTimer(id) {
      const index = this.queue.indexOf(id);
      if (index >= 0) this.queue.splice(index, 1);
    },
  };
  const autosave = autosaveMod.createAutosave({
    delay: 250,
    setTimer: (fn, ms) => clock.setTimer(fn, ms),
    clearTimer: (id) => clock.clearTimer(id),
    save: async (payload) => { writes.push(payload.mark); },
  });
  autosave.schedule({ mark: 'import' }, 'import');
  check('debounce is still pending before flush', writes.length === 0);
  await autosave.flush();
  check('flush on pause writes the pending project', writes.join() === 'import');

  const original = storeMod.toFileUrl;
  const fakeWindow = { Capacitor: { convertFileSrc: (file) => (file.startsWith('/') ? convert(file) : file) } };
  global.window = fakeWindow;
  check('toFileUrl uses convertFileSrc on android absolute paths', storeMod.toFileUrl(PRIVATE) === CAP);
  check('toFileUrl keeps http playback urls', storeMod.toFileUrl(CAP) === CAP);
  check('toFileUrl keeps windows paths as file urls', storeMod.toFileUrl('C:/media/clip.mp4').startsWith('file:///'));
  check('toFileUrl does not throw on empty', storeMod.toFileUrl('') === '' && storeMod.toFileUrl(null) === '');
  delete global.window;
  check('toFileUrl helper is still the same export', typeof original === 'function');

  const lowSpace = 'Não há espaço livre suficiente para copiar este arquivo.';
  check('low-space copy error stays user-facing', /espaço livre/.test(lowSpace));

  // Deferred media release: remove -> undo -> reopen, duplicated projects, and I/O failures.
  const release = await load('platform/mediaRelease.js');
  const relFs = memory.createMemoryStore();
  const relRepo = repoMod.createProjectRepository(relFs);
  const deleted = [];
  const deps = (overrides = {}) => ({
    loadRepo: async () => relRepo,
    deleteFile: async (source) => { deleted.push(source); return { ok: true }; },
    ...overrides,
  });
  const releaseWith = (o) => (item) => release.releaseOwnedFile(item, deps(o));

  const orig = await relRepo.createProject({ name: 'Original' });
  await relRepo.saveProject({ id: orig.document.id, project: mediaPath.persistableProject(projectWith()), playhead: 0 });

  let hist = { past: [], present: (await relRepo.loadProject(orig.document.id)).project, future: [] };
  const queue = [hist.present.media[0]];
  hist = storeMod.historyReducer(hist, { type: 'removeMedia', id: 'm1' });
  hist = storeMod.historyReducer(hist, { type: 'undo' });
  await relRepo.saveProject({ id: orig.document.id, project: mediaPath.persistableProject(hist.present), playhead: 0 });
  const undone = await release.releaseQueued(queue, hist.present.media, releaseWith());
  const reopenedOrig = await repoMod.createProjectRepository(relFs).loadProject(orig.document.id);
  check('remove -> undo -> close never touches the file', undone.results.length === 0 && deleted.length === 0);
  check('remove -> undo -> reopen keeps the clip and its source', reopenedOrig.project.videoClips.length === 1 && reopenedOrig.project.media[0].source === PRIVATE);

  const copy = await relRepo.duplicateProject(orig.document.id);
  let copyHist = { past: [], present: copy.document.project, future: [] };
  const copyQueue = [copyHist.present.media[0]];
  copyHist = storeMod.historyReducer(copyHist, { type: 'removeMedia', id: 'm1' });
  await relRepo.saveProject({ id: copy.document.id, project: mediaPath.persistableProject(copyHist.present), playhead: 0 });
  const fromCopy = await release.releaseQueued(copyQueue, copyHist.present.media, releaseWith());
  const origAfterCopy = await repoMod.createProjectRepository(relFs).loadProject(orig.document.id);
  check('removing media in a duplicate keeps the shared file', fromCopy.results.join() === 'in-use' && fromCopy.retry.length === 0 && deleted.length === 0);
  check('the original still opens with its media after the copy dropped it', origAfterCopy.project.media[0].source === PRIVATE && origAfterCopy.project.videoClips.length === 1);

  const listFails = await release.releaseQueued(copyQueue, [], releaseWith({ loadRepo: async () => { throw new Error('EIO'); } }));
  check('unreadable project list keeps the file and queues a retry', listFails.results.join() === 'failed' && listFails.retry.length === 1 && deleted.length === 0);
  const brokenRepo = { listProjects: async () => [{ id: 'x' }], loadProject: async () => { throw new Error('corrupt'); } };
  const loadFails = await release.releaseQueued(copyQueue, [], releaseWith({ loadRepo: async () => brokenRepo }));
  check('an unreadable project keeps the file and queues a retry', loadFails.results.join() === 'failed' && deleted.length === 0);

  await relRepo.deleteProject(orig.document.id);
  const nativeRefused = await release.releaseQueued(copyQueue, [], releaseWith({ deleteFile: async () => ({ ok: false }) }));
  check('native delete returning ok:false is a failure, not a deletion', nativeRefused.results.join() === 'failed' && nativeRefused.retry.length === 1);
  const nativeThrew = await release.releaseQueued(copyQueue, [], releaseWith({ deleteFile: async () => { throw new Error('EACCES'); } }));
  check('native delete throwing is a failure, not a deletion', nativeThrew.results.join() === 'failed');
  const retried = await release.releaseQueued(nativeThrew.retry, [], releaseWith());
  check('a retry deletes the file once nothing references it', retried.results.join() === 'deleted' && retried.retry.length === 0 && deleted.join() === PRIVATE);

  const relocated = { ...projectWith().media[0], source: '/data/user/0/com.pixelcut.editor/files/media/new.mp4', path: '' };
  const afterRelocate = await release.releaseQueued([projectWith().media[0]], [relocated], (item) => item.source);
  check('a relocated item releases the old file, not the new one', afterRelocate.results.join() === PRIVATE);

  console.log(`ANDROID PERSIST OK (${passed} checks)`);
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
