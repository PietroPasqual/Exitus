import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { analyzeCircles, getNodeCircles, lensPoint, ringInset, starFedCircles, type Model } from '../src/core/circles';
import { analyzeFlow } from '../src/core/flow';
import { normalizeProject } from '../src/core/project';
import type { Circle, MagicNode } from '../src/core/types';
import { cable, node, prism } from './helpers';

const opts = { specMode: 'simultaneous', missingMat: false } as const;

/** Círculo 1 com Matriz; círculo 2 sobreposto, sem Matriz, unido por duas Estrelas (uma em cada camada) */
function twoCircles(offset = 0, shape?: Circle['shape']): Model {
  const c1: Circle = { id: 'c1', x: 0, y: 0 };
  const c2: Circle = { id: 'c2', x: 430, y: 0, ...(shape ? { shape } : {}) };
  const lens = lensPoint(c1, c2);
  const star = (id: string, layer: string, dx = 0): MagicNode => ({ ...node(id, 'star', lens.x + dx, lens.y), size: 40, layer });
  return {
    circles: [c1, c2],
    nodes: [prism('fogo'), node('n1', 'circle', 0, -160, 'forma_esfera'), star('sA', 'c1'), star('sB', 'c2', offset), node('n2', 'circle', 470, -120, 'vento')],
    connections: [cable('prism_center', 'n1'), cable('n1', 'sA'), cable('sA', 'prism_center'), cable('sB', 'n2'), cable('n2', 'sB')]
  };
}

describe('círculos sobrepostos em camadas', () => {
  it('só um círculo precisa de Matriz: o outro recebe a energia pelas Estrelas', () => {
    const m = twoCircles();
    const pair = analyzeCircles(m).pairs[0];
    expect(pair.complete).toBe(true);
    expect(pair.stars.map(s => s.layer)).toEqual(['c1', 'c2']);
    expect(starFedCircles(m).has('c2')).toBe(true);
    const a = analyzeCircuit(m, opts);
    expect(a.badge.text).not.toContain('sem Fonte');
    expect(a.flow.working.has('n2')).toBe(true);
  });

  it('cada Estrela pertence só à sua camada: o cabo do círculo 2 vai para a Estrela da camada 2', () => {
    const m = twoCircles();
    expect(getNodeCircles(m, m.nodes.find(n => n.id === 'sB') as MagicNode)).toEqual(['c2']);
    expect(analyzeCircles(m).crossing).toEqual([]);
    // Ligar um selo do círculo 2 direto na Estrela da camada 1 cruza os círculos
    const wrong = { ...m, connections: [...m.connections, cable('n2', 'sA')] };
    expect(analyzeCircles(wrong).crossing.map(c => c.id)).toContain('n2-sA');
  });

  it('Estrelas desalinhadas não passam a energia', () => {
    const m = twoCircles(30);
    const pair = analyzeCircles(m).pairs[0];
    expect(pair.aligned).toBe(false);
    expect(analyzeFlow(m).working.has('n2')).toBe(false);
    expect(analyzeCircuit(m, opts).badge.text).toContain('Desalinhadas');
  });

  it('a Estrela que une círculos não é um Carregador', () => {
    const a = analyzeCircuit(twoCircles(), opts);
    expect(a.charge.stars).toEqual([]);
  });
});

describe('anel de fora com formato de selo', () => {
  it('o selo precisa ficar dentro do formato do anel', () => {
    const tri: Circle = { id: 'c1', x: 0, y: 0, shape: 'triangle' };
    expect(ringInset(tri, 0, 0)).toBeGreaterThan(100);
    // No círculo cabe, no triângulo não (canto de baixo à direita, fora da borda)
    expect(ringInset({ id: 'c1', x: 0, y: 0 }, 200, 150)).toBeGreaterThan(0);
    expect(ringInset(tri, 200, 150)).toBeLessThan(0);
  });

  it('a área de sobreposição acompanha o formato do anel', () => {
    const m = twoCircles(0, 'triangle');
    const lens = lensPoint(m.circles[0], m.circles[1]);
    expect(lens.room).toBeGreaterThan(20);
    expect(analyzeCircles(m).pairs[0].complete).toBe(true);
  });

  it('o arquivo guarda o formato do anel e a camada da Estrela', () => {
    const p = normalizeProject({
      nodes: [{ ...prism(), circleId: 'c1' }, { ...node('s', 'star', 200, 0), layer: 'c2' }],
      connections: [], circles: [{ id: 'c1', x: 0, y: 0 }, { id: 'c2', x: 430, y: 0, shape: 'hexagon' }, { id: 'c3', x: 0, y: 430, shape: 'hack' }]
    });
    expect(p?.circles?.[1].shape).toBe('hexagon');
    expect(p?.circles?.[2].shape).toBeUndefined();
    expect(p?.nodes[1].layer).toBe('c2');
  });
});
