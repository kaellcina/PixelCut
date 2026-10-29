import { inspectMedia } from '../projects/schema.js';
import { mediaOwnedPath, playableUrl } from './mediaPath.js';

export function applyAndroidRestore(project, statusItems, convertFileSrc) {
  const media = project?.media || [];
  const byId = new Map();
  (statusItems || []).forEach((row, index) => {
    const id = row?.id || media[index]?.id;
    if (id) byId.set(id, row);
  });
  const inspected = inspectMedia(project, (item) => byId.get(item.id)?.ok === true);
  inspected.project = {
    ...inspected.project,
    media: inspected.project.media.map((item, index) => {
      const native = byId.get(item.id) || statusItems?.[index] || {};
      const source = native.source || mediaOwnedPath(item) || item.source || '';
      if (native.ok && source) {
        return {
          ...item,
          source,
          path: native.path || playableUrl(source, convertFileSrc) || source,
          missing: false,
        };
      }
      const previousPath = typeof item.path === 'string' && !item.path.startsWith('blob:') ? item.path : '';
      return {
        ...item,
        source,
        path: previousPath || source,
        missing: true,
      };
    }),
  };
  return inspected;
}
