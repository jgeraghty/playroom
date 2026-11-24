# Playroom Modular Structure Design

## Intent

Playroom is a small, static arcade for children. The current implementation puts the catalog, shared play flow, styles, saved progress, and all 14 games into `index.html`. The goal is to make games easy to add, remove, and maintain while preserving the existing experience and keeping future static deployment straightforward.

## Goals

- Keep the app framework-free and use browser-native JavaScript modules.
- Give every game its own folder and a small, explicit lifecycle interface.
- Keep the catalog data-driven so a game can be added or removed in one registry entry plus its game folder.
- Separate the shared catalog/play shell, progress storage, and global styles from game rules and game-specific presentation.
- Preserve the 14 current games, existing kid-friendly content, local-only progress, touch-first iPad support, and current shared flows.
- Support local development and produce a static `dist/` build suitable for common static hosts.

## Non-goals

- Rewriting game rules or expanding the game enhancement plan as part of this structural migration.
- Adding React, another UI framework, a server-side backend, accounts, cloud sync, analytics, ads, or social features.
- Redesigning the visual identity or introducing a general-purpose plugin system.
- Selecting a specific deployment provider before one is needed.

## Constraints

- The current project contains `index.html` and `GAME_ENHANCEMENT_PLAN.md`; it has no package manifest or source tree.
- The current page is opened directly from disk. After migration, development will use Vite's local server because this architecture uses ES module imports.
- Vite will build a static site. Persisted progress remains in browser `localStorage`.
- iPad Safari remains a primary target. Safe areas, reduced motion, touch sizing, software keyboard behavior, and canvas device-pixel-ratio handling remain requirements from `GAME_ENHANCEMENT_PLAN.md`.
- The eventual hosting provider is undecided. Use a relative Vite base path (`./`) for a portable static build; adjust it if the chosen provider requires a different path.
- The current command environment has `pnpm` available but no standalone `node` or `npm` executable on `PATH`. Use pnpm for dependency management and confirm it can install and run Vite scripts; if its runtime cannot run Vite, resolve the Node.js prerequisite during implementation.

## Approaches

1. **Vanilla ES modules with Vite — selected.** Add Vite as a development/build dependency, use plain JavaScript modules, and deploy the generated `dist/` folder to static hosting. This keeps runtime architecture simple and gives the project a reliable build workflow. Vite documents `dist` as its default static build output and `./` as a supported relative base path. [Build guide](https://vite.dev/guide/build), [base option](https://vite.dev/config/shared-options).
2. **Vanilla ES modules with a separate static server.** This avoids build tooling and can serve module files during development. It leaves deployment and asset-path handling to a separate process and gives less room for a repeatable production build, so it is not the chosen direction.
3. **A framework-based app.** React or a similar framework would add component conventions and dependencies. The current interface can be separated into modules without a framework, so this would add migration cost without solving a current need.

## Architecture

`index.html` remains the Vite entry page and contains only document metadata, the app mount point, and the `src/main.js` module entry. `main.js` starts the app and imports global styles. The catalog registry owns game metadata and dynamic import functions. The shared shell owns catalog rendering, the dedicated play screen, pause/quit flow, result screen, and actions for replay/back-to-games. The progress store owns the storage key, safe parsing, updates, theme/badge records, and reset behavior.

Each game module owns its own rules, DOM/canvas, inputs, timers, and animation loops. Game timers and listeners must be scoped to that game's controller and released on destroy. Repeated pause/resume timer handling lives in `src/shared/pausable-scheduler.js`; each game owns one scheduler instance. The shell owns transitions and calls the controller lifecycle methods; games report a result through the supplied completion callback and remain mounted behind the shared result screen. The host passes result data to `progressStore.recordResult` and binds game-specific saves to `progressStore.saveGame`.

### Game module contract

Each game exports `mountGame({ root, level, progress, finish, saveProgress, updateStatus })`. It returns a controller with required methods:

- `pause()` — suspend the round without discarding its current state.
- `resume()` — continue a paused round.
- `restart()` — reset the current round while preserving saved progress.
- `destroy()` — stop timers/animation, remove event listeners, and release game resources.

`updateStatus({ level, score })` updates the shared level/score header without exposing shell DOM to the game.

`finish(result)` receives `{ outcome, title, message, score? }`, where `outcome` is one of `win`, `loss`, `draw`, or `complete`. The shared shell keeps the board visible and presents the common result UI. `saveProgress(patch)` persists game-specific local records through the progress store.

The catalog registry uses stable kebab-case IDs and metadata shaped as `{ id, title, category, icon, description, load }`, where `load` dynamically imports the game's module. Game UI must not modify the global catalog or shared shell directly.

## Proposed file structure

```text
index.html
package.json
package-lock.json
vite.config.js
src/
  main.js
  catalog/
    games.js
  shared/
    pausable-scheduler.js
  shell/
    app.js
    game-host.js
    progress-store.js
  styles/
    tokens.css
    app.css
    catalog.css
    play-screen.css
  games/
    memory-match/
      index.js
      style.css
    tic-tac-toe/
      index.js
      style.css
    number-guess/index.js
    rock-paper-scissors/index.js
    quick-math/index.js
    reaction-time/index.js
    word-scramble/index.js
    color-clicker/index.js
    snake/index.js
    whack-a-mole/index.js
    2048/index.js
    simon-says/index.js
    pong/index.js
    connect-four/index.js
  assets/
    ...
```

Game-specific `style.css` files are added only when a game needs styles beyond the shared tokens and base game controls. The existing standalone CSS moves into the global style files. Binary images or sounds live under `src/assets/` when introduced. Generated `dist/` output is not edited by hand.

## Migration sequence

1. Add the Vite package scripts/config while leaving the current page intact.
2. Extract shared styles and local progress storage into focused files while the current page remains active.
3. Implement the shared game host and app shell with the documented lifecycle/result contract.
4. Move games into their modules in coherent groups, preserving behavior and keeping the current page active until the modules are ready.
5. Connect the registry and module entry, remove the inline CSS/JS from `index.html`, build with relative paths, and document `pnpm dev`, `pnpm build`, and `pnpm preview`.

## Open implementation calls

- Use pnpm and a checked-in `pnpm-lock.yaml`, since pnpm is available in the current workspace. This is an implementation call; no prior package manager exists.
- Use the existing game IDs when present; otherwise derive kebab-case IDs from the game names.
- Start with the 14 existing games and avoid introducing optional helpers or frameworks until at least two games need the same abstraction.
- Keep game styles colocated only where they are game-specific; shared controls and layout stay in global styles.
- Because the hosting provider is unknown, do not add provider-specific deployment workflows in this migration.

## Acceptance criteria

- The app runs through the Vite development server and the production build completes to `dist/`.
- The catalog is generated from a registry and all 14 games can be loaded from their own modules.
- Every game can start, pause, resume, restart, finish, replay, and quit through the shared shell without leaking timers or listeners.
- Game results keep the play screen and board visible until the player chooses an action.
- Local progress and theme/badge state survive reloads and can be reset on-device.
- Existing touch, keyboard, responsive, safe-area, and reduced-motion behavior remains intact; test the game surfaces in iPad Safari portrait and landscape before calling that quality pass complete.
