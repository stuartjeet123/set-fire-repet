import { describe, expect, it } from "vitest";
import { matchPitch, matchPitchToAMinorScale } from "./matching";
import type { ReferenceNote } from "../reference/reference";
import { midiToHz } from "../pitch/pitch";

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

  it("matches the target pitch class in higher or lower octaves", () => {
    expect(matchPitch(130.8128, 0.99, target)).toMatchObject({ status: "PERFECT", cents: expect.closeTo(0, 1) });
    expect(matchPitch(523.2511, 0.99, target)).toMatchObject({ status: "PERFECT", cents: expect.closeTo(0, 1) });
  });

  it("does not score low-confidence input", () => {
    expect(matchPitch(261.6256, 0.4, target).status).toBe("WAITING");
  });

  it("accepts every A natural minor scale note across octaves", () => {
    for (const midi of [57, 59, 60, 62, 64, 65, 67, 69, 71, 72]) {
      expect(matchPitchToAMinorScale(midiToHz(midi), 0.99).status).toBe("PERFECT");
    }
  });

  it("marks chromatic notes outside A minor", () => {
    const match = matchPitchToAMinorScale(midiToHz(58), 0.99);
    expect(match.status).toBe("MISS");
    expect(match.cents).toBeGreaterThan(50);
  });
});
