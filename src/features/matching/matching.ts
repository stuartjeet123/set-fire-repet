import { centsBetween, midiToHz } from "../pitch/pitch";
import type { ReferenceNote } from "../reference/reference";
import type { MatchStatus } from "../../shared/types/pitch";

export function getTargetNote(notes: ReferenceNote[], time: number): ReferenceNote | null {
  return notes.find((note) => time >= note.start && time < note.end) ?? null;
}

export function matchPitch(hz: number | null, confidence: number, target: ReferenceNote | null) {
  if (!target) return { status: "NO_TARGET" as MatchStatus, cents: null, targetMidi: null };
  if (!hz || confidence < 0.9) return { status: "WAITING" as MatchStatus, cents: null, targetMidi: target.midi };
  const liveMidi = 69 + 12 * Math.log2(hz / 440);
  const octave = Math.round((liveMidi - target.midi) / 12);
  const cents = centsBetween(hz, midiToHz(target.midi + octave * 12));
  const absCents = Math.abs(cents);
  const status: MatchStatus = absCents <= 20 ? "PERFECT" : absCents <= 50 ? "CLOSE" : "MISS";
  return { status, cents, targetMidi: target.midi };
}
