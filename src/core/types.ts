// Tipos centrais do sistema de runas

export type ShapeId =
  | 'prism' | 'square' | 'circle' | 'triangle' | 'hexagon' | 'star'
  | 'corp' | 'salor' | 'redor';

export type Activation = 'ativacao' | 'perfeito' | 'instavel';

export type RuneCategory = 'elemental' | 'shape' | 'mod';

/** Tipo visual do símbolo interno (cada um tem uma cor) */
export type RuneType = 'elemental' | 'forma' | 'estrutural' | 'direcao';

export interface RuneStats {
  power: number;
  cost: number;
  [extra: string]: number;
}

export interface Rune {
  id: string;
  name: string;
  sigil: string;
  category: RuneCategory;
  svg: string;
  stats?: Record<Activation, RuneStats>;
  missingPenalty?: number;
  auxFactor?: number;
  passive?: string;
  perfectEffect?: string;
  desc?: string;
  costMod?: number;
  /** Valores ainda não definidos na tabela oficial */
  provisional?: boolean;
  /** Energia e poder variáveis na tabela oficial */
  variable?: boolean;
  /** Vida/Morte: a energia é o poder vezes esta escala */
  costPerPower?: Record<Activation, number>;
}

export interface ShapeMeta {
  name: string;
  short: string;
  factor: number;
  range: string;
  role: string;
}

export interface MagicNode {
  id: string;
  shape: ShapeId;
  x: number;
  y: number;
  size: number;
  rot: number;
  rune: string | null;
  activation: Activation;
  charge: number;
  /**
   * Magia dentro da magia: runas colocadas dentro de um Selo ○ ou Col □.
   * A forma só delimita a função que está lá dentro.
   */
  inner?: string[];
  /** Intenção: palavra ou números de vínculo (uma vez vinculados, não se desvinculam) */
  bond?: string;
  /** Estrela dupla: duas Estrelas uma em cima da outra, uma para cada círculo sobreposto */
  double?: boolean;
  /** Prisma de um círculo (nunca some) */
  lockedCenter?: boolean;
  /** Círculo ao qual o Prisma pertence */
  circleId?: string;
}

export type ConnectionType = 'straight' | 'arc-cw' | 'arc-ccw';
export type ConnectionMode = 'simultaneous' | 'sequential';

export interface Connection {
  id: string;
  /** Origem: onde fica o ○ */
  from: string;
  /** Destino: ponta sem ○ */
  to: string;
  type: ConnectionType;
  mode: ConnectionMode;
}

export interface Circle {
  id: string;
  x: number;
  y: number;
  /** Nome/função do círculo (ex.: "4 bolas de fogo que orbitam a lança") */
  name?: string;
  /** Raio do anel (padrão 285); círculos menores podem ficar dentro de outros */
  r?: number;
  /** Círculo dentro de um quadrado: efeito sustentado, não inerente à magia principal */
  frame?: 'square';
}

export type RingStyle = 'single' | 'double' | 'runic';

export interface SpellInfo {
  name: string;
  desc: string;
  kind?: PresetKind;
}

export type PresetKind = 'caderno' | 'magia' | 'estudo';

/** O desenho em si (o que é salvo, exportado e carregado) */
export interface Project {
  ringStyle: RingStyle;
  strokeWidth: number;
  showGrid: boolean;
  nodes: MagicNode[];
  connections: Connection[];
  circles?: Circle[];
  spellInfo?: SpellInfo | null;
  /** Círculo em volta de tudo (envolve os círculos separados ligados à magia) */
  envelope?: boolean;
}

export interface Preset extends Project {
  info: SpellInfo & { kind: PresetKind };
}

export type InteractionMode = 'move' | 'connect' | 'arc';
export type RuneFilter = 'all' | RuneType;

/** Estado completo do editor */
export interface EditorState extends Project {
  circles: Circle[];
  spellInfo: SpellInfo | null;
  interactionMode: InteractionMode;
  selectedNodeId: string;
  connectSourceId: string | null;
  runeCategoryFilter: RuneFilter;
  showFlow: boolean;
  /** Traço rabiscado à mão (pergaminho) ou limpo, de régua e compasso. Preferência do aparelho, não vai no projeto */
  sketchy: boolean;
  /** Runa tocada vai para dentro do Selo/Col (magia dentro da magia) */
  innerMode: boolean;
  /** Ímã polar ao arrastar (ângulos de 15° e mesmas distâncias do centro). Preferência do aparelho */
  snap: boolean;
}
