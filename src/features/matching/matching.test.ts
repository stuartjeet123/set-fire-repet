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

  it("matches the target pitch class in higher or lower octaves", () => {
    expect(matchPitch(130.8128, 0.99, target)).toMatchObject({ status: "PERFECT", cents: expect.closeTo(0, 1) });
    expect(matchPitch(523.2511, 0.99, target)).toMatchObject({ status: "PERFECT", cents: expect.closeTo(0, 1) });
  });

  it("does not score low-confidence input", () => {
    expect(matchPitch(261.6256, 0.4, target).status).toBe("WAITING");
  });
});
