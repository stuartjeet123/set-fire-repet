import { describe, expect, it } from "vitest";
import { getGraphWindow } from "./timeWindow";

describe("melody graph window", () => {
  it("shows a short lead-in and upcoming notes around playback", () => {
    expect(getGraphWindow(20, 100)).toEqual({ start: 18, end: 23 });
  });

  it("keeps the window inside the song at its beginning and end", () => {
    expect(getGraphWindow(0, 100)).toEqual({ start: 0, end: 5 });
    expect(getGraphWindow(100, 100)).toEqual({ start: 95, end: 100 });
  });

  it("uses the full song for tracks shorter than the window", () => {
    expect(getGraphWindow(2, 3)).toEqual({ start: 0, end: 3 });
  });
});
