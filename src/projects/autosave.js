export function createAutosave({
  save,
  delay = 700,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  if (typeof save !== 'function') throw new Error('createAutosave requires save()');

  let gen = 0;
  let pending = null;
  let timer = null;
  let chain = Promise.resolve();
  let inFlight = null;
  let status = 'idle';
  let savedAt = null;
  let error = null;
  let lastSaved = '';
  const listeners = new Set();

  const emit = () => {
    const snapshot = { status, savedAt, error };
    listeners.forEach((listener) => listener(snapshot));
  };

  const run = async () => {
    while (pending) {
      const job = pending;
      pending = null;
      status = 'saving';
      emit();
      inFlight = job.gen;
      try {
        const payload = typeof job.payload === 'function' ? job.payload() : job.payload;
        await save(payload, job.gen);
        lastSaved = job.fp;
        if (!pending) {
          status = 'saved';
          savedAt = Date.now();
          error = null;
          emit();
        }
      } catch (caught) {
        error = caught;
        status = 'error';
        emit();
      } finally {
        inFlight = null;
      }
    }
  };

  const kick = () => {
    chain = chain.then(run, run);
    return chain;
  };

  const schedule = (payload, fingerprint = '') => {
    // A queued job must still be replaced: its lazy payload may now differ from lastSaved.
    if (fingerprint && fingerprint === lastSaved && status !== 'error' && !pending && inFlight == null) return gen;
    gen += 1;
    pending = { gen, payload, fp: fingerprint };
    if (timer != null) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      kick();
    }, delay);
    return gen;
  };

  const flush = async () => {
    if (timer != null) {
      clearTimer(timer);
      timer = null;
    }
    if (pending || inFlight != null) await kick();
    else await chain;
    return { status, savedAt, error };
  };

  return {
    schedule,
    flush,
    subscribe(listener) {
      listeners.add(listener);
      listener({ status, savedAt, error });
      return () => listeners.delete(listener);
    },
    getState: () => ({ status, savedAt, error, pending: !!pending, inFlight }),
  };
}
