# Title

Book player (kid mode): fullscreen playback with narration sync and accident-proof exit

## Summary

Implement `/books/:id/play` per DESIGN §8.6: fullscreen page-by-page playback where the
character loops its motion, narration plays once, pages advance by tap or auto, with
wake lock and hold-to-exit.

## Context

This is the child-facing surface — the bedtime-story payoff of journey B. Simplicity
and accident-proofing rules (no dialogs, no links, hold-to-exit) come from DESIGN
§10.5's "curious child" abuse case.

## Scope

`src/book/player/`: playback orchestrator (state machine), player route/chrome,
transitions; reuses `PageView` (19) in `mode:'play'`.

## Detailed Requirements

1. Orchestrator state machine per page: `enter → (narration? play once) → awaitAdvance
   → exitTransition → next`. Advance modes (Page.advance): `tap` = tap anywhere
   (≥64 px implicit target = whole screen); `auto` = advance at narration end + 1 s, or
   6 s after enter when the page has no narration (DESIGN §8.6). Last page → gentle
   "おしまい" overlay with replay and exit buttons.
2. Page transition: 300 ms horizontal slide; motion starts when the page settles;
   narration starts 300 ms after settle (audio never overlaps transitions).
3. Chrome: none during playback except a translucent corner exit button requiring a
   **1 s press-and-hold** (progress ring, haptic via `navigator.vibrate` where
   available); accidental taps advance pages at most (never exit/navigate). Swipe
   left/right = next/previous page (threshold 25% width) — also child-safe.
4. Fullscreen + Screen Wake Lock on enter (feature-detected, released on exit/blur;
   re-acquired on visibilitychange per API rules — docs/research/03).
5. Narration playback via the object-URL helper; interrupted audio (page change) stops
   immediately; `auto` advance falls back to the 6 s rule if audio fails to decode
   (cross-browser codec case — docs/research/03).
6. Reduced-motion (DESIGN §8.6/§6.4): transitions become 150 ms fades; effects follow
   17's gate.
7. Player never mutates data (read-only route); browser back exits cleanly (history
   guard so back = exit, not previous page — deliberate: physical back is a parent
   action).
8. Resilience: missing character/clip/background on a page → render what exists +
   skip silently (log via console.warn only); zero-page book routes back to editor.

## Acceptance Criteria

- Component tests of the orchestrator: tap/auto timing (fake timers) incl.
  narration-end +1 s, silent 6 s, last-page overlay, swipe prev/next, hold-to-exit
  (short press does nothing).
- Audio stop-on-page-change asserted with a mocked audio element.
- Playwright: play the 3-page sample book (25) end-to-end with `auto` pages on
  chromium; reduced-motion variant renders fades.
- Manual: wake lock keeps screen on ≥2 min on Android + iOS (matrix note in PR);
  a toddler-mash test (random rapid taps for 15 s) never leaves the player.

## Validation

`pnpm test src/book/player`; manual device pass recorded in PR.

## Dependencies

17, 19, 20.

## Non-goals

Editing from the player, page thumbnails/progress UI beyond dots (DESIGN §8.4),
autoplay-on-open of narration outside the player (§8.7 rule), video export (v2).

## Design References

DESIGN.md §8.4, §8.6, §8.7, §10.5, §6.4; docs/research/03 (wake lock, codecs).
