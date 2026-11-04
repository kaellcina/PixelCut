export function playheadX(time, pps, headWidth) {
  return (Number(headWidth) || 0) + Math.max(0, Number(time) || 0) * Math.max(1, Number(pps) || 1);
}

export function playheadScrollLeft(time, pps, headWidth, viewWidth, align = 0.42) {
  const playX = playheadX(time, pps, headWidth);
  const width = Math.max(1, Number(viewWidth) || 1);
  return Math.max(0, playX - width * align);
}

export function playheadNeedsFollow(playX, scrollLeft, viewWidth, edgeRatio = 0.18) {
  const width = Math.max(1, Number(viewWidth) || 1);
  const left = Number(scrollLeft) || 0;
  const edge = Math.max(48, width * edgeRatio);
  if (playX < left + 24) return true;
  if (playX > left + width - edge) return true;
  return false;
}

export function playheadVisible(playX, scrollLeft, viewWidth, pad = 8) {
  const left = Number(scrollLeft) || 0;
  const right = left + Math.max(1, Number(viewWidth) || 1);
  return playX >= left + pad && playX <= right - pad;
}

export function playheadHitHalf(touch = false) {
  return touch ? 22 : 10;
}

export function isPlayheadHit(contentX, time, pps, headWidth, touch = false) {
  return Math.abs((Number(contentX) || 0) - playheadX(time, pps, headWidth)) <= playheadHitHalf(touch);
}

export function pointerContentX(clientX, viewLeft, scrollLeft) {
  return (Number(clientX) || 0) - (Number(viewLeft) || 0) + (Number(scrollLeft) || 0);
}

export function timeFromContentX(contentX, headWidth, pps, duration) {
  const raw = ((Number(contentX) || 0) - (Number(headWidth) || 0)) / Math.max(1, Number(pps) || 1);
  const end = Math.max(0, Number(duration) || 0);
  return Math.max(0, Math.min(end, raw));
}

export function edgeScrollDelta(viewportX, viewWidth, { touch = false } = {}) {
  const width = Math.max(1, Number(viewWidth) || 1);
  const x = Number(viewportX) || 0;
  const maxSpeed = touch ? 24 : 30;
  const edge = Math.min(width / 2, Math.max(touch ? 64 : 48, width * (touch ? 0.16 : 0.12)));
  if (x <= 0) return -maxSpeed;
  if (x >= width) return maxSpeed;
  if (x < edge) {
    const t = Math.max(0, Math.min(1, 1 - x / edge));
    return -maxSpeed * t * t;
  }
  if (x > width - edge) {
    const t = Math.max(0, Math.min(1, (x - (width - edge)) / edge));
    return maxSpeed * t * t;
  }
  return 0;
}

export function clampScrollLeft(scrollLeft, maxScroll) {
  return Math.max(0, Math.min(Math.max(0, Number(maxScroll) || 0), Number(scrollLeft) || 0));
}

export function timelinePanPosition({
  startLeft,
  startTop,
  pointerDeltaX,
  pointerDeltaY,
  maxLeft,
  maxTop,
} = {}) {
  const left = clampScrollLeft((Number(startLeft) || 0) - (Number(pointerDeltaX) || 0), maxLeft);
  const top = Math.max(0, Math.min(
    Math.max(0, Number(maxTop) || 0),
    (Number(startTop) || 0) - (Number(pointerDeltaY) || 0),
  ));
  return { left, top };
}

export function touchClipGesture({ deltaX, deltaY, moveReady = false, threshold = 12 } = {}) {
  const distance = Math.max(Math.abs(Number(deltaX) || 0), Math.abs(Number(deltaY) || 0));
  if (distance < Math.max(1, Number(threshold) || 12)) return 'pending';
  return moveReady ? 'move' : 'pan';
}

export function scrubAutoScroll({
  viewportX,
  viewWidth,
  scrollLeft,
  maxScroll,
  time,
  duration,
  pps,
  headWidth,
  touch = false,
} = {}) {
  const end = Math.max(0, Number(duration) || 0);
  const now = Math.max(0, Math.min(end, Number(time) || 0));
  let delta = edgeScrollDelta(viewportX, viewWidth, { touch });
  if (now <= 0 && delta < 0) delta = 0;
  if (now >= end && delta > 0) delta = 0;
  const nextScroll = clampScrollLeft((Number(scrollLeft) || 0) + delta, maxScroll);
  const nextTime = timeFromContentX((Number(viewportX) || 0) + nextScroll, headWidth, pps, end);
  return { scrollLeft: nextScroll, time: nextTime, delta };
}
