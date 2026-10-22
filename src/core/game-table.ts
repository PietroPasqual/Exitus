import { normalizeAvatar, type Avatar } from './avatar';

/**
 * Mesa do Mestre: cenas com mapa em grade, fichas no tabuleiro (tokens), névoa e rolagens.
 * Tudo fica neste navegador; a janela dos jogadores lê o mesmo armazenamento.
 */
export const TABLE_KEY = 'existus-mesa-v1';
/** Limite do arquivo da mesa (com as imagens de fundo), abaixo da cota usual do navegador. */
export const TABLE_FILE_LIMIT = 4_500_000;
export const TABLE_SCENE_LIMIT = 12;
export const TABLE_TOKEN_LIMIT = 80;
export const TABLE_ROLL_LIMIT = 60;
export const TABLE_SIZE_MIN = 4;
export const TABLE_SIZE_MAX = 80;
/** Imagem de fundo como data URL (já reduzida pelo navegador). */
export const TABLE_BACKGROUND_LIMIT = 1_800_000;

/** Um caractere por quadrado: '.' vazio e as letras abaixo (as cores são as do cartão; a arte está em data/table-art.ts). */
export const TERRAINS = {
  p: { nome: 'Parede', cor: '#8a8296' },
  e: { nome: 'Lajota', cor: '#5a566a' },
  m: { nome: 'Madeira', cor: '#8a5a2b' },
  t: { nome: 'Terra', cor: '#6b4a2b' },
  r: { nome: 'Areia', cor: '#dcc88e' },
  n: { nome: 'Neve', cor: '#eef4fa' },
  v: { nome: 'Vegetação', cor: '#3f7d3a' },
  a: { nome: 'Água', cor: '#2f6fa8' },
  d: { nome: 'Terreno difícil', cor: '#7a5a30' },
  l: { nome: 'Perigo (lava)', cor: '#b23a2e' }
} as const;
export type TerrainId = keyof typeof TERRAINS;

export const TOKEN_KINDS = { jogador: 'Personagem', aliado: 'Aliado', inimigo: 'Inimigo', objeto: 'Objeto' } as const;
export type TokenKind = keyof typeof TOKEN_KINDS;
/** Objetos que o mestre pode pôr no mapa (a arte está em data/table-art.ts). */
export const PROPS = {
  porta: 'Porta', bau: 'Baú', arvore: 'Árvore', pedra: 'Pedra', tocha: 'Tocha', mesa: 'Mesa', cama: 'Cama', barril: 'Barril',
  estatua: 'Estátua', fogueira: 'Fogueira', escada: 'Escada', armadilha: 'Armadilha', tapete: 'Tapete', caixote: 'Caixote',
  placa: 'Placa', coluna: 'Coluna'
} as const;
export type PropId = keyof typeof PROPS;
/** Retratos de criatura para os tokens de NPC. */
export const CREATURES = {
  slime: 'Slime', esqueleto: 'Esqueleto', lobo: 'Lobo', goblin: 'Goblin', orc: 'Orc', morcego: 'Morcego', aranha: 'Aranha',
  fantasma: 'Fantasma', dragao: 'Dragão', rato: 'Rato', zumbi: 'Zumbi', demonio: 'Demônio'
} as const;
export type CreatureId = keyof typeof CREATURES;
export const TOKEN_COLORS = ['#d4a853', '#4cc3ff', '#4cc06a', '#f2655c', '#a964e8', '#ec8c3c', '#e8e2d0', '#5a6478'] as const;

export const PROP_LIMIT = 400;
/** Objeto pintado no mapa (porta, baú, árvore…); no máximo um por quadrado. */
export interface TableProp {
  id: string; tipo: PropId; x: number; y: number;
  /** Quartos de volta no sentido horário. */
  rot: 0 | 1 | 2 | 3;
  /** Só o mestre vê (armadilhas, portas secretas…). */
  oculto: boolean;
}

export interface TableToken {
  /** Retrato de criatura do token; vazio = o avatar do personagem ou as iniciais. */
  sprite: CreatureId | '';
  /** Avatar e classe do personagem (cópia guardada, para quem não tem a ficha). */
  avatar: Avatar | null; classe: string;
  id: string; nome: string; cor: string; tipo: TokenKind;
  x: number; y: number; tamanho: number;
  /** Só o mestre vê. */
  oculto: boolean;
  /** Ficha ligada: a vida vem dela. */
  personagemId: string;
  vida: { atual: number; maximo: number } | null;
  notas: string;
}
/** Cor da linha da grade: "auto" segue o tema; claro/escuro servem para mapas com imagem. */
export const GRID_COLORS = { auto: 'Automática', clara: 'Clara', escura: 'Escura' } as const;
export type GridColor = keyof typeof GRID_COLORS;
export const IMAGE_WIDTH_MIN = 1;
export const IMAGE_WIDTH_MAX = 200;

export interface TableScene {
  id: string; nome: string; colunas: number; linhas: number;
  metros: number; grade: boolean; fundo: string;
  /**
   * Imagem do mapa sem deformar: ocupa `fundoLargura` quadrados de largura (a altura vem da
   * proporção original) a partir do canto (`fundoX`, `fundoY`), em quadrados. Proporção 0 = cena
   * antiga, em que a imagem é esticada sobre a grade toda.
   */
  fundoRazao: number; fundoLargura: number; fundoX: number; fundoY: number;
  gradeCor: GridColor; gradeOpacidade: number;
  /** Letras nas colunas e números nas linhas (A1, B2…). */
  coordenadas: boolean;
  /** Objetos no mapa (porta, baú, árvore…). */
  objetos: TableProp[];
  /** colunas × linhas caracteres: '.' ou um TerrainId. */
  terreno: string;
  nevoa: boolean;
  /** colunas × linhas caracteres: '1' coberto, '0' revelado. */
  coberto: string;
  tokens: TableToken[];
}
export interface DiceRoll { id: string; quando: number; quem: string; expressao: string; detalhe: string; total: number; secreta: boolean }
export interface TableState {
  kind: 'existus-mesa'; version: 1;
  ativa: string;
  /** Cena que a janela dos jogadores mostra ('' = nenhuma). */
  exibida: string;
  cenas: TableScene[];
  rolagens: DiceRoll[];
}

export function tableId(prefix = 't'): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function newScene(nome = 'Nova cena', colunas = 24, linhas = 16): TableScene {
  const cells = colunas * linhas;
  return {
    id: tableId('c'), nome, colunas, linhas, metros: 1.5, grade: true, fundo: '',
    fundoRazao: 0, fundoLargura: colunas, fundoX: 0, fundoY: 0,
    gradeCor: 'auto', gradeOpacidade: 0.35, coordenadas: false, objetos: [],
    terreno: '.'.repeat(cells), nevoa: false, coberto: '1'.repeat(cells), tokens: []
  };
}
export function newTable(): TableState {
  const scene = newScene('Primeira cena');
  return { kind: 'existus-mesa', version: 1, ativa: scene.id, exibida: scene.id, cenas: [scene], rolagens: [] };
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number, fallback = ''): string => typeof v === 'string' ? v.slice(0, max) : fallback;
const int = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
const TERRAIN_CELL = new RegExp(`^[.${Object.keys(TERRAINS).join('')}]$`);
const tenths = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v * 10) / 10)) : fallback;
const id = (v: unknown): string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : tableId();
const color = (v: unknown): string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : TOKEN_COLORS[0];
const cells = (v: unknown, size: number, allowed: RegExp, fill: string): string => {
  const raw = typeof v === 'string' ? v : '';
  let out = '';
  for (let i = 0; i < size; i++) out += allowed.test(raw[i] ?? '') ? raw[i] : fill;
  return out;
};

function normalizeToken(raw: unknown, scene: { colunas: number; linhas: number }): TableToken | null {
  if (!object(raw)) return null;
  const tamanho = int(raw.tamanho, 1, 4, 1);
  const vida = object(raw.vida)
    ? { atual: int(raw.vida.atual, -9999, 99999, 0), maximo: int(raw.vida.maximo, 0, 99999, 0) }
    : null;
  return {
    sprite: typeof raw.sprite === 'string' && raw.sprite in CREATURES ? raw.sprite as CreatureId : '',
    avatar: normalizeAvatar(raw.avatar), classe: text(raw.classe, 60),
    id: id(raw.id), nome: text(raw.nome, 60, 'Token'), cor: color(raw.cor),
    tipo: typeof raw.tipo === 'string' && raw.tipo in TOKEN_KINDS ? raw.tipo as TokenKind : 'aliado',
    x: int(raw.x, 0, Math.max(0, scene.colunas - tamanho), 0), y: int(raw.y, 0, Math.max(0, scene.linhas - tamanho), 0), tamanho,
    oculto: raw.oculto === true, personagemId: typeof raw.personagemId === 'string' ? raw.personagemId.slice(0, 80) : '',
    vida, notas: text(raw.notas, 1000)
  };
}
export function normalizeScene(raw: unknown): TableScene | null {
  if (!object(raw)) return null;
  const colunas = int(raw.colunas, TABLE_SIZE_MIN, TABLE_SIZE_MAX, 24), linhas = int(raw.linhas, TABLE_SIZE_MIN, TABLE_SIZE_MAX, 16);
  const size = colunas * linhas;
  const fundo = typeof raw.fundo === 'string' && raw.fundo.length <= TABLE_BACKGROUND_LIMIT && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw.fundo) ? raw.fundo : '';
  const metros = typeof raw.metros === 'number' && Number.isFinite(raw.metros) ? Math.min(100, Math.max(0.1, Math.round(raw.metros * 10) / 10)) : 1.5;
  const scene: TableScene = {
    id: id(raw.id), nome: text(raw.nome, 60, 'Cena') || 'Cena', colunas, linhas, metros,
    grade: raw.grade !== false, fundo,
    fundoRazao: fundo && typeof raw.fundoRazao === 'number' && Number.isFinite(raw.fundoRazao) && raw.fundoRazao >= 0.1 && raw.fundoRazao <= 10 ? raw.fundoRazao : 0,
    fundoLargura: tenths(raw.fundoLargura, IMAGE_WIDTH_MIN, IMAGE_WIDTH_MAX, colunas),
    fundoX: tenths(raw.fundoX, -IMAGE_WIDTH_MAX, IMAGE_WIDTH_MAX, 0), fundoY: tenths(raw.fundoY, -IMAGE_WIDTH_MAX, IMAGE_WIDTH_MAX, 0),
    gradeCor: typeof raw.gradeCor === 'string' && raw.gradeCor in GRID_COLORS ? raw.gradeCor as GridColor : 'auto',
    gradeOpacidade: typeof raw.gradeOpacidade === 'number' && Number.isFinite(raw.gradeOpacidade) ? Math.min(1, Math.max(0.05, Math.round(raw.gradeOpacidade * 100) / 100)) : 0.35,
    coordenadas: raw.coordenadas === true, objetos: [],
    terreno: cells(raw.terreno, size, TERRAIN_CELL, '.'),
    nevoa: raw.nevoa === true, coberto: cells(raw.coberto, size, /^[01]$/, '1'), tokens: []
  };
  const taken = new Set<number>();
  for (const entry of Array.isArray(raw.objetos) ? raw.objetos.slice(0, PROP_LIMIT * 2) : []) {
    if (scene.objetos.length >= PROP_LIMIT || !object(entry) || typeof entry.tipo !== 'string' || !(entry.tipo in PROPS)) continue;
    // Fora do mapa ou com coordenada que não é número inteiro: descarta (não arrasta para a borda)
    const x = entry.x, y = entry.y;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= colunas || y >= linhas || taken.has(y * colunas + x)) continue;
    taken.add(y * colunas + x);
    scene.objetos.push({ id: id(entry.id), tipo: entry.tipo as PropId, x, y, rot: int(entry.rot, 0, 3, 0) as 0 | 1 | 2 | 3, oculto: entry.oculto === true });
  }
  const seen = new Set<string>();
  for (const entry of Array.isArray(raw.tokens) ? raw.tokens.slice(0, TABLE_TOKEN_LIMIT) : []) {
    const token = normalizeToken(entry, scene);
    if (!token || seen.has(token.id)) continue;
    seen.add(token.id); scene.tokens.push(token);
  }
  return scene;
}
export function normalizeTable(raw: unknown): TableState | null {
  if (!object(raw) || raw.kind !== 'existus-mesa' || raw.version !== 1 || !Array.isArray(raw.cenas)) return null;
  const cenas: TableScene[] = [];
  const seen = new Set<string>();
  for (const entry of raw.cenas.slice(0, TABLE_SCENE_LIMIT)) {
    const scene = normalizeScene(entry);
    if (!scene || seen.has(scene.id)) continue;
    seen.add(scene.id); cenas.push(scene);
  }
  if (!cenas.length) cenas.push(newScene('Primeira cena'));
  const ativa = typeof raw.ativa === 'string' && seen.has(raw.ativa) ? raw.ativa : cenas[0].id;
  const exibida = typeof raw.exibida === 'string' && seen.has(raw.exibida) ? raw.exibida : '';
  const rolagens: DiceRoll[] = [];
  for (const entry of Array.isArray(raw.rolagens) ? raw.rolagens.slice(-TABLE_ROLL_LIMIT) : []) {
    if (!object(entry) || typeof entry.total !== 'number' || !Number.isFinite(entry.total)) continue;
    rolagens.push({
      id: id(entry.id), quando: int(entry.quando, 0, Number.MAX_SAFE_INTEGER, 0), quem: text(entry.quem, 60),
      expressao: text(entry.expressao, 80), detalhe: text(entry.detalhe, 400), total: entry.total, secreta: entry.secreta === true
    });
  }
  return { kind: 'existus-mesa', version: 1, ativa, exibida, cenas, rolagens };
}
export function encodeTable(state: TableState): string | null {
  const json = JSON.stringify(state);
  return json.length <= TABLE_FILE_LIMIT ? json : null;
}

/** Muda o tamanho da cena mantendo o que já foi pintado no canto superior esquerdo. */
export function resizeScene(scene: TableScene, colunas: number, linhas: number): TableScene {
  colunas = int(colunas, TABLE_SIZE_MIN, TABLE_SIZE_MAX, scene.colunas);
  linhas = int(linhas, TABLE_SIZE_MIN, TABLE_SIZE_MAX, scene.linhas);
  const remap = (grid: string, fill: string): string => {
    let out = '';
    for (let y = 0; y < linhas; y++) for (let x = 0; x < colunas; x++) {
      out += x < scene.colunas && y < scene.linhas ? grid[y * scene.colunas + x] : fill;
    }
    return out;
  };
  return {
    ...scene, colunas, linhas,
    terreno: remap(scene.terreno, '.'), coberto: remap(scene.coberto, '1'),
    objetos: scene.objetos.filter(o => o.x < colunas && o.y < linhas),
    tokens: scene.tokens.map(t => ({ ...t, x: Math.min(t.x, Math.max(0, colunas - t.tamanho)), y: Math.min(t.y, Math.max(0, linhas - t.tamanho)) }))
  };
}
export function setCell(grid: string, colunas: number, x: number, y: number, value: string): string {
  const index = y * colunas + x;
  if (x < 0 || y < 0 || x >= colunas || index >= grid.length || grid[index] === value) return grid;
  return grid.slice(0, index) + value + grid.slice(index + 1);
}
/** Quadrados (diagonal conta 1) e metros entre dois pontos da grade. */
export function gridDistance(a: { x: number; y: number }, b: { x: number; y: number }, metros: number): { quadrados: number; metros: number } {
  const quadrados = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  return { quadrados, metros: Math.round(quadrados * metros * 10) / 10 };
}
/** Agrupa quadrados vizinhos iguais da mesma linha: bem menos retângulos para desenhar. */
export function cellRuns(grid: string, colunas: number, keep: (c: string) => boolean): { x: number; y: number; w: number; c: string }[] {
  const runs: { x: number; y: number; w: number; c: string }[] = [];
  const linhas = Math.floor(grid.length / colunas);
  for (let y = 0; y < linhas; y++) {
    let x = 0;
    while (x < colunas) {
      const c = grid[y * colunas + x];
      if (!keep(c)) { x++; continue; }
      let w = 1;
      while (x + w < colunas && grid[y * colunas + x + w] === c) w++;
      runs.push({ x, y, w, c }); x += w;
    }
  }
  return runs;
}

/**
 * O que a janela dos jogadores recebe: sem tokens nem objetos ocultos, notas do mestre ou rolagens
 * secretas. Com a névoa ligada, o que está sob ela também não vai: nem tokens, nem objetos, nem terreno.
 */
export function playerView(state: TableState): { scene: TableScene | null; rolagens: DiceRoll[] } {
  const scene = state.cenas.find(s => s.id === state.exibida) ?? null;
  return {
    // A vida de inimigos e objetos fica só com o mestre.
    scene: scene && {
      ...scene,
      tokens: scene.tokens.filter(t => !t.oculto && !(scene.nevoa && hiddenByFog(scene, t))).map(t => t.tipo === 'inimigo' || t.tipo === 'objeto' ? { ...t, vida: null, notas: '' } : { ...t, notas: '' }),
      objetos: scene.objetos.filter(o => !o.oculto && !(scene.nevoa && scene.coberto[o.y * scene.colunas + o.x] === '1')),
      terreno: scene.nevoa ? scene.terreno.split('').map((c, i) => scene.coberto[i] === '1' ? '.' : c).join('') : scene.terreno
    },
    rolagens: state.rolagens.filter(r => !r.secreta)
  };
}
/** Token totalmente sob a névoa. */
export function hiddenByFog(scene: TableScene, token: TableToken): boolean {
  for (let y = token.y; y < token.y + token.tamanho; y++) for (let x = token.x; x < token.x + token.tamanho; x++) {
    if (scene.coberto[y * scene.colunas + x] === '0') return false;
  }
  return true;
}

export type DiceReading = { ok: true; expressao: string; detalhe: string; total: number } | { ok: false; problem: string };
/** Lê e rola "2d6+3", "d20", "1d12 + 1d4 - 1", "4dF" não; até 100 dados de até 1000 faces. */
export function rollDice(input: string, random: () => number = Math.random): DiceReading {
  const expr = input.toLowerCase().replace(/\s+/g, '');
  if (!expr) return { ok: false, problem: 'Escreva uma rolagem, como 1d20 ou 2d6+3.' };
  if (expr.length > 80 || !/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(expr)) {
    return { ok: false, problem: 'Rolagem não reconhecida. Use dados e números, como 1d20+2 ou 2d6-1d4.' };
  }
  const terms = expr.match(/[+-]?(\d*d\d+|\d+)/g)!;
  let total = 0, dice = 0;
  const parts: string[] = [];
  for (const term of terms) {
    const sign = term.startsWith('-') ? -1 : 1;
    const body = term.replace(/^[+-]/, '');
    const op = sign < 0 ? '−' : '+';
    if (body.includes('d')) {
      const [countText, facesText] = body.split('d');
      const count = countText ? Number(countText) : 1, faces = Number(facesText);
      if (count < 1 || faces < 2) return { ok: false, problem: 'Cada dado precisa de pelo menos 1 dado e 2 faces.' };
      if (faces > 1000) return { ok: false, problem: 'Dados de até 1000 faces.' };
      dice += count;
      if (dice > 100) return { ok: false, problem: 'No máximo 100 dados por rolagem.' };
      const results = Array.from({ length: count }, () => 1 + Math.floor(random() * faces));
      const sum = results.reduce((a, b) => a + b, 0);
      total += sign * sum;
      parts.push(`${op} ${count}d${faces} [${results.join(', ')}]`);
    } else {
      const value = Number(body);
      total += sign * value;
      parts.push(`${op} ${value}`);
    }
  }
  if (!dice) return { ok: false, problem: 'Inclua pelo menos um dado, como 1d20.' };
  const normalized = terms.map((t, i) => i === 0 ? t.replace(/^\+/, '') : t).join('').replace(/(^|[+-])d/g, '$11d');
  return { ok: true, expressao: normalized, detalhe: parts.join(' ').replace(/^\+ /, ''), total };
}

// ───────── Criação do grid ─────────

export const SCENE_SIZES = [
  { id: 'pequena', nome: 'Pequena · 16 × 12', colunas: 16, linhas: 12 },
  { id: 'media', nome: 'Média · 24 × 16', colunas: 24, linhas: 16 },
  { id: 'grande', nome: 'Grande · 36 × 24', colunas: 36, linhas: 24 },
  { id: 'enorme', nome: 'Enorme · 60 × 40', colunas: 60, linhas: 40 }
] as const;
export const SCENE_TEMPLATES = {
  vazio: 'Vazio',
  sala: 'Sala murada',
  salas: 'Quatro salas com portas',
  arena: 'Arena circular'
} as const;
export type SceneTemplateId = keyof typeof SCENE_TEMPLATES;
export interface Cell { x: number; y: number }

/** Terreno inicial de cada modelo (só paredes; o resto o mestre pinta). */
export function templateTerrain(template: SceneTemplateId, colunas: number, linhas: number): string {
  let grid = '.'.repeat(colunas * linhas);
  const wall = (cellsList: Cell[]): void => { grid = paintCells(grid, colunas, linhas, cellsList, 'p'); };
  if (template === 'vazio') return grid;
  if (template === 'sala') { wall(rectCells({ x: 0, y: 0 }, { x: colunas - 1, y: linhas - 1 }, false)); return grid; }
  if (template === 'salas') {
    wall(rectCells({ x: 0, y: 0 }, { x: colunas - 1, y: linhas - 1 }, false));
    const mx = Math.floor(colunas / 2), my = Math.floor(linhas / 2);
    wall(lineCells({ x: mx, y: 0 }, { x: mx, y: linhas - 1 }));
    wall(lineCells({ x: 0, y: my }, { x: colunas - 1, y: my }));
    // Uma porta de 2 quadrados no meio de cada trecho
    const doors: Cell[] = [];
    for (const [cx, cy] of [[Math.floor(mx / 2), my], [mx + Math.floor((colunas - mx) / 2), my]] as const) doors.push({ x: cx, y: cy }, { x: cx + 1, y: cy });
    for (const [cx, cy] of [[mx, Math.floor(my / 2)], [mx, my + Math.floor((linhas - my) / 2)]] as const) doors.push({ x: cx, y: cy }, { x: cx, y: cy + 1 });
    grid = paintCells(grid, colunas, linhas, doors, '.');
    return grid;
  }
  // arena: anel de paredes tocando as bordas, com uma abertura embaixo
  const rx = (colunas - 1) / 2, ry = (linhas - 1) / 2;
  const ring: Cell[] = [];
  for (let y = 0; y < linhas; y++) for (let x = 0; x < colunas; x++) {
    const d = Math.hypot((x - rx) / (rx + 0.5), (y - ry) / (ry + 0.5));
    if (d <= 1 && d > 1 - Math.max(1.2 / (rx + 0.5), 1.2 / (ry + 0.5))) ring.push({ x, y });
  }
  wall(ring);
  const gate = Math.floor(colunas / 2);
  grid = paintCells(grid, colunas, linhas, [{ x: gate, y: linhas - 1 }, { x: gate - 1, y: linhas - 1 }, { x: gate, y: linhas - 2 }, { x: gate - 1, y: linhas - 2 }], '.');
  return grid;
}

/** Objetos iniciais de cada modelo: portas nas passagens, tochas na sala e colunas na arena. */
export function templateProps(template: SceneTemplateId, colunas: number, linhas: number): TableProp[] {
  const props: TableProp[] = [];
  const add = (tipo: PropId, x: number, y: number, rot: 0 | 1 | 2 | 3 = 0): void => {
    if (x >= 0 && y >= 0 && x < colunas && y < linhas) props.push({ id: tableId('o'), tipo, x, y, rot, oculto: false });
  };
  if (template === 'sala') { add('tocha', 1, 1); add('tocha', colunas - 2, 1); }
  if (template === 'salas') {
    const mx = Math.floor(colunas / 2), my = Math.floor(linhas / 2);
    for (const cx of [Math.floor(mx / 2), mx + Math.floor((colunas - mx) / 2)]) { add('porta', cx, my, 1); add('porta', cx + 1, my, 1); }
    for (const cy of [Math.floor(my / 2), my + Math.floor((linhas - my) / 2)]) { add('porta', mx, cy); add('porta', mx, cy + 1); }
  }
  if (template === 'arena') {
    for (const fx of [0.3, 0.7]) for (const fy of [0.3, 0.7]) add('coluna', Math.round((colunas - 1) * fx), Math.round((linhas - 1) * fy));
  }
  return props;
}

export interface SceneOptions {
  nome?: string; colunas?: number; linhas?: number; metros?: number; modelo?: SceneTemplateId;
  /** Imagem já reduzida e a proporção (largura ÷ altura) dela. */
  fundo?: string; razao?: number;
  /** Com imagem: quantos quadrados cabem na largura dela; a altura da grade vem da proporção. */
  quadradosNaLargura?: number;
}
/** Cena nova com tamanho, modelo e, se houver, imagem calibrada para os quadrados não deformarem. */
export function createScene(options: SceneOptions = {}): TableScene {
  const fundo = options.fundo ?? '';
  const razao = fundo && options.razao && options.razao >= 0.1 && options.razao <= 10 ? options.razao : 0;
  let colunas = int(options.colunas, TABLE_SIZE_MIN, TABLE_SIZE_MAX, 24), linhas = int(options.linhas, TABLE_SIZE_MIN, TABLE_SIZE_MAX, 16);
  if (razao) {
    colunas = int(options.quadradosNaLargura ?? colunas, TABLE_SIZE_MIN, TABLE_SIZE_MAX, colunas);
    linhas = int(colunas / razao, TABLE_SIZE_MIN, TABLE_SIZE_MAX, linhas);
  }
  const scene = newScene(text(options.nome, 60, 'Nova cena').trim() || 'Nova cena', colunas, linhas);
  if (typeof options.metros === 'number' && Number.isFinite(options.metros)) scene.metros = Math.min(100, Math.max(0.1, Math.round(options.metros * 10) / 10));
  const model: SceneTemplateId = options.modelo && options.modelo in SCENE_TEMPLATES ? options.modelo : 'vazio';
  scene.terreno = templateTerrain(model, colunas, linhas);
  scene.objetos = templateProps(model, colunas, linhas);
  if (fundo) { scene.fundo = fundo; scene.fundoRazao = razao; scene.fundoLargura = colunas; }
  return scene;
}
/**
 * Ajusta a grade até o fim da imagem (largura em quadrados, altura pela proporção; o deslocamento
 * da imagem entra na conta).
 * Pinturas e tokens ficam onde estavam (os que saírem do mapa são trazidos para dentro).
 */
export function fitGridToImage(scene: TableScene): TableScene {
  if (!scene.fundo || !scene.fundoRazao) return scene;
  const colunas = int(scene.fundoX + scene.fundoLargura, TABLE_SIZE_MIN, TABLE_SIZE_MAX, scene.colunas);
  const linhas = int(scene.fundoY + scene.fundoLargura / scene.fundoRazao, TABLE_SIZE_MIN, TABLE_SIZE_MAX, scene.linhas);
  return resizeScene(scene, colunas, linhas);
}
/** Altura da imagem em quadrados (ou a grade toda, nas cenas antigas esticadas). */
export function imageBox(scene: TableScene): { x: number; y: number; w: number; h: number } {
  if (!scene.fundoRazao) return { x: 0, y: 0, w: scene.colunas, h: scene.linhas };
  return { x: scene.fundoX, y: scene.fundoY, w: scene.fundoLargura, h: scene.fundoLargura / scene.fundoRazao };
}

// ───────── Pincéis e formas (valem para o terreno e para a névoa) ─────────

/** Quadrados de um pincel de n × n, com o quadrado clicado no meio (ou um pouco acima à esquerda quando n é par). */
export function brushCells(center: Cell, size: number): Cell[] {
  const n = Math.min(8, Math.max(1, Math.round(size)));
  const start = Math.floor((n - 1) / 2);
  const out: Cell[] = [];
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) out.push({ x: center.x - start + dx, y: center.y - start + dy });
  return out;
}
/** Linha reta entre dois quadrados (Bresenham), sem buracos nas diagonais. */
export function lineCells(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = [];
  let x = a.x, y = a.y;
  const dx = Math.abs(b.x - a.x), dy = -Math.abs(b.y - a.y), sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
  let error = dx + dy;
  for (let guard = 0; guard < 10_000; guard++) {
    out.push({ x, y });
    if (x === b.x && y === b.y) break;
    const doubled = 2 * error;
    if (doubled >= dy) { error += dy; x += sx; }
    if (doubled <= dx) { error += dx; y += sy; }
  }
  return out;
}
/** Retângulo entre dois cantos: cheio ou só o contorno. */
export function rectCells(a: Cell, b: Cell, filled: boolean): Cell[] {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  const out: Cell[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (filled || x === x0 || x === x1 || y === y0 || y === y1) out.push({ x, y });
  }
  return out;
}
/** Pinta os quadrados que estão dentro da grade; devolve a mesma cadeia se nada mudou. */
export function paintCells(grid: string, colunas: number, linhas: number, list: readonly Cell[], value: string): string {
  const chars = grid.split('');
  let changed = false;
  for (const { x, y } of list) {
    if (x < 0 || y < 0 || x >= colunas || y >= linhas) continue;
    const index = y * colunas + x;
    if (chars[index] !== value) { chars[index] = value; changed = true; }
  }
  return changed ? chars.join('') : grid;
}
/** Balde: troca a região de quadrados iguais (4 vizinhos) em que o quadrado clicado está. */
export function floodFill(grid: string, colunas: number, linhas: number, from: Cell, value: string): string {
  if (from.x < 0 || from.y < 0 || from.x >= colunas || from.y >= linhas) return grid;
  const target = grid[from.y * colunas + from.x];
  if (target === value) return grid;
  const chars = grid.split('');
  const stack = [from.y * colunas + from.x];
  while (stack.length) {
    const index = stack.pop()!;
    if (chars[index] !== target) continue;
    chars[index] = value;
    const x = index % colunas, y = Math.floor(index / colunas);
    if (x > 0) stack.push(index - 1);
    if (x < colunas - 1) stack.push(index + 1);
    if (y > 0) stack.push(index - colunas);
    if (y < linhas - 1) stack.push(index + colunas);
  }
  return chars.join('');
}
/** Nome do quadrado como nos mapas de papel: coluna em letras, linha em número (A1, B2… AA10). */
export function cellName(x: number, y: number): string {
  let letters = '', n = x;
  do { letters = String.fromCharCode(65 + (n % 26)) + letters; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return `${letters}${y + 1}`;
}

// ───────── Desfazer e refazer ─────────

export interface History<T> { past: T[]; future: T[] }
export const HISTORY_LIMIT = 40;
export const newHistory = <T>(): History<T> => ({ past: [], future: [] });
/** Guarda o estado de antes de uma mudança; uma mudança nova apaga o "refazer". */
export function recordHistory<T>(history: History<T>, before: T): History<T> {
  return { past: [...history.past, before].slice(-HISTORY_LIMIT), future: [] };
}
export function undoHistory<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  const value = history.past[history.past.length - 1];
  return value === undefined ? null : { value, history: { past: history.past.slice(0, -1), future: [...history.future, current] } };
}
export function redoHistory<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  const value = history.future[history.future.length - 1];
  return value === undefined ? null : { value, history: { past: [...history.past, current].slice(-HISTORY_LIMIT), future: history.future.slice(0, -1) } };
}

// ───────── Objetos no mapa ─────────

export function propAt(scene: TableScene, cell: Cell): TableProp | undefined {
  return scene.objetos.find(o => o.x === cell.x && o.y === cell.y);
}
/**
 * Põe um objeto no quadrado (troca o que já estava lá). Com `girar`, tocar num objeto do mesmo tipo
 * o gira um quarto de volta em vez de recolocá-lo.
 */
export function placeProp(scene: TableScene, tipo: PropId, cell: Cell, options: { rot?: 0 | 1 | 2 | 3; oculto?: boolean; girar?: boolean } = {}): TableScene {
  if (!(tipo in PROPS) || cell.x < 0 || cell.y < 0 || cell.x >= scene.colunas || cell.y >= scene.linhas) return scene;
  const here = propAt(scene, cell);
  const rot = options.rot ?? 0, oculto = options.oculto === true;
  if (here && here.tipo === tipo) {
    if (options.girar) return { ...scene, objetos: scene.objetos.map(o => o === here ? { ...o, rot: ((o.rot + 1) % 4) as 0 | 1 | 2 | 3 } : o) };
    if (here.rot === rot && here.oculto === oculto) return scene;
  }
  if (!here && scene.objetos.length >= PROP_LIMIT) return scene;
  const next: TableProp = { id: here?.id ?? tableId('o'), tipo, x: cell.x, y: cell.y, rot, oculto };
  return { ...scene, objetos: here ? scene.objetos.map(o => o === here ? next : o) : [...scene.objetos, next] };
}
export function removePropAt(scene: TableScene, cell: Cell): TableScene {
  const here = propAt(scene, cell);
  return here ? { ...scene, objetos: scene.objetos.filter(o => o !== here) } : scene;
}
