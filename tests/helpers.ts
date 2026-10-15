import { ensureCircles, type Model } from '../src/core/circles';
import type { Connection, MagicNode, Preset } from '../src/core/types';
import { PRESETS } from '../src/data/presets';

/** Cópia independente de um exemplo, pronta para analisar */
export function modelOf(key: string): Model & { preset: Preset } {
  const p: Preset = JSON.parse(JSON.stringify(PRESETS[key]));
  const m = { nodes: p.nodes, connections: p.connections, circles: p.circles ?? [], envelope: !!p.envelope };
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

/** Problemas que a Leitura do Círculo aponta (avisos, posições fora do recomendado, falta de algo) */
export function issuesOf(a: { badge: { kind: string; text: string }; logs: { title: string; text: string }[] }): string[] {
  const out: string[] = [];
  if (a.badge.kind !== 'ok') out.push(a.badge.text);
  const markers = [/var\(--warning\)/, /var\(--danger\)/, /não está no lugar recomendado/, /não há nada antes/, /não há objeto nem elemento/, /sem palavra de vínculo/, /vazio — não há runas/, /nada ligado à linha/, /só há .* para ligar/];
  a.logs.forEach(l => {
    if (markers.some(r => r.test(l.text))) out.push(`${l.title}: ${l.text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 220)}`);
  });
  return out;
}
