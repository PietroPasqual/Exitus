import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { describeAppearance, describeBeing, type Appearance } from '../src/core/appearance';
import type { Model } from '../src/core/circles';
import { analyzeFlow } from '../src/core/flow';
import { inspectIntention, intentionQuantity, intentionFormName, resolveIntentionForm, validateIntentionWord, type IntentionForm } from '../src/core/intention';
import { buildSpellSheet, narrate } from '../src/core/spellsheet';
import { cable, model, node, prism } from './helpers';

function chain(runes: string[]): Model {
  const nodes = [prism(null), ...runes.map((rune, i) => node(`n${i}`, 'circle', Math.cos(i) * 170, Math.sin(i) * 170, rune))];
  return model(nodes, nodes.map((n, i) => cable(n.id, nodes[(i + 1) % nodes.length].id)));
}

const appearance = (m: Model): Appearance => describeAppearance(m, analyzeFlow(m));
const setBond = (m: Model, bond: string): void => { m.nodes.find(n => n.rune === 'mod_intencao' || n.inner?.includes('mod_intencao'))!.bond = bond; };
const options = { specMode: 'simultaneous', missingMat: false } as const;

describe('Intenção: uma palavra ou um número', () => {
  it.each([
    ['  Fênix  ', 'Fênix'],
    ['  lança  ', 'lança'],
    ['Kael7', 'Kael7'],
    ["D'Água", "D'Água"],
    ['Kael-7', 'Kael-7'],
    ['火', '火'],
    ['7', '7'],
    ['+0003', '+0003'],
    ['1234567890123456789012345678901234567890', '1234567890123456789012345678901234567890'],
    ['Á'.repeat(40), 'Á'.repeat(40)],
    ['𐐀'.repeat(40), '𐐀'.repeat(40)]
  ])('valida e normaliza %s sem converter números', (raw, value) => {
    expect(validateIntentionWord(raw)).toEqual({ value, error: null });
  });

  it.each(['0', '000', '-3', '-3,14', '+7.5', '3,14', '.5', '-.5', '１２３', '٣'])('quantidade %s exige inteiro positivo', raw => {
    expect(validateIntentionWord(raw).error).toBe('A quantidade deve ser um número inteiro maior que zero.');
    expect(intentionQuantity(raw)).toBeNull();
  });

  it.each([
    ['1', '1'], ['7', '7'], ['0003', '3'], ['+3', '3'], ['  +0003  ', '3'],
    ['1234567890123456789012345678901234567890', '1234567890123456789012345678901234567890']
  ])('interpreta a quantidade %s exatamente, sem arredondamento', (raw, canonical) => {
    expect(intentionQuantity(raw)).toBe(canonical);
  });

  it.each(['Fênix', 'Kael7', 'lança', '1'.repeat(41), '+'.concat('1'.repeat(40)), '0', '-3', '3.14', '1 2'])('não interpreta %s como quantidade positiva', raw => {
    expect(intentionQuantity(raw)).toBeNull();
  });

  it.each([
    '', '   ', 'a'.repeat(41), '火'.repeat(41), '𐐀'.repeat(41),
    'lança de água', 'lança\nespada', 'lança\tespada', 'lança e espada',
    '<b>lança</b>', '<script>espada</script>', '&lt;lança&gt;', '&#60;lança&#62;',
    '**lança**', '[espada](https://example.com)', 'Kael_7', '🔥',
    '-Kael', 'Kael-', "'Kael", "Kael'", '.', '+', '-', '7.', '1,2.3', '3.14.15'
  ])('rejeita entrada que não é um único token permitido: %s', raw => {
    const result = validateIntentionWord(raw);
    expect(typeof result.value).toBe('string');
    expect(result.error).toEqual(expect.any(String));
    expect(result.error!.length).toBeGreaterThan(0);
    expect(resolveIntentionForm(raw)).toBeNull();
    expect(inspectIntention(raw)).toEqual({ status: 'unknown', form: null, matches: [] });
  });
});

describe('Intenção: formas conhecidas são palavras exatas', () => {
  it.each([
    ['lança', 'lanca', 'Lança'],
    ['espada', 'espada', 'Espada'],
    ['escudo', 'escudo', 'Escudo'],
    ['flecha', 'flecha', 'Flecha'],
    ['martelo', 'martelo', 'Martelo'],
    ['parede', 'parede', 'Parede'],
    ['machado', 'machado', 'Machado']
  ] as const)('reconhece %s e apresenta seu nome em português', (word, form, label) => {
    expect(resolveIntentionForm(word)).toBe(form);
    expect(inspectIntention(word)).toEqual({ status: 'recognized', form, matches: [form] });
    expect(intentionFormName(form)).toBe(label);
  });

  it.each(['  LANÇA  ', 'lanca', 'lança'.normalize('NFD')])('normaliza caixa, espaços externos e acentuação: %s', word => {
    expect(resolveIntentionForm(word)).toBe('lanca');
    expect(inspectIntention(word)).toEqual({ status: 'recognized', form: 'lanca', matches: ['lanca'] });
  });

  it.each(['Aurion', '123', 'Kael7', 'lançamento', 'esconder', 'superlança', 'espadaço', 'lança-espada'])('aceita %s como vínculo próprio sem escolher uma silhueta conhecida', word => {
    expect(validateIntentionWord(word).error).toBeNull();
    expect(resolveIntentionForm(word)).toBeNull();
    expect(inspectIntention(word)).toEqual({ status: 'unknown', form: null, matches: [] });
  });
});

describe('Intenção: forma visual respeita as runas e seus conjuntos', () => {
  it.each(['lança', 'Aurion', '7'])('aplica %s somente ao primeiro dos dois seres de Fogo', bond => {
    const m = chain(['fogo', 'mod_intencao', 'mod_ser', 'fogo', 'mod_ser']);
    setBond(m, bond);
    const ap = appearance(m);
    expect(ap.beings).toHaveLength(2);
    expect(ap.beings[0]).toMatchObject({ elements: ['fogo'], bond });
    if (bond === 'lança') {
      expect(ap.beings[0].intentForm).toBe('lanca');
      expect(ap.beings[0].intentGlyph).toBeUndefined();
    } else if (bond === '7') {
      expect(ap.beings[0].intentCount).toBe('7');
      expect(ap.beings[0].intentGlyph).toBeUndefined();
      expect(ap.beings[0].intentForm).toBeUndefined();
    } else expect(ap.beings[0].intentGlyph).toBe(bond);
    expect(ap.beings[1]).toMatchObject({ elements: ['fogo'], bond: null });
    expect(ap.beings[1].intentForm).toBeUndefined();
    expect(ap.beings[1].intentGlyph).toBeUndefined();
    expect(ap.beings[1].intentCount).toBeUndefined();
  });

  it.each(['Aurion', 'Kael7'])('qualquer vínculo válido %s molda a matéria em tipografia sem trocar as runas', bond => {
    const m = chain(['fogo', 'forma_esfera', 'mod_intencao', 'mod_toque']);
    setBond(m, bond);
    const [being] = appearance(m).beings;
    expect(being).toMatchObject({ intentGlyph: bond, elements: ['fogo'], shapes: ['forma_esfera'], placement: 'touch', projectile: false, bond });
    expect(being.intentForm).toBeUndefined();
    expect(being.elements).not.toContain('agua');
  });

  it.each([
    ['3', '3'], ['+0003', '3'], ['1234567890123456789012345678901234567890', '1234567890123456789012345678901234567890']
  ])('quantidade %s repete a manifestação sem virar texto ou substituir a Esfera', (bond, count) => {
    const m = chain(['fogo', 'forma_esfera', 'mod_intencao', 'mod_toque']);
    setBond(m, bond);
    const ap = appearance(m);
    expect(ap.beings).toHaveLength(1);
    expect(ap.beings[0]).toMatchObject({ elements: ['fogo'], shapes: ['forma_esfera'], placement: 'touch', projectile: false, bond, intentCount: count });
    expect(ap.beings[0].intentGlyph).toBeUndefined();
    expect(ap.beings[0].intentForm).toBeUndefined();
  });

  it.each([false, true])('quantidade repete a aura de conceito com Esfera=%s sem inventar corpo', shaped => {
    const m = chain(['tempo', ...(shaped ? ['forma_esfera'] : []), 'mod_intencao']);
    setBond(m, '+0003');
    const [being] = appearance(m).beings;
    expect(being).toMatchObject({ elements: [], shapes: shaped ? ['forma_esfera'] : [], concepts: ['tempo'], intentCount: '3' });
    expect(being.intentGlyph).toBeUndefined();
    expect(being.intentForm).toBeUndefined();
  });

  it('uma palavra e uma quantidade no mesmo grupo combinam somente nesse ser', () => {
    const m = chain(['fogo', 'mod_intencao', 'mod_intencao', 'mod_ser', 'agua', 'mod_ser']);
    const intents = m.nodes.filter(n => n.rune === 'mod_intencao');
    intents[0].bond = 'lança';
    intents[1].bond = '3';
    const ap = appearance(m);
    expect(ap.beings).toHaveLength(2);
    expect(ap.beings[0]).toMatchObject({ elements: ['fogo'], intentForm: 'lanca', intentCount: '3', bond: 'lança', intentBonds: ['lança', '3'] });
    expect(ap.beings[0].intentGlyph).toBeUndefined();
    expect(ap.beings[1]).toMatchObject({ elements: ['agua'], bond: null });
    expect(ap.beings[1].intentForm).toBeUndefined();
    expect(ap.beings[1].intentGlyph).toBeUndefined();
    expect(ap.beings[1].intentCount).toBeUndefined();
    expect(ap.beings[1].intentBonds).toBeUndefined();
  });

  it('duas quantidades no mesmo grupo conservam a primeira em vez de multiplicar', () => {
    const m = chain(['fogo', 'mod_intencao', 'mod_intencao']);
    const intents = m.nodes.filter(n => n.rune === 'mod_intencao');
    intents[0].bond = '3';
    intents[1].bond = '5';
    const [being] = appearance(m).beings;
    expect(being).toMatchObject({ intentCount: '3', bond: '3', intentBonds: ['3', '5'] });
    expect(being.intentForm).toBeUndefined();
    expect(being.intentGlyph).toBeUndefined();
  });

  it.each(['lança de água', 'lança e espada', '<b>lança</b>', '0', '-3', '3,14', '.5'])('vínculo antigo inválido %s conserva texto e aparência base sem migração', bond => {
    const m = chain(['fogo', 'forma_esfera', 'mod_intencao']);
    setBond(m, bond);
    const snapshot = structuredClone(m);
    const [being] = appearance(m).beings;
    expect(being).toMatchObject({ elements: ['fogo'], shapes: ['forma_esfera'], bond });
    expect(being.intentForm).toBeUndefined();
    expect(being.intentGlyph).toBeUndefined();
    expect(being.intentCount).toBeUndefined();
    expect(m).toEqual(snapshot);
  });

  it.each([
    ['espada', 'espada', undefined],
    ['Aurion', undefined, 'Aurion']
  ] as const)('conceito puro continua aura; conceito com Esfera dá corpo à Intenção %s', (bond, form, glyph) => {
    const concept = chain(['tempo', 'mod_intencao']);
    const shapedConcept = chain(['tempo', 'forma_esfera', 'mod_intencao']);
    setBond(concept, bond);
    setBond(shapedConcept, bond);
    const [aura] = appearance(concept).beings;
    const [body] = appearance(shapedConcept).beings;
    expect(aura).toMatchObject({ elements: [], shapes: [], concepts: ['tempo'], bond });
    expect(aura.intentForm).toBeUndefined();
    expect(aura.intentGlyph).toBeUndefined();
    expect(body).toMatchObject({ elements: [], shapes: ['forma_esfera'], concepts: ['tempo'], bond });
    expect(body.intentForm).toBe(form);
    expect(body.intentGlyph).toBe(glyph);
  });

  it('reconhece a Intenção dentro de um selo sem perder sua Esfera física', () => {
    const seal = node('seal', 'circle', 100, 0, 'fogo');
    seal.inner = ['forma_esfera', 'mod_intencao'];
    seal.bond = 'martelo';
    const m = model([prism(null), seal], [cable('prism_center', 'seal'), cable('seal', 'prism_center')]);
    const [being] = appearance(m).beings;
    expect(being).toMatchObject({ elements: ['fogo'], shapes: ['forma_esfera'], bond: 'martelo', intentForm: 'martelo' });
  });

  it.each(['lança', 'Aurion', '7'])('Intenção %s dentro da fonte vale para seus seres, sem alcançar outro círculo independente', bond => {
    const source = prism('fogo');
    source.inner = ['mod_intencao'];
    source.bond = bond;
    const sphere = node('sphere', 'circle', 0, -170, 'forma_esfera');
    const firstSer = node('first-ser', 'circle', 150, -80, 'mod_ser');
    const cube = node('cube', 'circle', 150, 80, 'forma_cubo');
    const secondSer = node('second-ser', 'circle', 0, 170, 'mod_ser');
    const otherSource = { ...prism('agua'), id: 'other-source', x: 700, circleId: 'c2' };
    const otherShape = node('other-shape', 'circle', 700, -170, 'forma_esfera');
    const m = model([source, sphere, firstSer, cube, secondSer, otherSource, otherShape], [
      cable(source.id, sphere.id), cable(sphere.id, firstSer.id), cable(firstSer.id, cube.id),
      cable(cube.id, secondSer.id), cable(secondSer.id, source.id),
      cable(otherSource.id, otherShape.id), cable(otherShape.id, otherSource.id)
    ]);
    m.circles.push({ id: 'c2', x: 700, y: 0 });
    const ap = appearance(m);
    const fire = ap.beings.filter(b => b.elements.includes('fogo'));
    const water = ap.beings.find(b => b.elements.includes('agua'))!;
    expect(fire).toHaveLength(2);
    expect(fire.every(b => b.bond === bond && (bond === 'lança' ? b.intentForm === 'lanca' : bond === '7' ? b.intentCount === '7' && !b.intentGlyph && !b.intentForm : b.intentGlyph === bond))).toBe(true);
    expect(water).toMatchObject({ elements: ['agua'], shapes: ['forma_esfera'], bond: null });
    expect(water.intentForm).toBeUndefined();
    expect(water.intentGlyph).toBeUndefined();
    expect(water.intentCount).toBeUndefined();
  });

  it.each(['escudo', '3'])('Intenção %s voltada ao círculo anterior afeta somente os seres daquele círculo', bond => {
    const fire = prism('fogo');
    const intent = { ...prism('mod_intencao'), id: 'center2', shape: 'circle' as const, x: 700, circleId: 'c2', bond };
    const earth = { ...prism('terra'), id: 'center3', x: 1400, circleId: 'c3' };
    const sphere = node('sphere', 'circle', 150, 0, 'forma_esfera');
    const fireSer = node('fire-ser', 'circle', 0, 150, 'mod_ser');
    const water = node('water', 'circle', 850, 0, 'agua');
    const waterSer = node('water-ser', 'circle', 700, 150, 'mod_ser');
    const cube = node('cube', 'circle', 1550, 0, 'forma_cubo');
    const earthSer = node('earth-ser', 'circle', 1400, 150, 'mod_ser');
    const m = model([fire, intent, earth, sphere, fireSer, water, waterSer, cube, earthSer], [
      cable(fire.id, sphere.id), cable(sphere.id, fireSer.id), cable(fireSer.id, fire.id),
      cable('ring:c1', 'ring:c2'),
      cable(intent.id, water.id), cable(water.id, waterSer.id), cable(waterSer.id, intent.id),
      cable(earth.id, cube.id), cable(cube.id, earthSer.id), cable(earthSer.id, earth.id)
    ]);
    m.circles.push({ id: 'c2', x: 700, y: 0 }, { id: 'c3', x: 1400, y: 0 });
    const ap = appearance(m);
    const target = ap.beings.find(b => b.elements.includes('fogo'))!;
    expect(target.bond).toBe(bond);
    if (bond === 'escudo') expect(target.intentForm).toBe('escudo');
    else {
      expect(target.intentCount).toBe('3');
      expect(target.intentForm).toBeUndefined();
      expect(target.intentGlyph).toBeUndefined();
    }
    expect(ap.beings.filter(b => !b.elements.includes('fogo')).every(b => b.intentForm === undefined && b.intentGlyph === undefined && b.intentCount === undefined && b.bond === null)).toBe(true);
  });

  it('a descrição e a narrativa dizem a forma conhecida sem inventar Água ou voo', () => {
    const m = chain(['fogo', 'forma_esfera', 'mod_intencao']);
    setBond(m, 'lança');
    const [being] = appearance(m).beings;
    expect(describeBeing(being, 0)).toMatch(/^Fogo em forma de lança pela Intenção:/);
    expect(narrate(being, 0)).toMatch(/^Uma lança de chamas crepitantes, moldada pela Intenção, surge/);
    expect(narrate(being, 0)).not.toMatch(/água cristalina|disparad/);
  });

  it.each(['Aurion', 'Kael7'])('a narrativa descreve %s como tipografia da matéria pela Intenção', bond => {
    const m = chain(['fogo', 'mod_intencao']);
    setBond(m, bond);
    const [being] = appearance(m).beings;
    const description = describeBeing(being, 0);
    const narrative = narrate(being, 0);
    expect(description).toContain(bond);
    expect(description).toMatch(/tipograf|letras|caracteres/i);
    expect(description).toContain('Fogo');
    expect(narrative).toContain(bond);
    expect(narrative).toMatch(/tipograf|letras|caracteres|inscri/i);
    expect(narrative).toMatch(/chamas|fogo/i);
    expect(narrative).toMatch(/Intenção/);
  });

  it('a narrativa apresenta o número como quantidade de manifestações', () => {
    const m = chain(['fogo', 'forma_esfera', 'mod_intencao']);
    setBond(m, '+0003');
    const [being] = appearance(m).beings;
    expect(narrate(being, 0)).toMatch(/^3 manifestações: /);
    expect(narrate(being, 0)).toMatch(/esfera de chamas/);
    expect(narrate(being, 0)).not.toMatch(/tipograf|inscrição|caracteres/);
  });

  it.each(['lança', '7', '+0003', '1234567890123456789012345678901234567890'])('a aparência de %s preserva regras, custos, estatísticas e desenho original', bond => {
    const m = chain(['fogo', 'forma_esfera', 'mod_intencao', 'mod_projetil', 'dir_padrao']);
    setBond(m, 'Fênix');
    const beforeAnalysis = analyzeCircuit(m, options);
    const beforeAppearance = describeAppearance(m, beforeAnalysis.flow);
    const beforeSheet = buildSpellSheet(m, beforeAnalysis, beforeAppearance, 'Ensaio');
    setBond(m, bond);
    const snapshot = structuredClone(m);
    const afterAnalysis = analyzeCircuit(m, options);
    const afterAppearance = describeAppearance(m, afterAnalysis.flow);
    const afterSheet = buildSpellSheet(m, afterAnalysis, afterAppearance, 'Ensaio');
    expect(afterAnalysis.metrics).toEqual(beforeAnalysis.metrics);
    expect(afterAnalysis.charge).toEqual(beforeAnalysis.charge);
    expect(afterAnalysis.tier).toEqual(beforeAnalysis.tier);
    expect(afterSheet.stats).toEqual(beforeSheet.stats);
    expect(afterSheet.effects).toEqual(beforeSheet.effects);
    expect(afterSheet.tags).toEqual(beforeSheet.tags);
    expect(afterSheet.components).toEqual(beforeSheet.components);
    const body = (ap: Appearance) => ap.beings.map(({ elements, shapes, concepts, placement, projectile, orbit, direction, guards, estado, linked, merged, closed }) =>
      ({ elements, shapes, concepts, placement, projectile, orbit, direction, guards, estado, linked, merged, closed }));
    expect(body(afterAppearance)).toEqual(body(beforeAppearance));
    if (bond === 'lança') expect(afterAppearance.beings[0].intentForm).toBe('lanca');
    else {
      expect(afterAppearance.beings[0].intentCount).toBe(intentionQuantity(bond));
      expect(afterAppearance.beings[0].intentGlyph).toBeUndefined();
      expect(afterAppearance.beings[0].intentForm).toBeUndefined();
    }
    expect(m).toEqual(snapshot);
  });
});

// Keep all documented IDs type checked alongside the public name helper.
const supportedForms: IntentionForm[] = ['lanca', 'espada', 'escudo', 'flecha', 'martelo', 'parede', 'machado'];
it('todas as formas documentadas têm um nome legível', () => {
  expect(supportedForms.map(intentionFormName)).toEqual(['Lança', 'Espada', 'Escudo', 'Flecha', 'Martelo', 'Parede', 'Machado']);
});
