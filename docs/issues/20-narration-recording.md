# Title

Narration recording per page (MediaRecorder) with permission UX

## Summary

Implement per-page voice narration: record/re-record/play/delete with a live level
meter, mic permission flow on explicit gesture, browser-codec handling, and blob
persistence — per DESIGN §8.5.

## Context

Recorded parent/child voice is v1's narration (no TTS — DESIGN §2.3). Codec output
differs per browser (docs/research/03); we store what the browser produces plus its
mime. Mic access is a §10.3 (B1) sensitive boundary.

## Scope

`src/audio/`: `recorder.ts` (typed wrapper), `levelMeter.ts` (AnalyserNode), Narration
panel component mounted in the composer (19's slot).

## Detailed Requirements

1. `recorder.ts`: `start() → RecordingSession` using
   `navigator.mediaDevices.getUserMedia({audio: true})` + `MediaRecorder` with
   preferred mime ladder: `audio/mp4` → `audio/webm;codecs=opus` → default; expose
   `{stop() → {blob, mimeType, durationMs}, cancel()}`; hard stop at 60 s
   (DESIGN §8.5) with a 5 s countdown warning; all tracks stopped on stop/cancel/unmount
   (B1 control — no lingering mic indicator).
2. Permission UX: first tap on record shows a localized pre-permission explainer card
   ("マイクを つかって おはなしを ろくおん するよ") with confirm → actual
   `getUserMedia` call (user gesture chain preserved); denial → non-blocking hint with
   platform-specific re-enable instructions (ja/en), panel stays usable (text-only
   pages are fine).
3. Panel states: empty (record button) → recording (pulsing indicator + live level
   meter + elapsed/limit + stop) → recorded (play/pause, duration, re-record with
   confirm, delete with confirm). Level meter via AudioContext AnalyserNode RMS, 12 fps
   update, no allocation per tick.
4. Persistence: on stop, blob → `blobsRepo.put`, `Page.narrationBlobId` +
   `narrationMime` updated via 18's autosave; re-record replaces (old blob deleted on
   save, not before); delete clears both fields + blob.
5. Playback in panel and in PageView preview uses an `<audio>` element with object-URL
   lifecycle helper (issue 05 §4); playback never autostarts in the composer.
6. Size guard: recordings capped ~60 s; if the produced blob exceeds 20 MiB
   (schema/import bound) — practically impossible for 60 s mono — recording is
   rejected with a retry hint (keeps parity with §7.3 caps).
7. Feature detection: no MediaRecorder → panel renders a localized "not supported on
   this browser" note (book works without narration).

## Acceptance Criteria

- Unit tests with mocked MediaRecorder/getUserMedia: mime ladder, 60 s auto-stop,
  track cleanup on every exit path (spy on `track.stop`), replace/delete blob
  lifecycle (fake-indexeddb).
- Component tests: full state machine of the panel incl. denial path.
- Manual matrix: record/playback verified on Safari (mp4/aac) and Chrome (webm/opus);
  mic OS indicator disappears immediately after stop — results table in PR.
- A page with narration plays it in PageView preview on demand.

## Validation

`pnpm test src/audio`; manual matrix table (Safari macOS/iOS, Chrome desktop/Android)
in PR per docs/research/03 codec notes.

## Dependencies

05, 18 (19's slot for final placement; can develop standalone behind the panel
interface).

## Non-goals

TTS (v2), audio editing/trimming (v2), transcoding (explicitly out — docs/research/03),
background music (v2).

## Design References

DESIGN.md §8.5, §10.3 (B1), §7.3 caps; docs/research/03; ADR-005.
