import { checkProjectiles } from '../src/core/projectile';
import { PRESETS } from '../src/data/presets';
import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { analyzeFlow } from '../src/core/flow';
import { escapeHtml } from '../src/core/format';
import { cable, model, modelOf, node, prism } from './helpers';

const opts = { specMode: 'simultaneous', missingMat: false } as const;

describe('regras fundamentais', () => {
  it('Bola de Fogo: rota Prisma → Fogo → Esfera → Direção → Prisma', () => {
    const m = modelOf('ex1');
    const flow = analyzeFlow(m);
    expect(flow.perPrism[0].routes[0]).toEqual(['prism_center', 'n_br', 'n_top', 'n_bl', 'prism_center']);
  });

  it('sem o Prisma fechando o ciclo, nada funciona', () => {
    const m = model([prism('fogo', 'instavel')], []);
    const a = analyzeCircuit(m, opts);
    expect(a.badge.text).toBe('✕ Não Inicia no Prisma');
    expect(a.load.level).toBe('inativo');
    expect(a.metrics.power).toBe('0.0');
  });

  it('inverter um cabo abre o ciclo', () => {
    const m = modelOf('ex1');
    const c = m.connections.find(x => x.to === 'prism_center')!;
    [c.from, c.to] = [c.to, c.from];
    expect(analyzeCircuit(m, opts).badge.text).toBe('✕ Fluxo Aberto (Não Volta ao Prisma)');
  });

  it('o Quadrado □ só pega: cabo saindo dele não leva energia', () => {
    const m = model(
      [prism(), node('sq', 'square', 170, 0, 'mod_estado')],
      [cable('prism_center', 'sq'), cable('sq', 'prism_center')]
    );
    const a = analyzeCircuit(m, opts);
    expect(a.flow.perPrism[0].closes).toBe(false);
    expect(a.badge.text).toBe('✕ Fluxo Aberto (Não Volta ao Prisma)');
  });

  it('sem Sal △, passar de 100% explode; com Sal △ fica sobrecarregado', () => {
    // Som no Extremo (36) num Selo: capacidade Prisma 1,1 + Selo 9,9 + Selo 9,9 = 20,9
    const nodes = [prism(null), node('a', 'circle', 170, 0, 'som'), node('b', 'circle', -170, 0)];
    nodes[1].activation = 'perfeito'; // 24 de energia → 115%
    const links = [cable('prism_center', 'a'), cable('a', 'b'), cable('b', 'prism_center')];
    expect(analyzeCircuit(model(nodes, links), opts).load.level).toBe('explosao');

    nodes[2].shape = 'triangle'; // capacidade 20,5 → 117%, Sal △ segura até 130%
    expect(analyzeCircuit(model(nodes, links), opts).load.level).toBe('sobrecarga');
  });

  it('nomes vindos de fora são escapados', () => {
    expect(escapeHtml('<b>"x"</b>')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  });
});


describe('Projétil', () => {
  const fromPreset = (key: string) => JSON.parse(JSON.stringify(PRESETS[key]));
  it('logo depois dos formatos ou no fim do ciclo está no lugar recomendado', () => {
    const m = fromPreset('m_projetil_fogo');
    const r = checkProjectiles(m, analyzeFlow(m));
    expect(r.used).toEqual(['n_proj']);
    expect(r.misplaced).toEqual([]);
  });
  it('no meio do ciclo, longe dos formatos, avisa', () => {
    const m = fromPreset('m_projetil_fogo');
    // troca o Projétil com o Fogo: fica entre o Prisma e os formatos
    m.nodes.find((n: { id: string }) => n.id === 'n_fogo').rune = 'mod_projetil';
    m.nodes.find((n: { id: string }) => n.id === 'n_proj').rune = 'fogo';
    const r = checkProjectiles(m, analyzeFlow(m));
    expect(r.misplaced).toEqual(['n_fogo']);
  });
});
