import { Capacitor, registerPlugin } from '@capacitor/core';
import { createProjectRepository } from '../projects/repository.js';
import { inspectMedia } from '../projects/schema.js';
import { createCapacitorStore, createIpcStore, createLocalStorageStore } from './fsStore.js';
import { platformKind } from './runtime.js';

let nativePlugin = null;

export function getPixelCutPlugin() {
  if (!nativePlugin) nativePlugin = registerPlugin('PixelCut');
  return nativePlugin;
}

let repo = null;

function electronInvoke(method, ...args) {
  const api = typeof window !== 'undefined' ? window.api : null;
  if (!api?.projectFs) throw new Error('A ponte de projetos do Electron não está disponível.');
  return api.projectFs(method, args);
}

export async function getProjectRepository() {
  if (repo) return repo;
  const kind = platformKind();
  if (kind === 'electron') {
    repo = createProjectRepository(createIpcStore(electronInvoke));
  } else if (kind === 'android') {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    repo = createProjectRepository(createCapacitorStore(Filesystem, Directory, Encoding));
  } else {
    const storage = typeof window !== 'undefined' ? window.localStorage : { length: 0, key: () => null, getItem: () => null, setItem: () => {}, removeItem: () => {} };
    repo = createProjectRepository(createLocalStorageStore(storage));
  }
  return repo;
}

export async function mediaExists(item) {
  const kind = platformKind();
  if (kind === 'electron') {
    const file = item?.path || '';
    return !!(file && window.api?.mediaExists?.(file));
  }
  if (kind === 'android') {
    if (!item?.source) return false;
    try {
      const result = await getPixelCutPlugin().restoreMedia({ sources: [item.source] });
      return !!result?.items?.[0]?.ok;
    } catch {
      return false;
    }
  }
  const path = item?.path || '';
  return typeof path === 'string' && (path.startsWith('blob:') || path.startsWith('data:'));
}

export async function restoreManagedProject(project) {
  const kind = platformKind();
  if (kind === 'android') {
    const media = project?.media || [];
    let status = [];
    try {
      const result = await getPixelCutPlugin().restoreMedia({ sources: media.map((item) => item?.source || '') });
      status = result?.items || [];
    } catch (error) {
      throw new Error(error?.message || 'Não foi possível verificar os arquivos do projeto.');
    }
    const ok = new Map(media.map((item, index) => [item?.id, !!status[index]?.ok]));
    const inspected = inspectMedia(project, (item) => ok.get(item.id) === true);
    inspected.project = {
      ...inspected.project,
      media: inspected.project.media.map((item) => (
        item.missing || !item.source
          ? { ...item, path: '' }
          : { ...item, path: Capacitor.convertFileSrc(item.source) }
      )),
    };
    return inspected;
  }
  const inspected = inspectMedia(project, (item) => {
    if (kind === 'electron') return !!(item?.path && window.api?.mediaExists?.(item.path));
    const path = item?.path || '';
    return typeof path === 'string' && (path.startsWith('blob:') || path.startsWith('http') || path.startsWith('file:'));
  });
  return inspected;
}

export async function listProjects() {
  return (await getProjectRepository()).listProjects();
}

export async function createProject(input) {
  return (await getProjectRepository()).createProject(input);
}

export async function loadProject(id) {
  const document = await (await getProjectRepository()).loadProject(id);
  const restored = await restoreManagedProject(document.project);
  return { document: { ...document, project: restored.project }, missing: restored.missing };
}

export async function persistProject(input) {
  return (await getProjectRepository()).saveProject(input);
}

export async function renameProject(id, name) {
  return (await getProjectRepository()).renameProject(id, name);
}

export async function duplicateProject(id) {
  return (await getProjectRepository()).duplicateProject(id);
}

export async function deleteProject(id) {
  return (await getProjectRepository()).deleteProject(id);
}

export async function getProjectThumbnail(id) {
  return (await getProjectRepository()).getProjectThumbnail(id);
}

export async function saveThumbnail(id, dataUrl, thumbMediaId) {
  return (await getProjectRepository()).saveThumbnail(id, dataUrl, thumbMediaId);
}

export async function importProjectJson(text) {
  const imported = await (await getProjectRepository()).importProjectJson(text);
  const restored = await restoreManagedProject(imported.document.project);
  return { ...imported, document: { ...imported.document, project: restored.project }, missing: restored.missing };
}

export function androidPersistenceNote() {
  return 'Os projetos e as mídias importadas ficam no armazenamento privado do PixelCut. Desinstalar o aplicativo apaga esses arquivos. Exporte o vídeo para conservá-lo fora do aplicativo.';
}
