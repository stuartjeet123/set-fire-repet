import { centsBetween, midiToHz } from "../pitch/pitch";
import type { ReferenceNote } from "../reference/reference";
import type { MatchStatus } from "../../shared/types/pitch";

const A_MINOR_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);

export function getTargetNote(notes: ReferenceNote[], time: number): ReferenceNote | null {
  return notes.find((note) => time >= note.start && time < note.end) ?? null;
}

function matchToMidi(hz: number, targetMidi: number) {
  const liveMidi = 69 + 12 * Math.log2(hz / 440);
  const octave = Math.round((liveMidi - targetMidi) / 12);
  const cents = centsBetween(hz, midiToHz(targetMidi + octave * 12));
  const absCents = Math.abs(cents);
  const status: MatchStatus = absCents <= 20 ? "PERFECT" : absCents <= 50 ? "CLOSE" : "MISS";
  return { status, cents, targetMidi };
}

export function matchPitch(hz: number | null, confidence: number, target: ReferenceNote | null) {
  if (!target) return { status: "NO_TARGET" as MatchStatus, cents: null, targetMidi: null };
  if (!hz || confidence < 0.9) return { status: "WAITING" as MatchStatus, cents: null, targetMidi: target.midi };
  return matchToMidi(hz, target.midi);
}

export function matchPitchToAMinorScale(hz: number | null, confidence: number) {
  if (!hz || !Number.isFinite(hz) || confidence < 0.9) {
    return { status: "WAITING" as MatchStatus, cents: null, targetMidi: null };
  }

  const liveMidi = 69 + 12 * Math.log2(hz / 440);
  let targetMidi = Math.floor(liveMidi);
  let closestDistance = Infinity;
  for (let candidate = Math.floor(liveMidi) - 12; candidate <= Math.ceil(liveMidi) + 12; candidate += 1) {
    if (!A_MINOR_PITCH_CLASSES.has((candidate % 12 + 12) % 12)) continue;
    const distance = Math.abs(liveMidi - candidate);
    if (distance < closestDistance) {
      targetMidi = candidate;
      closestDistance = distance;
    }
  }

  return matchToMidi(hz, targetMidi);
}
