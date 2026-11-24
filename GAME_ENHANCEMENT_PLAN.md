# Playroom: game and iPad experience plan

## Goal

Turn Playroom from a collection of quick demos into a friendly arcade kids can return to. Each game should teach its controls quickly, provide a satisfying round, show clear progress, and work comfortably with touch in Safari on iPad.

## Product decisions

### Give games their own play screen

The current modal makes it too easy to dismiss a game by tapping outside it or hitting Done. Make the game catalog the home screen and open each game in a dedicated, full-viewport play screen. Keep a visible **Pause** control. Pause opens a deliberate menu with **Resume**, **Restart**, and **Quit to games**. Confirm before quitting an active round; don't confirm if the round has ended. A result screen belongs inside the game screen and should not dismiss the game by itself.

On desktop, the play screen can use a centered arcade layout. On iPad, it should use the available viewport, with controls placed where thumbs can reach them. Keep the browser's normal navigation available and don't require fullscreen mode.

### Make rounds feel complete

Every game should have:

1. A short instruction screen or one-line tutorial before the first round.
2. A clear goal, level or round, and score where they help.
3. A start state, active state, pause state, and end state.
4. A result screen with a specific outcome, score, and **Play again** / **Back to games** actions.
5. Difficulty that changes in understandable steps and can be replayed without losing saved progress.
6. Touch, keyboard, and mouse controls where appropriate, with visible controls on touch devices.

### Encourage return visits without pressure

Add optional local profiles or a simple local save for high scores, unlocked themes, and badge                            s. Offer a rotating daily challenge that can be skipped and replayed. Avoid loss-based streaks, timers that pressure kids to return, ads, chat, public leaderboards, or account creation. Progress should stay on the device unless a future version adds a clearly explained sync option.

## Plan for each game

| Game | Make a full game loop | Progression and personality | iPad controls |
|---|---|---|---|
| **Memory Match** | Add a start screen, move counter, elapsed time, and a clear board-complete result. Prevent matched cards from being tapped again. | Boards grow in small steps; themed card packs become unlockable. Give a gentle hint after a few misses, with no penalty. | Large cards in a 4-column portrait layout and a wider layout in landscape. Tap to flip; avoid hover-only cues. |
| **Tic-Tac-Toe** | Add a complete match flow: choose one or two players, play best-of-three, and show wins/draws in a result screen. Keep the board visible behind the result. | Offer easy, medium, and hard computer play with understandable labels. Add board and mark themes. | Large square touch targets, clear X/O contrast, and no reliance on keyboard. |
| **Number Guess** | Add an input keypad, guesses remaining, higher/lower feedback, and a win/try-again result. | Ranges increase gradually; optional hint reveals parity or a smaller range. Track best score by difficulty. | Use a numeric input with an on-screen keypad-friendly layout and a large submit button. |
| **Rock Paper Scissors** | Make a best-of-three match with round score, reveal animation, and match result. Add a short rules tip. | Introduce themed hand signs and optional challenge rules after the basic game. | Three big thumb-friendly buttons; don't require swipe gestures. |
| **Quick Math** | Turn questions into short sets with a progress bar, answer feedback, and a results summary. Let players pick addition, subtraction, multiplication, or mixed practice. | Difficulty adapts by operation and number range. Keep a no-timer mode and optional timed challenge. | Large answer field, number keypad, and tap-friendly answer choices for younger players. |
| **Reaction Time** | Use a clear ready phase, randomized wait, tap target, result in milliseconds, and retry. Handle early taps as a clear false start. | Personal best and a few fun labels for reaction ranges; don't compare children publicly. | Full-width tap surface; make sure the target remains large in both orientations. |
| **Word Scramble** | Add category and hint, one word per round, clear solved/try-again feedback, and a round summary. | Start with short common words, then gradually add length and categories. Hints can reveal a letter without ending the round. | Large text and input, with support for the iPad keyboard and an on-screen letter option. |
| **Color Clicker** | Make the 8-second timer a deliberate challenge mode, not the only mode. Add untimed practice, visible countdown, score, and end-of-round result. | Add color palettes and patterns. Provide shape/label cues so color recognition isn't the only way to play. | Large spaced buttons; avoid tiny choices and keep text labels readable. |
| **Snake** | Add a start/pause state, score, speed setting, clear collision result, and restart. Make food spawn only in empty cells. | Levels can add speed slowly; include an easy mode and personal-best score. | Add an on-screen directional pad and swipe controls; avoid requiring an external keyboard. Respect safe-area space around screen edges. |
| **Whack-a-Mole** | Give a countdown, score, hit/miss feedback, predictable round length, and result screen. Ensure taps only count while a mole is visible. | Add gentle speed steps and themed targets; include a relaxed mode without a timer. | Use large targets with enough spacing to avoid accidental neighboring taps. |
| **2048** | Add score, best score, undo for one move, restart confirmation, and a game-over result when no moves remain. | Introduce a goal tile per level and optional board themes. Keep the classic mode available. | Support swipes and visible directional buttons. Prevent page scrolling only on the board surface; preserve normal page zoom elsewhere. |
| **Simon Says** | Add a listen/watch phase, input phase, current sequence length, mistake feedback, and a result screen. | Increase sequence length gradually and unlock sound/light themes. Include a no-sound visual mode. | Make four pads fill a comfortable 2×2 touch grid. Use saturated colors plus symbols so color alone isn't required. |
| **Pong** | Keep the recent easy setting as the default. Add start/pause, score, match result, and selectable easy/normal difficulty. | Offer short matches and paddle/ball themes. Let kids replay a level without resetting all progress. | Provide large on-screen up/down controls or a drag paddle; keyboard should remain optional. |
| **Connect Four** | Add clear turn ownership, column previews, win-line highlighting, draw detection, and a match result. Offer local two-player and a computer opponent. | Add a best-of-three match and optional computer difficulty. | Large columns and discs; make the drop target easy to hit in portrait and landscape. |

## iPad Safari requirements

Treat iPad Safari as a primary target, not a mobile afterthought.

- Use responsive layouts for portrait and landscape, with no clipped boards or controls.
- Use `100dvh` with a safe fallback and account for `env(safe-area-inset-*)` around fixed controls.
- Keep touch targets comfortably large (aim for at least 44 CSS pixels) and space buttons to reduce mis-taps.
- Use Pointer Events or touch-friendly click handling consistently; avoid hover-only instructions.
- Scope `touch-action` and scroll prevention to the actual game surface. Preserve pinch zoom and Safari navigation outside active play.
- Support the iPad software keyboard for text and number games; don't cover inputs with fixed controls.
- Keep canvas games crisp on Retina displays by scaling the backing canvas for device pixel ratio while preserving logical game coordinates.
- Respect `prefers-reduced-motion`; make sound optional and remember the choice locally.
- Save best scores and unlocked cosmetics with local storage, with a visible reset option.
- Test on real iPad Safari in portrait and landscape, including a small iPad and a larger iPad. Check keyboard appearance, safe areas, page scrolling, orientation changes, and returning from the pause menu.

## Delivery phases

### Phase 1: Make the shell reliable

Replace game modals with a dedicated play screen, pause/quit flow, shared result screen, and consistent level/score header. Ensure timers and animation loops stop on pause, restart, and quit.

### Phase 2: Finish the core loops

Improve each game using the table above. Prioritize correct end conditions, restart behavior, instructions, and easy/relaxed options before adding decoration.

### Phase 3: Add return value

Add local best scores, a small badge collection, unlockable visual themes, and an optional daily challenge. Keep all progress private to the device and make the daily challenge optional.

### Phase 4: iPad polish and quality pass

Review each game on iPad Safari in both orientations. Fix touch sizing, safe-area spacing, keyboard overlaps, scrolling, animation timing, and accidental exits. Verify each game can start, pause, resume, end, replay, and quit cleanly.

## Definition of done

A game is ready when a child can understand how to start, play a full round, tell whether they won or lost, pause without losing progress, replay, and return to the catalog without accidental exits. It must work with touch in iPad Safari in portrait and landscape, and offer keyboard or mouse support on desktop where useful.
