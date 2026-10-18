/** Rest-pose centreline in the same authored coordinates as NATURE_FORMS.serpente.
 * Static geometry carries the creature; only narrow highlights breathe along it.
 */
const COIL = [
  [-22, 17], [-13, 15], [-5, 12], [1, 8], [0, 4], [-6, 1], [-14, -1],
  [-17, -5], [-17, -9], [-12, -14], [-6, -14], [0, -12], [6, -9], [13, -12], [19, -13]
] as const;
const SEGMENTS = COIL.slice(1).map((end, index) => {
  const start = COIL[index], dx = end[0] - start[0], dy = end[1] - start[1];
  return { x: start[0], y: start[1], dx, dy, length: Math.hypot(dx, dy), offset: 0 };
});
let totalLength = 0;
for (const segment of SEGMENTS) { segment.offset = totalLength; totalLength += segment.length; }
const TAU = Math.PI * 2;

/**
 * x/y are geometry()-centred pixel coordinates; scale is size / 15.
 * The authored envelope has centre (.5, 0), hence the half-unit correction.
 * Shared 8-frame time moves a restrained specular front along the S, leaving
 * eyes, mouth, incisions, peak glints and every alpha edge exactly untouched.
 */
export function serpentSurfaceLight(
  x: number, y: number, scale: number, baseLight: number, frame: number
): number {
  if (!Number.isFinite(baseLight) || baseLight <= .24 || baseLight >= .96) return baseLight;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return baseLight;
  const nativeScale = Number.isFinite(scale) && scale > 0 ? Math.max(.05, scale) : 1;
  const ax = x / nativeScale + .5, ay = y / nativeScale;
  let nearest = Infinity, along = 0;
  for (const segment of SEGMENTS) {
    const u = Math.max(0, Math.min(1,
      ((ax - segment.x) * segment.dx + (ay - segment.y) * segment.dy) / (segment.length * segment.length)));
    const dx = ax - segment.x - segment.dx * u, dy = ay - segment.y - segment.dy * u;
    const distance = dx * dx + dy * dy;
    if (distance < nearest) { nearest = distance; along = segment.offset + segment.length * u; }
  }
  // Small copies keep broad planes: a moving one-pixel glint is sufficient.
  const detail = nativeScale < .4 ? .65 : 1;
  const normalizedFrame = Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
  const phase = normalizedFrame * TAU / 8;
  const front = Math.max(0, (Math.cos(along / totalLength * TAU - phase) - .68) / .32);
  const wake = Math.max(0, (Math.cos(along / totalLength * TAU - phase - .7) - .86) / .14);
  const surface = nearest < 17 ? 1 : .55;
  const light = baseLight + detail * surface * (front * (baseLight > .52 ? .16 : .075) - wake * .045);
  return Math.max(.25, Math.min(.95, light));
}
