import { describe, expect, it } from "vitest";
import { PitchSmoother } from "./pitchSmoother";

describe("pitch reading stability", () => {
  it("smooths small changes and rejects multiple noisy pitch frames", () => {
    const smoother = new PitchSmoother();
    smoother.push(440);
    smoother.push(441);
    smoother.push(700);
    smoother.push(400);

    expect(smoother.push(442)).toBeCloseTo(441);
    expect(smoother.push(443)).toBeCloseTo(442);
  });

  it("holds the last pitch through brief gaps, then clears after sustained silence", () => {
    const smoother = new PitchSmoother();
    const first = smoother.push(440);
    smoother.push(441);

    expect(smoother.push(null)).toBeCloseTo(Math.sqrt(440 * 441));
    expect(smoother.push(null)).toBeCloseTo(Math.sqrt(440 * 441));
    expect(smoother.push(null)).toBeNull();
    expect(smoother.push(523)).toBeCloseTo(523);
    expect(first).toBe(440);
  });
});
