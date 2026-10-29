// Turns Android playback URLs and file:// paths back into the owned copy
// under files/media. Windows paths (C:\...) pass through unchanged.

export function ownedFilePath(raw) {
  if (raw && typeof raw === 'object') {
    return ownedFilePath(raw.source || raw.path || '');
  }
  if (typeof raw !== 'string') return '';
  const value = raw.trim();
  if (!value) return '';

  const markers = ['/_capacitor_file_', '/_capacitor_content_'];
  for (const marker of markers) {
    const at = value.indexOf(marker);
    if (at >= 0) {
      let rest = value.slice(at + marker.length);
      try {
        rest = decodeURIComponent(rest);
      } catch {
        // Keep the raw suffix when it is not percent-encoded.
      }
      if (/^file:/i.test(rest)) return ownedFilePath(rest);
      if (rest && !rest.startsWith('/')) rest = `/${rest}`;
      return rest;
    }
  }

  if (/^file:/i.test(value)) {
    try {
      const url = new URL(value);
      const path = decodeURIComponent(url.pathname || '');
      return path || value.replace(/^file:\/\//i, '');
    } catch {
      return value.replace(/^file:\/\//i, '');
    }
  }

  if (/^(https?:|capacitor:|content:|blob:|data:)/i.test(value)) return '';
  return value;
}

export function mediaOwnedPath(item) {
  return ownedFilePath(item?.source) || ownedFilePath(item?.path);
}

export function persistableMedia(item) {
  if (!item || typeof item !== 'object') return item;
  const source = mediaOwnedPath(item);
  const next = { ...item };
  delete next.missing;
  if (source) {
    next.source = source;
    next.path = source;
    return next;
  }
  const fallback = typeof item.source === 'string' && !/^(https?:|capacitor:|blob:|data:)/i.test(item.source)
    ? item.source
    : '';
  next.source = fallback;
  if (typeof next.path === 'string' && /^(blob:|https?:|capacitor:)/i.test(next.path)) {
    next.path = fallback;
  }
  return next;
}

export function persistableProject(project) {
  if (!project || typeof project !== 'object') return project;
  return {
    ...project,
    media: Array.isArray(project.media) ? project.media.map(persistableMedia) : [],
  };
}

export function projectHasWork(project) {
  if (!project || typeof project !== 'object') return false;
  const media = Array.isArray(project.media) ? project.media : [];
  const clips = [
    ...(project.videoClips || []),
    ...(project.overlayClips || []),
    ...(project.textClips || []),
    ...(project.audioClips || []),
  ];
  return media.length > 0 || clips.length > 0;
}

export function wouldEmptyOverwrite(previousProject, nextProject) {
  return projectHasWork(previousProject) && !projectHasWork(nextProject);
}

export function playableUrl(source, convertFileSrc) {
  const owned = ownedFilePath(source);
  if (!owned) return '';
  if (typeof convertFileSrc === 'function') {
    const converted = convertFileSrc(owned);
    if (converted && converted !== owned && /^(https?:|capacitor:|content:)/i.test(converted)) return converted;
    const prefixed = owned.startsWith('file:') ? owned : `file://${owned}`;
    const again = convertFileSrc(prefixed);
    if (again && again !== owned && again !== prefixed && /^(https?:|capacitor:|content:)/i.test(again)) return again;
  }
  return owned;
}
