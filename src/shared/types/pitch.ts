export type MatchStatus = "NO_TARGET" | "WAITING" | "PERFECT" | "CLOSE" | "MISS" | "OCTAVE_ERROR";

export interface PitchFrame {
  hz: number | null;
  midi: number | null;
  cents: number | null;
  confidence: number;
  timestamp: number;
  targetMidi: number | null;
  status: MatchStatus;
}
