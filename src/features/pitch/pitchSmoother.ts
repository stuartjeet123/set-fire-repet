export class PitchSmoother {
  private readonly recentHz: number[] = [];
  private missingFrames = 0;
  private static readonly WINDOW_SIZE = 5;
  private static readonly MAX_MISSING_FRAMES = 2;

  push(hz: number | null): number | null {
    if (hz === null || !Number.isFinite(hz) || hz <= 0) {
      this.missingFrames += 1;
      if (this.missingFrames <= PitchSmoother.MAX_MISSING_FRAMES && this.recentHz.length > 0) {
        return this.median();
      }
      this.reset();
      return null;
    }

    this.missingFrames = 0;
    this.recentHz.push(hz);
    if (this.recentHz.length > PitchSmoother.WINDOW_SIZE) this.recentHz.shift();

    return this.median();
  }

  reset() {
    this.recentHz.length = 0;
    this.missingFrames = 0;
  }

  private median(): number {
    const sorted = [...this.recentHz].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[middle];
    return Math.sqrt(sorted[middle - 1] * sorted[middle]);
  }
}
