# Playroom

Playroom is a framework-free browser arcade built with native JavaScript modules and Vite. Each game is isolated under `src/games/` and registered in `src/catalog/games.js`; the shared catalog, progress store, and play lifecycle live under `src/shell/`.

## Requirements

- Node.js 24.15+ (24.x) or 26+
- npm 11+

## Development

Install dependencies, then start the local server:

```sh
npm ci
npm run dev
```

Vite prints the local URL to open in a browser. Opening `index.html` directly with `file://` is not supported because the app uses JavaScript modules and dynamic imports.

## Production build

```sh
npm run build
npm run preview
```

The production site is written to `dist/`. Deploy the contents of that folder to any static host, including GitHub Pages, Netlify, or Cloudflare Pages. Vite is configured with a relative base path so the build can be served from a domain root or a project subpath.

### GitHub Pages and a custom subdomain

1. Push the project to a public GitHub repository to use GitHub Pages on GitHub Free. Set **Settings → Pages → Source** to **GitHub Actions**.
2. Run **Actions → GitHub Pages → Run workflow** on the default branch. The included workflow runs `npm ci` and `npm run check`, then publishes only `dist/`. Later pushes to the default branch deploy automatically after the checks pass.
3. Verify your domain in your GitHub account or organization, then set the desired subdomain under **Settings → Pages → Custom domain**. At your DNS provider, add a `CNAME` for that subdomain pointing to `OWNER.github.io` (replace `OWNER` with the GitHub user or organization that owns the repository). Once GitHub verifies DNS and provisions the certificate, enable **Enforce HTTPS**.
4. Run the workflow again after configuring the domain so canonical and social preview URLs use the subdomain. Check the catalog, a direct game link such as `?game=simon-says`, reload, and browser Back on the live host. Scores and settings belong to the current browser and site origin. Progress saved on the default GitHub Pages address will stay there when you switch to a custom domain.

If a release needs rollback, revert the offending change on the default branch and check the new Pages deployment in **Actions**. GitHub manages cache headers for this hosting setup.

[GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) · [Custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

## Adding or removing a game

1. Create a folder under `src/games/<game-id>/` with an `index.js` that exports `mountGame({ root, level, progress, finish, saveProgress, updateStatus })`.
2. Return `pause()`, `resume()`, `restart()`, and `destroy()` methods. Clear timers, animation frames, and event listeners in `destroy()`.
3. Add or remove a record in `src/catalog/games.js`. Each record provides catalog metadata and a lazy `load()` import.

Game progress is stored locally in the browser under `playroom-progress-v1`.

## Quality checks

Run `npm run check` before shipping. This runs deterministic DOM and rules regression tests, formatting checks, and the production build. Tests cover all game lifecycles plus rapid input, computer turns, match results, pause timing, hints, tile movement, and failed game initialization. Canvas drawing is stubbed in the DOM tests; real browser and iPad Safari playtesting are still required.

Use npm and the committed `package-lock.json` for reproducible installs.

Game UI resources should use `createGameUI` and its scheduler. Register document listeners and other external resources with `ui.onDispose(cleanup)` so a failed mount can be cleaned up before a controller is returned.

## Game setup and results

Catalog entries may define a `setup` field with a key, label, tip, and choices. The host validates and remembers the choice, passes it as `options` to `mountGame`, and preserves it on replay. Memory Match, Tic-Tac-Toe, Snake, Connect Four, and 2048 use this flow. A result may include `stats` as `[label, value]` pairs for the shared summary. Records that depend on mode use scoped keys, such as `bestMoves_large` or `bestScore_slow`.
