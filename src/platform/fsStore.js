import { createMemoryStore } from '../projects/memoryStore.js';

function childRel(rel, { allowRoot = false } = {}) {
  if (rel != null && typeof rel !== 'string') {
    throw new Error('Caminho de projeto inválido.');
  }
  const trimmed = String(rel || '').trim();
  if (!trimmed) {
    if (allowRoot) return '';
    throw new Error('Caminho de projeto inválido.');
  }
  if (trimmed.includes('\0')) throw new Error('Caminho de projeto inválido.');
  const clean = trimmed.replace(/\\/g, '/');
  if (clean.startsWith('/') || /^[a-zA-Z]:/.test(clean)) {
    throw new Error('Caminho de projeto inválido.');
  }
  const parts = clean.split('/').filter((part) => part !== '');
  if (!parts.length || parts.some((part) => part === '.' || part === '..')) {
    throw new Error('Caminho de projeto inválido.');
  }
  return parts.join('/');
}

function joinBase(base, rel, options) {
  const child = childRel(rel, options);
  if (!child) return base;
  return `${base}/${child}`;
}

function toBase64(bytes) {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (typeof Buffer !== 'undefined') return Buffer.from(buffer).toString('base64');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(data) {
  if (!data) return new Uint8Array();
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(data, 'base64'));
  return Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
}

export function createIpcStore(invoke) {
  return {
    exists: (rel) => invoke('exists', rel),
    readText: (rel) => invoke('readText', rel),
    writeText: (rel, text) => invoke('writeText', rel, text),
    readBytes: async (rel) => {
      const data = await invoke('readBytes', rel);
      return data ? fromBase64(data) : null;
    },
    writeBytes: (rel, bytes) => invoke('writeBytes', rel, toBase64(bytes)),
    remove: (rel) => invoke('remove', rel),
    list: (rel) => invoke('list', rel),
    writeAtomic: (rel, text) => invoke('writeAtomic', rel, text),
  };
}

export function createLocalStorageStore(storage, prefix = 'pixelcut.fs:') {
  const memory = createMemoryStore();
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const rel = key.slice(prefix.length);
      const raw = storage.getItem(key);
      if (raw == null) continue;
      if (raw.startsWith('\u0001')) memory.files.set(rel, fromBase64(raw.slice(1)));
      else memory.files.set(rel, raw);
    }
  } catch {
    // Private mode can block localStorage; the session still works in memory.
  }
  const persist = (rel) => {
    try {
      const value = memory.files.get(rel);
      const key = prefix + rel;
      if (value == null) storage.removeItem(key);
      else if (value instanceof Uint8Array) storage.setItem(key, `\u0001${toBase64(value)}`);
      else storage.setItem(key, value);
    } catch {
      // Quota errors leave the in-memory copy available for this session.
    }
  };
  return {
    exists: (rel) => memory.exists(rel),
    readText: (rel) => memory.readText(rel),
    readBytes: (rel) => memory.readBytes(rel),
    list: (rel) => memory.list(rel),
    async writeText(rel, text) {
      await memory.writeText(rel, text);
      persist(rel.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''));
    },
    async writeBytes(rel, bytes) {
      await memory.writeBytes(rel, bytes);
      persist(rel.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''));
    },
    async remove(rel) {
      const prefixRel = childRel(rel);
      const keys = [...memory.files.keys()].filter((key) => key === prefixRel || key.startsWith(`${prefixRel}/`));
      await memory.remove(rel);
      keys.forEach((key) => {
        try { storage.removeItem(prefix + key); } catch { /* ignore */ }
      });
    },
    async writeAtomic(rel, text) {
      await memory.writeAtomic(rel, text);
      const dest = rel.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      persist(dest);
      persist(`${dest}.tmp`);
      const parts = dest.split('/');
      parts[parts.length - 1] = 'backup.json';
      persist(parts.join('/'));
    },
  };
}

export function createCapacitorStore(Filesystem, Directory, Encoding, base = 'projects') {
  const directory = Directory.Data;

  const exists = async (rel) => {
    try {
      await Filesystem.stat({ path: joinBase(base, rel, { allowRoot: false }), directory });
      return true;
    } catch {
      return false;
    }
  };

  return {
    exists,
    async readText(rel) {
      try {
        const result = await Filesystem.readFile({
          path: joinBase(base, rel),
          directory,
          encoding: Encoding.UTF8,
        });
        return result.data ?? null;
      } catch {
        return null;
      }
    },
    async writeText(rel, text) {
      await Filesystem.writeFile({
        path: joinBase(base, rel),
        data: String(text),
        directory,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    },
    async readBytes(rel) {
      try {
        const result = await Filesystem.readFile({ path: joinBase(base, rel), directory });
        return fromBase64(result.data);
      } catch {
        return null;
      }
    },
    async writeBytes(rel, bytes) {
      await Filesystem.writeFile({
        path: joinBase(base, rel),
        data: toBase64(bytes),
        directory,
        recursive: true,
      });
    },
    async remove(rel) {
      const path = joinBase(base, rel);
      if (path === base) throw new Error('Caminho de projeto inválido.');
      try {
        await Filesystem.rmdir({ path, directory, recursive: true });
        return;
      } catch {
        // Fall through to a single file delete.
      }
      try {
        await Filesystem.deleteFile({ path, directory });
      } catch {
        // Already gone.
      }
    },
    async list(rel) {
      try {
        const result = await Filesystem.readdir({ path: joinBase(base, rel, { allowRoot: true }), directory });
        return (result.files || []).map((entry) => entry.name || entry).filter(Boolean);
      } catch {
        return [];
      }
    },
    async writeAtomic(rel, text) {
      const dest = joinBase(base, rel);
      const tmp = `${dest}.tmp`;
      const backup = dest.replace(/[^/]+$/, 'backup.json');
      await Filesystem.writeFile({
        path: tmp,
        data: String(text),
        directory,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      if (await exists(rel)) {
        try {
          await Filesystem.deleteFile({ path: backup, directory });
        } catch {
          // No previous backup.
        }
        await Filesystem.rename({ from: dest, to: backup, directory });
      }
      await Filesystem.rename({ from: tmp, to: dest, directory });
      try {
        await Filesystem.deleteFile({ path: backup, directory });
      } catch {
        // Keep backup.json if the cleanup fails; load() still prefers project.json.
      }
    },
  };
}
