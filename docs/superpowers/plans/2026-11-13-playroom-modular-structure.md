# Playroom Modular Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Split Playroom's single-file app into a Vite-powered, framework-free module tree while preserving all 14 games and the existing shared shell.

**Architecture:** Keep `index.html` as the Vite entry, register games through a data-driven catalog with dynamic imports, and move shell/progress behavior into shared modules. Each game exports `mountGame({ root, level, progress, finish, saveProgress, updateStatus })` and returns `pause`, `resume`, `restart`, and `destroy` methods.

**Tech Stack:** HTML, CSS, browser JavaScript ES modules, Vite, pnpm, static hosting.

**Spec:** `docs/superpowers/specs/2026-11-13-playroom-modular-structure-design.md`

## Global Constraints

- Preserve the 14 existing games and the current shell behavior while restructuring.
- Keep the app framework-free; do not add a server-side backend, accounts, cloud sync, analytics, ads, or social features.
- Preserve browser-local progress, badges, themes, reset behavior, and the existing `playroom-progress-v1` saved data.
- Keep iPad Safari touch targets, safe areas, reduced-motion behavior, keyboard handling, and Retina canvas scaling.
- Use Vite `base: './'` so build assets can be served from a root or subpath static host.
- Use pnpm and a checked-in `pnpm-lock.yaml`; verify pnpm can install and run Vite in this environment before proceeding with the migration.
- A game must release its timers, animation frames, event listeners, and canvas resources on `destroy()`.
- Do not add a UI framework or abstractions without a repeated use case.

## Review Focus

- Existing localStorage data from `playroom-progress-v1` must remain readable after migration.
- Returning from pause must resume the current state; restart must reset only the current round; quit must clean all game resources.
- Dynamic import paths must work in the Vite build when hosted under a relative base path.
- Game modules must not leave delayed callbacks or input listeners active after result, restart, or quit.
- Mobile Safari text/number inputs and canvas games must remain usable in portrait and landscape.

---

### Task 1: Add Vite entry and package scripts

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `.gitignore`
- Generate: `pnpm-lock.yaml`

**Interfaces:**
- Produces pnpm scripts `dev`, `build`, and `preview`.

- [x] Confirm `pnpm --version` works and use pnpm for the Vite dependency and lockfile. If pnpm cannot run Vite scripts in this environment, stop and report the Node.js runtime prerequisite.
- [x] Create `package.json` with `private: true`, `type: "module"`, and scripts `dev: "vite"`, `build: "vite build"`, and `preview: "vite preview"`.
- [x] Add Vite as a dev dependency with `pnpm add -D vite`; generate `pnpm-lock.yaml` with `pnpm install`.
- [x] Add `vite.config.js` with `base: "./"`; add `.gitignore` entries for `node_modules/` and `dist/`.
- [x] Leave `index.html` and the current app implementation untouched during bootstrap so this step keeps the existing page working.

**Check:** `pnpm dev` serves the existing app and `pnpm build` emits `dist/index.html` plus referenced assets. This plan adds no automated test framework.

### Task 2: Extract global styles and progress storage

**Files:**
- Create: `src/shell/progress-store.js`
- Create: `src/styles/tokens.css`
- Create: `src/styles/app.css`
- Create: `src/styles/catalog.css`
- Create: `src/styles/play-screen.css`

**Interfaces:**
- `progressStore` exports `load()`, `saveGame(gameId, patch)`, `recordResult(result)`, `chooseTheme(theme)`, `dailyGameId(gameIds)`, and `reset()`; it owns localStorage access.

- [x] Move the current CSS into shared files, retaining media queries, safe-area styles, focus states, and `prefers-reduced-motion` rules.
- [x] Move localStorage parsing, storage writes, badge/theme unlocks, daily game selection, and progress reset out of `index.html` into `progress-store.js`.
- [x] Normalize existing `playroom-progress-v1` data without dropping `played`, `wins`, `best`, `badges`, or `theme`; tolerate missing or malformed storage fields.

**Check:** `progressStore` preserves existing `playroom-progress-v1` fields when loading/saving and tolerates absent or malformed values. The current page remains the active app during extraction.

### Task 3: Build the shared game host and app shell

**Files:**
- Create: `src/shell/game-host.js`
- Create: `src/shell/app.js`

**Interfaces:**
- Game modules export `mountGame({ root, level, progress, finish, saveProgress, updateStatus })` and return `{ pause(), resume(), restart(), destroy() }`.
- `finish({ outcome, title, message, score? })` presents the shared result screen while keeping the game mounted.
- `createGameHost({ root, games, progressStore, renderResult })` owns transitions. Its returned host exposes `open(gameId)`, `pause()`, `resume()`, `restart()`, and `quit()`.

- [x] Implement mount/unmount, pause menu, restart, confirmed active-round quit, and shared result actions in `game-host.js`.
- [x] Ensure restart clears the old controller before remount; ensure quit calls `destroy()` and returns to catalog; do not auto-dismiss after `finish()`.
- [x] Make `app.js` receive the registry, progress store, and game host through constructor arguments so the shell stays independent of individual game modules.
- [x] Bind game-scoped `saveProgress(patch)` to `progressStore.saveGame(gameId, patch)` and results to `progressStore.recordResult(result)` in the host.

**Check:** Review lifecycle ownership and verify the host API has no direct dependencies on game names or globals. Keep the current app active until Task 7 cutover.

### Task 4: Migrate memory, sequence, and input games

**Files:**
- Create: `src/shared/pausable-scheduler.js`
- Create: `src/games/memory-match/index.js`
- Create: `src/games/memory-match/style.css`
- Create: `src/games/simon-says/index.js`
- Create: `src/games/simon-says/style.css`
- Create: `src/games/tic-tac-toe/index.js`
- Create: `src/games/number-guess/index.js`
- Create: `src/games/rock-paper-scissors/index.js`
- Create: `src/games/quick-math/index.js`
- Create: `src/games/word-scramble/index.js`
- Create game-specific `style.css` only where needed.
**Interfaces:** Use the shared `mountGame(...)` and controller contract from Task 3. Registry wiring is deferred until all game modules exist in Task 7.

- [x] Move Memory Match and Simon Says to the game contract; preserve instructions, progression, touch UI, and results. Simon Says must append a step to the pattern after each successful repeat.
- [x] Ensure both games pause their timers/animation callbacks and remove listeners/timers on destroy.
- [x] Move Tic-Tac-Toe with player-count selection, difficulty, best-of-three match, board/result state, and touch-size cells.
- [x] Move Number Guess with input keypad support, guess limit, higher/lower hints, and result states.
- [x] Move Rock Paper Scissors with best-of-three scoring, clear rules, and thumb-sized choices.
- [x] Move Quick Math with operation selection, ten-question set, feedback, and no-timer play.
- [x] Move Word Scramble with category/hint text, input keyboard support, and solved/try-again result.
- [x] Keep progress writes behind `saveProgress`; defer catalog wiring until Task 7.

**Check:** Once connected in Task 7, these games start from the shared host, can pause/restart/quit, and report results without closing themselves.

### Task 5: Migrate timed and reaction games

**Files:**
- Create: `src/games/reaction-time/index.js`
- Create: `src/games/color-clicker/index.js`
- Create: `src/games/whack-a-mole/index.js`
- Create game-specific `style.css` only where needed.
**Interfaces:** Use the shared `mountGame(...)` and controller contract from Task 3. Registry wiring is deferred until all game modules exist in Task 7.

- [x] Move Reaction Time with randomized wait, early-tap feedback, millisecond result, and personal best storage.
- [x] Move Color Clicker with relaxed and timed modes, visible countdown, readable labels and shape cues, and score summary.
- [x] Move Whack-a-Mole with timed and relaxed modes; only accept hits while a target is visible.
- [x] Ensure timers suspend on pause and are cleared on result, restart, and quit.
- [x] Keep progress writes behind `saveProgress`; defer catalog wiring until Task 7.

**Check:** Once connected in Task 7, each timer stops while paused, resumes with correct remaining time, and leaves no pending callback after quit.

### Task 6: Migrate board, canvas, and pointer games

**Files:**
- Create: `src/games/snake/index.js`
- Create: `src/games/2048/index.js`
- Create: `src/games/pong/index.js`
- Create: `src/games/connect-four/index.js`
- Create game-specific `style.css` only where needed.
**Interfaces:** Use the shared `mountGame(...)` and controller contract from Task 3. Registry wiring is deferred until all game modules exist in Task 7.

- [x] Move Snake with logical canvas coordinates, device-pixel-ratio scaling, empty-cell food placement, keyboard, on-screen direction pad, and swipe input.
- [x] Move 2048 with one-move undo, touch-surface-scoped swipe handling, visible directional buttons, and game-over detection.
- [x] Move Pong with easy default, keyboard and drag-paddle controls, canvas scaling, and result handling.
- [x] Move Connect Four with local/computer mode, accessible columns, turn feedback, win/draw detection, and result handling.
- [x] Stop animation frames and pointer/keyboard listeners in pause/destroy paths; defer catalog wiring until Task 7.

**Check:** Once connected in Task 7, all four games run inside the shared host and can pause/resume/restart/quit cleanly; touch gestures remain scoped to the board/canvas.

### Task 7: Remove inline implementation and complete the static build handoff

**Files:**
- Create: `src/catalog/games.js`
- Create: `src/main.js`
- Modify: `index.html`
- Create: `README.md`
- Verify: `dist/` output and source tree

**Interfaces:**
- `pnpm dev` starts local development.
- `pnpm build` creates static `dist/` files.
- `pnpm preview` serves the production build locally.

- [x] Add the 14 game records to `games.js`, each with a dynamic import to its game module.
- [x] Wire `main.js` to import global CSS, progress store, registry, and app shell.
- [x] Replace the current inline app with the document shell, `#app` mount point, and module entry; preserve `viewport-fit=cover`.
- [x] Confirm all catalog entries use module loaders and no game implementation remains in `index.html`.
- [x] Document pnpm install, dev, build, preview, and static hosting steps in `README.md`, including that direct `file://` opening is no longer the development workflow.
- [x] Run the production build once pnpm has a working Vite runtime and inspect output paths for `base: './'` compatibility.
- [x] Record any iPad Safari items that require a physical-device quality pass; do not claim those are verified without that device check.

**Check:** A clean install followed by `pnpm build` succeeds; the generated `dist/` can be previewed and all 14 game IDs resolve to their modules.


### Verification note

The production build and browser smoke check pass. Dynamic imports produce individual chunks for all 14 games. Physical iPad Safari checks in portrait and landscape remain pending and should be completed before treating the iPad quality pass as verified.
