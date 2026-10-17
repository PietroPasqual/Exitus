import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { describeAppearance, describeBeing, type Being } from '../src/core/appearance';
import { buildSpellSheet, narrate } from '../src/core/spellsheet';
import { isMaintainedFireJet } from '../src/core/spell-narrative-semantics';
import { PRESETS } from '../src/data/presets';
import { RUNES } from '../src/data/runes';
import { cable, model, modelOf, node, prism } from './helpers';

const being = (patch: Partial<Being> = {}): Being => ({
  elements: ['fogo'], shapes: [], concepts: [], placement: 'front', projectile: false,
  orbit: false, direction: null, guards: [], estado: false, linked: false,
  merged: false, bond: null, closed: false, ...patch
});
const interpreted = (key: string) => {
  const m = modelOf(key);
  const a = analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false });
  const ap = describeAppearance(m, a.flow);
  return { m, a, ap, sheet: buildSpellSheet(m, a, ap, m.preset.info.name) };
};

describe('Narrativa fiel às manifestações e runas', () => {
  it('Lança-Chamas é emissão sustentada, sem inventar projétil ou duração infinita', () => {
    const { ap, sheet } = interpreted('ex2');
    expect(sheet.description).toEqual(['Um jato de chamas crepitantes surge diante de quem lança e avança em linha reta. Estado mantém a emissão estável.']);
    expect(describeBeing(ap.beings[0], 0)).toContain('Fogo em um jato');
    expect(sheet.description.join(' ')).not.toMatch(/projétil|nunca|infinita|sem se apagar/);
  });

  it.each<Partial<Being>>([
    { estado: false }, { direction: null }, { placement: 'flight' }, { projectile: true },
    { orbit: true }, { shapes: ['forma_esfera'] }, { intentGlyph: 'Aurion' },
    { elements: ['agua', 'fogo'] }, { intentForm: 'lanca' as Being['intentForm'] }
  ])('não transforma outra configuração em jato: %j', patch => {
    const b = being({ estado: true, direction: 'forward', ...patch });
    expect(isMaintainedFireJet(b)).toBe(false);
    expect(narrate(b, 0)).not.toContain('um jato');
    expect(describeBeing(b, 0)).not.toContain('um jato');
  });

  it('Movimento nos acompanhantes da Lança Plasmática não cria Órbita', () => {
    const { ap, sheet } = interpreted('m_lanca_plasmatica');
    expect(sheet.description[1]).toMatch(/^Quatro iguais: /);
    expect(sheet.description[1]).toContain('acompanha o projétil em voo');
    expect(sheet.description[1]).not.toMatch(/gir|órbita/);
    for (const b of ap.beings.filter(b => b.placement === 'escort')) {
      expect(describeBeing(b, 0)).not.toMatch(/gir|órbita/);
    }
  });

  it('Órbita explícita preserva seu movimento e espaçamento', () => {
    const b = being({ orbit: true, concepts: ['movimento'] });
    expect(narrate(b, 3)).toContain('gira em volta da magia');
    expect(narrate(b, 3)).toContain('120°');
    expect(describeBeing(b, 3)).toContain('120°');
  });

  it.each([narrate, describeBeing])('nomeia só a fusão confirmada, mantendo o terceiro material separado (%#)', render => {
    const b = being({ elements: ['agua', 'gelo', 'fogo'], linked: true, merged: true,
      materialFusion: [{ family: 'agua', elements: ['agua', 'gelo'] }] });
    const text = render(b, 0);
    expect(text).toContain('Água e Gelo se fundem pela Ligação');
    expect(text).toContain('Fogo permanece na composição, sem se fundir a esses grupos');
    expect(text).not.toMatch(/partes fundidas|partes se mesclam|chamas crepitantes fundidas/);
  });

  it.each([narrate, describeBeing])('grupos sobrepostos não produzem fusão transitiva (%#)', render => {
    const b = being({ elements: ['terra', 'metal', 'materia'], linked: true, merged: true,
      materialFusion: [{ family: 'terra', elements: ['terra', 'metal'] }, { family: 'terra', elements: ['metal', 'materia'] }] });
    const text = render(b, 0);
    expect(text).toContain('Terra e Metal se fundem');
    expect(text).toContain('Metal e Matéria se fundem');
    expect(text).not.toContain('Terra e Matéria se fundem');
  });

  it.each([narrate, describeBeing])('legado sem grupos não inventa quais materiais se fundem (%#)', render => {
    const b = being({ elements: ['agua', 'gelo', 'fogo'], linked: true, merged: true });
    expect(render(b, 0)).toContain('os materiais fundidos não estão detalhados');
    expect(render(b, 0)).not.toContain('Água e Gelo se fundem');
  });

  it.each([narrate, describeBeing])('narra fusão confirmada entre dois objetos do mesmo material (%#)', render => {
    const m = model([prism(null), ...['fogo', 'forma_esfera', 'fogo', 'forma_cubo', 'mod_ligacao']
      .map((rune, index) => node(`part${index}`, 'circle', index * 30, -150, rune))],
      ['prism_center', 'part0', 'part1', 'part2', 'part3', 'part4', 'prism_center']
        .slice(1).map((to, index) => cable(index ? `part${index - 1}` : 'prism_center', to)));
    const a = analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false });
    const ap = describeAppearance(m, a.flow);
    expect(ap.beings[0].materialFusion).toContainEqual({ family: 'materia', elements: ['fogo'] });
    const text = render(ap.beings[0], ap.orbitCount);
    expect(text).toContain('As partes de Fogo se fundem pela Ligação');
    expect(text).not.toContain('não estão detalhados');
  });

  it('materiais sem Ligação não recebem fusão por pertencerem à mesma família', () => {
    expect(narrate(being({ elements: ['agua', 'gelo'] }), 0)).not.toMatch(/fund|Ligação/);
  });

  it('conceitos não inventam paralisação do tempo ou duração eterna', () => {
    const text = narrate(being({ concepts: ['tempo', 'infinito', 'pressao'] }), 0);
    expect(text).toContain('aura de tempo, infinito e pressão');
    expect(text).not.toMatch(/suspenso|esmagadora|etern|infinita/);
  });

  it('retorno pessoal, toque e área não inventam cobertura, espalhamento ou queda', () => {
    expect(interpreted('m_pele_pedra').sheet.description[0]).toContain('retorna a quem lança pela Direção Contrária');
    expect(narrate(being({ placement: 'touch' }), 0)).toContain('superfície mais próxima pelo Toque');
    expect(narrate(being({ placement: 'far' }), 0)).toContain('superfície mais distante pela Área');
  });

  it.each(Object.values(RUNES).filter(rune => rune.semEfeito).map(rune => rune.id))('explicita %s sem efeito definido somente se energizada', id => {
    const m = model([prism('fogo'), node('undefined', 'circle', 0, -150, id)], [cable('prism_center', 'undefined'), cable('undefined', 'prism_center')]);
    const a = analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false });
    const sh = buildSpellSheet(m, a, describeAppearance(m, a.flow), 'Teste');
    expect(sh.description.at(-1)).toBe(`Runas sem efeito definido nas regras: ${RUNES[id].name}.`);
    m.connections = [];
    const off = analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false });
    expect(buildSpellSheet(m, off, describeAppearance(m, off.flow), 'Teste').description.join(' ')).not.toContain('Runas sem efeito');
  });

  it.each(Object.keys(PRESETS))('descrição de %s é determinística e não altera o modelo ou análise', key => {
    const { m, a, ap, sheet } = interpreted(key);
    const before = JSON.stringify({ m, ap, stats: sheet.stats, effects: sheet.effects });
    const again = buildSpellSheet(m, a, ap, m.preset.info.name);
    expect(again).toEqual(sheet);
    expect(JSON.stringify({ m, ap, stats: again.stats, effects: again.effects })).toBe(before);
    expect(again.description.join(' ')).not.toMatch(/undefined|NaN|,\s*,|:\s*\./);
  });
});
