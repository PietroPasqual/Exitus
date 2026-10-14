import { describe, expect, it } from 'vitest';
import { evolveTarget } from '../src/core/circles';
import { lensCenter, snapPolar } from '../src/core/geometry';
import { copyName, normalizeProject, skeletonOf } from '../src/core/project';
import type { Project } from '../src/core/types';
import { modelOf, node, prism } from './helpers';

describe('Ímã polar', () => {
  const c = { x: 0, y: 0 };

  it('perto do centro, gruda no centro', () => {
    expect(snapPolar({ x: 5, y: -4 }, c, [])).toEqual({ x: 0, y: 0 });
  });

  it('gruda no ângulo de 15° mais perto', () => {
    const p = snapPolar({ x: 150, y: 6 }, c, []);
    expect(p.y).toBeCloseTo(0, 5);
    expect(p.x).toBeCloseTo(Math.hypot(150, 6), 5);
  });

  it('gruda na mesma distância do centro que outra peça', () => {
    const p = snapPolar({ x: 0, y: 176 }, c, [170]);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(170, 5);
  });

  it('longe de tudo, deixa onde está', () => {
    const p = snapPolar({ x: 101, y: 41 }, c, [], { angleStepDeg: 15, radiusStep: 20, threshold: 2 });
    expect(p.x).toBeCloseTo(101, 5);
    expect(p.y).toBeCloseTo(41, 5);
  });
});

describe('Estrela na lente', () => {
  it('círculos iguais: no meio dos dois centros', () => {
    expect(lensCenter({ x: 0, y: 0, r: 285 }, { x: 400, y: 0, r: 285 })).toEqual({ x: 200, y: 0 });
  });

  it('tamanhos diferentes: no meio da faixa que os dois anéis cobrem', () => {
    const p = lensCenter({ x: 0, y: 0, r: 285 }, { x: 0, y: 300, r: 100 });
    // a faixa vai de y = 200 (borda do pequeno) a y = 285 (borda do grande)
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(242.5, 5);
  });
});

describe('Evoluir Forma', () => {
  it('simples → composta e de volta', () => {
    expect(evolveTarget(node('a', 'circle', 0, 0))).toBe('salor');
    expect(evolveTarget(node('a', 'triangle', 0, 0))).toBe('salor');
    expect(evolveTarget(node('a', 'star', 0, 0))).toBe('redor');
    expect(evolveTarget(node('a', 'square', 0, 0))).toBe('corp');
    expect(evolveTarget(node('a', 'salor', 0, 0))).toBe('circle');
    expect(evolveTarget(node('a', 'redor', 0, 0))).toBe('hexagon');
  });

  it('o Corp do Prisma volta a ser Prisma; o de um Col volta a ser Col', () => {
    expect(evolveTarget({ ...prism(), shape: 'corp' })).toBe('prism');
    expect(evolveTarget(node('a', 'corp', 0, 0))).toBe('square');
  });
});

describe('Molde sem runas', () => {
  const m = modelOf('m_lanca_plasmatica');
  const p: Project = { ringStyle: 'single', strokeWidth: 4, showGrid: false, ...m, spellInfo: m.preset.info };

  it('tira todas as runas e mantém o desenho', () => {
    const s = skeletonOf(p);
    expect(s.nodes.length).toBe(p.nodes.length);
    expect(s.nodes.every(n => n.rune === null && !n.inner)).toBe(true);
    expect(s.connections).toEqual(p.connections);
    expect(s.circles).toEqual(p.circles);
    expect(s.envelope).toBe(true);
    expect(s.spellInfo).toBeNull();
  });

  it('tira também a palavra de vínculo da Intenção', () => {
    const q: Project = { ...p, nodes: p.nodes.map((n, i) => (i === 1 ? { ...n, rune: 'mod_intencao', bond: 'Fênix' } : n)) };
    expect(skeletonOf(q).nodes.some(n => n.bond)).toBe(false);
  });

  it('não mexe no original', () => {
    skeletonOf(p);
    expect(p.nodes.some(n => n.rune)).toBe(true);
  });
});

describe('Duplicar em Meus Círculos', () => {
  it('nome da cópia sem repetir', () => {
    expect(copyName('Lança', [])).toBe('Lança (cópia)');
    expect(copyName('Lança', ['Lança (cópia)'])).toBe('Lança (cópia 2)');
    expect(copyName('Lança (cópia)', ['Lança (cópia)', 'Lança (cópia 2)'])).toBe('Lança (cópia 3)');
  });
});

describe('Palavra de vínculo (Intenção)', () => {
  it('é guardada ao abrir um arquivo, sem espaços sobrando e com no máximo 40 letras', () => {
    const raw = { ringStyle: 'single', strokeWidth: 4, showGrid: false, connections: [],
      nodes: [{ ...prism(), rune: 'mod_intencao', bond: '  Fênix  ' }, { ...node('a', 'circle', 100, 0, 'mod_intencao'), bond: 'x'.repeat(60) }, { ...node('b', 'circle', 0, 100), bond: '   ' }] };
    const p = normalizeProject(raw);
    expect(p?.nodes.map(n => n.bond)).toEqual(['Fênix', 'x'.repeat(40), undefined]);
  });
});
