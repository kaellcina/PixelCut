import { emptyProject, projectDuration, uid } from '../store.js';

export const PROJECT_SCHEMA = 1;
export const INDEX_NAME = 'index.json';
export const PROJECT_FILE = 'project.json';
export const BACKUP_FILE = 'backup.json';
export const TEMP_FILE = 'project.json.tmp';
export const THUMB_FILE = 'thumb.jpg';

export function newProjectId() {
  return `p-${Date.now().toString(36)}-${uid()}${uid()}`;
}

export function isEnvelope(value) {
  return !!(value && typeof value === 'object' && value.project && Number(value.schemaVersion) >= 1);
}

function asProject(raw) {
  const base = emptyProject();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    media: Array.isArray(raw.media) ? raw.media : [],
    videoClips: Array.isArray(raw.videoClips) ? raw.videoClips : [],
    overlayClips: Array.isArray(raw.overlayClips) ? raw.overlayClips : [],
    textClips: Array.isArray(raw.textClips) ? raw.textClips : [],
    audioClips: Array.isArray(raw.audioClips) ? raw.audioClips : [],
    name: String(raw.name || base.name),
    width: Number(raw.width) > 0 ? Number(raw.width) : base.width,
    height: Number(raw.height) > 0 ? Number(raw.height) : base.height,
    fps: Number(raw.fps) > 0 ? Number(raw.fps) : base.fps,
  };
}

export function wrapProject(project, extra = {}) {
  const now = Number.isFinite(extra.now) ? extra.now : Date.now();
  const current = asProject(project);
  return {
    schemaVersion: PROJECT_SCHEMA,
    id: extra.id || newProjectId(),
    createdAt: Number.isFinite(extra.createdAt) ? extra.createdAt : now,
    updatedAt: Number.isFinite(extra.updatedAt) ? extra.updatedAt : now,
    playhead: Number.isFinite(extra.playhead) ? Math.max(0, extra.playhead) : 0,
    thumbMediaId: extra.thumbMediaId || null,
    project: current,
  };
}

export function migrateDocument(raw, extra = {}) {
  if (raw == null) throw new Error('O arquivo do projeto está vazio.');
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (isEnvelope(parsed)) {
    const inner = asProject(parsed.project);
    return {
      schemaVersion: PROJECT_SCHEMA,
      id: typeof parsed.id === 'string' && parsed.id ? parsed.id : extra.id || newProjectId(),
      createdAt: Number.isFinite(parsed.createdAt) ? parsed.createdAt : extra.now || Date.now(),
      updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : extra.now || Date.now(),
      playhead: Number.isFinite(parsed.playhead) ? Math.max(0, parsed.playhead) : 0,
      thumbMediaId: parsed.thumbMediaId || null,
      project: inner,
    };
  }
  return wrapProject(asProject(parsed), extra);
}

export function serializeDocument(doc) {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export function parseDocument(text) {
  return migrateDocument(text);
}

export function documentSummary(doc, extra = {}) {
  const project = asProject(doc.project);
  return {
    id: doc.id,
    name: project.name || 'Projeto sem título',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    width: project.width,
    height: project.height,
    fps: project.fps,
    duration: projectDuration(project),
    hasThumb: extra.hasThumb === true,
    thumbMediaId: doc.thumbMediaId || null,
    missingCount: extra.missingCount || 0,
  };
}

export function persistentSnapshot(project, playhead = 0) {
  return {
    name: project.name,
    width: project.width,
    height: project.height,
    fps: project.fps,
    media: project.media,
    videoClips: project.videoClips,
    overlayClips: project.overlayClips,
    textClips: project.textClips,
    audioClips: project.audioClips,
    playhead: Number.isFinite(playhead) ? Math.round(playhead * 100) / 100 : 0,
  };
}

export function fingerprint(project, playhead = 0) {
  return JSON.stringify(persistentSnapshot(project, playhead));
}

export function firstVisualMedia(project) {
  const clips = [...(project.videoClips || []), ...(project.overlayClips || [])];
  for (const clip of clips) {
    const media = (project.media || []).find((item) => item.id === clip.mediaId);
    if (media && (media.type === 'video' || media.type === 'image') && (media.path || media.source)) return media;
  }
  return (project.media || []).find((item) => item.type === 'video' || item.type === 'image') || null;
}

export function inspectMedia(project, exists) {
  const missing = [];
  const media = (project.media || []).map((item) => {
    const name = item?.name || 'Mídia';
    const blob = typeof item?.path === 'string' && item.path.startsWith('blob:');
    const persistent = item?.source || (!blob && item?.path) || '';
    if (!persistent) {
      missing.push({
        id: item.id,
        name,
        reason: blob
          ? `${name} — o endereço temporário da sessão anterior não vale mais. Importe o arquivo de novo.`
          : `${name} — este projeto não tem uma cópia salva no aparelho.`,
      });
      return { ...item, path: blob ? '' : (item.path || ''), missing: true };
    }
    let ok = true;
    try {
      ok = exists(item);
    } catch {
      ok = false;
    }
    if (!ok) {
      missing.push({ id: item.id, name, reason: `${name} — o arquivo não está mais disponível.` });
      return { ...item, missing: true };
    }
    return { ...item, missing: false };
  });
  return { project: { ...project, media }, missing };
}

export function encodeDataUrl(bytes, mime = 'image/jpeg') {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunk));
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(buffer).toString('base64');
  return `data:${mime};base64,${base64}`;
}

export function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const body = match[2];
  const buffer = typeof Buffer !== 'undefined'
    ? Uint8Array.from(Buffer.from(body, 'base64'))
    : Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  return { mime: match[1], bytes: buffer };
}
