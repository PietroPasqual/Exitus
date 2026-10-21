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

/** Um caractere por quadrado: '.' vazio e as letras abaixo. */
export const TERRAINS = {
  p: { nome: 'Parede', cor: '#8a8296' },
  a: { nome: 'Água', cor: '#2f6fa8' },
  v: { nome: 'Vegetação', cor: '#3f7d3a' },
  d: { nome: 'Terreno difícil', cor: '#8a6a3a' },
  l: { nome: 'Perigo', cor: '#b23a2e' }
} as const;
export type TerrainId = keyof typeof TERRAINS;

export const TOKEN_KINDS = { jogador: 'Personagem', aliado: 'Aliado', inimigo: 'Inimigo', objeto: 'Objeto' } as const;
export type TokenKind = keyof typeof TOKEN_KINDS;
export const TOKEN_COLORS = ['#d4a853', '#4cc3ff', '#4cc06a', '#f2655c', '#a964e8', '#ec8c3c', '#e8e2d0', '#5a6478'] as const;

export interface TableToken {
  id: string; nome: string; cor: string; tipo: TokenKind;
  x: number; y: number; tamanho: number;
  /** Só o mestre vê. */
  oculto: boolean;
  /** Ficha ligada: a vida vem dela. */
  personagemId: string;
  vida: { atual: number; maximo: number } | null;
  notas: string;
}
export interface TableScene {
  id: string; nome: string; colunas: number; linhas: number;
  metros: number; grade: boolean; fundo: string;
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
    terreno: cells(raw.terreno, size, /^[.padvl]$/, '.'),
    nevoa: raw.nevoa === true, coberto: cells(raw.coberto, size, /^[01]$/, '1'), tokens: []
  };
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

/** O que a janela dos jogadores recebe: sem tokens ocultos nem rolagens secretas. */
export function playerView(state: TableState): { scene: TableScene | null; rolagens: DiceRoll[] } {
  const scene = state.cenas.find(s => s.id === state.exibida) ?? null;
  return {
    scene: scene && { ...scene, tokens: scene.tokens.filter(t => !t.oculto && !(scene.nevoa && hiddenByFog(scene, t))) },
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
