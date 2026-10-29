// Desktop bridge. Uses the object exposed by electron/preload.cjs.
// This file must not import electron, child_process or ffmpeg-static.

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
import { restoreManagedProject } from './projectHost.js';

function bridge() {
  const api = typeof window !== 'undefined' ? window.api : null;
  if (!api) throw new Error('A ponte do Electron não está disponível nesta janela.');
  return api;
}

export const canReveal = true;

export function importMedia() {
  return bridge().importMedia();
}

export async function saveProject(json) {
  const file = await bridge().saveProject(json);
  return file ? { ok: true, file, message: 'Projeto salvo' } : { ok: false };
}

export function openProject() {
  return bridge().openProject();
}

export function exportVideo(project) {
  return bridge().exportVideo(project);
}

export function cancelExport() {
  return bridge().cancelExport();
}

export function showInFolder(file) {
  return bridge().showInFolder(file);
}

export function openExport(file) {
  return showInFolder(file);
}

export function shareFile() {
  return Promise.resolve();
}

export function restoreProject(project) {
  return restoreManagedProject(project);
}

export async function relocateMedia(item) {
  const picked = await bridge().pickMedia();
  if (!picked) return null;
  return {
    ...item,
    ...picked,
    id: item.id,
    missing: false,
  };
}

export const persistenceNote = () => 'Os projetos ficam neste computador, na pasta de dados do PixelCut. As mídias continuam nos arquivos originais; se um arquivo for movido ou apagado, o projeto pede para localizá-lo de novo.';

export function onAppClosing(callback) {
  return bridge().onClosing(callback);
}

export function readyToClose() {
  return bridge().readyToClose();
}

export function onExportProgress(callback) {
  return bridge().onExportProgress(callback);
}

export function releaseMedia() {}
