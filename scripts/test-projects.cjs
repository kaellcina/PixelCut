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

function clipProject(name = 'Demo') {
  return {
    name,
    width: 1280,
    height: 720,
    fps: 30,
    media: [{ id: 'm1', name: 'clip.mp4', type: 'video', path: 'C:/media/clip.mp4', duration: 3 }],
    videoClips: [{ id: 'v1', mediaId: 'm1', in: 0, out: 3, speed: 1 }],
    overlayClips: [],
    textClips: [{ id: 't1', text: 'Oi', start: 0, duration: 2 }],
    audioClips: [],
  };
}

function fakeTimers() {
  const queue = [];
  let now = 0;
  return {
    now: () => now,
    setTimer(fn, ms) {
      const id = { at: now + ms, fn };
      queue.push(id);
      return id;
    },
    clearTimer(id) {
      const index = queue.indexOf(id);
      if (index >= 0) queue.splice(index, 1);
    },
    async flush() {
      queue.sort((a, b) => a.at - b.at);
      while (queue.length) {
        const job = queue.shift();
        now = job.at;
        await job.fn();
      }
    },
  };
}

(async () => {
  const schema = await load('projects/schema.js');
  const { createMemoryStore } = await load('projects/memoryStore.js');
  const { createProjectRepository } = await load('projects/repository.js');
  const { createAutosave } = await load('projects/autosave.js');
  const storeMod = await load('store.js');

  const old = { name: 'Antigo', width: 1920, height: 1080, fps: 30, media: [], videoClips: [], overlayClips: [], textClips: [], audioClips: [] };
  const migrated = schema.migrateDocument(old);
  check('old json becomes a versioned envelope', migrated.schemaVersion === 1 && migrated.project.name === 'Antigo' && migrated.id);
  check('old json keeps canvas size', migrated.project.width === 1920 && migrated.project.height === 1080);

  const fs = createMemoryStore();
  const repo = createProjectRepository(fs);

  const created = await repo.createProject({ name: 'Um' });
  const listed = await repo.listProjects();
  check('create then list', listed.length === 1 && listed[0].id === created.document.id && listed[0].name === 'Um');

  await repo.saveProject({
    id: created.document.id,
    project: clipProject('Um'),
    playhead: 1.25,
  });
  const loaded = await repo.loadProject(created.document.id);
  check('open restores clips and playhead', loaded.project.videoClips[0].id === 'v1' && loaded.playhead === 1.25 && loaded.project.textClips[0].text === 'Oi');

  await repo.renameProject(created.document.id, 'Renomeado');
  check('rename updates the project name', (await repo.loadProject(created.document.id)).project.name === 'Renomeado');

  const copy = await repo.duplicateProject(created.document.id);
  check('duplicate gets a new id and copied clips', copy.document.id !== created.document.id && copy.document.project.videoClips[0].mediaId === 'm1');
  check('duplicate name is prefixed', copy.document.project.name.startsWith('Cópia de'));

  const other = await repo.createProject({ name: 'Dois' });
  await repo.deleteProject(created.document.id);
  const afterDelete = await repo.listProjects();
  await repo.deleteProject('').then(
    () => { throw new Error('empty id should fail'); },
    (error) => { check('empty project id is rejected', /inválido/.test(error.message)); },
  );
  await repo.deleteProject('.').then(
    () => { throw new Error('dot id should fail'); },
    (error) => { check('dot project id is rejected', /inválido/.test(error.message)); },
  );
  check('delete removes only the chosen project', afterDelete.some((item) => item.id === other.document.id) && !afterDelete.some((item) => item.id === created.document.id));
  check('deleted project cannot be opened', await repo.loadProject(created.document.id).then(() => false, () => true));
  check('the other project still opens', (await repo.loadProject(other.document.id)).project.name === 'Dois');

  const restart = createProjectRepository(fs);
  const reopened = await restart.loadProject(copy.document.id);
  check('a new repository on the same store still opens the project', reopened.project.name.startsWith('Cópia de') && reopened.project.videoClips.length === 1);

  let history = { past: [], present: clipProject('Edit'), future: [] };
  history = storeMod.historyReducer(history, { type: 'update', track: 'video', id: 'v1', patch: { out: 1.5 } });
  const edited = await repo.createProject({ name: 'Edit', project: history.present });
  history = storeMod.historyReducer(history, { type: 'undo' });
  await repo.saveProject({ id: edited.document.id, project: history.present, playhead: 0 });
  const afterUndo = await repo.loadProject(edited.document.id);
  check('undo is what gets persisted', afterUndo.project.videoClips[0].out === 3);

  history = storeMod.historyReducer({ past: [], present: afterUndo.project, future: [] }, { type: 'update', track: 'video', id: 'v1', patch: { out: 2 } });
  await repo.saveProject({ id: edited.document.id, project: history.present, playhead: 0 });
  history = storeMod.historyReducer(history, { type: 'undo' });
  history = storeMod.historyReducer(history, { type: 'redo' });
  await repo.saveProject({ id: edited.document.id, project: history.present, playhead: 0 });
  check('redo is persisted', (await repo.loadProject(edited.document.id)).project.videoClips[0].out === 2);

  const crashStore = createMemoryStore();
  const crashRepo = createProjectRepository(crashStore);
  const crash = await crashRepo.createProject({ name: 'Crash', project: clipProject('Crash') });
  crashStore.failOnce('after-tmp');
  const newer = clipProject('Crash');
  newer.videoClips = [{ id: 'v1', mediaId: 'm1', in: 0, out: 2, speed: 1 }];
  await crashRepo.saveProject({ id: crash.document.id, project: newer, playhead: 0.5 }).then(() => {
    throw new Error('crash save should fail');
  }, () => {});
  const recovered = await crashRepo.loadProject(crash.document.id);
  check('crash after tmp recovers the newer document', recovered.project.videoClips[0].out === 2);

  crashStore.failOnce('during-write');
  const evenNewer = clipProject('Crash');
  evenNewer.videoClips = [{ id: 'v1', mediaId: 'm1', in: 0, out: 1, speed: 1 }];
  await crashRepo.saveProject({ id: crash.document.id, project: evenNewer, playhead: 0 }).then(() => {
    throw new Error('write failure should fail');
  }, () => {});
  check('a failed write keeps the previous recovered document', (await crashRepo.loadProject(crash.document.id)).project.videoClips[0].out === 2);

  const missing = schema.inspectMedia({
    ...clipProject('Miss'),
    media: [
      { id: 'gone', name: 'lost.mp4', type: 'video', path: 'C:/nope.mp4' },
      { id: 'blob', name: 'temp.mp4', type: 'video', path: 'blob:http://localhost/x' },
      { id: 'ok', name: 'ok.mp4', type: 'video', path: 'C:/media/ok.mp4' },
    ],
    videoClips: [
      { id: 'a', mediaId: 'gone', in: 0, out: 1, speed: 1 },
      { id: 'b', mediaId: 'ok', in: 0, out: 1, speed: 1 },
    ],
  }, (item) => item.id === 'ok');
  check('missing media is reported without dropping clips', missing.missing.length === 2 && missing.project.videoClips.length === 2);
  check('blob urls are treated as missing', missing.missing.some((item) => item.id === 'blob'));
  check('present media is kept', missing.project.media.find((item) => item.id === 'ok').missing === false);

  const writes = [];
  const clock = fakeTimers();
  const autosave = createAutosave({
    delay: 700,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    save: async (payload) => {
      writes.push(payload.mark);
      await Promise.resolve();
    },
  });
  autosave.schedule({ mark: 'a' }, 'a');
  autosave.schedule({ mark: 'b' }, 'b');
  await clock.flush();
  check('debounce keeps only the latest payload', writes.join() === 'b');

  let active = Promise.resolve();
  let order = [];
  const slow = createAutosave({
    delay: 0,
    save: async (payload) => {
      const gate = active;
      active = new Promise((resolve) => {
        setTimeout(() => {
          order.push(payload.mark);
          resolve();
        }, payload.mark === 'old' ? 30 : 5);
      });
      await gate;
      await active;
    },
  });
  slow.schedule({ mark: 'old' }, 'old');
  await slow.flush();
  slow.schedule({ mark: 'old' }, 'old');
  slow.schedule({ mark: 'new' }, 'new');
  await slow.flush();
  check('a newer save is not replaced by an older one', order[order.length - 1] === 'new');

  const fp1 = schema.fingerprint(clipProject('A'), 1);
  const fp2 = schema.fingerprint(clipProject('A'), 1);
  const fp3 = schema.fingerprint(clipProject('A'), 1.2);
  check('fingerprint ignores identical project+playhead', fp1 === fp2 && fp1 !== fp3);

  console.log(`PROJECT LOGIC OK (${passed} checks)`);
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
