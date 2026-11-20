import { describe, expect, it } from "vitest";
import { matchPitch } from "./matching";
import type { ReferenceNote } from "../reference/reference";

const target: ReferenceNote = {
  start: 0,
  end: 1,
  midi: 60,
  frequencyHz: 261.6256,
  label: "C4",
  confidence: 1,
};

describe("pitch matching feedback", () => {
  it("distinguishes a correct note from an out-of-tune note", () => {
    expect(matchPitch(261.6256, 0.99, target).status).toBe("PERFECT");
    expect(matchPitch(277.1826, 0.99, target).status).toBe("MISS");
  });

  it("marks the right pitch class in the wrong octave separately", () => {
    expect(matchPitch(523.2511, 0.99, target).status).toBe("OCTAVE_ERROR");
  });

  it("does not score low-confidence input", () => {
    expect(matchPitch(261.6256, 0.4, target).status).toBe("WAITING");
  });
});
