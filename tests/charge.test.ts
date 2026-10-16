import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { simulateCharge, thresholds, wireKey } from '../src/core/charge';
import { analyzeFlow } from '../src/core/flow';
import { applyOverrides } from '../src/data/rules';
import type { Model } from '../src/core/circles';
import { cable, model, node, prism } from './helpers';

// Exemplo do caderno ("Energia e Cargas Mágicas"): Bola de Fogo
//   Matriz-1 ( ) → Círculo-1 (Fogo) → Círculo-2 (Esfera) → Círculo-3 (Movimento) → Matriz-1 ( )
const cost = (a: number, p: number, i: number) => ({ ativacao: { cost: a }, perfeito: { cost: p }, instavel: { cost: i } });
const EXAMPLE = {
  runas: { fogo: { stats: cost(3.4, 7.1, 11.3) }, forma_esfera: { stats: cost(1.2, 3.4, 4.2) }, movimento: { stats: cost(4.0, 7.2, 12.5) } },
  formas: { prism: { cost: { ativacao: 0.4, perfeito: 4, instavel: 40 } }, circle: { cost: { ativacao: 0.2, perfeito: 2, instavel: 20 } } }
};

function fireball(energia: number | null): Model {
  const m = model(
    [prism(null), node('c1', 'circle', 0, -160, 'fogo'), node('c2', 'circle', 150, 80, 'forma_esfera'), node('c3', 'circle', -150, 80, 'movimento')],
    [cable('prism_center', 'c1'), cable('c1', 'c2'), cable('c2', 'c3'), cable('c3', 'prism_center')]
  );
  return { ...m, mage: { energia } } as Model;
}
const run = (energia: number | null) => { const m = fireball(energia); return simulateCharge(m, analyzeFlow(m)); };

describe('Energia e Cargas Mágicas', () => {
  beforeEach(() => applyOverrides(EXAMPLE));
  afterEach(() => applyOverrides({}));

  it('limites da Bola de Fogo do caderno', () => {
    const c = run(null);
    expect(c.minimum).toBe(9.6);
    expect(c.perfect).toBe(27.7);
    expect(c.destruction).toBe(128);
    expect(thresholds(c).map(t => t[2])).toEqual(['9,6', '9,6 ~ 27,6', '27,7', '27,8 ~ 127,9', '128']);
  });

  it('10 de energia: estável', () => {
    const c = run(10);
    expect(c.level).toBe('estavel');
    expect(c.failure).toBe(0);
  });

  it('13,3: estável, mas o Fogo do Círculo-1 entra em Perfeito', () => {
    const c = run(13.3);
    expect(c.level).toBe('estavel');
    expect(c.nodeState.get('c1')).toBe('perfeito');
    expect(c.nodeState.get('c2')).toBe('ativacao');
    expect(c.nodeState.get('c3')).toBe('ativacao');
  });

  it('20: estável; todos em Círculos, nenhuma runa oscila', () => {
    const c = run(20);
    expect(c.level).toBe('estavel');
    expect(c.oscillating).toEqual([]);
  });

  it('27,7: ativação perfeita, sem chance de falha', () => {
    const c = run(27.7);
    expect(c.level).toBe('perfeito');
    expect(c.failure).toBe(0);
    expect(['c1', 'c2', 'c3'].map(id => c.nodeState.get(id))).toEqual(['perfeito', 'perfeito', 'perfeito']);
  });

  it('30: instável; o Círculo-1 (Fogo) é o primeiro a poder falhar; 27,8 = 20% e 128 = 100%', () => {
    const c = run(30);
    expect(c.level).toBe('instavel');
    expect(c.firstToFail).toBe('c1');
    expect(c.failure).toBeCloseTo(20 + 80 * (30 - 27.8) / (127.9 - 27.8), 5);
    expect(run(27.8).failure).toBeCloseTo(20, 5);
    expect(run(128).level).toBe('autodestruicao');
    expect(run(128).failure).toBe(100);
  });

  it('abaixo do mínimo não ativa', () => {
    expect(run(9).level).toBe('insuficiente');
  });

  it('energia em cada fio: o que sobra depois de cada selo e runa', () => {
    const c = run(13.3);
    expect(c.wires.get(wireKey('prism_center', 'c1'))).toBeCloseTo(12.9, 5);
    expect(c.wires.get(wireKey('c1', 'c2'))).toBeCloseTo(5.6, 5);
    expect(c.wires.get(wireKey('c2', 'c3'))).toBeCloseTo(4.2, 5);
    expect(c.wires.get(wireKey('c3', 'prism_center'))).toBeCloseTo(0, 5);
  });

  it('tempo: 3 de energia a cada 0,1 s', () => {
    expect(run(30).seconds).toBeCloseTo(1, 5);
  });
});

describe('selos', () => {
  afterEach(() => applyOverrides({}));

  it('Triângulo: base para baixo = custo ×5; base para cima = custo ×4', () => {
    const tri = (rot: number) => {
      const m = model([prism(null), { ...node('t', 'triangle', 0, -160, 'fogo'), rot }], [cable('prism_center', 't'), cable('t', 'prism_center')]);
      return simulateCharge(m, analyzeFlow(m)).parts.find(p => p.kind === 'runa')!;
    };
    const base = tri(0).cost.ativacao / 5;
    expect(tri(180).cost.ativacao).toBeCloseTo(base * 4, 5);
  });

  it('Pentágono só passa quando todas as entradas estão ativas', () => {
    const m = model(
      [prism(null), node('a', 'circle', -150, -100, 'fogo'), node('b', 'circle', 150, -100, 'fogo'), node('p', 'hexagon', 0, -200), node('x', 'circle', 0, 150, 'agua')],
      [cable('prism_center', 'a'), cable('a', 'p'), cable('x', 'p'), cable('p', 'prism_center')]
    );
    const c = simulateCharge(m, analyzeFlow(m));
    const pent = c.pentagons.find(p => p.node === 'p');
    expect(pent?.passes).toBe(false);
  });
});
