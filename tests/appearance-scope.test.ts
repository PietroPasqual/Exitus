import { describe, expect, it } from 'vitest';
import { describeAppearance, describeBeing, type Appearance } from '../src/core/appearance';
import type { Model } from '../src/core/circles';
import { analyzeFlow } from '../src/core/flow';
import { PRESETS } from '../src/data/presets';
import { RUNES } from '../src/data/runes';
import { cable, model, modelOf, node, prism } from './helpers';

function chain(runes: string[], source: string | null = null): Model {
  const nodes = [prism(source), ...runes.map((rune, i) => node(`n${i}`, 'circle', Math.cos(i) * 170, Math.sin(i) * 170, rune))];
  return model(nodes, nodes.map((n, i) => cable(n.id, nodes[(i + 1) % nodes.length].id)));
}

const appearance = (m: Model): Appearance => describeAppearance(m, analyzeFlow(m));

function sharedShape(): Model {
  return model([
    prism('fogo'),
    node('shape', 'circle', 0, -170, 'forma_esfera'),
    node('direction', 'circle', 150, 80, 'dir_padrao'),
    node('state', 'circle', -150, 80, 'mod_estado')
  ], [
    cable('prism_center', 'shape'),
    cable('shape', 'direction'), cable('direction', 'prism_center'),
    cable('shape', 'state'), cable('state', 'prism_center')
  ]);
}

describe('Aparência: escopo dos seres e identidade das formas', () => {
  it.each([
    ['mod_toque', 'touch'],
    ['mod_area', 'far']
  ] as const)('%s afeta somente a esfera de água depois do Ser', (modifier, placement) => {
    const ap = appearance(chain(['fogo', 'forma_esfera', 'mod_ser', 'agua', 'forma_esfera', modifier]));
    expect(ap.beings).toHaveLength(2);
    expect(ap.beings.find(b => b.elements.includes('fogo'))).toMatchObject({ shapes: ['forma_esfera'], placement: 'front' });
    expect(ap.beings.find(b => b.elements.includes('agua'))).toMatchObject({ shapes: ['forma_esfera'], placement });
  });

  it('Estado não passa para outro ser que usa o mesmo elemento', () => {
    const ap = appearance(chain(['fogo', 'mod_estado', 'mod_ser', 'fogo', 'mod_ser']));
    expect(ap.beings).toHaveLength(2);
    expect(ap.beings.map(b => ({ elements: b.elements, estado: b.estado }))).toEqual([
      { elements: ['fogo'], estado: true },
      { elements: ['fogo'], estado: false }
    ]);
  });

  it('a palavra de Intenção pertence somente ao ser ligado à sua runa', () => {
    const m = chain(['fogo', 'mod_intencao', 'mod_ser', 'fogo', 'mod_ser']);
    m.nodes.find(n => n.rune === 'mod_intencao')!.bond = 'Fênix';
    const ap = appearance(m);
    expect(ap.beings).toHaveLength(2);
    expect(ap.beings.map(b => b.bond)).toEqual(['Fênix', null]);
  });

  it('Intenção sem alvo ou fora da rota não dá vínculo a todas as manifestações', () => {
    const m = chain(['mod_intencao', 'fogo', 'mod_ser', 'agua', 'mod_ser']);
    m.nodes.find(n => n.rune === 'mod_intencao')!.bond = 'Sem alvo anterior';
    const unused = node('unused-intent', 'circle', 100, 100, 'mod_intencao');
    unused.bond = 'Fora da rota'; m.nodes.push(unused);
    expect(appearance(m).beings.map(being => being.bond)).toEqual([null, null]);
  });

  it('Intenção logo depois do Ser acompanha aquele conjunto', () => {
    const m = chain(['fogo', 'mod_ser', 'mod_intencao', 'agua', 'mod_ser']);
    m.nodes.find(n => n.rune === 'mod_intencao')!.bond = 'Primeiro conjunto';
    expect(appearance(m).beings.map(being => being.bond)).toEqual(['Primeiro conjunto', null]);
  });

  it('Toque da magia inteira não alcança outro círculo com uma esfera igual', () => {
    const secondPrism = { ...prism('agua'), id: 'second-prism', x: 700, circleId: 'c2' };
    const m = model([
      prism('fogo'), node('first-shape', 'circle', 70, 0, 'forma_esfera'), node('touch', 'circle', 120, 50, 'mod_toque'),
      secondPrism, node('second-shape', 'circle', 770, 0, 'forma_esfera'), node('ser', 'circle', 820, 50, 'mod_ser')
    ], [
      cable('prism_center', 'first-shape'), cable('first-shape', 'touch'), cable('touch', 'prism_center'),
      cable('second-prism', 'second-shape'), cable('second-shape', 'ser'), cable('ser', 'second-prism')
    ]);
    m.circles.push({ id: 'c2', x: 700, y: 0 });
    const ap = appearance(m);
    expect(ap.beings).toHaveLength(2);
    expect(ap.beings.find(being => being.elements.includes('fogo'))).toMatchObject({ placement: 'touch' });
    expect(ap.beings.find(being => being.elements.includes('agua'))).toMatchObject({ placement: 'front' });
  });

  it('Ligação não cola outro ser que reutiliza o formato Esfera', () => {
    const ap = appearance(chain([
      'fogo', 'forma_esfera', 'agua', 'forma_cubo', 'mod_ligacao', 'mod_ser',
      'terra', 'forma_esfera', 'mod_ser'
    ]));
    expect(ap.beings).toHaveLength(2);
    expect(ap.beings[0]).toMatchObject({ elements: ['fogo', 'agua'], shapes: ['forma_esfera', 'forma_cubo'], linked: true });
    expect(ap.beings[1]).toMatchObject({ elements: ['terra'], shapes: ['forma_esfera'], linked: false, merged: false });
  });

  it.each([
    ['mod_toque', 'touch'], ['mod_area', 'far'], ['mod_ligacao', 'front'], ['mod_estado', 'front']
  ] as const)('%s antes de Ser não se espalha pela cor herdada da Matriz', (modifier, placement) => {
    const ap = appearance(chain(['forma_esfera', modifier, 'mod_ser', 'forma_cubo', 'mod_ser'], 'fogo'));
    expect(ap.beings).toHaveLength(2);
    expect(ap.beings.map(being => being.elements)).toEqual([['fogo'], ['fogo']]);
    expect(ap.beings[0]).toMatchObject({ placement, linked: modifier === 'mod_ligacao', estado: modifier === 'mod_estado' });
    expect(ap.beings[1]).toMatchObject({ placement: 'front', linked: false, estado: false });
  });

  it('Estado e Intenção dentro da fonte mantêm a contribuição global daquela fonte', () => {
    const state = chain(['forma_esfera', 'mod_ser', 'forma_cubo', 'mod_ser'], 'fogo');
    state.nodes[0].inner = ['mod_estado'];
    expect(appearance(state).beings.map(being => being.estado)).toEqual([true, true]);
    const intent = chain(['forma_esfera', 'mod_ser', 'forma_cubo', 'mod_ser'], 'fogo');
    intent.nodes[0].inner = ['mod_intencao']; intent.nodes[0].bond = 'Fonte de Fênix';
    expect(appearance(intent).beings.map(being => being.bond)).toEqual(['Fonte de Fênix', 'Fonte de Fênix']);
  });

  it.each(['mod_toque', 'mod_area'])('%s sem objeto anterior não atinge runas posteriores', modifier => {
    expect(appearance(chain([modifier, 'fogo'])).beings[0].placement).toBe('front');
    expect(appearance(chain(['dir_padrao', modifier, 'fogo'])).beings[0].placement).toBe('front');
  });

  it.each([['mod_toque', 'touch'], ['mod_area', 'far']] as const)('%s final de magia inteira inclui os grupos paralelos da mesma Matriz', (modifier, placement) => {
    const m = model([
      prism(null), node('fire', 'circle', 80, 0, 'fogo'), node('surface', 'circle', 130, 40, modifier),
      node('water', 'circle', -80, 0, 'agua'), node('ser', 'circle', -130, 40, 'mod_ser')
    ], [
      cable('prism_center', 'fire'), cable('fire', 'surface'), cable('surface', 'prism_center'),
      cable('prism_center', 'water'), cable('water', 'ser'), cable('ser', 'prism_center')
    ]);
    expect(appearance(m).beings.map(being => being.placement)).toEqual([placement, placement]);
  });

  it.each([{ runes: ['fogo', 'forma_esfera', 'mod_ser', 'agua', 'forma_cubo', 'mod_ser'] },
    { runes: ['fogo', 'forma_esfera', 'mod_ser', 'fogo', 'forma_esfera', 'mod_ser'] }])('Ser dentro de um selo preserva dois grupos físicos: %j', ({ runes }) => {
    const m = chain([]);
    const seal = node('inner-groups', 'circle', 100, 0, null); seal.inner = runes;
    m.nodes.push(seal); m.connections = [cable('prism_center', seal.id), cable(seal.id, 'prism_center')];
    const ap = appearance(m);
    expect(ap.beings).toHaveLength(2);
    expect(ap.beings.map(being => being.shapes)).toEqual([[runes[1]], [runes[4]]]);
    expect(ap.beings.every(being => being.closed)).toBe(true);
  });

  it('Ser na própria Matriz separa seus elementos e formatos, sem herança entre grupos', () => {
    const m = chain([], 'fogo'); m.nodes[0].inner = ['forma_esfera', 'mod_ser', 'agua', 'forma_cubo', 'mod_ser'];
    const ap = appearance(m);
    expect(ap.beings.map(being => ({ elements: being.elements, shapes: being.shapes, closed: being.closed }))).toEqual([
      { elements: ['fogo'], shapes: ['forma_esfera'], closed: true },
      { elements: ['agua'], shapes: ['forma_cubo'], closed: true }
    ]);
  });

  it('um selo que serve de fonte também separa seus grupos internos com Ser', () => {
    const center = { ...prism(null), shape: 'circle' as const };
    const source = node('seal-source', 'circle', 80, 0, null);
    source.inner = ['fogo', 'forma_esfera', 'mod_ser', 'agua', 'forma_cubo', 'mod_ser'];
    const direction = node('direction', 'circle', 140, 70, 'dir_padrao');
    const m = model([center, source, direction], [cable(source.id, direction.id), cable(direction.id, source.id)]);
    const ap = appearance(m);
    expect(ap.beings.map(being => ({ elements: being.elements, shapes: being.shapes, closed: being.closed }))).toEqual([
      { elements: ['fogo'], shapes: ['forma_esfera'], closed: true },
      { elements: ['agua'], shapes: ['forma_cubo'], closed: true }
    ]);
  });

  it('uma forma compartilhada por duas rotas aparece uma única vez', () => {
    const ap = appearance(sharedShape());
    expect(ap.beings).toHaveLength(1);
    expect(ap.beings[0]).toMatchObject({ elements: ['fogo'], shapes: ['forma_esfera'], direction: 'forward', estado: true });
  });

  it('duas formas físicas distintas com a mesma runa continuam sendo duas formas', () => {
    const ap = appearance(chain(['fogo', 'forma_esfera', 'forma_esfera']));
    expect(ap.beings).toHaveLength(1);
    expect(ap.beings[0].shapes).toEqual(['forma_esfera', 'forma_esfera']);
  });

  it('runas de formato repetidas dentro do mesmo selo são preservadas em rotas compartilhadas', () => {
    const m = sharedShape();
    m.nodes.find(n => n.id === 'shape')!.inner = ['forma_esfera'];
    const ap = appearance(m);
    expect(ap.beings).toHaveLength(1);
    expect(ap.beings[0].shapes).toEqual(['forma_esfera', 'forma_esfera']);
  });

  it('Estado continua mantendo Fogo e Vento que correm em paralelo', () => {
    const m = model([
      prism(null),
      node('fire', 'circle', 0, -170, 'fogo'),
      node('state', 'circle', 150, 80, 'mod_estado'),
      node('wind', 'circle', -150, 80, 'vento')
    ], [
      cable('prism_center', 'fire'),
      cable('fire', 'state'), cable('state', 'prism_center'),
      cable('fire', 'wind'), cable('wind', 'prism_center')
    ]);
    const ap = appearance(m);
    expect(ap.beings).toHaveLength(1);
    expect(ap.beings[0]).toMatchObject({ elements: ['fogo', 'vento'], estado: true });
  });

  it('Estado em paralelo respeita o Ser antes de outro fogo independente', () => {
    const m = model([
      prism(null),
      node('fire', 'circle', 0, -170, 'fogo'),
      node('state', 'circle', 150, -80, 'mod_estado'),
      node('wind', 'circle', -150, -80, 'vento'),
      node('first-being', 'circle', 0, 20, 'mod_ser'),
      node('other-fire', 'circle', 80, 100, 'fogo'),
      node('other-being', 'circle', 0, 170, 'mod_ser')
    ], [
      cable('prism_center', 'fire'), cable('fire', 'state'), cable('fire', 'wind'),
      cable('state', 'first-being'), cable('wind', 'first-being'),
      cable('first-being', 'other-fire'), cable('other-fire', 'other-being'),
      cable('other-being', 'prism_center')
    ]);
    const ap = appearance(m);
    expect(ap.beings).toHaveLength(2);
    expect(ap.beings[0]).toMatchObject({ elements: ['fogo', 'vento'], estado: true });
    expect(ap.beings[1]).toMatchObject({ elements: ['fogo'], estado: false });
  });

  it.each(Object.keys(PRESETS))('%s mantém uma descrição finita, visível e determinística', key => {
    const m = modelOf(key);
    const flow = analyzeFlow(m);
    const ap = describeAppearance(m, flow);
    expect(describeAppearance(m, flow)).toEqual(ap);
    expect(Number.isFinite(ap.orbitCount)).toBe(true);
    expect(ap.orbitCount).toBe(ap.beings.filter(b => b.orbit).length);
    const visible = m.nodes.some(n => flow.working.has(n.id) && [n.rune, ...(n.inner ?? [])]
      .some(r => r && ['elemental', 'shape'].includes(RUNES[r]?.category)));
    if (visible) expect(ap.beings.length).toBeGreaterThan(0);
    for (const being of ap.beings) {
      expect(describeBeing(being, ap.orbitCount)).not.toMatch(/undefined|NaN|Infinity/);
      expect(describeBeing(being, ap.orbitCount)).toMatch(/: .+\.$/);
      expect([...being.elements, ...being.shapes, ...being.concepts].every(id => !!RUNES[id])).toBe(true);
    }
  });
});
