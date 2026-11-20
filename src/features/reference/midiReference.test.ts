import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import { createAminorReference } from "./midiReference";

describe("MIDI singing reference", () => {
  it("uses each bar's transposed chord root instead of melody notes", () => {
    const midi = new Midi();
    const melody = midi.addTrack();
    melody.name = "Melody";
    melody.addNote({ midi: 84, time: 0, duration: 5 });

    const chords = midi.addTrack();
    chords.name = "Chords";
    for (const pitch of [50, 57, 62, 65, 69]) chords.addNote({ midi: pitch, time: 0, duration: 0.25 });
    for (const pitch of [53, 57, 60, 65, 69]) chords.addNote({ midi: pitch, time: 1.75, duration: 0.25 });
    for (const pitch of [48, 52, 55, 60, 67]) chords.addNote({ midi: pitch, time: 4, duration: 0.25 });

    const bytes = midi.toArray();
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const reference = createAminorReference(buffer);

    expect(reference.notes.map(({ midi: note, barNumber, chordName }) => ({ note, barNumber, chordName }))).toEqual([
      { note: 57, barNumber: 1, chordName: "Am" },
      { note: 48, barNumber: 2, chordName: "C" },
      { note: 55, barNumber: 3, chordName: "G" },
    ]);
    expect(reference.notes.map(({ start }) => start)).toEqual([0, 2, 4]);
    expect(reference.notes[0].label).toBe("A3");
  });
});
