/** Polígonos autorados na escala 15, sempre feitos do material da magia. */
export type IntentionPoint = [number, number];
export interface IntentionPart { points: IntentionPoint[]; light: number }
export const part = (light: number, ...points: IntentionPoint[]): IntentionPart => ({ points, light });
export const rect = (l: number, t: number, r: number, b: number, light: number): IntentionPart =>
  part(light, [l, t], [r, t], [r, b], [l, b]);
