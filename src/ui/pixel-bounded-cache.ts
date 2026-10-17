/** Small LRU for geometry only; callers never store animation frames here. */
export class BoundedPixelCache<T> {
  private readonly entries = new Map<string, { value: T; pixels: number }>();
  private usedPixels = 0;

  constructor(readonly maxEntries = 16, readonly maxPixels = 262144) {}

  get size(): number { return this.entries.size; }
  get pixelCount(): number { return this.usedPixels; }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, pixels: number): void {
    const old = this.entries.get(key);
    if (old) { this.usedPixels -= old.pixels; this.entries.delete(key); }
    if (!Number.isFinite(pixels) || pixels < 0 || pixels > this.maxPixels || this.maxEntries < 1) return;
    while (this.entries.size && (this.entries.size >= this.maxEntries || this.usedPixels + pixels > this.maxPixels)) {
      const oldest = this.entries.keys().next().value!;
      this.usedPixels -= this.entries.get(oldest)!.pixels;
      this.entries.delete(oldest);
    }
    this.entries.set(key, { value, pixels });
    this.usedPixels += pixels;
  }

  clear(): void { this.entries.clear(); this.usedPixels = 0; }
}
