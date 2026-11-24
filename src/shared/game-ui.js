import { createPausableScheduler } from './pausable-scheduler.js';

const mountedUIs = new WeakMap();

export function disposeGameUI(root) {
  mountedUIs.get(root)?.destroy();
}

export function createGameUI(root, markup) {
  disposeGameUI(root);
  const cleanups = [];
  const scheduler = createPausableScheduler();
  let listeners = new AbortController();
  let disposed = false;
  const render = (html) => {
    listeners.abort();
    listeners = new AbortController();
    root.innerHTML = html;
  };
  const on = (selector, event, handler) => {
    root
      .querySelectorAll(selector)
      .forEach((node) => node.addEventListener(event, handler, { signal: listeners.signal }));
  };
  render(markup);
  const ui = {
    onDispose: (cleanup) => cleanups.push(cleanup),
    render,
    on,
    scheduler,
    get disposed() {
      return disposed;
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      listeners.abort();
      scheduler.destroy();
      for (const cleanup of cleanups) cleanup();
      mountedUIs.delete(root);
      root.replaceChildren();
    },
  };
  mountedUIs.set(root, ui);
  return ui;
}

export function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}

export function result(finish, title, message, score, outcome = 'complete', icon) {
  finish({ title, message, score, outcome, icon });
}
