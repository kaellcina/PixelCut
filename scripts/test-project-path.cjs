const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { createProjectFs, resolveSafe, INVALID_PATH } = require('../shared/project-fs.cjs');

process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'Warning' || !/MODULE_TYPELESS|reparsing/i.test(`${w.code} ${w.message}`)) console.warn(w); });

let passed = 0;
function check(name, condition, detail = '') {
  if (!condition) throw new Error(`FAIL ${name}${detail ? `: ${detail}` : ''}`);
  passed += 1;
}

function rejected(name, fn) {
  try {
    fn();
    throw new Error(`FAIL ${name}: expected rejection`);
  } catch (error) {
    if (error.message.startsWith('FAIL ')) throw error;
    check(name, error.message === INVALID_PATH || error.code === 'PROJECT_PATH', error.message);
  }
}

async function rejectedAsync(name, fn) {
  try {
    await fn();
    throw new Error(`FAIL ${name}: expected rejection`);
  } catch (error) {
    if (error.message.startsWith('FAIL ')) throw error;
    check(name, error.message === INVALID_PATH || error.code === 'PROJECT_PATH', error.message);
  }
}

async function tryLink(target, linkPath) {
  try {
    await fs.promises.symlink(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
    return true;
  } catch {
    try {
      await fs.promises.symlink(target, linkPath, 'dir');
      return true;
    } catch {
      return false;
    }
  }
}

(async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pixelcut-path-'));
  const root = path.join(tmp, 'projects');
  const outside = path.join(tmp, 'outside');
  await fs.promises.mkdir(root, { recursive: true });
  await fs.promises.mkdir(outside, { recursive: true });
  const canary = path.join(outside, 'secret.txt');
  await fs.promises.writeFile(canary, 'keep-me', 'utf8');

  try {
    rejected('empty path', () => resolveSafe(root, ''));
    rejected('null path', () => resolveSafe(root, null));
    rejected('spaces-only path', () => resolveSafe(root, '   '));
    rejected('dot path', () => resolveSafe(root, '.'));
    rejected('dot-dot path', () => resolveSafe(root, '..'));
    rejected('absolute outside', () => resolveSafe(root, path.parse(root).root));
    rejected('escape with ../', () => resolveSafe(root, '../secret.txt'));
    rejected('windows escape', () => resolveSafe(root, '..\\secret.txt'));
    rejected('nested escape', () => resolveSafe(root, 'p-ok/../../secret.txt'));

    const listedRoot = resolveSafe(root, '', { allowRoot: true });
    check('list root is allowed', path.resolve(listedRoot) === path.resolve(root));

    const mixed = resolveSafe(root, 'p-ok\\project.json');
    check('windows separators stay inside', mixed.toLowerCase().startsWith(path.resolve(root).toLowerCase()));

    const store = createProjectFs(() => root);
    await store.writeAtomic('index.json', '{"schemaVersion":1,"projects":[]}\n');
    await store.writeAtomic(path.join('p-keep', 'project.json'), '{"id":"p-keep"}\n');
    await store.writeAtomic(path.join('p-gone', 'project.json'), '{"id":"p-gone"}\n');
    await store.writeText(path.join('p-gone', 'note.txt'), 'tmp');

    const names = await store.list('');
    check('list empty still lists the root', names.includes('p-keep') && names.includes('p-gone') && names.includes('index.json'));

    await rejectedAsync('remove empty', () => store.remove(''));
    await rejectedAsync('remove spaces', () => store.remove('   '));
    await rejectedAsync('remove dot', () => store.remove('.'));
    await rejectedAsync('remove dot-dot', () => store.remove('..'));
    await rejectedAsync('remove absolute outside', () => store.remove(outside));
    await rejectedAsync('remove the projects root itself', () => store.remove(root));
    await rejectedAsync('remove ../ escape', () => store.remove('../outside'));
    await rejectedAsync('remove windows ../', () => store.remove('..\\outside'));
    await rejectedAsync('write empty path', () => store.writeText('', 'x'));
    await rejectedAsync('writeAtomic empty path', () => store.writeAtomic('', '{}'));

    check('root survives rejected deletes', await store.exists(path.join('p-keep', 'project.json')));
    check('index survives rejected deletes', await store.exists('index.json'));
    check('outside canary survives rejected deletes', fs.readFileSync(canary, 'utf8') === 'keep-me');

    await store.remove('p-gone');
    check('legitimate project delete removes the folder', !(await store.exists(path.join('p-gone', 'project.json'))));
    check('legitimate delete does not touch another project', await store.exists(path.join('p-keep', 'project.json')));
    check('legitimate delete does not remove the projects root', fs.existsSync(root) && await store.exists('index.json'));

    const linked = await tryLink(outside, path.join(root, 'escape-link'));
    if (!linked) throw new Error('FAIL symlink test: could not create a directory link in the isolated temp tree');
    await rejectedAsync('write through outbound symlink', () => store.writeText(path.join('escape-link', 'hijack.txt'), 'nope'));
    await rejectedAsync('remove nested path through outbound symlink', () => store.remove(path.join('escape-link', 'secret.txt')));
    check('outbound symlink target survived nested write/remove', fs.readFileSync(canary, 'utf8') === 'keep-me');
    await store.remove('escape-link');
    check('removing an outbound link does not delete the target', fs.readFileSync(canary, 'utf8') === 'keep-me');
    check('outbound link is gone after remove', !fs.existsSync(path.join(root, 'escape-link')));

    const loopLinked = await tryLink(root, path.join(root, 'loop-root'));
    if (!loopLinked) throw new Error('FAIL symlink loop test: could not create a link to the projects root');
    await store.remove('loop-root');
    check('removing a link to the root does not wipe projects', await store.exists(path.join('p-keep', 'project.json')));
    check('index still present after root-link remove', await store.exists('index.json'));
    check('root-link is gone', !fs.existsSync(path.join(root, 'loop-root')));

    await store.writeAtomic(path.join('p-keep', 'project.json'), '{"id":"p-keep","keep":true}\n');
    const aliasLinked = await tryLink(path.join(root, 'p-keep'), path.join(root, 'p-alias'));
    if (!aliasLinked) throw new Error('FAIL internal junction: could not link p-alias -> p-keep');
    await rejectedAsync('write through internal project junction', () => store.writeText(path.join('p-alias', 'hijack.json'), 'nope'));
    await rejectedAsync('remove nested path through internal project junction', () => store.remove(path.join('p-alias', 'project.json')));
    check('target project survived write/remove through alias', fs.readFileSync(path.join(root, 'p-keep', 'project.json'), 'utf8').includes('p-keep'));
    await store.remove('p-alias');
    check('deleting alias junction unlinks only the alias', !fs.existsSync(path.join(root, 'p-alias')));
    check('deleting alias does not delete the other project', await store.exists(path.join('p-keep', 'project.json')));

    const wrapperLinked = await tryLink(root, path.join(root, 'p-wrap'));
    if (!wrapperLinked) throw new Error('FAIL internal wrapper junction: could not link p-wrap -> projects root');
    await rejectedAsync('remove another project via wrapper junction', () => store.remove(path.join('p-wrap', 'p-keep')));
    check('wrapper escape did not delete the other project', await store.exists(path.join('p-keep', 'project.json')));
    await store.remove('p-wrap');
    check('wrapper junction itself can be unlinked', !fs.existsSync(path.join(root, 'p-wrap')));
    check('projects root still exists after wrapper unlink', fs.existsSync(root));

    const load = (file) => import(pathToFileURL(path.join(__dirname, '..', 'src', file)).href);
    const { createProjectRepository } = await load('projects/repository.js');
    const repo = createProjectRepository(store);
    const created = await repo.createProject({ name: 'Repo' });
    const listed = await repo.listProjects();
    check('repository still creates and lists', listed.some((item) => item.id === created.document.id));
    await repo.saveProject({ id: created.document.id, project: created.document.project, playhead: 0 });
    await repo.renameProject(created.document.id, 'Renomeado');
    check('repository rename still works', (await repo.loadProject(created.document.id)).project.name === 'Renomeado');
    await repo.deleteProject(created.document.id);
    check('repository delete still works', !(await repo.loadProject(created.document.id).then(() => true, () => false)));
    check('kept project still present after repo delete', await store.exists(path.join('p-keep', 'project.json')));
    check('projects root still exists after repo delete', fs.existsSync(root));

    console.log(`PROJECT PATH OK (${passed} checks)`);
  } finally {
    await fs.promises.rm(tmp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
