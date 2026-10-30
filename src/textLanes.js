export function clipEnd(clip) {
  if (!clip) return 0;
  if (Number.isFinite(clip.duration)) return (clip.start || 0) + clip.duration;
  return (clip.start || 0) + Math.max(0, (clip.out || 0) - (clip.in || 0));
}

export function firstFreeTextLane(clips, start, duration) {
  const from = Number.isFinite(start) ? start : 0;
  const to = from + Math.max(0.15, Number.isFinite(duration) ? duration : 3);
  const used = new Set();
  (clips || []).forEach((clip) => {
    const clipStart = clip.start || 0;
    const clipFinish = clipEnd(clip);
    if (clipStart < to && clipFinish > from) used.add(clip.lane || 0);
  });
  let lane = 0;
  while (used.has(lane)) lane += 1;
  return lane;
}

export function overlap(a, b) {
  const aStart = a.start || 0;
  const bStart = b.start || 0;
  return aStart < clipEnd(b) && bStart < clipEnd(a);
}

export function packedTextClips(clips) {
  const next = [];
  const sorted = [...(clips || [])].sort((a, b) => (a.start || 0) - (b.start || 0) || String(a.id || '').localeCompare(String(b.id || '')));
  sorted.forEach((clip) => {
    const used = new Set(next.filter((item) => overlap(item, clip)).map((item) => item.lane || 0));
    let lane = Number.isFinite(clip.lane) ? clip.lane : 0;
    if (used.has(lane)) lane = firstFreeTextLane(next, clip.start, clip.duration);
    while (used.has(lane)) lane += 1;
    next.push({ ...clip, lane });
  });
  return next;
}

export function textLaneRows(clips) {
  const list = Array.isArray(clips) ? clips : [];
  const max = list.reduce((highest, clip) => Math.max(highest, clip.lane || 0), 0);
  const rows = [];
  for (let lane = 0; lane <= max; lane += 1) {
    const items = list.filter((clip) => (clip.lane || 0) === lane);
    if (items.length) rows.push({ lane, clips: items });
  }
  if (!rows.length && list.length) rows.push({ lane: 0, clips: list });
  return rows;
}
