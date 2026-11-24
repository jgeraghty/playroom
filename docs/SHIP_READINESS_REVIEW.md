# Playroom: review and ship plan

Reviewed November 20, 2026. This is an audit of the current implementation and an execution plan; no game code was changed during the review. Read alongside `GAME_ENHANCEMENT_PLAN.md`, which records the original product direction.

## Implementation progress — correctness pass

The review below describes the original baseline. The first implementation pass now fixes the audited startup failures, repeated math answers, computer-turn ownership, pending board-game callbacks, final-draw match scoring, reaction pause timing, memory hint races, Snake tail/full-board cases, late-loaded games while paused, failed-mount cleanup, and result-screen isolation. Hidden tabs pause automatically and require deliberate resume.

Validation: 28 deterministic Node/DOM regression checks pass, including lifecycle coverage for every registered game; formatting and production build pass. A browser startup sweep opened all 14 games with no console errors. Browser spot checks confirmed 2048 movement/undo, Pong rendering, and one accepted answer after a Quick Math double-click.

Tooling now uses npm and one `package-lock.json`; run `npm run check`. Development requires Node 24.15+ (24.x) or 26+ and npm 11+. Tests stub canvas rendering and do not substitute for real iPad Safari, touch/keyboard usability, full playthroughs, or deployment verification.

Next: shared setup/HUD/stage/results design and the Memory Match, Tic-Tac-Toe, and Snake reference experiences. No public deployment has been made.

## Implementation progress — shared UX and reference games

Implemented the shared setup and result patterns and applied them to Memory Match, Tic-Tac-Toe, and Snake. Each now has a defined play stage, contextual statistics, explicit mode choices, saved settings, same-settings replay, and a separate Change settings action. The other games retain their existing play layouts for the next catalog pass.

- Memory Match: Small/Medium/Large boards, distinct hidden/revealed/matched cards, gentle hints, size-specific move/time records, and a result breakdown. Existing unscoped records remain stored but are not presented as comparable size-specific records.
- Tic-Tac-Toe: stable board controls, clear turn and match scores, deliberate Next board transitions, visible winning lines, local-player results, and a minimax Hard opponent. Automated exploration verifies that Hard cannot lose to any legal human move sequence when playing O.
- Snake: explicit Slow/Normal/Fast speeds, speed-specific records, a ready/resume countdown, a two-turn input queue, captured swipe gestures, and a canvas sized once per round. Landscape uses a side-by-side board/control layout.

Validation: 33 automated checks pass, including settings-preserving replay, scoped records, complete match outcomes, memory completion, and Snake resume behavior. Browser checks covered complete Memory and local Tic-Tac-Toe rounds/results, Snake collision/replay/pause/resume, 390×844 phone layout, and 1024×600 landscape layout. No console errors appeared in that browser pass. This does not replace observed player testing or real iPad Safari/touch testing.

Next implementation group: Connect Four and 2048, applying the established board, setup, feedback, and results patterns. Public deployment remains outstanding.

## Implementation progress — Connect Four and 2048

Both games now use the shared setup, saved settings, stage, and result experience.

- Connect Four: seven column controls, keyboard/focus landing previews, distinct Red/Yellow symbols, full-column feedback, disc drop feedback, winning-line outlines, persistent score/turn display, deliberate Next board transitions, and complete match summaries. Smart prioritizes immediate wins and blocks, then central moves that avoid an immediate opponent win; it is not a full search opponent.
- 2048: Classic 2048 and Warm-up 256 goals, goal-specific best scores saved during play, distinct tile colors, merge/spawn feedback, stable controls and focus, captured swipe gestures, confirmed restart, and one undo. When the board is blocked, players can undo or explicitly finish; the result is recorded only on finishing. Reaching the chosen goal ends the round after a short final-board pause. Continuing beyond the goal is deferred.

Validation: 38 automated checks pass, including merge rules in every direction, no-op moves, undo restoration, preserved best scores, blocked-board recovery, all Connect Four win directions, Smart wins/blocks, full columns, input ownership, and local match completion. Formatting and production build pass. Browser checks covered a complete local Connect Four match on a 390×844 viewport and 2048 merge/undo and desktop/phone layouts with no console errors. Real-device swipe testing remains outstanding. 2048 currently uses merge/spawn feedback rather than interpolated tile-travel animation.

## Implementation progress — Number Guess, Quick Math, and Word Scramble

All three games now use saved settings, a dedicated play stage, and same-settings replay.

- Number Guess offers 1–20, 1–100, and 1–1000 with 5, 7, and 10 attempts respectively. Directional feedback narrows the visible range, and a guess history keeps earlier feedback on screen. Invalid guesses preserve the budget. Optional hints reveal parity and narrow the range. Best unaided attempts are tracked by range.
- Quick Math offers addition, subtraction, multiplication, mixed, and mixed challenge. Ten distinct questions provide a score and explanation after each answer. Players advance when ready and can review missed equations afterward. Best sets are tracked by mode.
- Word Scramble uses 40 words across four categories, with short and long five-word sets. Scrambles differ from the target and words do not repeat within a set. Players can tap tiles, type on a keyboard, undo, ask for a clue or first letter, or reveal and skip a word. The result includes a recap of revealed words.

Validation: 41 automated checks, formatting, and the production build pass. Browser checks completed all three rounds at 390×844, including Number Guess hints, a missed-answer math review, and Word Scramble tile input, keyboard input, skips, and replay. The long-word stage also rendered at a 1024×768 viewport. Real iPad Safari testing and public deployment remain outstanding.

## Implementation progress — matches, reflex rounds, and pattern play

- Rock Paper Scissors has first-to-two and first-to-three matches, large move reveals, a running score, and a recent-round history. Ties score no point. Each reveal waits for the player to advance.
- Reaction Time uses five measured trials with a stable input panel. It measures from the GO update to pointer-down or keyboard key-down. Early presses retry the current trial, and pausing before a measurement restarts that trial with a fresh delay. The summary shows the median, fastest trial, and personal best.
- Color Clicker ends untimed practice at ten matches. An incorrect choice keeps the target visible. Timed play adds a three-second countdown and a 15-second round with a separate best score.
- Whack-a-Mole keeps its nine hole controls mounted. Relaxed play ends after ten hits and each mole waits for the player. Timed play starts with a countdown and tracks hits, escaped moles, and empty taps separately.
- Simon Says starts playback automatically, offers Gentle and Steady paces, and distinguishes pads by shape, text, and color. A correct pattern automatically starts the next round after a short pause, and the first incorrect pad ends the game. Players can replay a pattern for practice. Only the unaided portion counts toward the pace-specific record. Paused playback restarts from the first cue on resume, while paused input keeps its place. Sound is optional.

Validation: 47 automated checks, formatting, and the production build pass. Browser playthroughs covered a full Rock Paper Scissors match, a five-trial Reaction Time set with keyboard and pointer input, Color Clicker and Whack-a-Mole practice, Simon replay and results, and a timed Whack-a-Mole result at 1024×768. No browser console errors appeared. Physical touch, audio output, and iPad Safari remain for device QA. Public deployment is still pending.

## Implementation progress — Pong and round exit

- Pong now offers saved Easy and Normal settings, fixed-step ball movement, paddle and wall collisions, and a speed cap. Players can hold keys or on-screen controls, or drag on the court. A countdown runs before serves and resumed rallies. The fifth point remains visible briefly before results.
- Quitting an active round and changing its settings use Playroom’s pause dialog. Keep playing resumes the round, and Escape returns to the pause controls. Returning from completed results goes straight to the catalog.

Validation: 53 automated checks, formatting, and the production build pass. Browser play covered a Pong match, captured drag, held keyboard movement, pause/resume, and same-settings replay. The court and controls fit at 390×844 and 844×390. A browser Simon Says round advanced on its own and ended on a wrong pad. Keep playing, Change settings, and Quit to games were verified in the browser. Real iPad touch testing is still pending.

## Implementation progress — catalog and GitHub Pages preparation

- The catalog now has game-specific previews, a search empty state with a reset action, About and Settings sections, and an in-page progress reset dialog. If storage is blocked, scores and settings are available for the current visit.
- Game links use `?game=<id>` so GitHub Pages can serve deep links from a repository subpath or a custom domain. Links open game setup, and the game header can copy the current link.
- The GitHub Pages workflow runs the project checks before deploying `dist/`. It uses the Pages URL for canonical and social sharing metadata. The README covers enabling the workflow, the DNS CNAME for a custom subdomain, HTTPS, and rollback.

Validation: 55 automated checks, formatting, and the production build pass. The local production build loaded all 14 games under a simulated GitHub Pages subpath without console errors. Browser checks covered direct-link refresh, Back and Forward, empty search recovery, copying a game link, and canceling the reset dialog. The GitHub Actions run, custom domain, live rollback, real iPad testing, and observed player testing are still pending.

## Recommendation

Keep the lightweight architecture and friendly brand. Raise the quality of the actual games before expanding the catalog or adding more rewards. The current project is a promising prototype, but it is not ready for public launch: two games fail to start, several games can accept invalid input sequences, and progression does not consistently represent meaningful difficulty.

Working product assumption, taken from the existing plan: a free, kid-friendly arcade for short breaks, with iPad Safari as a primary target, desktop support, local progress, and no accounts, ads, chat, or public leaderboards. Confirm the intended age/reading range before producing a larger word bank or math curriculum. These audience choices affect content and difficulty, but do not block the correctness work.

## What was reviewed

- Read all 14 game modules, catalog, application shell, host lifecycle, progress store, scheduler, shared UI helpers, styles, README, and prior enhancement plan.
- Ran the production build successfully. The main JS bundle is about 20.3 kB (7.1 kB gzip), with games loaded separately. There is no reason to introduce a framework or backend for the current scope.
- Ran the formatting check: it fails on `src/shell/game-host.js`.
- Opened every game through the live catalog and Start round flow. Twelve reach their gameplay or mode-selection screen; 2048 and Pong show a loading error. This is a startup smoke check, not complete playthrough coverage.
- Visually inspected the catalog and Quick Math play screen, checked Connect Four at a narrow viewport, and reproduced Quick Math's double-answer defect.
- No automated test script or test suite is present in the project. Actual iPad Safari, touch hardware, software-keyboard behavior, and complete end-to-end rounds remain unverified.

## Project and website review

### Keep

- Isolated game modules and lazy imports make individual games easy to improve.
- Shared start, pause, restart, quit, and results flows already exist. The play experience is full-viewport through CSS overrides; replacing a small modal is no longer outstanding work.
- The pausable scheduler and listener cleanup helper provide a useful foundation.
- The catalog supports keyboard activation, search, and category filtering. The shell includes focus trapping and inert background handling.
- Device-local scores, basic badges, rotating daily picks, and unlockable themes are already implemented.
- The warm palette, rounded cards, and concise brand copy establish a coherent visual direction.

### Improve before launch

1. **Make the game the main attraction.** The homepage is more resolved than gameplay. Quick Math has a tiny cluster of controls centered in a large empty viewport; many games use the same generic text/button treatment. Establish a bounded game stage, a compact status row, a readable goal, and controls sized for the task. Use distinct boards and feedback within a shared visual system.
2. **Combine setup and instructions.** Currently players open a game, press Start round, and sometimes encounter another mode/start choice. Show a short control explanation and difficulty/mode selection in one setup screen, followed by one deliberate Play action. Show selected mode clearly.
3. **Separate difficulty from achievement.** The host reopens at the highest saved level, while several games increment level without changing gameplay. Offer explicit, replayable difficulty. Track meaningful per-game records rather than imposing Level on every game.
4. **Make replay predictable.** Replay should retain the selected mode and difficulty. Offer Next challenge separately where progression exists. Current host restart remounts games and resets several mode selections to defaults.
5. **Improve results.** Show outcome, useful game-specific statistics, previous/personal best, and a clear next action. Preserve the final board long enough to understand the result. Practice and survival games need completion language that does not label every ordinary finish a loss.
6. **Give practice an ending.** Color Clicker and relaxed Whack-a-Mole lack a normal finish-and-summary action. Offer Finish practice or a finite untimed goal, and define whether and how practice records are saved.
7. **Improve catalog utility.** Use actual board illustrations/previews rather than only emoji, add player count and approximate session length, show recent games or personal bests, and provide a no-results state. Move reset/theme management into a small settings area. The About link currently leads only to the footer; provide a concise explanation of controls, local saves, and the project.
8. **Use honest daily-pick copy.** The current daily feature selects a game by date; it is not a seeded, comparable daily challenge. Call it Today's pick for v1. Seeded challenges can be added later if wanted.
9. **Support website navigation.** Add shareable game URLs and browser Back behavior, using a routing approach compatible with the chosen static host. Refresh should restore a useful game entry screen; do not imply active rounds survive reload unless implemented.
10. **Consolidate styling.** Game layouts mix inline CSS, generic selectors, and old modal rules overridden in `app.css`. Create game-scoped styles and shared stage/HUD/control components so fixes remain predictable.

## Release blockers and important correctness findings

Evidence labels distinguish browser reproduction from source review. P0 blocks normal use; P1 must be fixed before that game is published.

| Priority | Finding and evidence | Required fix / acceptance check |
|---|---|---|
| P0 | **2048 and Pong cannot start.** Browser-confirmed errors. Both pass an `AbortController` as the listener `signal` option rather than its `.signal`. See `src/games/2048/index.js:45` and `src/games/pong/index.js:57`. | Correct listener ownership and cleanup. Both games must start, accept pointer input, restart, quit, and reopen with no console errors or leftover handlers. |
| P1 | **Quick Math counts multiple answers to one question.** Browser-confirmed: double-clicking the correct answer on question 1 advances to question 3 with score 2. `src/games/quick-math/index.js:53` accepts every click during the 650 ms feedback interval. | Lock answers immediately; schedule exactly one transition. Use a defensive terminal condition. Ten questions must always mean ten accepted answers and score 0–10, including rapid taps. |
| P1 | **Players can act during the computer's turn in Tic-Tac-Toe and Connect Four.** Source-confirmed: `play()` / `drop()` guard board validity and end state, but not input ownership. Delayed computer callbacks use mutable current state. | Distinguish human/AI actions, lock the board while AI thinks, and invalidate pending moves on reset/mode change. Rapid taps must never place the computer's piece or create extra AI moves. |
| P1 | **Drawn final rounds can produce the wrong match result.** Source-confirmed in both board games: the round-three draw branch declares the match drawn regardless of accumulated wins. | Decide “three boards” versus “first to two wins”; use one match-resolution function. Test a 1–0 lead followed by draws, tied scores, and either player's win. |
| P1 | **Changing board-game mode leaves scheduled work behind.** Source-confirmed: setup button handlers reset state without clearing pending AI/new-round jobs. | Make mode changes an explicit new match and clear/invalidate outstanding callbacks. Verify changes during AI thinking and between rounds. |
| P1 | **Reaction Time includes paused time after the GO signal.** Source-confirmed: `performance.now() - startedAt` includes time spent paused; only the scheduler is paused. | Restart the trial after an interruption, or explicitly exclude pause duration. Define measurement consistently and test pause before and after GO. |
| P1 | **Memory hints can disagree with the actual open-card state.** Source-confirmed: hint timers hide unmatched cards without checking whether the player has since opened them. | Derive all card visuals from state; make hint, flip, and mismatch transitions cooperate. Repeated hints and flips during hints must never hide an open card incorrectly. |
| P1 | **Snake has collision and completion edge cases.** Source-confirmed: collision checks include the tail before it moves, and food placement loops until an empty cell is found without a full-board terminal state. | Allow entry into the departing tail when not growing; enumerate free food cells; finish successfully when the board fills. Test both rules deterministically. |
| P1 | **Shell interruption and loading state need strengthening.** Source review: no visibility auto-pause; a game loading while the pause menu is open can mount and run without inheriting pause. Failed mounts can leave partial resources without a returned controller to destroy. | Make loading, setup, playing, paused, result, and error explicit host states. A paused host must pause a late-mounted game. Add direct Retry / Back on errors and cleanup on partial mount failure. |
| P1 | **Result dialog does not make underlying game content inert.** Source-confirmed: inert handling considers the play and pause screens, but not the underlying content when results are open. Some handlers also lack ended guards. | Inert the stage/header under results and guard mutations at game level. Verify keyboard, pointer, and assistive-technology navigation cannot modify a finished round. |

## Game-by-game quality plan

The target is a complete, understandable, satisfying loop for every published game. Cosmetic extras are secondary to the following requirements.

| Game | Current assessment | Required v1 work | Ready when |
|---|---|---|---|
| **Memory Match** | One of the stronger foundations: board growth, moves/time, matching lock, and hints exist. Visual/state interaction needs polish. | Fix hint races; offer Small/Medium/Large boards; compare best moves/time only within the same board size; add clear face-down, revealed, matched, and hint states with restrained flip/match feedback. | All cards remain logically and visually consistent through rapid taps, hints, pause, and completion. Players can replay their chosen size. |
| **Tic-Tac-Toe** | Match flow, local two-player, and three AI labels exist, but turn and match rules are unreliable. Hard is a win/block/center heuristic, not a complete strong strategy. | Fix ownership, stale timers, match scoring, and local-player result labels. Show turn and running match score together. Update occupied-cell accessible names. Make Hard reliably strong using a full strategy or describe the mode accurately. | Both players' wins and draw sequences resolve correctly; no human action is accepted during AI turns; winning line and score are clear. |
| **Number Guess** | Functional loop with limits and a hint, but little visual help or lasting variety. | Add guess history and a shrinking valid-range display. Offer explicit ranges and fair attempt budgets. Current higher levels reach 1–1000 with only five guesses, making unaided guaranteed binary-search success impossible. Replace the centered ±5 hint, whose midpoint often reveals the secret, with purposeful incremental hints. Label the input and compare records by mode. | Players can explain higher/lower feedback, see their remaining range, and choose a reasonable challenge without being forced upward. |
| **Rock Paper Scissors** | Correct basic first-to-two loop; rounds resolve immediately and can be clicked through without a readable reveal. Levels add no gameplay. | Add choose → locked reveal → next-round phases, large competing hands, a rule diagram, round history, and clear tie treatment. Remove meaningless levels. Keep reveal short and respect reduced motion. | Each input produces one readable round; the match outcome is obvious without reading a dense sentence. |
| **Quick Math** | Short sets and operation choices are good; repeated answers corrupt progress and mode changes silently reset the set. | Fix answer locking; guarantee distinct choices (zero-answer questions can currently show duplicate zero choices); choose operation/difficulty before starting; show progress; provide brief explanations and a review of missed questions. Keep untimed default. | Exactly ten answers are accepted, distractors are distinct, the selected operation persists, and the summary identifies useful next practice. |
| **Reaction Time** | Simple, understandable target and personal best. Timing and interruption behavior need definition. | Fix pause timing; make input timing consistent across pointer and keyboard; offer a short multi-trial session with median and best; retain early-tap feedback. Use a stable target so keyboard focus survives wait → GO changes. Remove generic levels. | False starts are clear, pauses invalidate/restart fairly, and results report the same defined measurement on repeated trials. |
| **Word Scramble** | Only seven words, all five letters; level increases do not change the content. A shuffle can return the original word. | Build an age-appropriate categorized word bank; guarantee a changed scramble; avoid immediate repeats; add tap-to-place letters plus keyboard input, progressive hints, skip/reveal, and a short set summary. Reject empty attempts. | A session has meaningful variety, works without typing, and every word can be completed or skipped without getting stuck. |
| **Color Clicker** | Accessible color/shape/text cues are a good start. Practice still displays “8s,” wrong answers silently change the target, and practice has no result. | Show correct mode/timer; add explicit correct/incorrect feedback; provide finite untimed practice or Finish practice; give the timed mode a countdown; improve text contrast, especially yellow. | Mode is unambiguous, mistakes teach the target, and practice produces a useful end state. |
| **Snake** | Touch pad, swipes, and scoring exist. Speed is selected indirectly from saved level; it starts moving immediately. | Fix tail/full-board rules; add visible Slow/Normal/Fast choices and ready countdown; buffer direction changes predictably; add pointer capture/cancel handling; show best/score live; render the canvas without resizing its backing buffer every tick. | Input feels reliable, legal turns do not falsely collide, chosen speed persists, and board/control layout fits both orientations. |
| **Whack-a-Mole** | Timed and relaxed modes exist; hits count only on visible targets. Whole-screen rerenders make interaction/focus unstable. | Keep stable hole elements, animate pop/hit/miss states, choose mode before play, add countdown and an untimed finish, and calibrate difficulty. Distinguish misses from hits and preserve focus. | Each visible target counts once, no input focus disappears on a tick, and both modes finish with an understandable summary. |
| **2048** | Startup is broken. Once fixed, basic merging, swipes, score, undo, and terminal checks exist. Tiles all use the same occupied color and redraw instantly. | Fix mount; test merge rules and no-op moves; add distinct tile styling, slide/merge feedback, live best/score, confirmed restart, and pointer capture. Show the final winning board before the result; offer Continue after 2048 if included in scope. Define undo after a losing move. | Canonical merge cases work, no-op moves spawn nothing, undo restores board/score, and touch movement is readable and reliable. |
| **Simon Says** | Visual/audio modes and sequence growth exist. Every pad uses a differently colored circle, so symbols are not actually distinct non-color cues. The extra Start pattern step is redundant. | Use distinct shapes/numbers and visible labels; combine setup/start; show sequence length and current input progress; define replay as assisted practice; add warm feedback and meaningful best-sequence results. Keep audio optional and test interruption/repeated playback. | Watch/input phases are obvious with sound off, pads are distinguishable without color, and pause/replay never corrupts the sequence. |
| **Pong** | Startup is broken. Post-fix design has easy/normal, first-to-five, keyboard and drag. Physics and input need playtesting. | Fix mount; move difficulty selection to setup; add countdown between serves; support held buttons/keys and robust captured dragging; clamp both paddles; use time-based or fixed-step simulation with bounded speed and collision tests. Keep easy forgiving. | Rally speed remains consistent, paddle controls are smooth, missed balls score correctly, and the final point appears before the result. |
| **Connect Four** | Local/AI match structure exists; turn ownership and scoring share Tic-Tac-Toe defects. No winning-line highlight. Forty-two buttons represent seven possible drop actions. | Fix ownership/timers/scoring; provide seven accessible column controls, drop previews/animation, full-column feedback, winning-line highlight, and clear player identity beyond color. Improve computer strategy after rules are stable. | Every win direction and full-board draw works, columns are usable with touch/keyboard, and the player can see why the match ended. |

## Shared design and engineering work

### A consistent game contract

Keep `mountGame` and isolated modules, but make these rules explicit:

- No gameplay input while loading, paused, resolving a move, or finished.
- Setup choices survive replay. Restart and Next challenge have distinct meanings.
- Each action is accepted once; each round produces at most one result.
- Every timer/listener belongs to the mounted instance and is invalidated on quit, restart, mode change, and failed initialization.
- Tab hiding pauses active play. Returning shows a deliberate Resume action; real-time games receive a short readiness cue where appropriate.
- Timers measure active play consistently. Reaction trials restart after interruption rather than silently producing misleading times.
- The host can show contextual stats such as Round, Moves, Time, Score, or Sequence rather than a universal Level badge.
- Results include mode/difficulty and comparable statistics. Store records by stable game ID plus mode/difficulty; migrate existing local records conservatively.
- Use stable DOM for interactive boards and controls; update state instead of rebuilding all focused elements on every move/tick.

### Visual and interaction standard

- Shared setup panel, status row, game stage, control area, pause menu, and result card.
- Game-specific identity: card faces for Memory, contrasting board marks, distinct 2048 tiles, readable paddle/ball motion, and satisfying but brief feedback.
- Primary actions should be visually dominant; settings should not compete with active gameplay.
- Aim for at least 44 × 44 CSS pixel controls, with deliberate spacing and clear focus indicators. Check constrained boards separately rather than assuming a global minimum height solves touch sizing.
- Support text/shape cues, readable contrast, reduced motion, and optional sound. Announce turn/results selectively without announcing every timer tick.
- Keep normal browser zoom and scrolling outside the game surface. Test both tablet orientations and software keyboards, not just CSS breakpoints.

## Delivery sequence and exit gates

### 1. Correctness and test foundation

Fix the P0/P1 findings first. Add deterministic tests around pure rules, input ownership, delayed callbacks, active-time accounting, and result recording. Add a browser smoke test that opens every registered game and fails on a mount error. Resolve the formatting failure and standardize on one package manager/lockfile; align README requirements with the installed toolchain.

**Exit gate:** all 14 mount; rapid-input and interrupted-round regressions pass; no callbacks survive teardown; build and repository checks pass. This is stabilization, not the launch-quality gate.

### 2. Shared UX and three reference games

Implement the setup/HUD/stage/result standard and meaningful settings/records. Bring **Memory Match, Tic-Tac-Toe, and Snake** to the target bar first: they exercise puzzle, turn-based, and real-time interaction. Use them to validate layout and controls before applying patterns broadly.

**Exit gate:** representative players can independently start, understand the goal, pause/resume, finish, replay the same settings, and return to the catalog. Validate these three on real iPad Safari and desktop before spreading the design.

### 3. Finish the catalog in related groups

1. Transfer board-game improvements to Connect Four; finish 2048's movement and tile presentation.
2. Finish Number Guess, Quick Math, and Word Scramble content, hints, and accessible input.
3. Finish Rock Paper Scissors, Reaction Time, Color Clicker, Whack-a-Mole, and Simon Says feedback and session structure.
4. Finish Pong after its physics and control feel pass playtesting.

**Exit gate:** every game meets its row above and the common lifecycle checks. Keep unreleased games out of the public catalog if they do not meet the bar; a smaller initial release is an option, not an assumption that unfinished games are acceptable. Full-catalog launch remains the default scope of this plan.

### 4. Website and release preparation

Improve catalog previews, metadata, empty states, settings, About/help, and game URLs. Add favicon/share metadata and useful loading/error states. Verify local-save messaging and reset behavior, including storage-disabled behavior. Consider self-hosted fonts to reduce dependence on the external font request already in `tokens.css`.

Deploy a preview of the production `dist/` to the selected static host. Use the existing relative Vite base deliberately; verify assets and game links at the actual root or subpath. Set up an HTTPS production domain, repeatable build/deploy checks, cache behavior that does not strand old HTML against missing chunks, and a tested rollback to the previous build. No server or account system is needed for v1.

**Exit gate:** the deployed production build, not only the dev server, passes the full checklist below. Record known limitations and a clear bug-report channel. Public launch is a separate action after this gate.

## Release checklist

- [ ] For every game: setup, start, valid/invalid input, pause, resume, restart, end, replay, quit, reopen, and page reload behave as specified.
- [ ] Rapid taps, held keys, repeated hints, AI-turn input, mode changes during pending work, and tab switching cannot corrupt state.
- [ ] Win/loss/draw and practice outcomes are correct; final boards/scores match summaries; records remain comparable by mode.
- [ ] Keyboard-only navigation works; focus remains visible and returns sensibly; results/pause isolate background content; screen-reader labels reflect current state.
- [ ] Real iPad Safari portrait/landscape, desktop Safari/Chromium, and a narrow phone viewport pass layout/input checks; software keyboards do not obscure required controls.
- [ ] Reduced motion, sound off/on, browser zoom, and storage-disabled scenarios remain usable.
- [ ] No published game throws during startup or lifecycle transitions; tests and production build pass; formatting check passes.
- [ ] A small observed usability session with intended players finds no need for coaching on starting, goals, input, results, and replay. Use findings to tune readability, round lengths, and difficulty.
- [ ] Production deep links, refresh, browser Back, asset loading, local saves, and deployment rollback are verified on the real domain.

## Defer until after v1

More games, accounts/cloud sync, multiplayer over the network, public leaderboards, complex unlock economies, many cosmetic packs, installation/offline support, and seeded daily challenges. The project already has enough breadth. Its next investment should make existing games feel finished and trustworthy.

## Follow-up roadmap for discovery, progress, and three new games

**Implementation status, November 21, 2026.** The local release candidate includes all 17 games. The discovery filters, setup exit, round-based themes, Simon Says record feedback, and three expansions are implemented. Production Chrome checks exercised deep links, start, pause, and quit for all 17 games. At 320, 1024, and 1280 CSS pixels the three expansions opened without horizontal stage overflow. The initial expansions shipped to local preview for playtesting. The gameplay redesign below records the subsequent player feedback and current mechanics.

The release still needs observed first-time-player and physical iPad Safari sessions, plus publication and live verification on the owner's GitHub Pages subdomain. The milestones below record the original delivery sequence.

Planned November 21, 2026. Launch the current 14 games after the discovery, navigation, and release checks below. Deliver progress polish and each new game independently afterward. The earlier deferral of new games applies to the initial launch.

### 1. Help players choose and leave a game

- Add **Two players** and **No timer** alongside the existing catalog controls. Describe capabilities in catalog metadata so filtering, text search, and card descriptions agree. Two players means two people can play together on one device. No timer means at least one mode lets the player decide when to act. A stopwatch that only records elapsed time qualifies. A slow opponent or an automatically moving board does not.
- Audit all 14 entries. Include Tic-Tac-Toe and Connect Four in Two players. Identify the relevant mode on mixed-mode cards, for example “Relaxed waits for your tap. Timed gives you 15 seconds.” Match common searches such as “two players” and “untimed.” Combine selected capabilities with each other, the category, and the search term. Keep the result count and one-action reset.
- Show **Back to games** on setup and **Pause** during a round. Reuse the host and URL close path. Exiting setup should take one action, preserve the catalog search and filters, restore focus to the launching card when available, and record zero rounds. Keep the existing in-page confirmation during active play.
- Verify the filter combinations, zero results, a direct game URL, browser Back/Forward, setup exit, and active-round quit/cancel. Check keyboard focus and phone-width layout after adding the controls.

### 2. Observe the launch experience and verify hosting

On a physical iPad in Safari, ask a first-time player to “find something two of you can play,” “pick a different game before starting,” and “finish a round and play it again.” Give the goals without naming the controls. Record the first choice, where the player hesitates, and whether coaching was needed. Repeat in the other orientation and check the same routes with a desktop keyboard. Fix and rerun any task that required coaching or lost the player's place.

Run the existing release checklist and npm run check. At publication, use the GitHub Pages workflow and custom-subdomain instructions in the README. Verify HTTPS, a direct game link, reload, asset loading, browser Back, saved progress on the final domain, and rollback. Record live-domain and physical-device results separately from automated checks.

### 3. Reward finished rounds and recognize personal bests

Use the existing played counter for cosmetic eligibility. Keep Berry at three finished rounds and Ocean at eight. Drive both the settings UI and theme selection from the same eligibility rule. Show the next unlock in rounds. Keep the win count and win-specific badge as separate accomplishments. Existing saves already carry played totals, so read them in place and preserve selected themes, badges, settings, and records.

For Simon Says, compare the round with the player's unaided best at round start for the selected pace. Display “New personal best” only when that record improves. Preserve automatic progression, the pause between patterns, and the first-mistake ending. Verify first score, tie, improvement, use of replay, and switching paces. Test unlocks across losses, draws, and wins, including a saved profile near each threshold. Quitting or restarting early earns zero rounds, and a finished round earns credit once.

### 4. Garden Paths — first expansion

**First playable.** Build one small board with a watering can, rotatable path tiles, and flowers. Tap or activate a focused tile to rotate it a quarter turn. Water reaches a flower only through connected openings on adjacent tiles. Show flowing water and a distinct watered-flower shape, with a static equivalent for reduced motion. The player wins when every flower is watered.

**Release scope.** Author six named boards in a fixed progression. Teach a single bend first, introduce a branch, then require players to supply multiple flowers at once. Offer reset and replay per board. Save completed boards and fewest rotations per board. Completing a board counts as one finished round.

**Ready when** every starting layout is unsolved and has a verified solution, disconnected loops stay dry, and the final rotation awards one result. On iPad and keyboard, a new player should solve the introductory board and explain why a branch on a later board stays dry.

### 5. Mini Golf — second expansion

**First playable.** Prototype one straight hole and one bank shot. Let players choose direction and power, preview the aim, then press **Putt**. Provide touch buttons and keyboard controls so precise dragging is optional. Tune wall rebounds, friction, and cup capture on a phone before authoring the course.

**Release scope.** Build a three-hole course with a straight putt, a corner, and a bank shot. Support solo and two-player pass-and-play. Let each player finish the current hole before handing over. Show whose turn it is, strokes for the hole, and course totals. Use a proposed six-stroke limit per hole to keep the handoff moving. Lowest total wins, with ties allowed. Save the lowest solo course total separately from two-player match results.

**Ready when** each hole is reachable, aiming survives rotation, and tapping Putt twice counts one shot. Test wall corners, a slow ball at the cup, stroke-limit scoring, ties, and pause or tab switching during motion. Two people should finish the course and know when to pass the device without coaching. If the bank shot feels unpredictable, tune the prototype before expanding the course.

### 6. Pattern Detective — third expansion

**First playable.** Show a short sequence with one missing tile and three answer choices. Start with alternating shapes. After an answer, reveal the rule in plain language and highlight the repeating or changing feature. Let the player advance when ready to read the next pattern.

**Release scope.** Author 15 puzzles across repetition, rotation, and quantity. Assemble untimed five-puzzle rounds with no repeats within a round. A wrong answer gets a clue and another try. Score first-try solves out of five and include a short result review. Use labels, orientation markers, and countable shapes so every puzzle works without color.

**Ready when** another reviewer can independently identify the intended rule and explain why each distractor fails. Replace ambiguous items. Verify keyboard choices, repeated taps, clue scoring, and a full five-puzzle replay. Observe a player explaining one rule in their own words.

### Integration and release of each expansion

Use the existing game host, catalog preview, setup, results, local progress, and lazy module loading. Add the appropriate discovery tags. Test rules independently and exercise setup, start, pause/resume, quit, replay, storage fallback, and deep links through the host. Compare personal records only within the same board or course where layout affects difficulty. Run npm run check and play a production build with touch and keyboard before publishing each game. The catalog grows to 15, 16, then 17 as each game passes its own checks.

## Gameplay redesign after player feedback

The new release criteria below supersede the authored garden expedition, adjustable golf controls, and five-case Pattern Detective session described above.

| Game | What the player does | What must hold |
| --- | --- | --- |
| Garden Paths | Start directly on a fresh branching bed. Water every flower, keep weeds dry when they appear, inspect the brief clear feedback, then play the next generated bed automatically. | Generate a connected solution first, scramble it, and check it using the water rules. A bed needs at least three clockwise turns across two distinct tiles. Increase complexity within phone-size bounds. Bound generation work and validate the fallback. Preserve the best run when the player leaves. |
| Mini Golf | Press the ball, pull back opposite the intended direction, and release. Distance controls strength. A short guide shows the launch direction. On a focused green, turn with the keyboard and hold and release Space to putt. | Reuse one launch and collision model for mouse, touch, and keyboard. Use course coordinates, pointer capture, a dead zone, and a maximum pull. Cancel abandoned gestures without spending a stroke. Keep the five-hole scorecard and two-player handoffs. |
| Pattern Detective | Edit a draft and press Check to commit it. Solving reveals the rule briefly and advances automatically. The first incorrect submission ends the run and explains the failed puzzle. | Vary fill, repair, and extension tasks with seeded rules. Increase complexity while keeping the board readable. Validate a unique offered solution, including both location and replacement on repairs. Prevent recent repeats. Save best streak independently of legacy scores. |

Acceptance checks include 1,000 deterministic samples per generator, a 100-level Pattern Detective run, pause and resume during each automatic transition, fresh replay, and one credit per solve or shot. Golf checks cover equivalent pulls on different size greens, receiving a release outside the canvas, cancellation, second-finger input, rough, banks, and local handoffs. Run the production build on phone- and desktop-sized viewports. Physical-device and observed-player checks remain separate release gates.

**Local verification.** Both generators passed 1,000 reproducible sample checks. Pattern Detective also played 100 consecutive levels through the host. A production Chrome walkthrough solved three Garden Paths beds, watched each advance automatically, and ended a Pattern Detective run on the eighth level after seven correct submissions. Separate keyboard, mouse, and emulated-touch walkthroughs completed all five golf holes. The shared screens were checked at phone portrait, phone landscape, tablet, and desktop sizes. Physical-device playfeel and live-domain checks are still open.
