import { describe, expect, it } from "vitest";
import { parseTimedLyrics } from "./lyrics";

describe("timestamped lyrics", () => {
  it("parses ordered MM:SS lyric lines", () => {
    expect(parseTimedLyrics("# Format: MM:SS lyric text\n0:03 First line\n01:12 Second line")).toEqual({
      lines: [
        { timeSeconds: 3, text: "First line" },
        { timeSeconds: 72, text: "Second line" },
      ],
      error: null,
    });
  });

  it("rejects malformed or out-of-order lines", () => {
    expect(parseTimedLyrics("0:03 First line\n0:02 Second line").error)
      .toBe("Line 2: timestamps must be in increasing order.");
    expect(parseTimedLyrics("First line").error)
      .toBe("Line 1: use MM:SS followed by lyric text.");
  });
});
