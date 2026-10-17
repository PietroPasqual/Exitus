import { describe, expect, it } from 'vitest';
import { Pix, rgb } from '../src/ui/pixel';
import { fireLanceBounds, lightningRingBounds, paintCoherentFireLance, paintCoherentLightningRing } from '../src/ui/pixel-coherent-energy';

const ramp = ['#3b1029', '#7d1f3b', '#cb3c35', '#f87935', '#ffc45c', '#fff1b8', '#fffdf1'].map(rgb);
const points = (pix: Pix): [number, number][] => {
  const result: [number, number][] = [];
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++) if (pix.data[(y * pix.w + x) * 4 + 3]) result.push([x, y]);
  return result;
};
function components(pix: Pix): number {
  const pending = new Set(points(pix).map(([x, y]) => y * pix.w + x));
  let count = 0;
  while (pending.size) {
    count++;
    const queue = [pending.values().next().value!];
    pending.delete(queue[0]);
    while (queue.length) {
      const p = queue.pop()!, x = p % pix.w, y = Math.floor(p / pix.w);
      for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
        const next = yy * pix.w + xx;
        if (xx >= 0 && xx < pix.w && yy >= 0 && yy < pix.h && pending.delete(next)) queue.push(next);
      }
    }
  }
  return count;
}
const render = (s: number, x: number, y: number, frame: number, reverse = false, launching = false): Pix => {
  const p = new Pix(64, 48); paintCoherentFireLance(p, x, y, s, ramp, frame, reverse, launching); return p;
};

describe('Lança de fogo em cópias muito pequenas', () => {
  it.each([.25, .5, 1, 1.5, 2, 2.99])('escala %s não desaparece nem separa haste, chama e ponta em origens fracionárias', s => {
    const fractions = [0, .125, .25, .5, .75, .875];
    for (const launching of [false, true]) for (const dx of fractions) for (const dy of fractions) for (const reverse of [false, true]) for (let frame = 0; frame < 8; frame++) {
      const x = 32 + dx, y = 24 + dy, p = render(s, x, y, frame, reverse, launching), pixels = points(p), q = fireLanceBounds(s, launching);
      expect(pixels.length).toBeGreaterThanOrEqual(3);
      expect(components(p)).toBe(1);
      for (const [px, py] of pixels) {
        expect(px >= x + q.l && px <= x + q.r && py >= y + q.t && py <= y + q.b).toBe(true);
      }
    }
  });

  it('espelha exatamente a direção em origens inteiras e de meio pixel', () => {
    for (const s of [1, 2, 2.99]) for (const x of [31, 31.5]) for (let frame = 0; frame < 8; frame++) {
      const a = render(s, x, 24.5, frame), b = render(s, x, 24.5, frame, true);
      for (let yy = 18; yy <= 30; yy++) for (let xx = 20; xx <= 43; xx++) for (let channel = 0; channel < 4; channel++) {
        expect(a.data[(yy * a.w + xx) * 4 + channel]).toBe(b.data[(yy * b.w + 2 * x - xx) * 4 + channel]);
      }
    }
  });

  it('normaliza o ciclo e mantém a ponta pequena imóvel', () => {
    for (const s of [1, 2]) for (const dx of [0, .5]) {
      const still = render(s, 32 + dx, 24.5, 0);
      for (const f of [8, 16, Number.NaN, Number.POSITIVE_INFINITY]) expect(render(s, 32 + dx, 24.5, f).data.every((v, i) => v === still.data[i])).toBe(true);
      for (let f = 0; f < 8; f++) {
        const p = render(s, 32 + dx, 24.5, f);
        for (let y = 20; y < 29; y++) for (let x = Math.ceil(32 + dx); x < 40; x++) {
          const i = (y * p.w + x) * 4;
          expect(p.data.slice(i, i + 4).every((v, k) => v === still.data[i + k])).toBe(true);
        }
      }
    }
  });

  it('preserva a silhueta aceita da lâmina enquanto o calor percorre sua crista', () => {
    for (const [s, silhouette] of [[3, 2142550415], [15, 4027940013]]) {
      const signatures = new Set<number>();
      for (let frame = 0; frame < 8; frame++) {
        const p = new Pix(96, 64); paintCoherentFireLance(p, 48, 32, s, ramp, frame);
        let hash = 2166136261, color = 2166136261;
        for (let y = 0; y < 64; y++) for (let x = Math.ceil(48 + 4 * s / 15); x < 96; x++) {
          const i = (y * p.w + x) * 4;
          hash = Math.imul(hash ^ p.data[i + 3], 16777619);
          color = Math.imul(color ^ p.data[i + 1], 16777619);
        }
        expect(hash >>> 0).toBe(silhouette);
        signatures.add(color);
      }
      if (s === 15) expect(signatures.size).toBeGreaterThanOrEqual(6);
    }
  });
});

const largeLance = (frame: number, launching = false, reverse = false, s = 15, dx = 0, dy = 0): Pix => {
  const p = new Pix(192, 112); paintCoherentFireLance(p, 96 + dx, 56 + dy, s, ramp, frame, reverse, launching); return p;
};
const samePixels = (a: Pix, b: Pix): boolean => a.data.every((v, i) => v === b.data[i]);
const extents = (p: Pix) => {
  const ink = points(p); return { left: Math.min(...ink.map(([x]) => x)), right: Math.max(...ink.map(([x]) => x)) };
};
const signature = (p: Pix): number => p.data.reduce((h, value) => Math.imul(h ^ value, 16777619), 2166136261);
const changes = (a: Pix, b: Pix): number => {
  let total = 0;
  for (let i = 0; i < a.data.length; i += 4) if ([0, 1, 2, 3].some(c => a.data[i + c] !== b.data[i + c])) total++;
  return total;
};

describe('Lança: preparação, aceleração e recuperação de voo', () => {
  it('separa o lançamento explícito do fluxo ancorado padrão', () => {
    for (let frame = 0; frame < 8; frame++) {
      const p = new Pix(192, 112); paintCoherentFireLance(p, 96, 56, 15, ramp, frame);
      expect(samePixels(p, largeLance(frame, false))).toBe(true);
      expect(samePixels(p, largeLance(frame, true))).toBe(false);
      expect(extents(p).right).toBe(126);
    }
    expect(fireLanceBounds(15)).toEqual({ l: -32, t: -9, r: 32, b: 8 });
    expect(fireLanceBounds(15, true)).toEqual({ l: -42, t: -9, r: 42, b: 8 });
  });

  it('acelera para a frente, deixa a chama atrasada e recupera sem salto de reinício', () => {
    const frames = Array.from({ length: 8 }, (_, f) => largeLance(f, true));
    const limits = frames.map(extents);
    const spacing = limits.map((p, f) => limits[(f + 1) % 8].right - p.right);
    expect(spacing).toEqual([-3, 2, 7, 8, -2, -4, -4, -4]);
    expect(limits[4].left).toBeLessThan(limits[1].left);
    expect(limits[4].right - limits[4].left).toBeGreaterThan(limits[1].right - limits[1].left + 18);
    expect(new Set(frames.map(signature)).size).toBe(8);
    expect(changes(frames[7], frames[0])).toBeLessThan(Math.max(...frames.slice(0, -1).map((p, f) => changes(p, frames[f + 1]))));
  });

  it.each([3, 4.75, 7.5, 15, 22, 30])('encerra escala %s em limites estáveis, com chama conectada e encaixe do transporte', s => {
    for (const launching of [false, true]) for (const reverse of [false, true]) for (const [dx, dy] of [[0, 0], [.125, .875], [.5, .5], [.875, .25]]) {
      const q = fireLanceBounds(s, launching), direction = reverse ? -1 : 1;
      for (let f = 0; f < 8; f++) {
        const p = largeLance(f, launching, reverse, s, dx, dy);
        expect(components(p)).toBe(1);
        expect(points(p).every(([x, y]) => x >= 96 + dx + q.l && x <= 96 + dx + q.r && y >= 56 + dy + q.t && y <= 56 + dy + q.b)).toBe(true);
        const ax = Math.round(96 + dx - 1.2 * s * direction), ay = Math.round(56 + dy - s / 15);
        expect(p.data[(ay * p.w + ax) * 4 + 3]).toBe(255);
      }
    }
  });

  it('espelha voo e repouso com a mesma fase e normaliza qualquer quadro', () => {
    for (const s of [1, 2, 3, 7.5, 15]) for (const launching of [false, true]) for (let f = 0; f < 8; f++) {
      const a = largeLance(f, launching, false, s, .5, .5), b = largeLance(f, launching, true, s, .5, .5);
      let mirror = true;
      for (let y = 0; y < a.h; y++) for (let x = 2; x < a.w; x++) {
        const left = (y * a.w + x) * 4, right = (y * b.w + 193 - x) * 4;
        for (let c = 0; c < 4; c++) if (a.data[left + c] !== b.data[right + c]) mirror = false;
      }
      expect(mirror).toBe(true);
      expect(samePixels(a, largeLance(f + 8, launching, false, s, .5, .5))).toBe(true);
    }
    for (const launching of [false, true]) {
      for (const f of [8, 16, 8.9, NaN, Infinity, -Infinity]) expect(samePixels(largeLance(f, launching), largeLance(0, launching))).toBe(true);
      expect(samePixels(largeLance(-1, launching), largeLance(7, launching))).toBe(true);
    }
  });
});

const lightning = ['#54204b', '#a64b44', '#ed9c38', '#ffe878', '#fff9ca', '#ffffff'].map(rgb);
const ring = (frame: number, s = 15, dx = 0, dy = 0): Pix => {
  const p = new Pix(192, 112); paintCoherentLightningRing(p, 96 + dx, 56 + dy, s, lightning, frame); return p;
};
const bright = (p: Pix, x: number, y: number): boolean => {
  const i = (y * p.w + x) * 4;
  return p.data[i + 3] > 0 && p.data[i] === 255 && p.data[i + 1] >= 249;
};

describe('Anel elétrico: cabeça viajante e derivações enraizadas', () => {
  it('leva a descarga pela borda em saltos e pausas, sem ritmo uniforme de carregamento', () => {
    const angles: number[] = [], hotCounts: number[] = [];
    for (let f = 0; f < 8; f++) {
      const p = ring(f); let x = 0, y = 0, hot = 0;
      for (const [px, py] of points(p)) if (bright(p, px, py)) {
        hot++;
        if (Math.hypot(px - 96, py - 56) < 17.8) { x += px - 96; y += py - 56; }
      }
      angles.push(Math.atan2(y, x));
      hotCounts.push(hot);
      expect(hot).toBeGreaterThan(2);
      expect(hot).toBeLessThan(points(p).length * .2);
    }
    const advances: number[] = [];
    for (let f = 0; f < 8; f++) {
      const advance = ((angles[(f + 1) % 8] - angles[f]) + Math.PI * 2) % (Math.PI * 2);
      advances.push(advance);
      expect(advance).toBeGreaterThan(.18);
      expect(advance).toBeLessThan(2);
    }
    expect(Math.max(...advances)).toBeGreaterThan(Math.min(...advances) * 3);
    expect(Math.max(...hotCounts)).toBeGreaterThan(Math.min(...hotCounts) * 3);
  });

  it('acende primeiro a derivação superior e depois a inferior sem clarão global', () => {
    const upper: number[] = [], lower: number[] = [], masks = new Set<number>();
    for (let f = 0; f < 8; f++) {
      const p = ring(f), ink = points(p);
      upper.push(ink.filter(([x, y]) => y < 43 && bright(p, x, y)).length);
      lower.push(ink.filter(([x, y]) => x > 113 && y > 63 && bright(p, x, y)).length);
      let hash = 2166136261;
      for (let i = 3; i < p.data.length; i += 4) hash = Math.imul(hash ^ p.data[i], 16777619);
      masks.add(hash);
    }
    const upperPeak = upper.indexOf(Math.max(...upper)), lowerPeak = lower.indexOf(Math.max(...lower));
    expect(upperPeak).toBeLessThan(3);
    expect(lowerPeak).toBeGreaterThanOrEqual(4);
    expect(Math.max(...upper)).toBeGreaterThan(0);
    expect(Math.max(...lower)).toBeGreaterThan(0);
    expect(masks.size).toBeGreaterThanOrEqual(6);
  });

  it.each([.5, 1, 2, 3, 7.5, 15, 30])('mantém escala %s legível, conectada, limitada e com centro aberto quando há espaço', s => {
    for (const [dx, dy] of [[0, 0], [.125, .875], [.5, .5], [.875, .25]]) for (let f = 0; f < 8; f++) {
      const p = ring(f, s, dx, dy), ink = points(p), q = lightningRingBounds(s);
      expect(ink.length).toBeGreaterThanOrEqual(3);
      expect(components(p)).toBe(1);
      expect(ink.every(([x, y]) => x >= 96 + dx + q.l && x <= 96 + dx + q.r && y >= 56 + dy + q.t && y <= 56 + dy + q.b)).toBe(true);
      if (s >= 3) expect(ink.every(([x, y]) => Math.hypot(x - 96 - dx, y - 56 - dy) > s * .4)).toBe(true);
    }
  });

  it('fecha o ciclo sem reinicializar a força e trata quadros inválidos com segurança', () => {
    const frames = Array.from({ length: 8 }, (_, f) => ring(f));
    for (let f = 0; f < 8; f++) expect(samePixels(frames[f], ring(f + 8))).toBe(true);
    for (const f of [8, 16, 8.9, NaN, Infinity, -Infinity]) expect(samePixels(frames[0], ring(f))).toBe(true);
    expect(samePixels(frames[7], ring(-1))).toBe(true);
    const inner = frames.slice(0, -1).map((p, f) => changes(p, frames[f + 1]));
    expect(changes(frames[7], frames[0])).toBeLessThanOrEqual(Math.max(...inner) * 1.25);
  });
});
