import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { describeAppearance, type Appearance } from '../src/core/appearance';
import type { Model } from '../src/core/circles';
import { analyzeFlow } from '../src/core/flow';
import { INTENTION_CATALOG, inspectIntention, intentionFormArticle, intentionFormName, resolveIntentionForm, validateIntentionWord } from '../src/core/intention';
import { normalizeProject } from '../src/core/project';
import { buildSpellSheet } from '../src/core/spellsheet';
import { cable, model, node, prism } from './helpers';

const IDS = [
  'lanca', 'espada', 'escudo', 'flecha', 'martelo', 'parede', 'machado',
  'adaga', 'foice', 'arco', 'tridente', 'chicote', 'corrente', 'cajado', 'picareta', 'kunai', 'agulha',
  'bomba', 'esfera', 'cubo', 'piramide', 'cone', 'anel', 'estrela', 'espiral', 'cruz', 'coracao', 'coroa',
  'chave', 'cristal', 'mao', 'explosao', 'arvore', 'flor', 'folha', 'raiz', 'vinha', 'asa', 'garra',
  'presa', 'serpente', 'dragao', 'lobo', 'passaro', 'tentaculo'
] as const;

const normalized = (word: string): string => word.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const options = { specMode: 'simultaneous', missingMat: false } as const;

function circle(bond: string): Model {
  const runes = ['fogo', 'forma_esfera', 'mod_intencao', 'mod_toque', 'dir_padrao'];
  const nodes = [prism(null), ...runes.map((rune, i) => node(`n${i}`, 'circle', Math.cos(i) * 170, Math.sin(i) * 170, rune))];
  nodes.find(n => n.rune === 'mod_intencao')!.bond = bond;
  return model(nodes, nodes.map((n, i) => cable(n.id, nodes[(i + 1) % nodes.length].id)));
}

const appearance = (m: Model): Appearance => describeAppearance(m, analyzeFlow(m));

describe('Catálogo de formas de Intenção', () => {
  it('contém exatamente os 45 identificadores documentados, sem repetição', () => {
    expect(INTENTION_CATALOG).toHaveLength(45);
    expect(INTENTION_CATALOG.map(entry => entry.id).sort()).toEqual([...IDS].sort());
    expect(new Set(INTENTION_CATALOG.map(entry => entry.id)).size).toBe(45);
  });

  it.each(IDS)('%s tem nome, artigo, categoria e palavras válidas', id => {
    const entry = INTENTION_CATALOG.find(candidate => candidate.id === id)!;
    expect(entry).toBeDefined();
    expect(entry.name.trim().length).toBeGreaterThan(0);
    expect(entry.category.trim().length).toBeGreaterThan(0);
    expect(['um', 'uma']).toContain(entry.article);
    expect(entry.words.length).toBeGreaterThan(0);
    expect(intentionFormName(entry.id)).toBe(entry.name);
    expect(intentionFormArticle(entry.id)).toBe(entry.article);
    for (const word of entry.words) {
      expect(validateIntentionWord(word), `${id}: ${word}`).toEqual({ value: word.trim().normalize('NFC'), error: null });
      expect(resolveIntentionForm(word), word).toBe(id);
      expect(resolveIntentionForm(word.toUpperCase()), word).toBe(id);
      expect(resolveIntentionForm(word.normalize('NFD')), word).toBe(id);
      expect(inspectIntention(word), word).toEqual({ status: 'recognized', form: id, matches: [id] });
    }
  });

  it('oferece pelo menos 150 aliases normalizados únicos e sem colisões entre formas', () => {
    const owners = new Map<string, string>();
    for (const entry of INTENTION_CATALOG) {
      for (const word of entry.words) {
        const key = normalized(word);
        if (owners.has(key)) expect(owners.get(key), `Alias compartilhado: ${word}`).toBe(entry.id);
        owners.set(key, entry.id);
      }
    }
    expect(owners.size).toBeGreaterThanOrEqual(150);
  });

  it('conserva nomes e artigos das sete formas originais', () => {
    expect(IDS.slice(0, 7).map(intentionFormName)).toEqual(['Lança', 'Espada', 'Escudo', 'Flecha', 'Martelo', 'Parede', 'Machado']);
    expect(IDS.slice(0, 7).map(intentionFormArticle)).toEqual(['uma', 'uma', 'um', 'uma', 'um', 'uma', 'um']);
  });

  it.each(['bombardeio', 'dragônico', 'cristalino', 'superbomba', 'bomba2', 'esconder', 'Fênix'])('consulta exata mantém %s como palavra própria com glifo', word => {
    expect(resolveIntentionForm(word)).toBeNull();
    expect(inspectIntention(word)).toEqual({ status: 'unknown', form: null, matches: [] });
    const [being] = appearance(circle(word)).beings;
    expect(being).toMatchObject({ elements: ['fogo'], shapes: ['forma_esfera'], bond: word, intentGlyph: word });
    expect(being.intentForm).toBeUndefined();
    expect(being.intentCount).toBeUndefined();
  });

  it.each(['<b>bomba</b>', 'dragão de fogo', 'cristal e bomba'])('HTML e frases %s conservam o vínculo antigo sem nova forma', word => {
    expect(resolveIntentionForm(word)).toBeNull();
    const m = circle(word);
    const snapshot = structuredClone(m);
    const [being] = appearance(m).beings;
    expect(being.bond).toBe(word);
    expect(being.intentForm).toBeUndefined();
    expect(being.intentGlyph).toBeUndefined();
    expect(being.intentCount).toBeUndefined();
    expect(m).toEqual(snapshot);
  });
});

describe('Catálogo integrado ao círculo salvo', () => {
  it.each([
    ['bomba', 'bomba', 'Uma bomba'], ['dragão', 'dragao', 'Um dragão'], ['cristal', 'cristal', 'Um cristal']
  ] as const)('%s muda somente a aparência, preservando regras e componentes', (word, form, opening) => {
    const m = circle('Fênix');
    const before = analyzeCircuit(m, options);
    const beforeAp = describeAppearance(m, before.flow);
    const beforeSheet = buildSpellSheet(m, before, beforeAp, 'Ensaio');
    m.nodes.find(n => n.rune === 'mod_intencao')!.bond = word;
    const snapshot = structuredClone(m);
    const after = analyzeCircuit(m, options);
    const afterAp = describeAppearance(m, after.flow);
    const afterSheet = buildSpellSheet(m, after, afterAp, 'Ensaio');
    expect(afterAp.beings).toHaveLength(1);
    expect(afterAp.beings[0]).toMatchObject({ intentForm: form, elements: ['fogo'], shapes: ['forma_esfera'], placement: 'touch', projectile: false });
    expect(afterAp.beings[0].intentGlyph).toBeUndefined();
    expect(afterAp.beings[0].intentCount).toBeUndefined();
    expect(after.metrics).toEqual(before.metrics);
    expect(after.charge).toEqual(before.charge);
    expect(after.tier).toEqual(before.tier);
    expect(afterSheet.stats).toEqual(beforeSheet.stats);
    expect(afterSheet.effects).toEqual(beforeSheet.effects);
    expect(afterSheet.tags).toEqual(beforeSheet.tags);
    expect(afterSheet.components).toEqual(beforeSheet.components);
    expect(afterSheet.description[0]).toMatch(new RegExp(`^${opening} de chamas crepitantes, moldad[ao] pela Intenção`));
    const physical = (ap: Appearance) => ap.beings.map(({ elements, shapes, concepts, placement, projectile, orbit, direction, guards, estado, linked, merged, closed }) =>
      ({ elements, shapes, concepts, placement, projectile, orbit, direction, guards, estado, linked, merged, closed }));
    expect(physical(afterAp)).toEqual(physical(beforeAp));
    expect(m).toEqual(snapshot);
  });

  it.each(['bomba', 'DRAGÃO', 'cristal'])('normalização e JSON preservam o vínculo %s e sua aparência', bond => {
    const m = circle(bond);
    const before = appearance(m);
    const saved = normalizeProject({ ...m, ringStyle: 'runic', strokeWidth: 6, showGrid: false });
    expect(saved).not.toBeNull();
    const restored = normalizeProject(JSON.parse(JSON.stringify(saved)))!;
    expect(restored.nodes.find(n => n.rune === 'mod_intencao')!.bond).toBe(bond);
    const after = appearance({ ...restored, circles: restored.circles ?? [] });
    expect(after).toEqual(before);
  });
});
