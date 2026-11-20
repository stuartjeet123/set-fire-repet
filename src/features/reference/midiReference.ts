import { Midi } from "@tonejs/midi";
import { midiToHz, midiToLabel } from "../pitch/pitch";
import type { ReferenceData, ReferenceNote } from "./reference";

const SEMITONES_TO_A_MINOR = -5;
const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const CHORD_QUALITIES = [
  { suffix: "m7b5", intervals: [0, 3, 6, 10] },
  { suffix: "dim7", intervals: [0, 3, 6, 9] },
  { suffix: "maj7", intervals: [0, 4, 7, 11] },
  { suffix: "m7", intervals: [0, 3, 7, 10] },
  { suffix: "7", intervals: [0, 4, 7, 10] },
  { suffix: "m", intervals: [0, 3, 7] },
  { suffix: "dim", intervals: [0, 3, 6] },
  { suffix: "aug", intervals: [0, 4, 8] },
  { suffix: "sus2", intervals: [0, 2, 7] },
  { suffix: "sus4", intervals: [0, 5, 7] },
  { suffix: "", intervals: [0, 4, 7] },
];

function identifyChord(pitches: number[]) {
  const pitchClasses = new Set(pitches.map((pitch) => pitch % 12));
  let best: { root: number; suffix: string; score: number } | null = null;

  for (let root = 0; root < 12; root += 1) {
    for (const quality of CHORD_QUALITIES) {
      if (!quality.intervals.every((interval) => pitchClasses.has((root + interval) % 12))) continue;
      const score = quality.intervals.length * 10 - (pitchClasses.size - quality.intervals.length);
      if (!best || score > best.score) best = { root, suffix: quality.suffix, score };
    }
  }

  return best;
}

export function createAminorReference(buffer: ArrayBuffer): ReferenceData {
  const midi = new Midi(buffer);
  const chordTrack = midi.tracks.find((track) => track.name.trim().toLowerCase() === "chords");
  if (!chordTrack?.notes.length) throw new Error("The MIDI file has no chord track");

  const timeSignature = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  const [numerator, denominator] = timeSignature;
  if (numerator <= 0 || denominator <= 0) throw new Error("The MIDI file has an invalid time signature");
  const ticksPerBar = Math.round(midi.header.ppq * numerator * 4 / denominator);

  const chordEventsByTick = new Map<number, number[]>();
  for (const note of chordTrack.notes) {
    const pitches = chordEventsByTick.get(note.ticks) ?? [];
    pitches.push(note.midi);
    chordEventsByTick.set(note.ticks, pitches);
  }
  const chordEvents = [...chordEventsByTick]
    .map(([ticks, pitches]) => ({ ticks, pitches }))
    .sort((left, right) => left.ticks - right.ticks);

  const notes: ReferenceNote[] = [];
  let eventIndex = 0;
  let currentChord: { pitches: number[] } | undefined;
  const barCount = Math.ceil(midi.durationTicks / ticksPerBar);
  for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
    const startTicks = barIndex * ticksPerBar;
    while (eventIndex < chordEvents.length && chordEvents[eventIndex].ticks <= startTicks) {
      currentChord = chordEvents[eventIndex];
      eventIndex += 1;
    }
    if (!currentChord) continue;

    const chord = identifyChord(currentChord.pitches);
    if (!chord) throw new Error(`Could not identify the chord at bar ${barIndex + 1}`);
    const rootPitchClass = (chord.root + SEMITONES_TO_A_MINOR + 12) % 12;
    const midiNote = 48 + rootPitchClass;
    const start = midi.header.ticksToSeconds(startTicks);
    const end = midi.header.ticksToSeconds(Math.min(startTicks + ticksPerBar, midi.durationTicks));
    if (end <= start) continue;

    notes.push({
      start,
      end,
      midi: midiNote,
      frequencyHz: midiToHz(midiNote),
      label: midiToLabel(midiNote),
      confidence: 1,
      barNumber: barIndex + 1,
      chordName: `${PITCH_NAMES[rootPitchClass]}${chord.suffix}`,
    });
  }

  return {
    schemaVersion: 1,
    songId: "set-fire-to-the-rain-a-minor",
    audioFile: "user-provided accompaniment",
    audioOffsetSeconds: 0,
    tempoBpm: midi.header.tempos[0]?.bpm ?? 120,
    notes,
  };
}
