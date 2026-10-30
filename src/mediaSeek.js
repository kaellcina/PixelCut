// One in-flight media seek at a time. Fast timeline drags would otherwise queue
// hundreds of currentTime assignments and stall the WebView decoder.

export function createSeekQueue() {
  let element = null;
  let pending = null;
  let busy = false;
  let waiter = null;

  const finishWait = () => {
    if (pending != null || busy) return;
    const done = waiter;
    waiter = null;
    if (done) done();
  };

  const pump = () => {
    if (!element || busy || pending == null) {
      finishWait();
      return;
    }
    const target = pending;
    pending = null;
    if (element.readyState < 1) {
      pending = target;
      return;
    }
    const current = Number(element.currentTime) || 0;
    if (Math.abs(current - target) < 0.008) {
      finishWait();
      pump();
      return;
    }
    busy = true;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(watchdog);
      element.removeEventListener('seeked', done);
      element.removeEventListener('error', done);
      busy = false;
      pump();
    };
    const watchdog = globalThis.setTimeout(done, 140);
    element.addEventListener('seeked', done);
    element.addEventListener('error', done);
    try {
      if (typeof element.fastSeek === 'function') element.fastSeek(target);
      else element.currentTime = target;
    } catch {
      busy = false;
      finishWait();
    }
  };

  return {
    attach(next) {
      element = next || null;
    },
    request(time) {
      if (!Number.isFinite(time)) return;
      pending = Math.max(0, time);
      pump();
    },
    flush() {
      if (!busy && pending == null) return Promise.resolve();
      return new Promise((resolve) => {
        const previous = waiter;
        waiter = () => {
          if (previous) previous();
          resolve();
        };
        pump();
      });
    },
    reset() {
      pending = null;
      busy = false;
    },
  };
}

export function shouldCoalesceSeek(playing) {
  return !playing;
}
