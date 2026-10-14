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

describe('Fonte de todo Selo e Col', () => {
  it('um Selo ○ sem cabo vindo do Prisma deixa o círculo sem fonte', () => {
    const m = { circles: [{ id: 'c1', x: 0, y: 0 }], ...JSON.parse(JSON.stringify(PRESETS.m_projetil_fogo)) };
    m.nodes.push({ id: 'solto', shape: 'circle', x: 90, y: 90, size: 40, rot: 0, rune: null, activation: 'ativacao', charge: 1 });
    const a = analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false, spellInfo: null });
    expect(a.badge.kind).toBe('danger');
    expect(a.badge.text).toContain('Fonte');
  });
  it('ir e voltar do Prisma já é uma fonte', () => {
    const m = { circles: [{ id: 'c1', x: 0, y: 0 }], ...JSON.parse(JSON.stringify(PRESETS.m_projetil_fogo)) };
    m.nodes.push({ id: 'vai_volta', shape: 'square', x: 90, y: 90, size: 40, rot: 0, rune: null, activation: 'ativacao', charge: 1 });
    m.connections.push({ id: 'x1', from: 'prism_center', to: 'vai_volta', type: 'straight', mode: 'simultaneous' });
    const a = analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false, spellInfo: null });
    expect(a.badge.text).not.toContain('Fonte');
  });
});

describe('Círculo da magia', () => {
  it('magia dentro de um Selo é de 2º círculo; sem isso, 1º', async () => {
    const { spellTier } = await import('../src/core/analysis');
    expect(spellTier(PRESETS.m_projetil_fogo)).toBe(2);
    expect(spellTier(PRESETS.ex1)).toBe(1);
  });
});

describe('Círculos sobrepostos: Estrela dupla e 2,5º círculo', () => {
  it('círculos unidos pela Estrela são de 2,5º círculo', async () => {
    const { spellTier } = await import('../src/core/analysis');
    expect(spellTier(PRESETS.ex8)).toBe(2.5);
  });
  it('com uma Estrela só (não dupla) falta a 2ª Estrela', () => {
    const m = JSON.parse(JSON.stringify(PRESETS.ex8));
    delete m.nodes.find((n: { id: string }) => n.id === 'n_star').double;
    const a = analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false, spellInfo: null });
    expect(a.badge.text).toContain('2ª Estrela');
  });
});

describe('Lança de Fogo Plasmática: círculos ligados, fonte dentro do Selo e check-list de níveis', () => {
  it('é de 2º e de 3º círculo ao mesmo tempo', async () => {
    const { spellTiers } = await import('../src/core/analysis');
    expect(spellTiers(PRESETS.m_lanca_plasmatica)).toEqual([2, 3]);
  });
  it('com o centro sendo um Col □, a fonte passa a ser o Prisma da magia dentro do Selo', async () => {
    const { getSources } = await import('../src/core/circles');
    const m = JSON.parse(JSON.stringify(PRESETS.m_lanca_plasmatica));
    const center = m.nodes.find((n: { id: string }) => n.id === 'prism_center');
    center.shape = 'square';
    expect(getSources(m).map((n: { id: string }) => n.id)).toContain('n_fogo');
  });
  it('centro que não é Prisma e nenhuma magia dentro de Selo: círculo sem fonte', () => {
    const m = JSON.parse(JSON.stringify(PRESETS.m_lanca_plasmatica));
    m.nodes.find((n: { id: string }) => n.id === 'prism_center').shape = 'square';
    m.nodes.forEach((n: { inner?: string[] }) => { delete n.inner; });
    const a = analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false, spellInfo: null });
    expect(a.badge.text).toContain('sem Fonte');
  });
  it('círculos separados ligados pedem o círculo em volta de tudo', () => {
    const m = JSON.parse(JSON.stringify(PRESETS.m_lanca_plasmatica));
    delete m.envelope;
    const a = analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false, spellInfo: null });
    expect(a.badge.text).toContain('Volta de Tudo');
  });
});

describe('Estado', () => {
  it('mantém as runas de objeto/elemento anteriores e avisa quando não vem depois delas', async () => {
    const { checkEstados } = await import('../src/core/estado');
    const m = model(
      [prism('fogo'), node('a', 'circle', 0, -150, 'vento'), node('b', 'circle', 150, 0, 'mod_estado'), node('c', 'circle', 0, 150, 'mod_ser'), node('d', 'circle', -150, 0, 'mod_estado')],
      [cable('prism_center', 'a'), cable('a', 'b'), cable('b', 'c'), cable('c', 'd'), cable('d', 'prism_center')]);
    const uses = checkEstados(m, analyzeFlow(m));
    const b = uses.find(u => u.id === 'b')!, d = uses.find(u => u.id === 'd')!;
    expect(b.kept).toEqual(expect.arrayContaining(['fogo', 'vento']));
    expect(b.wellPlaced).toBe(true);
    expect(d.wellPlaced).toBe(false);
  });
});
