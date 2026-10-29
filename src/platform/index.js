import * as androidHost from './androidHost.js';
import * as electronHost from './electronHost.js';
import * as webHost from './webHost.js';
import { platformKind, prefersMobileLayout } from './runtime.js';

function host() {
  const kind = platformKind();
  if (kind === 'electron') return electronHost;
  if (kind === 'android') return androidHost;
  return webHost;
}

export { platformKind, prefersMobileLayout };

export const platform = {
  kind: platformKind,
  mobile: prefersMobileLayout,
  canReveal: () => host().canReveal,
  importMedia: () => host().importMedia(),
  saveProject: (json) => host().saveProject(json),
  openProject: () => host().openProject(),
  restoreProject: (project) => host().restoreProject(project),
  relocateMedia: (item) => host().relocateMedia(item),
  listProjects: () => host().listProjects(),
  createProject: (input) => host().createProject(input),
  loadProject: (id) => host().loadProject(id),
  persistProject: (input) => host().persistProject(input),
  renameProject: (id, name) => host().renameProject(id, name),
  duplicateProject: (id) => host().duplicateProject(id),
  deleteProject: (id) => host().deleteProject(id),
  getProjectThumbnail: (id) => host().getProjectThumbnail(id),
  saveThumbnail: (id, dataUrl, mediaId) => host().saveThumbnail(id, dataUrl, mediaId),
  importProjectJson: (text) => host().importProjectJson(text),
  persistenceNote: () => host().persistenceNote?.() || '',
  onAppClosing: (callback) => (host().onAppClosing ? host().onAppClosing(callback) : () => {}),
  readyToClose: () => host().readyToClose?.(),
  exportVideo: (project) => host().exportVideo(project),
  cancelExport: () => host().cancelExport(),
  showInFolder: (file) => host().showInFolder(file),
  openExport: (file) => host().openExport(file),
  shareFile: (file) => host().shareFile(file),
  onExportProgress: (callback) => host().onExportProgress(callback),
  releaseMedia: (item) => host().releaseMedia(item),
};
