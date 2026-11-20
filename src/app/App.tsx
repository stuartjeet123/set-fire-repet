import { useEffect, useRef, useState, type CSSProperties } from "react";
import "../app/styles.css";
import { AudioEngine } from "../audio/AudioEngine";
import { getTargetNote, matchPitch } from "../features/matching/matching";
import { hzToMidi, midiToLabel } from "../features/pitch/pitch";
import { createAminorReference } from "../features/reference/midiReference";
import { validateReference, type ReferenceData } from "../features/reference/reference";
import { SessionRepository, type SavedSession } from "../features/sessions/persistence";
import { useSessionStore } from "../features/sessions/sessionStore";
import { CONFIG } from "../shared/config";

const METER_RANGE_CENTS = 50;

function createSessionId() {
  const browserCrypto = globalThis.crypto;
  if (typeof browserCrypto.randomUUID === "function") return browserCrypto.randomUUID();
  if (typeof browserCrypto.getRandomValues !== "function") {
    throw new Error("Secure random ID generation is unavailable in this browser.");
  }

  const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export default function App() {
  const audio = useRef<HTMLAudioElement>(null);
  const engine = useRef<AudioEngine | null>(null);
  const frameCount = useRef(0);
  const frame = useSessionStore((state) => state.frame);
  const micStatus = useSessionStore((state) => state.micStatus);
  const setFrame = useSessionStore((state) => state.setFrame);
  const setMicStatus = useSessionStore((state) => state.setMicStatus);
  const resetFrame = useSessionStore((state) => state.reset);
  const [reference, setReference] = useState<ReferenceData>();
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const startedAt = useRef(Date.now());
  const [sessionId] = useState(createSessionId);
  const savedOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const midiUrl = new URL("../assets/references/Adele — Set Fire to the Rain [MIDIfind.com].mid", import.meta.url);
    void fetch(midiUrl).then(async (response) => {
      if (!response.ok) throw new Error(`MIDI reference could not be loaded (${response.status})`);
      const parsed = createAminorReference(await response.arrayBuffer());
      validateReference(parsed);
      if (!cancelled) setReference(parsed);
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "MIDI reference unavailable");
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => engine.current?.dispose(), []);

  function updateTime() {
    if (audio.current) setCurrentTime(audio.current.currentTime);
  }

  async function startMicrophone() {
    engine.current ??= new AudioEngine();
    await engine.current.startMicrophone((hz, clarity, timestamp) => {
      if (!reference || !audio.current) return;
      const target = getTargetNote(reference.notes, audio.current.currentTime);
      const match = matchPitch(hz, clarity, target);
      const midi = hz === null ? null : hzToMidi(hz);
      if (hz !== null && target) frameCount.current += 1;
      setFrame({
        hz,
        midi,
        cents: match.cents,
        confidence: clarity,
        timestamp,
        targetMidi: match.targetMidi,
        status: match.status,
      });
    });
    setMicStatus("Active");
  }

  function stopMicrophone() {
    engine.current?.stopMicrophone();
    setMicStatus("Stopped");
    resetFrame();
  }

  async function togglePlayback() {
    const player = audio.current;
    if (!player) return;
    if (playing) {
      player.pause();
      stopMicrophone();
      return;
    }
    if (!duration || starting) {
      if (!duration) {
        setError("The accompaniment MP3 is still loading.");
      }
      return;
    }
    setStarting(true);
    try {
      setError("");
      engine.current ??= new AudioEngine();
      await startMicrophone();
      await engine.current.connectPlayback(player);
      await player.play();
    } catch (cause) {
      player.pause();
      stopMicrophone();
      setPlaying(false);
      setError(cause instanceof Error ? cause.message : "Playback failed");
    } finally {
      setStarting(false);
    }
  }

  function seekBy(seconds: number) {
    if (!audio.current || !duration) return;
    audio.current.currentTime = Math.max(0, Math.min(duration, audio.current.currentTime + seconds));
    updateTime();
  }

  async function saveCompletedSession() {
    if (savedOnce.current) return;
    savedOnce.current = true;
    const session: SavedSession = {
      id: sessionId,
      userId: CONFIG.userId,
      songId: "set-fire-to-the-rain-a-minor",
      referenceVersion: 1,
      appVersion: CONFIG.appVersion,
      state: "COMPLETED",
      startedAt: startedAt.current,
      endedAt: Date.now(),
      calibrationOffsetMs: 0,
      metrics: { validFrames: frameCount.current },
    };
    try {
      await new SessionRepository().save(session);
    } catch (cause) {
      savedOnce.current = false;
      setError(cause instanceof Error ? `Save failed: ${cause.message}` : "Save failed");
    }
  }

  const targetNote = reference ? getTargetNote(reference.notes, currentTime) : null;
  const targetMidi = targetNote?.midi ?? null;
  const targetName = targetMidi === null ? "—" : midiToLabel(targetMidi);
  const hasPitch = micStatus === "Active" && frame.hz !== null && frame.cents !== null;
  const deviation = hasPitch ? frame.cents : null;
  const markerPosition = deviation === null
    ? 50
    : 50 - Math.max(-METER_RANGE_CENTS, Math.min(METER_RANGE_CENTS, deviation)) / (METER_RANGE_CENTS * 2) * 100;
  const guidance = !reference
    ? "Loading song notes…"
    : targetMidi === null
      ? "No chord target right now"
      : micStatus !== "Active"
        ? "Press play to check the chord root"
        : deviation === null
          ? "Sing a steady note"
          : Math.abs(deviation) <= 10
            ? "IN TUNE — hold this note"
            : deviation < 0
              ? "TOO LOW — sing a little higher"
              : "TOO HIGH — sing a little lower";
  const meterTone = deviation === null ? "idle" : Math.abs(deviation) <= 10 ? "accurate" : "off";

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Pitchlight home"><span className="brand-mark">♪</span> pitchlight</a>
        <span className={`mic-indicator ${micStatus === "Active" ? "is-live" : ""}`}><i />{micStatus === "Active" ? "Mic on" : "Mic off"}</span>
      </header>

      <div className="practice-layout">
        {error && <div className="error-banner" role="alert">{error}</div>}

        <section className="panel pitch-panel" aria-label="Live pitch accuracy">
          <div className="song-heading">
            <p className="eyebrow">NOW PRACTICING</p>
            <h1>Set Fire to the Rain</h1>
            <p className="song-subtitle">Chord-root target · updates at each bar</p>
          </div>

          <div className="accuracy-display">
            <div className="target-note">
              <span className="target-label">{targetNote ? `BAR ${targetNote.barNumber} · ${targetNote.chordName}` : "CURRENT CHORD ROOT"}</span>
              <strong>{targetName}</strong>
              <span className="target-frequency">{targetMidi === null ? "—" : `ROOT TONE · ${(440 * 2 ** ((targetMidi - 69) / 12)).toFixed(1)} Hz`}</span>
            </div>

            <div className={`accuracy-meter meter-${meterTone}`} role="img" aria-label={deviation === null ? "Pitch accuracy level waiting for microphone" : `Pitch is ${Math.abs(Math.round(deviation))} cents ${deviation < 0 ? "too low" : deviation > 0 ? "too high" : "in tune"}`}>
              <div className="meter-track">
                <span className="meter-center" />
                <span className="meter-marker" style={{ "--marker-position": `${markerPosition}%` } as CSSProperties} />
              </div>
              <div className="meter-labels"><span>HIGH</span><span>IN TUNE</span><span>LOW</span></div>
            </div>

            <div className={`accuracy-guidance ${deviation !== null && Math.abs(deviation) <= 10 ? "is-accurate" : ""}`} role="status">{guidance}</div>
            <div className="deviation-readout">{deviation === null ? "—" : `${deviation > 0 ? "+" : ""}${Math.round(deviation)}¢`}</div>
          </div>
        </section>

        <section className="panel player-panel" aria-label="Music player">
          <div className="player-title">
            <div><strong>Set Fire to the Rain</strong><span>Accompaniment</span></div>
            <span className="duration">{formatTime(currentTime)} <b>/</b> {formatTime(duration)}</span>
          </div>
          <input
            className="timeline"
            aria-label="Song timeline"
            type="range"
            min="0"
            max={duration || 1}
            step="0.05"
            value={Math.min(currentTime, duration || 1)}
            style={{ "--progress": `${duration ? currentTime / duration * 100 : 0}%` } as CSSProperties}
            disabled={!duration}
            onChange={(event) => {
              if (!audio.current) return;
              audio.current.currentTime = Number(event.currentTarget.value);
              updateTime();
            }}
          />
          <div className="transport">
            <button className="quiet-button" aria-label="Skip back 10 seconds" disabled={!duration} onClick={() => seekBy(-10)}>−10s</button>
            <button className="play-button" aria-label={starting ? "Starting microphone" : playing ? "Pause song and microphone" : "Play song and start microphone"} disabled={!duration || starting} onClick={() => void togglePlayback()}>{starting ? "…" : playing ? "Ⅱ" : "▶"}</button>
            <button className="quiet-button" aria-label="Skip forward 10 seconds" disabled={!duration} onClick={() => seekBy(10)}>+10s</button>
          </div>
        </section>

        <p className="headphone-note">Echo cancellation is on; headphones further reduce backing-track bleed.</p>
      </div>

      <audio ref={audio} src="/accompaniment.mp3" preload="metadata" onLoadedMetadata={(event) => {
        setDuration(event.currentTarget.duration);
      }} onTimeUpdate={updateTime} onPlay={() => setPlaying(true)} onPause={() => { setPlaying(false); stopMicrophone(); }}
        onError={() => setError("Could not load public/accompaniment.mp3. Replace it with a valid MP3 file.")}
        onEnded={() => { setPlaying(false); stopMicrophone(); void saveCompletedSession(); }} />
    </main>
  );
}
