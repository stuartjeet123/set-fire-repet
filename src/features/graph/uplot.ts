import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { midiToLabel } from "../pitch/pitch";

export function createGraph(element: HTMLElement) {
  const steppedPath = uPlot.paths.stepped;
  if (!steppedPath) throw new Error("uPlot stepped path builder is unavailable");

  const chart = new uPlot({
    width: Math.max(280, element.clientWidth),
    height: 320,
    scales: { x: { time: false } },
    axes: [
      {
        stroke: "#aaa8b5",
        grid: { stroke: "rgba(255,255,255,.07)", width: 1 },
        ticks: { stroke: "rgba(255,255,255,.14)" },
        incrs: [1],
        values: (_chart, splits) => splits.map((value) =>
          `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`,
        ),
      },
      {
        stroke: "#aaa8b5",
        grid: { stroke: "rgba(255,255,255,.07)", width: 1 },
        ticks: { stroke: "rgba(255,255,255,.14)" },
        values: (_chart, splits) => splits.map((value) => midiToLabel(value)),
        label: "NOTE",
      },
    ],
    series: [
      {},
      { label: "Target melody", stroke: "#a898ff", width: 3, paths: steppedPath({ align: 1 }) },
      { label: "Your voice", stroke: "transparent", width: 0, points: { show: true, size: 7, fill: "#65e4c8" } },
    ],
    legend: { show: false },
    cursor: { drag: { setScale: false } },
  }, [[], [], []], element);
  const observer = new ResizeObserver(() => chart.setSize({ width: Math.max(280, element.clientWidth), height: 320 }));
  observer.observe(element);
  let xRange: { min: number; max: number } | undefined;
  let yRange: { min: number; max: number } | undefined;

  function applyRanges() {
    if (xRange) chart.setScale("x", xRange);
    if (yRange) chart.setScale("y", yRange);
  }

  return {
    setData: (target: number[], singer: number[], x: number[]) => {
    chart.setData([x, target, singer], false);
    applyRanges();
    },
    setWindow: (start: number, end: number) => {
    xRange = { min: start, max: end };
    applyRanges();
    },
    setPitchRange: (min: number, max: number) => {
    yRange = { min, max };
    applyRanges();
    },
    dispose: () => {
      observer.disconnect();
      chart.destroy();
    },
  };
}
