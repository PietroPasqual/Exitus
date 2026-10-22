/**
 * Pixel art da Mesa: texturas de terreno, objetos para o mapa, retratos de criatura e o retrato
 * do avatar. Tudo é desenhado aqui em código (16 × 16, sem arquivos) e entregue como PNG em
 * texto (`data:`), que o navegador guarda em cache. As cores seguem a paleta escura do site.
 */
import { pngDataUri } from '../core/png';
import { avatarPixels, outfitForClass, type Avatar } from '../core/avatar';
import { CREATURES, PROPS, TERRAINS, type CreatureId, type PropId, type TerrainId } from '../core/game-table';

export const SPRITE_SIZE = 16;
const INK = '#1a1020';

/** Figura de 16 × 16 pixels com um pequeno kit de desenho. */
export class Pix {
  readonly data = new Uint8Array(SPRITE_SIZE * SPRITE_SIZE * 4);
  set(x: number, y: number, color: string | null): this {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= SPRITE_SIZE || y >= SPRITE_SIZE) return this;
    const at = (y * SPRITE_SIZE + x) * 4;
    if (color === null) { this.data.fill(0, at, at + 4); return this; }
    const hex = color.slice(1);
    this.data[at] = parseInt(hex.slice(0, 2), 16);
    this.data[at + 1] = parseInt(hex.slice(2, 4), 16);
    this.data[at + 2] = parseInt(hex.slice(4, 6), 16);
    this.data[at + 3] = hex.length > 6 ? parseInt(hex.slice(6, 8), 16) : 255;
    return this;
  }
  filled(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < SPRITE_SIZE && y < SPRITE_SIZE && this.data[(y * SPRITE_SIZE + x) * 4 + 3] > 0;
  }
  rect(x: number, y: number, w: number, h: number, color: string | null): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, color: string | null): this {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) this.set(Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps), color);
    return this;
  }
  /** Elipse cheia: o centro é medido em pixels, com o quadrado (x, y) centrado em (x + .5, y + .5). */
  disc(cx: number, cy: number, rx: number, ry: number, color: string | null): this {
    for (let y = 0; y < SPRITE_SIZE; y++) for (let x = 0; x < SPRITE_SIZE; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.set(x, y, color);
    }
    return this;
  }
  /** Contorno de 1 pixel em volta do que já foi desenhado. */
  outline(color: string = INK): this {
    const edge: [number, number][] = [];
    for (let y = 0; y < SPRITE_SIZE; y++) for (let x = 0; x < SPRITE_SIZE; x++) {
      if (this.filled(x, y)) continue;
      if (this.filled(x - 1, y) || this.filled(x + 1, y) || this.filled(x, y - 1) || this.filled(x, y + 1)) edge.push([x, y]);
    }
    for (const [x, y] of edge) this.set(x, y, color);
    return this;
  }
  uri(): string { return pngDataUri(SPRITE_SIZE, SPRITE_SIZE, this.data); }
}

/** Sorteio repetível: a mesma textura sai igual em qualquer aparelho. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const flat = (color: string): Pix => new Pix().rect(0, 0, SPRITE_SIZE, SPRITE_SIZE, color);
/** Espalha pixels soltos de uma cor (n vezes). */
function sprinkle(p: Pix, random: () => number, color: string, n: number): void {
  for (let i = 0; i < n; i++) p.set(Math.floor(random() * SPRITE_SIZE), Math.floor(random() * SPRITE_SIZE), color);
}
const wrap = (n: number): number => ((n % SPRITE_SIZE) + SPRITE_SIZE) % SPRITE_SIZE;

/** Tijolos ou lajes: cada um com um tom, luz em cima à esquerda e argamassa embaixo à direita. */
function bricks(p: Pix, bw: number, bh: number, shades: string[], mortar: string, light: string, random: () => number): void {
  for (let row = 0; row * bh < SPRITE_SIZE; row++) {
    const y0 = row * bh, shift = row % 2 ? Math.floor(bw / 2) : 0;
    for (let x0 = -shift; x0 < SPRITE_SIZE; x0 += bw) {
      p.rect(x0, y0, bw, bh, shades[Math.floor(random() * shades.length)]);
      p.rect(x0, y0, bw, 1, light);
      p.rect(x0 + bw - 1, y0, 1, bh, mortar);
      p.rect(x0, y0 + bh - 1, bw, 1, mortar);
    }
  }
}

type TileId = TerrainId | 'pf' | 'nevoa';
const TILES: Record<TileId, () => Pix> = {
  // Topo da parede: lajes de pedra clara (vista de cima)
  p() {
    const random = seeded(11), p = flat('#8c86a3');
    bricks(p, 8, 8, ['#8c86a3', '#948ead', '#847e9a'], '#4a465c', '#aaa4c2', random);
    sprinkle(p, random, '#7a748f', 14);
    return p;
  },
  // Frente da parede: tijolos mais escuros, com sombra na base
  pf() {
    const random = seeded(12), p = flat('#5a5468');
    bricks(p, 8, 4, ['#5a5468', '#625c72', '#524c60'], '#2c283a', '#7a748e', random);
    p.rect(0, 14, SPRITE_SIZE, 2, '#2c283a');
    sprinkle(p, random, '#46405a', 10);
    return p;
  },
  e() {
    const random = seeded(21), p = flat('#5a566a');
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const shade = ['#5a566a', '#625e74', '#524e62'][Math.floor(random() * 3)];
      p.rect(tx * 8, ty * 8, 8, 8, shade);
      p.rect(tx * 8 + 1, ty * 8 + 1, 6, 1, '#6e6a82');
      p.rect(tx * 8, ty * 8, 8, 1, '#3a3648');
      p.rect(tx * 8, ty * 8, 1, 8, '#3a3648');
    }
    sprinkle(p, random, '#4a465a', 10);
    p.line(10, 2, 13, 5, '#3f3b50');
    return p;
  },
  m() {
    const random = seeded(31), p = flat('#8a5a2b');
    for (let row = 0; row < 4; row++) {
      const shade = ['#9a6a38', '#8a5a2b', '#a8733f', '#94632f'][row % 4];
      p.rect(0, row * 4, SPRITE_SIZE, 3, shade);
      p.rect(0, row * 4 + 3, SPRITE_SIZE, 1, '#5a3a1c');
      const joint = (row * 7 + 3) % SPRITE_SIZE;
      p.rect(joint, row * 4, 1, 3, '#5a3a1c');
      p.set(wrap(joint + 1), row * 4 + 1, '#3b2616');
      p.set(wrap(joint - 2), row * 4 + 1, '#3b2616');
    }
    sprinkle(p, random, '#7a4a24', 10);
    sprinkle(p, random, '#b8844c', 8);
    return p;
  },
  t() {
    const random = seeded(41), p = flat('#6b4a2b');
    sprinkle(p, random, '#5a3c22', 40);
    sprinkle(p, random, '#7a5a38', 30);
    // Torrões: topo claro e sombra embaixo
    for (const [x, y] of [[2, 2], [10, 4], [5, 9], [12, 12], [1, 13]] as const) {
      p.rect(x, y, 3, 1, '#85623c').rect(x, y + 1, 3, 1, '#6b4a2b').rect(x, y + 2, 3, 1, '#4a3119');
    }
    // Rachadura e pedrinhas
    p.line(7, 1, 9, 4, '#3f2a16').line(9, 4, 8, 7, '#3f2a16').set(8, 8, '#3f2a16');
    for (const [x, y] of [[13, 8], [3, 6]] as const) { p.set(x, y, '#aa9a88'); p.set(x + 1, y, '#8a7a6a'); p.set(x, y + 1, '#4a3018'); p.set(x + 1, y + 1, '#4a3018'); }
    return p;
  },
  r() {
    const random = seeded(51), p = flat('#dcc88e');
    sprinkle(p, random, '#c9b377', 30);
    sprinkle(p, random, '#ede0ac', 18);
    // Marcas de vento: crista clara com sombra logo abaixo
    for (const [x0, y] of [[1, 3], [9, 6], [3, 10], [11, 13]] as const) for (let i = 0; i < 6; i++) {
      const dy = i === 0 || i === 5 ? 1 : 0;
      p.set(wrap(x0 + i), y + dy, '#f0e4b8');
      p.set(wrap(x0 + i), y + dy + 1, '#c2aa6a');
    }
    for (const [x, y] of [[13, 2], [6, 7], [2, 14]] as const) { p.set(x, y, '#a89462'); p.set(x + 1, y, '#8a7a50'); }
    return p;
  },
  n() {
    const random = seeded(61), p = flat('#eef4fa');
    sprinkle(p, random, '#e0eaf5', 36);
    // Montinhos de neve: topo branco e sombra azulada embaixo
    for (const [cx, cy, rx] of [[4, 4, 3], [11, 8, 3.4], [5, 12, 3.2]] as const) {
      p.disc(cx, cy + 0.6, rx, 1.8, '#b8cce6').disc(cx, cy, rx, 1.8, '#dbe7f4').disc(cx - 0.4, cy - 0.5, rx - 1, 1.1, '#f9fcff');
    }
    sprinkle(p, random, '#ffffff', 8);
    for (const [x, y] of [[12, 2], [2, 8], [9, 14]] as const) { p.set(x, y, '#ffffff'); p.set(x - 1, y, '#c4d8ee'); p.set(x + 1, y, '#c4d8ee'); p.set(x, y - 1, '#c4d8ee'); p.set(x, y + 1, '#c4d8ee'); }
    return p;
  },
  v() {
    const random = seeded(71), p = flat('#3f7d3a');
    sprinkle(p, random, '#37722f', 40);
    sprinkle(p, random, '#4a8c43', 28);
    // Tufos de capim: lâminas claras sobre uma base escura
    for (const [x, y] of [[2, 4], [8, 3], [13, 6], [5, 9], [11, 11], [2, 13], [8, 14]] as const) {
      p.set(x, y, '#2f6a2a'); p.set(x + 1, y, '#2f6a2a');
      p.set(x, y - 1, '#5fa352'); p.set(x + 1, y - 2, '#7ac868'); p.set(x + 1, y - 1, '#5fa352'); p.set(x - 1, y - 2, '#6fb85f');
    }
    for (const [x, y, c] of [[3, 12, '#f4e07a'], [11, 4, '#ffffff'], [6, 6, '#f2a0c0']] as const) { p.set(x, y, c); p.set(x + 1, y, '#e8b84a'); }
    return p;
  },
  a() {
    const random = seeded(81), p = flat('#2f6fa8');
    sprinkle(p, random, '#2a65a0', 24);
    for (const y of [1, 5, 9, 13]) {
      const off = (y * 3) % 8;
      for (const x0 of [off, off + 8]) for (let i = 0; i < 4; i++) {
        p.set(wrap(x0 + i), y, '#6db3e6');
        p.set(wrap(x0 + i + 1), y + 1, '#245a8c');
      }
    }
    sprinkle(p, random, '#cfeaff', 4);
    return p;
  },
  d() {
    const random = seeded(91), p = flat('#7a5a30');
    sprinkle(p, random, '#6a4c28', 45);
    sprinkle(p, random, '#8a6a3c', 30);
    for (const [cx, cy] of [[4, 4], [11, 7], [6, 12]] as const) {
      p.disc(cx, cy, 2.2, 1.7, '#8a8a98');
      p.set(cx - 1, cy - 1, '#b0b0c0'); p.set(cx, cy - 1, '#a0a0b0');
      p.rect(cx - 1, cy + 1, 3, 1, '#5a5a68');
    }
    return p;
  },
  l() {
    const random = seeded(101), p = flat('#8e2a1e');
    sprinkle(p, random, '#6a1e18', 60);
    for (const [sx, sy] of [[1, 3], [9, 1], [5, 11]] as const) {
      let x = sx, y = sy;
      for (let i = 0; i < 8; i++) {
        p.set(wrap(x), wrap(y), '#f08a2a');
        if (i % 2 === 0) p.set(wrap(x), wrap(y + 1), '#ffd05a');
        x += random() < 0.7 ? 1 : 0; y += random() < 0.5 ? 1 : 0;
      }
    }
    p.set(13, 9, '#ffb24a'); p.set(3, 8, '#ffb24a'); p.set(12, 14, '#ffb24a');
    return p;
  },
  // Névoa de guerra: nuvens escuras e pontilhadas
  nevoa() {
    const random = seeded(111), p = flat('#0a0c13');
    sprinkle(p, random, '#141927', 80);
    sprinkle(p, random, '#1d2436', 34);
    return p;
  }
};

// ───────── Objetos (transparentes, com contorno) ─────────

const PROP_ART: Record<PropId, () => Pix> = {
  porta() {
    const p = new Pix();
    p.rect(2, 1, 12, 14, '#3b2616').rect(3, 2, 10, 12, '#8a5a2b');
    p.rect(6, 2, 1, 12, '#6b4420').rect(9, 2, 1, 12, '#6b4420').rect(3, 2, 10, 1, '#a8733f');
    p.rect(3, 4, 10, 1, '#4a4a55').rect(3, 10, 10, 1, '#4a4a55');
    p.rect(10, 7, 2, 2, '#e8c35a').set(10, 7, '#fff2a8');
    return p.outline();
  },
  bau() {
    const p = new Pix();
    p.rect(2, 7, 12, 7, '#8a5a2b').rect(2, 4, 12, 4, '#a8733f').rect(2, 4, 12, 1, '#c4915a');
    p.rect(2, 13, 12, 1, '#6b4420').rect(4, 4, 2, 10, '#c9a24a').rect(10, 4, 2, 10, '#c9a24a');
    p.rect(7, 7, 2, 3, '#f0d060').set(7, 8, '#3b2616').set(8, 8, '#3b2616');
    return p.outline();
  },
  arvore() {
    const p = new Pix();
    p.rect(7, 11, 2, 4, '#5a3a1c').set(7, 11, '#7a5230');
    p.disc(8, 7, 6.5, 6, '#2f6a2d').disc(7.4, 6.2, 5.2, 4.8, '#3f8a3a');
    p.disc(5.8, 4.6, 2.2, 1.6, '#5ab04c').disc(9.6, 8.4, 1.6, 1.2, '#2f6a2d');
    p.set(10, 5, '#5ab04c'); p.set(4, 8, '#2f6a2d'); p.set(7, 9, '#2f6a2d');
    return p.outline();
  },
  pedra() {
    const p = new Pix();
    p.disc(8, 9.5, 6.5, 5, '#7a7a88').rect(3, 11, 10, 2, '#5a5a68').disc(6.4, 7.6, 3, 2, '#a8a8b8');
    p.line(9, 8, 11, 11, '#4a4a58').set(5, 6, '#d0d0dc');
    return p.outline();
  },
  tocha() {
    const p = new Pix();
    p.rect(7, 8, 2, 7, '#6b4420').rect(6, 6, 4, 3, '#3b2616').set(7, 8, '#8a5a2b');
    p.disc(8, 4, 3, 3.6, '#f08a2a').disc(8, 4.6, 1.8, 2.4, '#ffd05a').set(8, 5, '#ffffff');
    p.set(5, 2, '#ffb24a'); p.set(11, 3, '#ffb24a');
    return p.outline();
  },
  mesa() {
    const p = new Pix();
    p.rect(2, 11, 2, 3, '#6b4420').rect(12, 11, 2, 3, '#6b4420');
    p.rect(1, 4, 14, 8, '#a8733f').rect(1, 4, 14, 1, '#c4915a').rect(1, 11, 14, 1, '#6b4420');
    p.rect(1, 7, 14, 1, '#8a5a2b').set(4, 9, '#8a5a2b').set(10, 5, '#8a5a2b');
    return p.outline();
  },
  cama() {
    const p = new Pix();
    p.rect(3, 1, 10, 14, '#6b4420').rect(4, 2, 8, 12, '#e8e2d0');
    p.rect(5, 3, 6, 3, '#ffffff').rect(5, 5, 6, 1, '#cfc8b4');
    p.rect(4, 8, 8, 6, '#3b5bb5').rect(4, 8, 8, 1, '#6a8ae0').rect(4, 13, 8, 1, '#2a4185');
    return p.outline();
  },
  barril() {
    const p = new Pix();
    p.disc(8, 8, 6.5, 6.5, '#6b4420').disc(8, 8, 5.2, 5.2, '#8a5a2b').disc(8, 8, 3.6, 3.6, '#a8733f');
    p.line(5, 5, 11, 11, '#8a5a2b').line(5, 11, 11, 5, '#8a5a2b').disc(8, 8, 1, 1, '#6b4420');
    p.rect(2, 7, 1, 2, '#4a4a55').rect(13, 7, 1, 2, '#4a4a55');
    return p.outline();
  },
  estatua() {
    const p = new Pix();
    // Pedestal, corpo de cavaleiro de pedra, elmo com crista, escudo e espada erguida
    p.rect(3, 12, 10, 3, '#8a8a98').rect(3, 12, 10, 1, '#b8b8c6').rect(3, 14, 10, 1, '#5a5a68');
    p.rect(5, 7, 6, 5, '#a8a8b8').rect(5, 7, 6, 1, '#c4c4d0').rect(5, 8, 1, 4, '#c4c4d0').rect(10, 8, 1, 4, '#8a8a98');
    p.rect(3, 8, 3, 4, '#8a8a98').rect(3, 8, 3, 1, '#b0b0c0').rect(4, 9, 1, 2, '#c8a85a');
    p.disc(8, 4.6, 2.4, 2.4, '#c4c4d0').rect(6, 4, 4, 1, '#5a5a68').rect(8, 1, 1, 2, '#8a8a98').set(6, 3, '#e0e0ec');
    p.rect(10, 7, 2, 3, '#a8a8b8').line(12, 1, 12, 8, '#e4e4f0').set(12, 0, '#ffffff').rect(11, 8, 3, 1, '#e8c35a');
    p.set(6, 10, '#6a8a5a').set(9, 13, '#6a8a5a').set(4, 13, '#6a8a5a');
    return p.outline();
  },
  fogueira() {
    const p = new Pix();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; p.set(8 + Math.cos(a) * 6, 10 + Math.sin(a) * 4.2, '#7a7a88'); }
    p.line(3, 12, 12, 9, '#6b4420').line(3, 9, 12, 12, '#6b4420');
    p.disc(8, 7.6, 3.2, 4, '#f08a2a').disc(8, 8.2, 2, 2.8, '#ffd05a').set(8, 9, '#ffffff');
    p.set(5, 4, '#ffb24a'); p.set(11, 5, '#ffb24a');
    return p.outline();
  },
  escada() {
    const p = new Pix();
    for (let i = 0; i < 5; i++) {
      const y = 2 + i * 2.6 | 0;
      p.rect(2, y, 12, 2, i % 2 ? '#7a7a88' : '#8a8a98').rect(2, y, 12, 1, '#b0b0c0').rect(2, y + 2, 12, 1, '#4a4a58');
    }
    p.rect(2, 13, 12, 1, '#4a4a58');
    return p.outline();
  },
  armadilha() {
    const p = new Pix();
    p.rect(2, 2, 12, 12, '#5a5a68').rect(2, 2, 12, 1, '#7a7a88').rect(2, 13, 12, 1, '#3a3a48');
    for (const [x, y] of [[4, 4], [8, 4], [4, 8], [8, 8], [6, 6], [10, 10], [10, 6], [6, 10]] as const) { p.set(x, y, '#e8e8f4'); p.set(x, y + 1, '#8a8a9a'); }
    return p.outline();
  },
  tapete() {
    const p = new Pix();
    p.rect(1, 2, 14, 12, '#a82a2a').rect(2, 3, 12, 10, '#e8c35a').rect(3, 4, 10, 8, '#a82a2a');
    p.line(8, 5, 11, 8, '#e8c35a').line(11, 8, 8, 11, '#e8c35a').line(8, 11, 5, 8, '#e8c35a').line(5, 8, 8, 5, '#e8c35a').set(8, 8, '#f4e07a');
    for (let x = 2; x < 14; x += 2) { p.set(x, 1, '#e8c35a'); p.set(x, 14, '#e8c35a'); }
    return p.outline();
  },
  caixote() {
    const p = new Pix();
    p.rect(2, 2, 12, 12, '#a8733f').rect(2, 2, 12, 1, '#c4915a').rect(2, 13, 12, 1, '#6b4420');
    p.rect(2, 2, 1, 12, '#6b4420').rect(13, 2, 1, 12, '#6b4420').rect(2, 7, 12, 2, '#8a5a2b');
    p.line(3, 3, 12, 12, '#8a5a2b').line(12, 3, 3, 12, '#8a5a2b');
    for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]] as const) p.set(x, y, '#3b2616');
    return p.outline();
  },
  placa() {
    const p = new Pix();
    p.rect(7, 8, 2, 7, '#6b4420').set(7, 8, '#8a5a2b');
    p.rect(2, 2, 12, 7, '#c4a068').rect(2, 2, 12, 1, '#dcb87c').rect(2, 8, 12, 1, '#8a6a3c');
    p.rect(4, 4, 8, 1, '#3b2616').rect(4, 6, 5, 1, '#3b2616');
    return p.outline();
  },
  coluna() {
    const p = new Pix();
    p.rect(3, 1, 10, 2, '#cfcfdc').rect(3, 2, 10, 1, '#9a9aa8').rect(4, 3, 8, 1, '#8a8a98');
    p.rect(5, 4, 6, 8, '#b0b0c0').rect(5, 4, 1, 8, '#d8d8e4').rect(7, 4, 1, 8, '#9a9aa8').rect(9, 4, 1, 8, '#9a9aa8').rect(10, 4, 1, 8, '#7a7a88');
    p.rect(4, 12, 8, 1, '#8a8a98').rect(3, 13, 10, 2, '#b0b0c0').rect(3, 14, 10, 1, '#6a6a78');
    p.set(6, 6, '#8a9a7a').set(9, 9, '#8a9a7a');
    return p.outline();
  }

};

// ───────── Retratos de criatura (busto, fundo transparente) ─────────

const CREATURE_ART: Record<CreatureId, () => Pix> = {
  slime() {
    const p = new Pix();
    p.disc(8, 10, 6.5, 5, '#4cc06a').disc(8, 7.6, 4.4, 3.4, '#4cc06a').rect(2, 11, 12, 3, '#3a9a52');
    p.disc(6.2, 7.4, 2, 1.4, '#8ee6a0').set(11, 12, '#2a7a3c');
    p.rect(5, 9, 2, 2, '#ffffff').rect(9, 9, 2, 2, '#ffffff').set(6, 10, INK).set(10, 10, INK);
    p.rect(7, 12, 2, 1, '#2a7a3c');
    return p.outline();
  },
  esqueleto() {
    const p = new Pix();
    p.disc(8, 7, 5.2, 5.2, '#e8e2d0').rect(5, 11, 6, 3, '#e8e2d0').rect(5, 11, 6, 1, '#cfc8b4');
    p.rect(4, 6, 3, 3, INK).rect(9, 6, 3, 3, INK).rect(7, 9, 2, 2, INK);
    for (const x of [6, 8, 10]) p.set(x, 13, INK);
    p.rect(3, 3, 3, 1, '#ffffff').set(5, 6, '#c04040').set(10, 7, '#c04040');
    return p.outline();
  },
  lobo() {
    const p = new Pix();
    p.rect(2, 1, 3, 5, '#6a6a78').rect(11, 1, 3, 5, '#6a6a78').rect(3, 2, 1, 3, '#d49a9a').rect(12, 2, 1, 3, '#d49a9a');
    p.disc(8, 8.5, 6, 5.4, '#8a8a98').rect(5, 9, 6, 5, '#a8a8b8').rect(6, 12, 4, 2, '#c8c8d4');
    p.rect(7, 11, 2, 2, INK).set(4, 7, '#e0a83a').set(11, 7, '#e0a83a').set(4, 8, INK).set(11, 8, INK);
    p.set(5, 13, '#ffffff').set(10, 13, '#ffffff');
    p.rect(7, 4, 2, 2, '#6a6a78');
    return p.outline();
  },
  goblin() {
    const p = new Pix();
    p.line(2, 8, 5, 6, '#6aa84f').line(2, 7, 5, 5, '#6aa84f').line(13, 8, 10, 6, '#6aa84f').line(13, 7, 10, 5, '#6aa84f');
    p.disc(8, 8.8, 5.6, 5.4, '#6aa84f').rect(4, 5, 8, 2, '#4a8a3a').disc(8, 6.5, 4.4, 1.6, '#5a9a45');
    p.set(5, 8, '#f0d040').set(10, 8, '#f0d040').set(5, 9, INK).set(10, 9, INK);
    p.rect(7, 9, 2, 2, '#4a8a3a').rect(5, 12, 6, 1, INK).set(5, 11, '#ffffff').set(10, 11, '#ffffff');
    return p.outline();
  },
  orc() {
    const p = new Pix();
    p.disc(8, 8.5, 6.6, 6, '#4a7a3a').rect(3, 4, 10, 2, '#2f5a28').disc(8, 5.6, 4, 1.4, '#3a6a30');
    p.rect(4, 7, 3, 1, '#c04040').rect(9, 7, 3, 1, '#c04040').set(5, 7, '#ffd0d0').set(10, 7, '#ffd0d0');
    p.rect(7, 8, 2, 3, '#3a6a30').rect(4, 11, 8, 2, '#2f5a28');
    p.rect(4, 10, 1, 3, '#ffffff').rect(11, 10, 1, 3, '#ffffff').rect(6, 12, 4, 1, INK);
    return p.outline();
  },
  morcego() {
    const p = new Pix();
    p.rect(1, 4, 5, 1, '#4a3a5a').rect(10, 4, 5, 1, '#4a3a5a');
    p.disc(3.4, 8, 3.2, 3.4, '#4a3a5a').disc(12.6, 8, 3.2, 3.4, '#4a3a5a');
    p.set(1, 11, '#4a3a5a').set(5, 11, '#4a3a5a').set(10, 11, '#4a3a5a').set(14, 11, '#4a3a5a').set(3, 12, '#4a3a5a').set(12, 12, '#4a3a5a');
    p.disc(8, 9, 2.8, 3.6, '#3a2a4a').rect(5, 3, 2, 3, '#3a2a4a').rect(9, 3, 2, 3, '#3a2a4a').disc(8, 6.5, 2.6, 2.2, '#3a2a4a');
    p.set(7, 7, '#e04040').set(9, 7, '#e04040').set(7, 9, '#ffffff').set(9, 9, '#ffffff');
    return p.outline();
  },
  aranha() {
    const p = new Pix();
    for (const sy of [4, 6, 9, 11]) {
      p.line(6, 8, 2, sy - 1, '#4a3030').line(2, sy - 1, 1, sy + 2, '#4a3030');
      p.line(10, 8, 14, sy - 1, '#4a3030').line(14, sy - 1, 15, sy + 2, '#4a3030');
    }
    p.disc(8, 10, 3.6, 3.8, '#3a2a2a').disc(8, 5.6, 2.6, 2.4, '#4a3a3a');
    p.set(7, 5, '#e04040').set(9, 5, '#e04040').set(8, 6, '#e04040');
    p.set(8, 9, '#c02020').set(8, 11, '#c02020').set(7, 10, '#c02020').set(9, 10, '#c02020');
    return p.outline();
  },
  fantasma() {
    const p = new Pix();
    p.disc(8, 7.2, 5.6, 5.6, '#dfe9ff').rect(2, 7, 12, 6, '#dfe9ff');
    for (const x of [2, 6, 10]) p.rect(x, 13, 2, 2, '#dfe9ff');
    p.rect(2, 11, 1, 3, '#b8c8ec').rect(13, 11, 1, 3, '#b8c8ec').rect(4, 4, 2, 1, '#ffffff');
    p.rect(4, 7, 2, 3, INK).rect(10, 7, 2, 3, INK).rect(7, 11, 2, 2, INK);
    return p.outline();
  },
  dragao() {
    const p = new Pix();
    // Chifres claros, cabeça escamosa com brilho, focinho, olhos amarelos, presas e narinas
    p.line(4, 5, 3, 1, '#f0e8d4').line(5, 5, 4, 1, '#c8c0a8').line(11, 5, 12, 1, '#f0e8d4').line(10, 5, 11, 1, '#c8c0a8');
    p.disc(8, 8.5, 6.2, 5.6, '#2f7a4e').disc(7.2, 7.4, 4.6, 3.6, '#3a8a5a').disc(6.4, 6.4, 2.4, 1.6, '#4aa06a');
    for (const [x, y] of [[3, 8], [12, 8], [4, 5], [11, 5], [6, 4], [9, 4]] as const) p.set(x, y, '#256040');
    p.rect(4, 10, 8, 4, '#5aaa70').rect(4, 10, 8, 1, '#6bbf82').rect(4, 13, 8, 1, '#2a6a42');
    p.rect(4, 6, 3, 2, '#f0d040').rect(9, 6, 3, 2, '#f0d040').rect(5, 6, 1, 2, INK).rect(10, 6, 1, 2, INK);
    p.rect(3, 5, 4, 1, '#256040').rect(9, 5, 4, 1, '#256040');
    p.set(6, 10, '#ffb24a').set(9, 10, '#ffb24a').set(8, 8, '#256040');
    p.rect(5, 12, 1, 2, '#ffffff').rect(10, 12, 1, 2, '#ffffff').set(8, 12, INK);
    return p.outline();
  },
  rato() {
    const p = new Pix();
    p.disc(3.6, 5, 2.8, 2.8, '#8a7a6a').disc(12.4, 5, 2.8, 2.8, '#8a7a6a').disc(3.6, 5, 1.6, 1.6, '#e8a8b0').disc(12.4, 5, 1.6, 1.6, '#e8a8b0');
    p.disc(8, 9.6, 5, 4.6, '#8a7a6a').disc(8, 11.6, 3, 2.6, '#a8988a');
    p.set(5, 8, INK).set(10, 8, INK).rect(7, 11, 2, 2, '#e8a8b0').set(8, 11, '#c07880');
    p.line(1, 11, 4, 12, '#d8d0c0').line(15, 11, 12, 12, '#d8d0c0');
    return p.outline();
  },
  zumbi() {
    const p = new Pix();
    p.disc(8, 8.5, 5.6, 5.6, '#8aa86a').rect(3, 3, 10, 3, '#4a3a2a').rect(2, 5, 2, 3, '#4a3a2a').rect(11, 3, 1, 2, '#4a3a2a');
    p.rect(4, 7, 3, 3, INK).set(5, 8, '#ffffff').rect(9, 7, 3, 2, '#e8e2d0').set(10, 8, INK);
    p.rect(5, 11, 6, 2, INK).set(6, 11, '#e8e2d0').set(9, 11, '#e8e2d0');
    p.line(10, 4, 12, 6, '#5a7a48').set(7, 9, '#6a8a50');
    return p.outline();
  },
  demonio() {
    const p = new Pix();
    p.line(4, 6, 2, 3, INK).line(3, 6, 1, 2, '#3a2a3a').line(4, 5, 3, 2, '#3a2a3a');
    p.line(11, 6, 13, 3, INK).line(12, 6, 14, 2, '#3a2a3a').line(11, 5, 12, 2, '#3a2a3a');
    p.disc(8, 8.5, 5.8, 5.6, '#a82a3a').rect(4, 4, 8, 2, '#8a1a28').disc(8, 11, 3.6, 2.6, '#b83a4a');
    p.rect(4, 7, 3, 2, '#ffd040').rect(9, 7, 3, 2, '#ffd040').set(5, 8, INK).set(10, 8, INK);
    p.rect(5, 12, 6, 1, INK).set(5, 12, '#ffffff').set(10, 12, '#ffffff').set(8, 10, '#8a1a28');
    return p.outline();
  }
};

// ───────── Entrega em PNG (com cache) ─────────

const cache = new Map<string, string>();
function cached(key: string, build: () => Pix): string {
  let uri = cache.get(key);
  if (uri === undefined) { uri = build().uri(); cache.set(key, uri); }
  return uri;
}
export const TILE_IDS = [...Object.keys(TERRAINS), 'pf', 'nevoa'] as TileId[];
export const tileUri = (id: TileId): string => cached(`t:${id}`, TILES[id]);
export const propUri = (id: PropId): string => cached(`p:${id}`, PROP_ART[id]);
export const creatureUri = (id: CreatureId): string => cached(`c:${id}`, CREATURE_ART[id]);
export const PROP_IDS = Object.keys(PROPS) as PropId[];
export const CREATURE_IDS = Object.keys(CREATURES) as CreatureId[];
export type { TileId };

/** Retrato do avatar do personagem (roupa pela classe), para os tokens. */
export function avatarSprite(avatar: Avatar, classe: string): Pix {
  const p = new Pix();
  for (const { x, y, cor } of avatarPixels(avatar, outfitForClass(classe))) p.set(x, y, cor);
  return p;
}
export const avatarUriFor = (avatar: Avatar, classe: string): string =>
  cached(`a:${avatar.pele}${avatar.olhos}${avatar.cabelo}:${outfitForClass(classe)}`, () => avatarSprite(avatar, classe));
/** Sprite pelo nome, só para a galeria de revisão e os testes. */
export const allSprites = (): { key: string; sprite: Pix }[] => [
  ...TILE_IDS.map(id => ({ key: `tile-${id}`, sprite: TILES[id]() })),
  ...PROP_IDS.map(id => ({ key: `prop-${id}`, sprite: PROP_ART[id]() })),
  ...CREATURE_IDS.map(id => ({ key: `creature-${id}`, sprite: CREATURE_ART[id]() }))
];
