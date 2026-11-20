export interface GraphWindow {
  start: number;
  end: number;
}

export function getGraphWindow(currentTime: number, duration: number, widthSeconds = 5): GraphWindow {
  const songDuration = Number.isFinite(duration) && duration > 0 ? duration : widthSeconds;
  const time = Math.max(0, Math.min(currentTime, songDuration));
  let start = Math.max(0, time - 2);
  let end = Math.min(songDuration, start + widthSeconds);

  if (end - start < widthSeconds) start = Math.max(0, end - widthSeconds);
  return { start, end };
}
