import { describe, expect, it } from "vitest";
import { centsBetween, hzToMidi, midiToHz, midiToLabel, midiToPitchClass } from "./pitch";

describe("pitch conversion", () => {
  it("converts A4 correctly", () => {
    expect(hzToMidi(440)).toBeCloseTo(69);
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToLabel(69)).toBe("A4");
  });
  it("handles octave boundaries", () => {
    expect(midiToLabel(60)).toBe("C4");
    expect(midiToLabel(72)).toBe("C5");
  });
  it("returns the same pitch class across octaves", () => {
    expect([midiToPitchClass(45), midiToPitchClass(57), midiToPitchClass(69)]).toEqual(["A", "A", "A"]);
  });
  it("calculates cents", () => {
    expect(centsBetween(466.1638, 440)).toBeCloseTo(100, 1);
  });
});
