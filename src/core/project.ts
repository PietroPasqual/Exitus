import { SHAPE_META } from '../data/shapes';
/** Máximo de runas dentro de um Selo/Col */
export const MAX_INNER = 7;
import type { Activation, Circle, Connection, MagicNode, Project, RingStyle } from './types';

const ACTIVATIONS: Activation[] = ['ativacao', 'perfeito', 'instavel'];
const RING_STYLES: RingStyle[] = ['single', 'double', 'runic'];
const CONN_TYPES: Connection['type'][] = ['straight', 'arc-cw', 'arc-ccw'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && isFinite(v) ? v : fallback);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length < 200 ? v : null);

/**
 * Lê um projeto vindo de fora (arquivo JSON ou círculo salvo na conta) e devolve
 * só o que é válido. Retorna null se não parece um círculo mágico.
 */
export function normalizeProject(raw: unknown): Project | null {
  if (!isObj(raw) || !Array.isArray(raw.nodes)) return null;

  const nodes: MagicNode[] = [];
  for (const n of raw.nodes) {
    if (!isObj(n)) continue;
    const id = str(n.id);
    const shape = n.shape as MagicNode['shape'];
    if (!id || !(shape in SHAPE_META)) continue;
    nodes.push({
      id,
      shape,
      x: num(n.x, 0),
      y: num(n.y, 0),
      size: Math.min(120, Math.max(20, num(n.size, 54))),
      rot: num(n.rot, 0),
      rune: str(n.rune),
      ...(Array.isArray(n.inner) && n.inner.length
        ? { inner: (n.inner as unknown[]).filter((r): r is string => typeof r === 'string').slice(0, MAX_INNER) }
        : {}),
      activation: ACTIVATIONS.includes(n.activation as Activation) ? n.activation as Activation : 'ativacao',
      charge: Math.min(20, Math.max(1, Math.round(num(n.charge, 1)))),
      ...(str(n.bond)?.trim() ? { bond: (str(n.bond) as string).trim().slice(0, 40) } : {}),
      ...(n.double === true && (shape === 'star' || shape === 'redor') ? { double: true } : {}),
      ...(n.lockedCenter ? { lockedCenter: true } : {}),
      ...(str(n.circleId) ? { circleId: str(n.circleId) as string } : {})
    });
  }
  if (!nodes.some(n => n.lockedCenter)) return null;

  const ids = new Set(nodes.map(n => n.id));
  // Anéis de círculo também podem ser ponta de cabo (ring:<id>)
  const ringIds = new Set((Array.isArray(raw.circles) ? raw.circles : []).filter(isObj).map(c => 'ring:' + (str(c.id) ?? 'c1')));
  const connections: Connection[] = (Array.isArray(raw.connections) ? raw.connections : [])
    .filter(isObj)
    .map(c => ({
      id: str(c.id) ?? `conn_${Math.random().toString(36).slice(2, 9)}`,
      from: str(c.from) ?? '',
      to: str(c.to) ?? '',
      type: CONN_TYPES.includes(c.type as Connection['type']) ? c.type as Connection['type'] : 'straight',
      mode: c.mode === 'sequential' ? 'sequential' as const : 'simultaneous' as const
    }))
    .filter(c => (ids.has(c.from) || ringIds.has(c.from)) && (ids.has(c.to) || ringIds.has(c.to)) && c.from !== c.to);

  const circles: Circle[] | undefined = Array.isArray(raw.circles)
    ? raw.circles.filter(isObj).map(c => ({
      id: str(c.id) ?? 'c1', x: num(c.x, 0), y: num(c.y, 0),
      ...(str(c.name) ? { name: (str(c.name) as string).slice(0, 80) } : {}),
      ...(typeof c.r === 'number' && Number.isFinite(c.r) ? { r: Math.min(600, Math.max(80, c.r)) } : {}),
      ...(c.frame === 'square' ? { frame: 'square' as const } : {})
    }))
    : undefined;

  const info = isObj(raw.spellInfo) ? raw.spellInfo : null;
  return {
    ringStyle: RING_STYLES.includes(raw.ringStyle as RingStyle) ? raw.ringStyle as RingStyle : 'single',
    strokeWidth: Math.min(10, Math.max(3, num(raw.strokeWidth, 6))),
    showGrid: !!raw.showGrid,
    nodes,
    connections,
    circles,
    ...(raw.envelope === true ? { envelope: true } : {}),
    spellInfo: info && str(info.name) ? { name: String(info.name), desc: String(info.desc ?? '') } : null
  };
}

/**
 * Molde geométrico: o mesmo desenho (formas, cabos, círculos e anel) sem nenhuma runa,
 * pronto para ser preenchido com outros elementos.
 */
export function skeletonOf(project: Project): Project {
  return {
    ...project,
    nodes: project.nodes.map(n => {
      const { inner: _inner, bond: _bond, ...rest } = n;
      return { ...rest, rune: null };
    }),
    connections: project.connections.map(c => ({ ...c })),
    circles: project.circles?.map(c => ({ ...c })),
    spellInfo: null
  };
}

/** Nome da cópia: "Nome (cópia)", "Nome (cópia 2)"… sem repetir um nome que já existe */
export function copyName(name: string, taken: string[]): string {
  const base = name.replace(/\s*\(cópia(?: \d+)?\)$/, '');
  const used = new Set(taken);
  let candidate = `${base} (cópia)`;
  for (let i = 2; used.has(candidate); i++) candidate = `${base} (cópia ${i})`;
  return candidate;
}
