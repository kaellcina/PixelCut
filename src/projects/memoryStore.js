function norm(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function parentOf(rel) {
  const parts = norm(rel).split('/');
  parts.pop();
  return parts.join('/');
}

function backupFor(rel) {
  const dir = parentOf(rel);
  return dir ? `${dir}/backup.json` : 'backup.json';
}

export function createMemoryStore(options = {}) {
  const files = new Map();
  let failOnce = options.failOnce || null;

  const api = {
    files,
    failOnce(kind) {
      failOnce = kind;
    },
    async exists(rel) {
      return files.has(norm(rel));
    },
    async readText(rel) {
      const value = files.get(norm(rel));
      return typeof value === 'string' ? value : null;
    },
    async writeText(rel, text) {
      files.set(norm(rel), String(text));
    },
    async readBytes(rel) {
      const value = files.get(norm(rel));
      if (value instanceof Uint8Array) return value;
      if (typeof value === 'string') return new TextEncoder().encode(value);
      return null;
    },
    async writeBytes(rel, bytes) {
      files.set(norm(rel), bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []));
    },
    async remove(rel) {
      const exact = norm(rel);
      const parts = exact.split('/').filter(Boolean);
      if (!exact || parts.some((part) => part === '.' || part === '..')) {
        throw new Error('Caminho de projeto inválido.');
      }
      const prefix = `${exact}/`;
      for (const key of [...files.keys()]) {
        if (key === exact || key.startsWith(prefix)) files.delete(key);
      }
    },
    async list(rel) {
      const prefix = norm(rel);
      const base = prefix ? `${prefix}/` : '';
      const names = new Set();
      for (const key of files.keys()) {
        if (prefix && key !== prefix && !key.startsWith(base)) continue;
        const rest = prefix ? key.slice(base.length) : key;
        if (!rest) continue;
        names.add(rest.split('/')[0]);
      }
      return [...names];
    },
    async writeAtomic(rel, text) {
      const dest = norm(rel);
      const tmp = `${dest}.tmp`;
      if (failOnce === 'during-write') {
        failOnce = null;
        throw new Error('simulated write failure');
      }
      files.set(tmp, String(text));
      if (failOnce === 'after-tmp') {
        failOnce = null;
        throw new Error('simulated crash');
      }
      if (files.has(dest)) files.set(backupFor(dest), files.get(dest));
      files.set(dest, String(text));
      files.delete(tmp);
    },
  };
  return api;
}
