export interface ReferenceNote {
  start: number;
  end: number;
  midi: number;
  frequencyHz: number;
  label: string;
  confidence: number;
  barNumber?: number;
  chordName?: string;
}

export interface ReferenceData {
  schemaVersion: number;
  songId: string;
  audioFile: string;
  audioOffsetSeconds: number;
  tempoBpm: number;
  notes: ReferenceNote[];
}

export function validateReference(data: unknown): asserts data is ReferenceData {
  if (!data || typeof data !== "object") throw new Error("Invalid reference data");
  const ref = data as ReferenceData;
  if (ref.schemaVersion !== 1) throw new Error("Unsupported reference schema");
  if (!ref.songId || !ref.audioFile) throw new Error("Reference missing song metadata");
  if (!Array.isArray(ref.notes)) throw new Error("Reference notes missing");
  let previousEnd = -Infinity;
  for (const note of ref.notes) {
    if (!Number.isFinite(note.start) || !Number.isFinite(note.end) || note.end <= note.start)
      throw new Error("Invalid reference timing");
    if (note.start < previousEnd) throw new Error("Reference notes overlap in this monotonic fixture");
    if (!Number.isInteger(note.midi) || note.midi < 0 || note.midi > 127)
      throw new Error("Invalid MIDI note");
    if (!Number.isFinite(note.frequencyHz) || note.frequencyHz <= 0)
      throw new Error("Invalid reference frequency");
    previousEnd = note.end;
  }
}
