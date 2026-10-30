import { emptyProject } from '../store.js';
import {
  BACKUP_FILE,
  INDEX_NAME,
  PROJECT_FILE,
  TEMP_FILE,
  THUMB_FILE,
  decodeDataUrl,
  documentSummary,
  encodeDataUrl,
  migrateDocument,
  newProjectId,
  parseDocument,
  serializeDocument,
  wrapProject,
} from './schema.js';

function isSafeProjectId(id) {
  if (typeof id !== 'string') return false;
  if (!id || id.trim() !== id) return false;
  if (id === '.' || id === '..') return false;
  if (/[\\/\0]/.test(id) || /^[a-zA-Z]:/.test(id)) return false;
  return true;
}

function folder(id) {
  if (!isSafeProjectId(id)) throw new Error('Caminho de projeto inválido.');
  return id;
}

function fileOf(id, name) {
  return `${folder(id)}/${name}`;
}

async function readIndex(store) {
  const text = await store.readText(INDEX_NAME);
  if (!text) return { schemaVersion: 1, projects: [] };
  try {
    const parsed = JSON.parse(text);
    const projects = Array.isArray(parsed?.projects) ? parsed.projects : [];
    return { schemaVersion: 1, projects };
  } catch {
    return { schemaVersion: 1, projects: [] };
  }
}

async function writeIndex(store, index) {
  await store.writeAtomic(INDEX_NAME, `${JSON.stringify(index, null, 2)}\n`);
}

async function readCandidates(store, id) {
  const names = [PROJECT_FILE, TEMP_FILE, BACKUP_FILE];
  const found = [];
  for (const name of names) {
    const text = await store.readText(fileOf(id, name));
    if (!text) continue;
    try {
      found.push(parseDocument(text));
    } catch {
      // Skip a half-written file and try the next recovery candidate.
    }
  }
  return found;
}

function revisionOf(doc) {
  return Number.isFinite(doc?.revision) ? doc.revision : 0;
}

function newestDocument(docs) {
  if (!docs.length) return null;
  return docs.reduce((best, doc) => {
    if (!best) return doc;
    const nextRev = revisionOf(doc);
    const bestRev = revisionOf(best);
    if (nextRev !== bestRev) return nextRev > bestRev ? doc : best;
    if ((doc.updatedAt || 0) > (best.updatedAt || 0)) return doc;
    return best;
  }, null);
}

async function upsertSummary(store, summary) {
  const index = await readIndex(store);
  const rest = index.projects.filter((item) => item.id !== summary.id);
  index.projects = [summary, ...rest].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  await writeIndex(store, index);
  return summary;
}

export function createProjectRepository(store) {
  if (!store || typeof store.writeAtomic !== 'function') {
    throw new Error('createProjectRepository requires an atomic store');
  }

  let writeChain = Promise.resolve();
  const withWriteLock = (work) => {
    const run = writeChain.then(work, work);
    writeChain = run.then(() => undefined, () => undefined);
    return run;
  };

  const repo = {
    async listProjects() {
      const index = await readIndex(store);
      let listed = index.projects.filter((item) => item && item.id);
      try {
        const ids = await store.list('');
        const known = new Set(listed.map((item) => item.id));
        for (const id of ids) {
          if (!id || id === INDEX_NAME || known.has(id) || !isSafeProjectId(id)) continue;
          try {
            const doc = await repo.loadProject(id);
            listed.push(documentSummary(doc, { hasThumb: await store.exists(fileOf(id, THUMB_FILE)) }));
          } catch {
            // Ignore stray folders that are not projects.
          }
        }
      } catch {
        // A store that cannot list still serves the index.
      }
      listed.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return listed;
    },

    async createProject(input = {}) {
      const now = Number.isFinite(input.now) ? input.now : Date.now();
      const id = input.id || newProjectId();
      const project = { ...emptyProject(), ...(input.project || {}), name: input.name || input.project?.name || emptyProject().name };
      const doc = wrapProject(project, { id, now, createdAt: now, updatedAt: now, playhead: 0 });
      await store.writeAtomic(fileOf(id, PROJECT_FILE), serializeDocument(doc));
      const summary = documentSummary(doc, { hasThumb: false });
      await upsertSummary(store, summary);
      return { document: doc, summary };
    },

    async loadProject(id) {
      const docs = await readCandidates(store, id);
      const doc = newestDocument(docs);
      if (!doc) throw new Error('Não foi possível abrir este projeto.');
      if (doc.id !== id) doc.id = id;
      return doc;
    },

    async saveProject(input) {
      return withWriteLock(async () => {
        const id = input.id;
        if (!id) throw new Error('O projeto não tem identificador.');
        const requested = Number.isFinite(input.now) ? input.now : Date.now();
        let previous = null;
        try {
          previous = await repo.loadProject(id);
        } catch {
          previous = null;
        }
        const now = Math.max(requested, (previous?.updatedAt || 0) + 1);
        const doc = wrapProject(input.project, {
          id,
          now,
          createdAt: previous?.createdAt || input.createdAt || now,
          updatedAt: now,
          playhead: input.playhead,
          revision: revisionOf(previous) + 1,
          thumbMediaId: input.thumbMediaId != null ? input.thumbMediaId : previous?.thumbMediaId,
        });
        await store.writeAtomic(fileOf(id, PROJECT_FILE), serializeDocument(doc));
        const hasThumb = await store.exists(fileOf(id, THUMB_FILE));
        const summary = documentSummary(doc, { hasThumb, missingCount: input.missingCount || 0 });
        await upsertSummary(store, summary);
        return { document: doc, summary };
      });
    },

    async renameProject(id, name) {
      const doc = await repo.loadProject(id);
      doc.project = { ...doc.project, name: String(name || '').trim() || doc.project.name };
      return repo.saveProject({ id, project: doc.project, playhead: doc.playhead, now: Date.now() });
    },

    async duplicateProject(id) {
      const source = await repo.loadProject(id);
      const copyId = newProjectId();
      const now = Date.now();
      const copy = wrapProject({
        ...source.project,
        name: source.project.name && source.project.name !== 'Projeto sem título'
          ? `Cópia de ${source.project.name}`
          : 'Projeto sem título',
      }, {
        id: copyId,
        now,
        createdAt: now,
        updatedAt: now,
        playhead: source.playhead,
        thumbMediaId: source.thumbMediaId,
      });
      await store.writeAtomic(fileOf(copyId, PROJECT_FILE), serializeDocument(copy));
      if (await store.exists(fileOf(id, THUMB_FILE))) {
        const bytes = await store.readBytes(fileOf(id, THUMB_FILE));
        if (bytes) await store.writeBytes(fileOf(copyId, THUMB_FILE), bytes);
      }
      const summary = documentSummary(copy, { hasThumb: await store.exists(fileOf(copyId, THUMB_FILE)) });
      await upsertSummary(store, summary);
      return { document: copy, summary };
    },

    async deleteProject(id) {
      if (!isSafeProjectId(id)) throw new Error('Caminho de projeto inválido.');
      const index = await readIndex(store);
      if (!index.projects.some((item) => item.id === id) && !(await store.exists(fileOf(id, PROJECT_FILE)))) {
        throw new Error('Este projeto não existe.');
      }
      index.projects = index.projects.filter((item) => item.id !== id);
      await writeIndex(store, index);
      await store.remove(folder(id));
      return { id };
    },

    async getProjectThumbnail(id) {
      const bytes = await store.readBytes(fileOf(id, THUMB_FILE));
      if (!bytes || !bytes.length) return null;
      return encodeDataUrl(bytes, 'image/jpeg');
    },

    async saveThumbnail(id, dataUrl, thumbMediaId = null) {
      const decoded = decodeDataUrl(dataUrl);
      if (!decoded) return null;
      await store.writeBytes(fileOf(id, THUMB_FILE), decoded.bytes);
      if (thumbMediaId) {
        try {
          await withWriteLock(async () => {
            const doc = await repo.loadProject(id);
            if (doc.thumbMediaId === thumbMediaId) {
              await upsertSummary(store, documentSummary(doc, { hasThumb: true }));
              return;
            }
            doc.thumbMediaId = thumbMediaId;
            doc.revision = revisionOf(doc) + 1;
            doc.updatedAt = Math.max(Date.now(), (doc.updatedAt || 0) + 1);
            await store.writeAtomic(fileOf(id, PROJECT_FILE), serializeDocument(doc));
            await upsertSummary(store, documentSummary(doc, { hasThumb: true }));
          });
        } catch {
          // The jpeg is already stored; the next save will record thumbMediaId.
        }
      }
      return fileOf(id, THUMB_FILE);
    },

    async importProjectJson(text, extra = {}) {
      const imported = migrateDocument(text, extra);
      const listed = await repo.listProjects();
      if (listed.some((item) => item.id === imported.id)) imported.id = extra.id || newProjectId();
      imported.updatedAt = extra.now || Date.now();
      if (!imported.createdAt) imported.createdAt = imported.updatedAt;
      await store.writeAtomic(fileOf(imported.id, PROJECT_FILE), serializeDocument(imported));
      const summary = documentSummary(imported, { hasThumb: false });
      await upsertSummary(store, summary);
      return { document: imported, summary };
    },
  };

  return repo;
}
