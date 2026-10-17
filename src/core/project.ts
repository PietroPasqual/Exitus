import { RUNES } from '../data/runes';
import { SHAPE_META } from '../data/shapes';
/** Máximo de runas dentro de um Círculo/Quadrado */
export const MAX_INNER = 7;
import type { Activation, Circle, Connection, MagicNode, Project, RingShape, RingStyle } from './types';
import { RING_SHAPES } from './circles';

const ACTIVATIONS: Activation[] = ['ativacao', 'perfeito', 'instavel'];
const RING_STYLES: RingStyle[] = ['single', 'double', 'runic'];
const CONN_TYPES: Connection['type'][] = ['straight', 'arc-cw', 'arc-ccw'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && isFinite(v) ? v : fallback);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length < 200 ? v : null);

export const MAX_PROJECT_BYTES = 2_000_000;
const MAX_NODES = 500;
const MAX_CONNECTIONS = 2000;
const MAX_LAYERS = 32;
const own = (o: object, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);
const runeId = (v: unknown): string | null => typeof v === 'string' && own(RUNES, v) ? v : null;

/**
 * Lê um projeto vindo de fora (arquivo JSON ou círculo salvo na conta) e devolve
 * só o que é válido. Retorna null se não parece um círculo mágico.
 */
export function normalizeProject(raw: unknown): Project | null {
  if (!isObj(raw) || !Array.isArray(raw.nodes)) return null;
  if (raw.nodes.length > MAX_NODES
    || (Array.isArray(raw.connections) && raw.connections.length > MAX_CONNECTIONS)
    || (Array.isArray(raw.circles) && raw.circles.length > MAX_LAYERS)) return null;

  const nodes: MagicNode[] = [];
  for (const n of raw.nodes) {
    if (!isObj(n)) continue;
    const id = str(n.id);
    const shape = n.shape as MagicNode['shape'];
    if (!id || typeof shape !== 'string' || !own(SHAPE_META, shape)) continue;
    if (nodes.some(node => node.id === id)) return null;
    const bond = str(n.bond)?.trim().normalize('NFC');
    nodes.push({
      id,
      shape,
      x: num(n.x, 0),
      y: num(n.y, 0),
      size: Math.min(200, Math.max(10, num(n.size, 54))),
      rot: num(n.rot, 0),
      rune: runeId(n.rune),
      ...(Array.isArray(n.inner) && n.inner.length
        ? { inner: (n.inner as unknown[]).filter((r): r is string => typeof r === 'string' && own(RUNES, r)).slice(0, MAX_INNER) }
        : {}),
      activation: ACTIVATIONS.includes(n.activation as Activation) ? n.activation as Activation : 'ativacao',
      charge: Math.min(20, Math.max(1, Math.round(num(n.charge, 1)))),
      ...(bond ? { bond: Array.from(bond).slice(0, 40).join('') } : {}),
      ...(n.double === true && (shape === 'star' || shape === 'redor') ? { double: true } : {}),
      ...(str(n.layer) ? { layer: str(n.layer) as string } : {}),
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
      ...(typeof c.r === 'number' && Number.isFinite(c.r) ? { r: Math.min(900, Math.max(40, c.r)) } : {}),
      ...(c.frame === 'square' ? { frame: 'square' as const } : {}),
      ...(RING_SHAPES.includes(c.shape as RingShape) ? { shape: c.shape as RingShape } : {})
    }))
    : undefined;

  const info = isObj(raw.spellInfo) ? raw.spellInfo : null;
  // Mago: refino, energia infundida (vazio = automática) e velocidade
  const mage = isObj(raw.mage) ? {
    refino: Math.min(100, Math.max(0.1, num(raw.mage.refino, 1))),
    energia: typeof raw.mage.energia === 'number' && isFinite(raw.mage.energia) && raw.mage.energia >= 0 ? Math.min(1e6, raw.mage.energia) : null,
    velocidade: Math.min(1e5, Math.max(0.1, num(raw.mage.velocidade, 30)))
  } : undefined;
  return {
    ...(mage ? { mage } : {}),
    ringStyle: RING_STYLES.includes(raw.ringStyle as RingStyle) ? raw.ringStyle as RingStyle : 'single',
    strokeWidth: Math.min(10, Math.max(3, num(raw.strokeWidth, 6))),
    showGrid: !!raw.showGrid,
    nodes,
    connections,
    circles,
    ...(raw.envelope === true ? { envelope: true } : {}),
    spellInfo: info && str(info.name) ? { name: String(info.name), desc: typeof info.desc === 'string' ? info.desc.slice(0, 4000) : '' } : null
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
