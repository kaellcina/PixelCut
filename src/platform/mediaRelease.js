// Deferred release of media files removed or replaced during an editing session.
// Release results: 'deleted' (file gone), 'in-use' (kept on purpose: another saved
// project references it), 'failed' (I/O error; keep it queued and retry), 'skipped'.

import { mediaOwnedPath } from './mediaPath.js';

const mediaKey = (item) => item?.source || item?.path || '';

// Duplicated projects share one private file: delete only when no saved project still references it.
export async function releaseOwnedFile(item, { loadRepo, deleteFile }) {
  const source = mediaOwnedPath(item) || (item && typeof item === 'object' ? item.source : '');
  if (!source) return 'skipped';
  try {
    const repo = await loadRepo();
    for (const summary of await repo.listProjects()) {
      const doc = await repo.loadProject(summary.id);
      if ((doc.project?.media || []).some((media) => (mediaOwnedPath(media) || media?.source) === source)) return 'in-use';
    }
  } catch {
    return 'failed'; // Cannot prove the file is unused: keep it and try again later.
  }
  try {
    const result = await deleteFile(source);
    return result?.ok === false ? 'failed' : 'deleted';
  } catch {
    return 'failed';
  }
}

// Releases queued items that are no longer in the live project (Ctrl+Z may have brought them back).
export async function releaseQueued(queued, currentMedia, release) {
  const live = new Set((currentMedia || []).map(mediaKey));
  const candidates = queued.filter((item) => !live.has(mediaKey(item)));
  const results = await Promise.all(candidates.map(async (item) => {
    try {
      return (await release(item)) || 'skipped';
    } catch {
      return 'failed';
    }
  }));
  return { results, retry: candidates.filter((_, i) => results[i] === 'failed') };
}
