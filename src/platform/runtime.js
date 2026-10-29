// Where the shared interface is running. Electron is detected from the preload
// bridge, never by importing electron. Capacitor's native bridge sets window.Capacitor.

export function platformKind() {
  if (typeof window === 'undefined') return 'browser';
  const bridge = window.api;
  if (bridge && typeof bridge.importMedia === 'function' && typeof bridge.exportVideo === 'function') return 'electron';
  const native = window.Capacitor?.isNativePlatform?.() === true;
  const name = window.Capacitor?.getPlatform?.();
  if (native && name === 'android') return 'android';
  if (native) return 'native';
  return 'browser';
}

export function prefersMobileLayout() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  const narrow = window.matchMedia('(max-width: 860px)').matches;
  const short = window.matchMedia('(max-height: 520px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const kind = platformKind();
  if (kind === 'electron') return false;
  if (kind === 'android') return narrow || short;
  return coarse && (narrow || short);
}
