export interface TimedLyricLine {
  timeSeconds: number;
  text: string;
}

export interface TimedLyricsResult {
  lines: TimedLyricLine[];
  error: string | null;
}

export function parseTimedLyrics(input: string): TimedLyricsResult {
  const lines: TimedLyricLine[] = [];
  let previousTime = -1;

  for (const [index, rawLine] of input.split(/\r?\n/).entries()) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    const match = /^\s*(\d+):([0-5]\d)\s+(.+?)\s*$/.exec(rawLine);
    if (!match) {
      return { lines: [], error: `Line ${index + 1}: use MM:SS followed by lyric text.` };
    }

    const timeSeconds = Number(match[1]) * 60 + Number(match[2]);
    if (timeSeconds <= previousTime) {
      return { lines: [], error: `Line ${index + 1}: timestamps must be in increasing order.` };
    }

    lines.push({ timeSeconds, text: match[3] });
    previousTime = timeSeconds;
  }

  return { lines, error: null };
}
