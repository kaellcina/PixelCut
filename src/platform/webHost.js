// Browser and Android WebView. Files chosen by the user become blob URLs.
// There is no Windows path and no FFmpeg here. Export does not pretend to succeed.

import { platformKind } from './runtime.js';
import { EXPORT_UNAVAILABLE, engineFor } from './mediaEngine.js';
import { restoreManagedProject } from './projectHost.js';

export {
  listProjects,
  createProject,
  loadProject,
  persistProject,
  renameProject,
  duplicateProject,
  deleteProject,
  getProjectThumbnail,
  saveThumbnail,
  importProjectJson,
} from './projectHost.js';

const liveUrls = new Set();

function pickFiles(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    let settled = false;
    const finish = (files) => {
      if (settled) return;
      settled = true;
      resolve(files);
    };
    input.type = 'file';
    input.accept = accept;
    input.multiple = true;
    input.onchange = () => finish([...(input.files || [])]);
    window.addEventListener('focus', () => {
      window.setTimeout(() => finish([...(input.files || [])]), 400);
    }, { once: true });
    input.click();
  });
}

function kindOf(file) {
  const type = file.type || '';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['mp4', 'mov', 'webm', 'm4v'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) return 'audio';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  return null;
}

function waitForMedia(element, eventName) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('O arquivo demorou demais para abrir.')), 12000);
    const finish = (ok) => {
      window.clearTimeout(timer);
      if (ok) resolve();
      else reject(new Error('Este formato não é reproduzido neste aparelho. Use MP4 H.264, PNG, JPG, MP3 ou WAV.'));
    };
    element.addEventListener(eventName, () => finish(true), { once: true });
    element.addEventListener('error', () => finish(false), { once: true });
  });
}

async function describe(file) {
  const type = kindOf(file);
  if (!type) throw new Error('Formato não reconhecido. Escolha vídeo, imagem ou áudio.');
  const url = URL.createObjectURL(file);
  liveUrls.add(url);
  try {
    if (type === 'image') {
      const image = new Image();
      const ready = waitForMedia(image, 'load');
      image.src = url;
      await ready;
      return { name: file.name, path: url, type, duration: 5, hasVideo: true, hasAudio: false, width: image.naturalWidth, height: image.naturalHeight };
    }
    const media = document.createElement(type === 'audio' ? 'audio' : 'video');
    media.preload = 'metadata';
    const ready = waitForMedia(media, 'loadedmetadata');
    media.src = url;
    await ready;
    const duration = Number.isFinite(media.duration) ? media.duration : 0;
    if (type === 'video' && !(media.videoWidth > 0)) throw new Error('O vídeo não tem imagem reproduzível neste aparelho.');
    return {
      name: file.name,
      path: url,
      type,
      duration,
      hasVideo: type === 'video',
      hasAudio: type === 'audio' || type === 'video',
      width: media.videoWidth || 0,
      height: media.videoHeight || 0,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    liveUrls.delete(url);
    throw error;
  }
}

export const canReveal = false;

export async function importMedia() {
  const files = await pickFiles('video/*,image/*,audio/*');
  const items = [];
  for (const file of files) {
    try {
      items.push(await describe(file));
    } catch (error) {
      items.push({ name: file.name, error: error.message });
    }
  }
  return items;
}

export function releaseMedia(item) {
  const path = typeof item === 'string' ? item : item?.path;
  if (typeof path === 'string' && path.startsWith('blob:') && liveUrls.has(path)) {
    URL.revokeObjectURL(path);
    liveUrls.delete(path);
  }
}

export function restoreProject(project) {
  return restoreManagedProject(project);
}

export async function relocateMedia(item) {
  const items = await importMedia();
  const picked = (items || []).find((entry) => entry && !entry.error);
  if (!picked) return null;
  return { ...item, ...picked, id: item?.id, missing: false };
}

export const persistenceNote = () => 'Neste navegador os projetos ficam só neste aparelho. Endereços blob de mídia não sobrevivem ao recarregar a página.';

export function openExport() {
  return Promise.reject(new Error('Este aparelho não abre a pasta do Explorer.'));
}

export function shareFile() {
  return Promise.resolve();
}

async function saveOnAndroid(json) {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const name = `pixelcut-${Date.now()}.fve.json`;
  await Filesystem.writeFile({
    path: name,
    data: json,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
  });
  return {
    ok: true,
    file: name,
    message: `Projeto salvo em Documentos/${name}. Os vídeos continuam no armazenamento privado do aplicativo; o arquivo guarda as referências, não uma cópia dos vídeos.`,
  };
}

export async function saveProject(json) {
  if (platformKind() === 'android') {
    try {
      return await saveOnAndroid(json);
    } catch (error) {
      return { ok: false, message: `Não foi possível gravar o projeto no aparelho: ${error.message}` };
    }
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'projeto.fve.json';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { ok: true, message: 'Download do projeto iniciado. A mídia desta sessão não entra no arquivo.' };
}

export function openProject() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    let settled = false;
    const finish = (value, failed) => {
      if (settled) return;
      settled = true;
      if (failed) reject(value);
      else resolve(value);
    };
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return finish(null);
      try {
        finish(await file.text());
      } catch (error) {
        finish(error, true);
      }
    };
    window.addEventListener('focus', () => {
      window.setTimeout(() => {
        if (!input.files || !input.files.length) finish(null);
      }, 400);
    }, { once: true });
    input.click();
  });
}

export function exportVideo() {
  return Promise.resolve({ ok: false, error: engineFor(platformKind()).summary || EXPORT_UNAVAILABLE });
}

export function cancelExport() {
  return Promise.resolve();
}

export function showInFolder() {
  return Promise.reject(new Error('Este aparelho não abre a pasta do Explorer.'));
}

export function onExportProgress() {
  return () => {};
}
