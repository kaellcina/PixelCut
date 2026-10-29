// Snapping for elements dragged in the preview. Positions are the element center as a 0..1
// fraction of the stage; sizes are half the element's width/height as a fraction of the stage.
export const SNAP_PX = 7;

// Returns { value, guide } where guide is 'start' | 'center' | 'end' | null.
export function snapAxis(value, half, stagePx, threshold = SNAP_PX) {
  const targets = [{ guide: 'center', value: 0.5 }];
  if (half > 0 && half < 0.5) {
    targets.push({ guide: 'start', value: half }, { guide: 'end', value: 1 - half });
  }
  let best = null;
  let bestDistance = threshold;
  targets.forEach((target) => {
    const distance = Math.abs(value - target.value) * stagePx;
    // Center is listed first and keeps ties.
    if (best ? distance < bestDistance : distance <= threshold) {
      best = target;
      bestDistance = distance;
    }
  });
  return best ? { value: best.value, guide: best.guide } : { value, guide: null };
}

export function snapPosition({ x, y, halfW = 0, halfH = 0, stageW, stageH, disabled = false, threshold = SNAP_PX }) {
  const sx = disabled ? { value: x, guide: null } : snapAxis(x, halfW, stageW, threshold);
  const sy = disabled ? { value: y, guide: null } : snapAxis(y, halfH, stageH, threshold);
  return {
    x: Math.max(0, Math.min(1, sx.value)),
    y: Math.max(0, Math.min(1, sy.value)),
    guides: { v: sx.guide, h: sy.guide },
  };
}
