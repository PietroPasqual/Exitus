import { ensureCircles, type Model } from '../src/core/circles';
import type { Connection, MagicNode, Preset } from '../src/core/types';
import { PRESETS } from '../src/data/presets';

/** Cópia independente de um exemplo, pronta para analisar */
export function modelOf(key: string): Model & { preset: Preset } {
  const p: Preset = JSON.parse(JSON.stringify(PRESETS[key]));
  const m = { nodes: p.nodes, connections: p.connections, circles: p.circles ?? [] };
  ensureCircles(m);
  return { ...m, preset: p };
}

export const prism = (rune: string | null = 'fogo', activation: MagicNode['activation'] = 'ativacao'): MagicNode =>
  ({ id: 'prism_center', shape: 'prism', x: 0, y: 0, size: 52, rot: 0, rune, activation, charge: 1, lockedCenter: true, circleId: 'c1' });

export const node = (id: string, shape: MagicNode['shape'], x: number, y: number, rune: string | null = null): MagicNode =>
  ({ id, shape, x, y, size: 54, rot: 0, rune, activation: 'ativacao', charge: 1 });

export const cable = (from: string, to: string): Connection =>
  ({ id: `${from}-${to}`, from, to, type: 'straight', mode: 'simultaneous' });

export const model = (nodes: MagicNode[], connections: Connection[]): Model =>
  ({ nodes, connections, circles: [{ id: 'c1', x: 0, y: 0 }] });
