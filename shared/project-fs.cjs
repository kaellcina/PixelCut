const fs = require('fs');
const path = require('path');

const INVALID_PATH = 'Caminho de projeto inválido.';

function pathError() {
  const error = new Error(INVALID_PATH);
  error.code = 'PROJECT_PATH';
  return error;
}

function win32() {
  return process.platform === 'win32';
}

function fold(value) {
  return win32() ? String(value).toLowerCase() : String(value);
}

function isInside(base, dest, allowEqual) {
  const root = path.resolve(base);
  const target = path.resolve(dest);
  const rootFold = fold(root);
  const targetFold = fold(target);
  if (allowEqual && targetFold === rootFold) return true;
  const prefix = rootFold.endsWith(path.sep) ? rootFold : rootFold + path.sep;
  return targetFold.startsWith(prefix);
}

function looksAbsolute(rel) {
  if (path.isAbsolute(rel)) return true;
  if (/^[a-zA-Z]:[\\/]/.test(rel)) return true;
  if (rel.startsWith('\\\\') || rel.startsWith('//')) return true;
  return false;
}

function resolveSafe(base, rel, options = {}) {
  const allowRoot = options.allowRoot === true;
  if (rel != null && typeof rel !== 'string') throw pathError();
  const raw = rel == null ? '' : rel;
  if (raw.includes('\0')) throw pathError();
  const trimmed = raw.trim();
  if (!trimmed) {
    if (allowRoot) return path.resolve(base);
    throw pathError();
  }
  if (trimmed.includes('\0')) throw pathError();

  const root = path.resolve(base);
  const dest = looksAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(root, trimmed.replace(/\\/g, '/'));

  if (allowRoot) {
    if (!isInside(root, dest, true)) throw pathError();
    return dest;
  }
  if (!isInside(root, dest, false)) throw pathError();
  return dest;
}

async function lstatOrNull(target) {
  try {
    return await fs.promises.lstat(target);
  } catch {
    return null;
  }
}

async function walkStablePath(base, dest, options = {}) {
  const leafMayBeLink = options.leafMayBeLink === true;
  const root = path.resolve(base);
  await fs.promises.mkdir(root, { recursive: true });
  const realRoot = await fs.promises.realpath(root);
  const relative = path.relative(root, dest);
  if (!relative || path.isAbsolute(relative) || relative.split(path.sep).includes('..')) {
    if (fold(path.resolve(dest)) === fold(root)) return dest;
    throw pathError();
  }
  let current = root;
  const parts = relative.split(path.sep).filter((part) => part && part !== '.');
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part === '..') throw pathError();
    current = path.join(current, part);
    const stat = await lstatOrNull(current);
    if (!stat) return dest;
    if (stat.isSymbolicLink()) {
      const isLeaf = i === parts.length - 1;
      if (isLeaf && leafMayBeLink) return dest;
      throw pathError();
    }
  }
  const realDest = await fs.promises.realpath(current);
  const lexicalRel = fold(path.relative(root, current));
  const realRel = fold(path.relative(realRoot, realDest));
  if (!lexicalRel || lexicalRel !== realRel) throw pathError();
  if (path.isAbsolute(path.relative(realRoot, realDest)) || realRel.split(path.sep).includes('..')) {
    throw pathError();
  }
  return dest;
}

async function assertNoSymlinkEscape(base, dest) {
  await walkStablePath(base, dest, { leafMayBeLink: false });
}

async function unlinkLink(target) {
  try {
    await fs.promises.unlink(target);
  } catch (error) {
    if (win32()) {
      try {
        await fs.promises.rmdir(target);
        return;
      } catch {
        throw error;
      }
    }
    throw error;
  }
}

async function removeInside(realRoot, dest) {
  const stat = await lstatOrNull(dest);
  if (!stat) return;
  if (stat.isSymbolicLink()) {
    await unlinkLink(dest);
    return;
  }
  const realDest = await fs.promises.realpath(dest);
  if (fold(realDest) === fold(realRoot) || !isInside(realRoot, realDest, false)) {
    throw pathError();
  }
  if (stat.isDirectory()) {
    const entries = await fs.promises.readdir(dest, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..') continue;
      await removeInside(realRoot, path.join(dest, entry.name));
    }
    await fs.promises.rmdir(dest);
    return;
  }
  await fs.promises.unlink(dest);
}

function assertNotRoot(root, dest, realRoot) {
  if (fold(dest) === fold(root)) throw pathError();
  if (realRoot && fold(dest) === fold(realRoot)) throw pathError();
}

async function safeRemove(base, rel) {
  const dest = resolveSafe(base, rel, { allowRoot: false });
  const root = path.resolve(base);
  await fs.promises.mkdir(root, { recursive: true });
  const realRoot = await fs.promises.realpath(root);
  assertNotRoot(root, dest, realRoot);

  await walkStablePath(root, dest, { leafMayBeLink: true });

  const stat = await lstatOrNull(dest);
  if (!stat) return;
  if (stat.isSymbolicLink()) {
    await unlinkLink(dest);
    return;
  }

  const realDest = await fs.promises.realpath(dest);
  if (fold(realDest) === fold(realRoot) || !isInside(realRoot, realDest, false)) throw pathError();
  const lexicalRel = fold(path.relative(root, dest));
  const realRel = fold(path.relative(realRoot, realDest));
  if (lexicalRel !== realRel) throw pathError();
  if (lexicalRel.split(path.sep)[0] !== realRel.split(path.sep)[0]) throw pathError();

  await removeInside(realRoot, dest);
}

function backupPath(dest) {
  return path.join(path.dirname(dest), 'backup.json');
}

function createProjectFs(getRoot) {
  const rootPath = () => path.resolve(getRoot());

  async function preparedRoot() {
    const root = rootPath();
    await fs.promises.mkdir(root, { recursive: true });
    return root;
  }

  async function exists(rel) {
    const root = await preparedRoot();
    const dest = resolveSafe(root, rel, { allowRoot: false });
    try {
      await fs.promises.access(dest);
      return true;
    } catch {
      return false;
    }
  }

  async function readText(rel) {
    const root = await preparedRoot();
    try {
      return await fs.promises.readFile(resolveSafe(root, rel, { allowRoot: false }), 'utf8');
    } catch (error) {
      if (error.code === 'PROJECT_PATH') throw error;
      return null;
    }
  }

  async function writeText(rel, text) {
    const root = await preparedRoot();
    const dest = resolveSafe(root, rel, { allowRoot: false });
    await assertNoSymlinkEscape(root, dest);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, String(text), 'utf8');
  }

  async function readBytes(rel) {
    const root = await preparedRoot();
    try {
      const buf = await fs.promises.readFile(resolveSafe(root, rel, { allowRoot: false }));
      return buf.toString('base64');
    } catch (error) {
      if (error.code === 'PROJECT_PATH') throw error;
      return null;
    }
  }

  async function writeBytes(rel, base64) {
    const root = await preparedRoot();
    const dest = resolveSafe(root, rel, { allowRoot: false });
    await assertNoSymlinkEscape(root, dest);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, Buffer.from(String(base64 || ''), 'base64'));
  }

  async function remove(rel) {
    const root = await preparedRoot();
    await safeRemove(root, rel);
  }

  async function list(rel) {
    const root = await preparedRoot();
    try {
      const dest = resolveSafe(root, rel, { allowRoot: true });
      const entries = await fs.promises.readdir(dest, { withFileTypes: true });
      return entries.map((entry) => entry.name);
    } catch (error) {
      if (error.code === 'PROJECT_PATH') throw error;
      return [];
    }
  }

  async function writeAtomic(rel, text) {
    const root = await preparedRoot();
    const dest = resolveSafe(root, rel, { allowRoot: false });
    await assertNoSymlinkEscape(root, dest);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.tmp`;
    const handle = await fs.promises.open(tmp, 'w');
    try {
      await handle.writeFile(String(text), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await fs.promises.copyFile(dest, backupPath(dest));
    } catch {
      // First save, or the previous file is already gone.
    }
    try {
      await fs.promises.unlink(dest);
    } catch {
      // Destination may not exist yet. Windows cannot rename over an existing file.
    }
    await fs.promises.rename(tmp, dest);
  }

  const methods = { exists, readText, writeText, readBytes, writeBytes, remove, list, writeAtomic };

  async function dispatch(method, args) {
    const fn = methods[method];
    if (!fn) throw new Error(`Operação de projeto desconhecida: ${method}`);
    return fn(...(args || []));
  }

  return {
    dispatch,
    root: rootPath,
    resolveSafe: (rel, options) => resolveSafe(rootPath(), rel, options),
    ...methods,
  };
}

module.exports = {
  INVALID_PATH,
  resolveSafe,
  isInside,
  createProjectFs,
};
