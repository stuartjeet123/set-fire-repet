# AGENT.md — Precision Singing Pitch Matcher

> Build a production-ready browser app that plays bundled MP3 songs and scores a singer's live pitch and octave against timestamped reference notes. Follow this file; avoid unnecessary dependencies, abstractions, and documentation.

## 1. Non-negotiable requirements

- Target: modern Chromium desktop; responsive UI.
- Use bundled MP3 assets. Each song must have matching reference-pitch data.
- Show live note, octave, frequency (Hz), cents deviation, confidence, match status, and a real-time graph of target vs singer.
- Measure pitch and octave separately; never silently treat an octave error as a correct note.
- Prioritise accuracy, stable timing, low latency, and graceful failure over flashy features.
- Compact UI; rectangular controls with modest corner radius; no pill-shaped controls.
- No authentication flow. Use the configured user ID `Oc14WmlclHeaOeD_02` only where persistence requires it; keep it in one config constant, never scatter it through code. Do not treat this ID as a secret.
- Automatically persist a completed/stopped session and its summary. Prevent duplicate saves.
- Reuse mature libraries where they genuinely fit. Do not write custom DSP, graphing, routing, or state infrastructure unnecessarily.

## 2. Preferred stack

- App: React + TypeScript + Vite.
- State: Zustand; keep high-frequency audio samples out of React state.
- Audio playback/capture: native Web Audio API.
- DSP isolation: AudioWorklet for frame capture/pre-processing; dedicated Worker for expensive pitch/VAD inference if the chosen library cannot safely run inside an AudioWorklet.
- Pitch: evaluate `pitchy` (McLeod Pitch Method) and `pitchfinder` (YIN) against the test corpus; select the most accurate stable monophonic estimator. Do not claim either is pYIN unless the installed package actually implements pYIN. A pYIN implementation is optional, not a requirement.
- Voice activity: `@ricky0123/vad-web` (Silero VAD / ONNX Runtime Web), subject to browser compatibility and benchmark.
- Graph: `uPlot` for efficient time-series rendering.
- Validation/tests: Vitest + Testing Library; Playwright for browser end-to-end tests.
- Runtime validation: pin dependency versions; inspect package APIs and compatibility before implementation. Do not invent library methods.

## 3. Architecture

Use feature-based, layered architecture with strict boundaries:

```text
src/
  app/                 # bootstrap, routes, providers
  features/
    player/            # song selection, playback controls, transport
    microphone/        # permission, device selection, capture lifecycle
    pitch/             # estimator adapter, confidence, note conversion
    reference/          # reference schema, loader, validator
    matching/           # time alignment, cents/octave scoring
    graph/              # uPlot adapter and rendering
    sessions/           # session lifecycle, summaries, persistence
    settings/           # calibration and user preferences
  audio/
    AudioEngine.ts      # AudioContext, source, clock, graph routing
    worklets/           # capture/frame processing only
    workers/            # pitch/VAD inference when required
    messages.ts         # typed worker/worklet messages
  shared/
    config.ts
    types/
    utils/
  assets/
    songs/
    references/
tests/
```

Rules:
- UI depends on feature services, never directly on DSP internals.
- Keep audio engine, pitch estimator, reference provider, matcher, graph adapter, and persistence behind typed interfaces.
- One owner for AudioContext and microphone stream; deterministic start/stop/dispose.
- Use typed messages and bounded buffers between threads.
- Do not use `SharedArrayBuffer` by default. Use transferable `ArrayBuffer` or bounded message batches. Adopt SharedArrayBuffer only after profiling proves it necessary and deployment correctly enables COOP/COEP.
- No network dependency for core playback or pitch matching. Session persistence may use IndexedDB/local storage unless a backend is explicitly configured.
- No `Date.now()` for audio alignment. Use `AudioContext.currentTime` / audio timestamps as the authoritative clock.

## 4. Reference pitch data — required

An MP3 contains no reliable note-by-note singing target. Every supported song needs a separate, verified reference asset (JSON preferred; MIDI may be an import source).

Use a versioned schema similar to:

```json
{
  "schemaVersion": 1,
  "songId": "song-id",
  "audioFile": "song.mp3",
  "audioOffsetSeconds": 0,
  "tempoBpm": 120,
  "notes": [
    {
      "start": 1.25,
      "end": 1.72,
      "midi": 60,
      "frequencyHz": 261.6256,
      "label": "C4",
      "confidence": 1
    }
  ]
}
```

- Store note events as seconds relative to the song timeline; allow gaps, rests, overlaps/polyphony flags, and sustained notes.
- MIDI note is canonical; derive Hz and note label from MIDI using equal temperament (A4=440 Hz), unless a song explicitly defines another tuning.
- Validate schema, monotonic timing, positive durations, legal MIDI range, finite values, and audio/reference alignment on load.
- Include tooling/workflow to create, import, edit, preview, and validate reference data. MIDI/MusicXML import is useful; manual correction is mandatory.
- Optional assisted extraction from MP3 may propose notes, but must never be treated as ground truth without human verification. Vocal melody extraction from a mixed song is not reliably solved by generic pitch detection.
- Add a reference-data test fixture with known notes and timing.

## 5. Audio and pitch pipeline

1. Load/decode MP3 with `decodeAudioData`; preload metadata and handle decode errors.
2. Request microphone permission only after user action. Allow device selection and clear permission/error states.
3. Capture mono where possible. Request 48 kHz when supported, but inspect actual sample rate; never assume the browser granted it.
4. Prefer disabling browser processing that can distort pitch (`echoCancellation`, `noiseSuppression`, `autoGainControl`) where supported; expose a fallback if device/browser constraints reject these settings.
5. Use AudioWorklet to timestamp and frame mic audio without blocking UI. Use appropriate windowing and adaptive frame sizes.
6. Estimate fundamental frequency (F0) using the selected tested estimator. Return Hz, confidence/clarity, voiced status, and audio timestamp.
7. Reject low-confidence, unvoiced, noisy, clipped, or implausible frames. Smooth cautiously; preserve note transitions and vibrato.
8. Support realistic singing range and configurable range limits. Do not hard-code one vocal range.
9. Detect octave ambiguity using harmonic evidence and temporal continuity. Report uncertain/octave-ambiguous frames instead of inventing a note.
10. Handle silence, consonants, breath, vibrato, slides, and note transitions without producing misleading scores.

Precision rules:
- Do not assume FFT size 4096 is universally optimal. Choose analysis window/hop based on sample rate, low-note resolution, latency, and benchmarks. Longer windows improve low-frequency resolution but increase latency.
- Use Float32 audio and windowed analysis. Preserve timestamps through every processing stage.
- Convert frequency to MIDI: `midi = 69 + 12 * log2(hz / 440)`.
- Convert pitch difference to cents: `cents = 1200 * log2(liveHz / targetHz)`.
- Compare unrounded values; round only for display.
- Calibrate input latency and processing delay empirically. Never apply a guessed fixed `+150 ms` offset as a universal correction.
- Provide user calibration and configurable fine offset. Keep playback timeline and mic capture timeline distinct, then align using measured timestamps/offset.
- Prefer headphone use. VAD detects voice activity; it does NOT reliably remove the backing track from microphone audio. Do not claim VAD alone prevents speaker bleed.
- Recommend headphones and warn when speaker playback is likely contaminating the mic. Use optional echo/reference-bleed diagnostics; do not subtract the MP3 blindly because room acoustics and speaker/mic paths vary.
- Do not use browser echo cancellation as the sole bleed solution; it may alter pitch.

## 6. Matching and scoring

For each voiced live frame:
- Find the active target note at the aligned song time.
- If no target note is active, mark as `NO_TARGET` (do not score).
- Compute signed cents deviation and nearest semitone.
- Determine note match, octave match, and confidence independently.
- Default configurable thresholds: `PERFECT <= 20 cents`, `CLOSE <= 50 cents`, otherwise `MISS`. These are product defaults, not claims of perceptual truth.
- An octave mismatch is a distinct `OCTAVE_ERROR`, even if pitch class matches.
- Ignore invalid/low-confidence frames rather than counting them as misses.
- Aggregate accuracy using valid voiced frames or duration-weighted note events; expose the denominator and ignored-frame percentage.
- Track pitch stability, note coverage, octave accuracy, average absolute cents error, and per-note results.
- Avoid scoring silence, rests, unvoiced consonants, or reference gaps as wrong notes.
- Make thresholds and scoring method explicit and configurable.

## 7. Live graph and UI

- Graph target melody and singer pitch on the same musical scale; use time on X-axis and MIDI/note-octave on Y-axis. Display Hz optionally in tooltip/secondary readout.
- Show target line, live line, gaps/invalid samples, and octave errors distinctly.
- Follow playback with a configurable scrolling window; allow zoom/pan and review after playback.
- Use uPlot efficiently: batch updates, bounded ring buffer, no React render per audio frame.
- Live panel: note, octave, Hz, cents, confidence, match status, mic status, latency offset.
- Controls: song select, play/pause/stop, seek, mic start/stop, input device, calibration, graph range, replay.
- Provide clear states for permission denied, no mic, unsupported browser, no reference data, decode failure, clipping, low confidence, and audio-device loss.
- Keep accessible labels, keyboard operation, and readable status text.

## 8. Session lifecycle and persistence

- States: `IDLE -> READY -> COUNTDOWN (optional) -> RUNNING -> PAUSED -> COMPLETED | STOPPED | ERROR`.
- Store song ID, reference version, timestamps/audio time, calibration, score metrics, note-level results, and app version.
- Auto-save on completion or explicit stop; save once using an idempotent session ID.
- Do not save incomplete/failed sessions as completed. Mark them stopped/aborted as appropriate.
- Use IndexedDB for structured session history; isolate persistence behind `SessionRepository` so a backend can be added later.
- Handle quota errors and failed writes visibly; do not silently lose a session.
- Keep personal/session data minimal. The configured user ID is metadata only, not authentication.

## 9. Performance and reliability

- UI must remain responsive during playback and inference.
- No unbounded arrays, message queues, graph points, or retained microphone buffers.
- Reuse typed arrays and audio nodes; dispose streams, tracks, worklets, workers, listeners, and AudioContext resources.
- Handle tab backgrounding, suspended AudioContext, device changes, sample-rate changes, and browser interruptions.
- Avoid unnecessary resampling. If required by a model/library, use a tested high-quality resampler and preserve time mapping.
- Measure end-to-end latency, pitch error, CPU, memory, dropped frames, and graph update cost.
- Log structured diagnostic events without recording raw microphone audio by default.

## 10. Required tests and acceptance criteria

### Unit tests
- Hz <-> MIDI/note/octave conversion and cents math, including A4=440 and octave boundaries.
- Reference schema validation, timing boundaries, gaps, sustained notes, and invalid data.
- Matching thresholds, octave errors, rests, confidence rejection, and latency offsets.
- Session state transitions, idempotent auto-save, and persistence failures.
- Pitch estimator adapter: clean sine waves, harmonics, vibrato, slides, noise, silence, and octave ambiguity.

### Integration tests
- MP3 decode/playback/seek/pause and authoritative audio clock.
- Mic permission grant/deny, device selection, device loss, and cleanup.
- Worklet/worker message ordering, timestamps, overload, and recovery.
- VAD + pitch pipeline; ensure VAD is not mistaken for source separation.
- Reference alignment and graph target/live updates.
- Auto-save on complete/stop, no duplicate save, reload session history.

### Browser smoke tests (Playwright)
- App loads with no console errors.
- Song and matching reference load.
- Playback controls work and graph renders target line.
- Mic permission flow works with a fake/test audio device.
- Known generated tone is detected within the agreed tolerance.
- Correct pitch, semitone error, and octave error are distinguished.
- Stop/completion persists one session.
- Refresh restores saved history.
- No leaked microphone tracks, workers, or AudioContexts after stop/unmount.

### Accuracy benchmark
Create a repeatable corpus of generated and recorded monophonic singing samples across the supported frequency range, with ground-truth F0. Include low/high notes, male/female voice ranges without assuming identity, vibrato, breathiness, harmonics, background noise, and octave-confusable signals. Report:
- median and 95th-percentile absolute cents error;
- voiced-frame recall and false-voiced rate;
- octave-error rate;
- detection latency;
- CPU/memory and dropped-frame rate.

Set numeric release thresholds after measuring the selected estimator on this corpus; do not invent benchmark results. Compare candidate estimators before choosing one.

## 11. Delivery workflow

1. Inspect the existing repository and preserve working conventions.
2. Confirm package APIs, browser support, and AudioWorklet/Worker compatibility.
3. Implement typed contracts and reference schema first.
4. Build audio lifecycle and pitch pipeline; benchmark estimator choices.
5. Implement matching/scoring, then graph/UI, then persistence.
6. Add tests alongside each feature; run lint, typecheck, unit, integration, and Playwright smoke tests.
7. Test production build and serve it over HTTPS or localhost (mic access requires a secure context).
8. Fix all critical errors; document setup, reference-data creation, browser limitations, and test commands.
9. Do not mark complete until all acceptance tests pass. Report actual test results and known limitations.

## 12. Out of scope unless requested

- User accounts, social features, payments, song marketplace, cloud recording, automatic full-song transcription, and mobile-native apps.
- Never store or upload raw microphone recordings by default.
