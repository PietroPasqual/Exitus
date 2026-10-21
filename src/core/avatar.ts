/**
 * Mini avatar em pixel art do personagem: a roupa vem da classe e o jogador escolhe
 * só o tom de pele, a cor dos olhos e a cor do cabelo (sempre de uma paleta fixa).
 */
export const SKIN_TONES = ['#f6d7bd', '#eec39a', '#d9a066', '#b97a4a', '#8d5a36', '#5e3a22', '#c9d6a3', '#a9b8d8'] as const;
export const EYE_COLORS = ['#3b2414', '#6b4420', '#3f7d3a', '#2f6fa8', '#5a6478', '#8e44ad', '#c0392b', '#e0a83a'] as const;
export const HAIR_COLORS = ['#1c1410', '#4a2d1a', '#8a5a2b', '#d9a441', '#f3e3a3', '#b8442a', '#e8e2d0', '#7a7f8c', '#3b5bb5', '#a964e8'] as const;
export const AVATAR_LABELS = {
  pele: ['Clara', 'Bege', 'Morena clara', 'Morena', 'Escura', 'Retinta', 'Esverdeada', 'Azulada'],
  olhos: ['Castanho escuro', 'Castanho', 'Verde', 'Azul', 'Cinza', 'Violeta', 'Vermelho', 'Âmbar'],
  cabelo: ['Preto', 'Castanho escuro', 'Castanho', 'Loiro', 'Loiro claro', 'Ruivo', 'Branco', 'Grisalho', 'Azul', 'Violeta']
} as const;

export interface Avatar { pele: string; olhos: string; cabelo: string }
export type AvatarPart = keyof Avatar;
export const AVATAR_PALETTES: Record<AvatarPart, readonly string[]> = { pele: SKIN_TONES, olhos: EYE_COLORS, cabelo: HAIR_COLORS };

export function newAvatar(): Avatar {
  return { pele: SKIN_TONES[1], olhos: EYE_COLORS[1], cabelo: HAIR_COLORS[1] };
}
/** Cada cor precisa ser uma das paletas; o que não for volta ao padrão. */
export function normalizeAvatar(raw: unknown): Avatar | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const result = newAvatar();
  for (const part of Object.keys(AVATAR_PALETTES) as AvatarPart[]) {
    const color = typeof value[part] === 'string' ? (value[part] as string).toLowerCase() : '';
    if (AVATAR_PALETTES[part].includes(color)) result[part] = color;
  }
  return result;
}

/** Roupas: O principal, o sombra, A detalhe, B segundo detalhe. */
export const OUTFITS = {
  aventureiro: { nome: 'Aventureiro', O: '#8a5a2b', o: '#6b4420', A: '#d9b26b', B: '#4a2d1a' },
  guerreiro: { nome: 'Armadura', O: '#9aa3b5', o: '#6c7486', A: '#b23a2e', B: '#e8c35a' },
  mago: { nome: 'Manto arcano', O: '#3b5bb5', o: '#2a4185', A: '#e8c35a', B: '#2a4185' },
  arqueiro: { nome: 'Capuz de caçador', O: '#3f7d3a', o: '#2c5a29', A: '#8a5a2b', B: '#d9b26b' },
  ladino: { nome: 'Capa das sombras', O: '#3a3346', o: '#26212f', A: '#8a8296', B: '#b23a2e' },
  druida: { nome: 'Veste da natureza', O: '#6b4a2b', o: '#4d341e', A: '#4cc06a', B: '#2c5a29' },
  clerigo: { nome: 'Hábito sagrado', O: '#e8e2d0', o: '#bdb5a0', A: '#d4a853', B: '#bdb5a0' },
  bardo: { nome: 'Gibão de artista', O: '#8e44ad', o: '#6c3483', A: '#f1c40f', B: '#e8e2d0' },
  monge: { nome: 'Kimono', O: '#e67e22', o: '#b8621a', A: '#1c1410', B: '#f6d7bd' },
  artesao: { nome: 'Avental de ofício', O: '#5a6478', o: '#424a5a', A: '#8a5a2b', B: '#d9b26b' }
} as const;
export type OutfitId = keyof typeof OUTFITS;

/** Palavra da classe → roupa (a primeira que bater vale; as mais específicas vêm antes). */
const CLASS_OUTFITS: [string, OutfitId][] = [
  ['cacador de demonios', 'guerreiro'], ['invocador espiritual', 'druida'], ['dragon slayer', 'guerreiro'],
  ['guerreiro', 'guerreiro'], ['soldado', 'guerreiro'], ['cavaleiro', 'guerreiro'], ['escudeiro', 'guerreiro'], ['lanceiro', 'guerreiro'],
  ['espadachim', 'guerreiro'], ['gladiador', 'guerreiro'], ['barbaro', 'guerreiro'], ['berserker', 'guerreiro'], ['mercenario', 'guerreiro'],
  ['paladino', 'guerreiro'], ['executor', 'guerreiro'], ['heroi', 'guerreiro'], ['lider', 'guerreiro'], ['quebra mundos', 'guerreiro'], ['asura', 'guerreiro'],
  ['mago', 'mago'], ['feiticeiro', 'mago'], ['bruxo', 'mago'], ['ocultista', 'mago'], ['invocador', 'mago'], ['vidente', 'mago'], ['cartomante', 'mago'],
  ['alquimista', 'mago'], ['dobrador', 'mago'], ['vozmander', 'mago'], ['artefato', 'mago'], ['rei demonio', 'mago'], ['pecado', 'mago'],
  ['masmorra', 'mago'], ['pesquisador', 'mago'], ['bibliotecario', 'mago'], ['escriba', 'mago'], ['cientista', 'mago'],
  ['arqueiro', 'arqueiro'], ['cacador', 'arqueiro'], ['besteiro', 'arqueiro'], ['atirador', 'arqueiro'], ['batedor', 'arqueiro'], ['arremessador', 'arqueiro'],
  ['armadilheiro', 'arqueiro'], ['cartografo', 'arqueiro'], ['domador', 'arqueiro'], ['lenhador', 'arqueiro'], ['pescador', 'arqueiro'], ['barqueiro', 'arqueiro'],
  ['ladino', 'ladino'], ['ladrao', 'ladino'], ['espiao', 'ladino'], ['assassino', 'ladino'], ['traficante', 'ladino'], ['provocador', 'ladino'], ['investigador', 'ladino'],
  ['druida', 'druida'], ['xama', 'druida'], ['herbalista', 'druida'],
  ['clerigo', 'clerigo'], ['sacerdote', 'clerigo'], ['devoto', 'clerigo'], ['santo', 'clerigo'], ['santidade', 'clerigo'], ['sol', 'clerigo'],
  ['curandeiro', 'clerigo'], ['medico', 'clerigo'], ['fonteine', 'clerigo'],
  ['bardo', 'bardo'], ['musico', 'bardo'], ['artista', 'bardo'], ['palhaco', 'bardo'], ['pintor', 'bardo'], ['escultor', 'bardo'], ['lutie', 'bardo'],
  ['nobre', 'bardo'], ['principe', 'bardo'], ['pagma', 'bardo'], ['mercador', 'bardo'], ['avaliador', 'bardo'], ['joalheiro', 'bardo'],
  ['monge', 'monge'], ['lutador', 'monge'],
  ['ferreiro', 'artesao'], ['mineiro', 'artesao'], ['construtor', 'artesao'], ['artesao', 'artesao'], ['trabalhador', 'artesao'], ['relojoeiro', 'artesao'],
  ['cozinheiro', 'artesao'], ['zelador', 'artesao'], ['atendente', 'artesao'], ['entregador', 'artesao'], ['cortador de gelo', 'artesao']
];
const plain = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function outfitForClass(className: string): OutfitId {
  const name = plain(className);
  if (!name.trim()) return 'aventureiro';
  return CLASS_OUTFITS.find(([word]) => name.includes(word))?.[1] ?? 'aventureiro';
}

/*
 * Desenho 16×16. Letras: H cabelo, h sombra do cabelo, S pele, s sombra da pele, E olhos,
 * O/o/A/B cores da roupa, K contorno. '.' é transparente; nas camadas da roupa, '.' mantém a base.
 */
const BASE = [
  '................',
  '.....KKKKKK.....',
  '....KHHHHHHK....',
  '...KHHHHHHHHK...',
  '...KHHSSSSHHK...',
  '...KHSSSSSSHK...',
  '...KHSESSESHK...',
  '...KHSSSSSSHK...',
  '...KhSSssSShK...',
  '...KhhSSSShhK...',
  '....Kh.SS.hK....',
  '.......ss.......',
  '................',
  '................',
  '................',
  '................'
];
const BODY: Record<OutfitId, string[]> = {
  aventureiro: ['...KoOAAAAOoK...', '..KoOOOAAOOOoK..', '..KoOOOOOOOOoK..', '..KoOBBBBBBOoK..'],
  guerreiro: ['..KBOOOAAOOOBK..', '.KBBOOOAAOOOBBK.', '..KoOOOAAOOOoK..', '..KoOOOAAOOOoK..'],
  mago: ['...KOOOAAOOOK...', '..KoOOOAAOOOoK..', '..KoOOAOOAOOoK..', '..KoOOOOOOOOoK..'],
  arqueiro: ['...KOOOOOOAOK...', '..KoOOOOOAOOoK..', '..KoOOOOAOOOoK..', '..KoOOOAOOOOoK..'],
  ladino: ['...KoOOOOOOoK...', '..KoOOOAAOOOoK..', '..KoOOOOOOOOoK..', '..KoOBBOOBBOoK..'],
  druida: ['...KOOOAAOOOK...', '..KoOOOOOOOOoK..', '..KoOOBBBBOOoK..', '..KoOOOOOOOOoK..'],
  clerigo: ['...KOOOOOOOOK...', '..KoOOOAAOOOoK..', '..KoOAAAAAAOoK..', '..KoOOOAAOOOoK..'],
  bardo: ['...KOOBBBBOOK...', '..KoOOOBBOOOoK..', '..KoOAOOOOAOoK..', '..KoOOOOOOOOoK..'],
  monge: ['...KOOBOOBOOK...', '..KoOOOBBOOOoK..', '..KoAAAAAAAAoK..', '..KoOOOOOOOOoK..'],
  artesao: ['...KOAOOOOAOK...', '..KoOABBBBAOoK..', '..KoOOBBBBOOoK..', '..KoOOBBBBOOoK..']
};
/** Chapéus e capuzes por cima do cabelo (linhas 0 a 9). */
const HEAD: Partial<Record<OutfitId, string[]>> = {
  mago: ['........KK......', '.......KOOK.....', '......KOOOoK....', '..KAAAAAAAAAAK..'],
  arqueiro: ['.....KKKKKK.....', '....KoOOOOoK....', '...KoOOOOOOoK...', '...KoOHHHHOoK...', '...KoHSSSSHoK...', '...KoSSSSSSoK...', '...KoSESSESoK...', '...KoSSSSSSoK...', '...KoSSssSSoK...', '...KoOSSSSOoK...'],
  ladino: ['.....KKKKKK.....', '....KoOOOOoK....', '...KoOOOOOOoK...', '...KoOHHHHOoK...', '...KoHSSSSHoK...', '...KoSSSSSSoK...', '...KoSESSESoK...', '...KoAAAAAAoK...', '...KoAAAAAAoK...', '...KoOAAAAOoK...'],
  druida: ['....A..A..A.....', '....KAAAAAAK....'],
  clerigo: [],
  bardo: ['..........AA....', '.....KKKKKKA....', '....KOOOOOOK....', '..KOOOOOOOOOOK..'],
  monge: ['................', '.....KKKKKK.....', '....KHHHHHHK....', '...KAAAAAAAAK...']
};

const shade = (hex: string, amount: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number): number => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * amount)));
  return `#${[16, 8, 0].map(s => channel(s).toString(16).padStart(2, '0')).join('')}`;
};

/** Pixels do avatar ({x, y, cor}) prontos para desenhar em qualquer tamanho. */
export function avatarPixels(avatar: Avatar, outfit: OutfitId): { x: number; y: number; cor: string }[] {
  const grid = BASE.map(row => row.split(''));
  const overlay = (rows: string[], top: number): void => rows.forEach((row, dy) => row.split('').forEach((c, x) => { if (c !== '.') grid[top + dy][x] = c; }));
  overlay(BODY[outfit], 12);
  overlay(HEAD[outfit] ?? [], 0);
  const colors = OUTFITS[outfit];
  const palette: Record<string, string> = {
    H: avatar.cabelo, h: shade(avatar.cabelo, 0.72), S: avatar.pele, s: shade(avatar.pele, 0.8), E: avatar.olhos,
    O: colors.O, o: colors.o, A: colors.A, B: colors.B, K: '#140f1c'
  };
  const pixels: { x: number; y: number; cor: string }[] = [];
  grid.forEach((row, y) => row.forEach((c, x) => { if (palette[c]) pixels.push({ x, y, cor: palette[c] }); }));
  return pixels;
}
