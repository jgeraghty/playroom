export function createPausableScheduler() {
  const jobs = new Map();
  let nextId = 1;
  let paused = false;
  let destroyed = false;

  function arm(job) {
    if (paused || destroyed || !jobs.has(job.id)) return;
    job.startedAt = performance.now();
    if (job.kind === 'frame') {
      job.nativeId = requestAnimationFrame((time) => {
        if (!jobs.has(job.id)) return;
        jobs.delete(job.id);
        job.callback(time);
      });
      return;
    }
    job.nativeId = window.setTimeout(() => {
      if (!jobs.has(job.id)) return;
      if (job.kind === 'interval') {
        job.remaining = job.delay;
        arm(job);
      } else {
        jobs.delete(job.id);
      }
      job.callback(...job.args);
    }, job.remaining);
  }

  function add(kind, callback, delay = 0, args = []) {
    if (destroyed) return null;
    const id = nextId++;
    const job = {
      id,
      kind,
      callback,
      args,
      delay: Math.max(0, Number(delay) || 0),
      remaining: Math.max(0, Number(delay) || 0),
      startedAt: 0,
      nativeId: null,
    };
    jobs.set(id, job);
    arm(job);
    return id;
  }

  function cancel(id) {
    const job = jobs.get(id);
    if (!job) return;
    if (job.nativeId !== null) {
      if (job.kind === 'frame') cancelAnimationFrame(job.nativeId);
      else window.clearTimeout(job.nativeId);
    }
    jobs.delete(id);
  }

  function pause() {
    if (paused || destroyed) return;
    paused = true;
    for (const job of jobs.values()) {
      if (job.nativeId !== null) {
        if (job.kind === 'frame') {
          cancelAnimationFrame(job.nativeId);
        } else {
          window.clearTimeout(job.nativeId);
          job.remaining = Math.max(0, job.remaining - (performance.now() - job.startedAt));
        }
        job.nativeId = null;
      }
    }
  }

  function resume() {
    if (!paused || destroyed) return;
    paused = false;
    for (const job of jobs.values()) arm(job);
  }

  function clear() {
    for (const id of [...jobs.keys()]) cancel(id);
  }

  function destroy() {
    clear();
    destroyed = true;
  }

  return {
    timeout: (callback, delay, ...args) => add('timeout', callback, delay, args),
    interval: (callback, delay, ...args) => add('interval', callback, delay, args),
    frame: (callback) => add('frame', callback),
    clearTimeout: cancel,
    clearInterval: cancel,
    cancelFrame: cancel,
    pause,
    resume,
    clear,
    destroy,
  };
}
