// Android host. Talks to the PixelCut Capacitor plugin and never imports
// electron, child_process or ffmpeg-static.

import { Capacitor } from '@capacitor/core';
import { planMainExport } from './exportPlan.js';
import { playableUrl } from './mediaPath.js';
import { releaseOwnedFile } from './mediaRelease.js';
import { openProject } from './webHost.js';
import {
  androidPersistenceNote,
  createProject,
  deleteProject,
  duplicateProject,
  getPixelCutPlugin,
  getProjectRepository,
  getProjectThumbnail,
  importProjectJson,
  listProjects,
  loadProject,
  persistProject,
  renameProject,
  restoreManagedProject,
  saveThumbnail,
} from './projectHost.js';

function native() {
  return getPixelCutPlugin();
}

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
};

export const persistenceNote = androidPersistenceNote;

export const canReveal = false;
export { openProject };

function failure(error, fallback) {
  return error?.message || fallback;
}

export async function importMedia() {
  try {
    const result = await native().importMedia();
    return (result?.items || []).map((item) => {
      if (item?.error || !item?.source) {
        return { name: item?.name || 'Arquivo', error: item?.error || 'não foi possível guardar o arquivo.' };
      }
      return {
        name: item.name,
        source: item.source,
        path: playableUrl(item.source, (file) => Capacitor.convertFileSrc(file)) || Capacitor.convertFileSrc(item.source),
        type: item.type,
        duration: item.duration,
        width: item.width || 0,
        height: item.height || 0,
        hasVideo: item.hasVideo !== false,
        hasAudio: !!item.hasAudio,
      };
    });
  } catch (error) {
    return [{ name: 'Importação', error: failure(error, 'não foi possível abrir o seletor de arquivos.') }];
  }
}

// Duplicated projects share the same private file, so delete only when no saved project still uses it.
export function releaseMedia(item) {
  return releaseOwnedFile(item, {
    loadRepo: getProjectRepository,
    deleteFile: (source) => native().deleteMedia({ source }),
  });
}

export function onAppClosing(callback) {
  let removed = false;
  let handle = null;
  native().addListener('appState', (event) => {
    if (!removed && event && event.isActive === false) {
      Promise.resolve(callback()).catch(() => {});
    }
  }).then((result) => {
    handle = result;
    if (removed && result) result.remove();
  }).catch(() => {});
  return () => {
    removed = true;
    if (handle) handle.remove();
  };
}

export async function restoreProject(project) {
  return restoreManagedProject(project);
}

export async function relocateMedia(item) {
  const items = await importMedia();
  const picked = (items || []).find((entry) => entry && !entry.error);
  if (!picked) return null;
  return { ...item, ...picked, id: item.id, missing: false };
}

export async function saveProject(json) {
  try {
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
  } catch (error) {
    const lowSpace = /space|espaço|enospc/i.test(error?.message || '');
    const message = lowSpace
      ? 'Não há espaço livre suficiente para gravar o projeto.'
      : `Não foi possível gravar o projeto no aparelho: ${failure(error, 'erro desconhecido')}`;
    return { ok: false, message };
  }
}

export async function exportVideo(project) {
  let plan;
  try {
    plan = planMainExport(project);
  } catch (error) {
    return { ok: false, error: failure(error, 'O projeto não pode ser exportado.') };
  }
  try {
    const result = await native().exportVideo({ plan });
    if (result?.canceled) return { canceled: true };
    if (!result?.uri) return { ok: false, error: 'A exportação terminou sem gerar um arquivo.' };
    return {
      ok: true,
      file: result.uri,
      display: result.display || result.uri,
      warnings: plan.warnings,
    };
  } catch (error) {
    return { ok: false, error: failure(error, 'A exportação falhou.') };
  }
}

export function cancelExport() {
  return native().cancelExport().catch(() => {});
}

export function openExport(file) {
  return native().openVideo({ uri: file });
}

export function showInFolder(file) {
  return openExport(file);
}

export function shareFile(file) {
  return native().shareVideo({ uri: file });
}

export function onExportProgress(callback) {
  let handle = null;
  let active = true;
  native().addListener('progress', (event) => {
    if (active && event && typeof event.progress === 'number') callback(event.progress);
  }).then((result) => {
    handle = result;
    if (!active && result) result.remove();
  }).catch(() => {});
  return () => {
    active = false;
    if (handle) handle.remove();
  };
}
