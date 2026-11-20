import { centsBetween, midiToHz } from "../pitch/pitch";
import type { ReferenceNote } from "../reference/reference";
import type { MatchStatus } from "../../shared/types/pitch";

export function getTargetNote(notes: ReferenceNote[], time: number): ReferenceNote | null {
  return notes.find((note) => time >= note.start && time < note.end) ?? null;
}

export function matchPitch(hz: number | null, confidence: number, target: ReferenceNote | null) {
  if (!target) return { status: "NO_TARGET" as MatchStatus, cents: null, targetMidi: null };
  if (!hz || confidence < 0.9) return { status: "WAITING" as MatchStatus, cents: null, targetMidi: target.midi };
  const cents = centsBetween(hz, midiToHz(target.midi));
  const liveMidi = 69 + 12 * Math.log2(hz / 440);
  const nearest = Math.round(liveMidi);
  if (nearest % 12 !== target.midi % 12) return { status: "MISS" as MatchStatus, cents, targetMidi: target.midi };
  if (nearest !== target.midi) return { status: "OCTAVE_ERROR" as MatchStatus, cents, targetMidi: target.midi };
  const absCents = Math.abs(cents);
  const status: MatchStatus = absCents <= 20 ? "PERFECT" : absCents <= 50 ? "CLOSE" : "MISS";
  return { status, cents, targetMidi: target.midi };
}
