import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { describeAppearance, describeBeing, type Being } from '../src/core/appearance';
import type { Model } from '../src/core/circles';
import { buildSpellSheet, narrate } from '../src/core/spellsheet';
import { isMaintainedDirectedStream, isMaintainedFireJet } from '../src/core/spell-narrative-semantics';
import { CONCEPT_RUNES } from '../src/core/structural';
import { PRESETS } from '../src/data/presets';
import { RUNES } from '../src/data/runes';
import { modelOf } from './helpers';

const materials = Object.keys(RUNES).filter(id => RUNES[id].category === 'elemental' && !CONCEPT_RUNES.has(id));
const matter: Record<string, string> = {
  fogo: 'chamas crepitantes', terra: 'rocha maciça', agua: 'água cristalina', vento: 'vento uivante',
  raio: 'eletricidade estalante', metal: 'metal polido', gelo: 'gelo', som: 'ondas sonoras vibrantes',
  natureza: 'vinhas e folhas vivas', acido: 'ácido borbulhante', ilusao: 'ilusão cintilante',
  luz: 'luz', sombra: 'sombras densas', materia: 'matéria bruta', gravidade: 'gravidade', espaco: 'espaço distorcido'
};
const serialize = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  item instanceof Map ? { $map: [...item] } : item instanceof Set ? { $set: [...item] } : item);
const signature = async (value: unknown): Promise<string> => Array.from(new Uint8Array(
  await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialize(value)))
)).map(byte => byte.toString(16).padStart(2, '0')).join('');
const options = { specMode: 'simultaneous', missingMat: false } as const;
const substitute = (material: string) => {
  const m = modelOf('ex2');
  // Both source and upper seal change. All geometry, routes, Estado and Directions stay intact.
  m.nodes.forEach(n => { if (n.rune === 'fogo') n.rune = material; });
  return m;
};
const interpret = (m: Model) => {
  const a = analyzeCircuit(m, options), ap = describeAppearance(m, a.flow);
  return { a, ap, sheet: buildSpellSheet(m, a, ap, 'Lança-Chamas') };
};
const being = (patch: Partial<Being> = {}): Being => ({
  elements: ['terra'], shapes: [], concepts: [], placement: 'front', projectile: false,
  orbit: false, direction: 'forward', guards: [], estado: true, linked: false,
  merged: false, bond: null, closed: false, ...patch
});

// Captured before changing presentation, from 88fc878 plus the unrelated raster cache work.
// Each SHA-256 freezes the complete Model, CircuitAnalysis (including Map/Set entries),
// interpreted Appearance, and every SpellSheet field except its descriptive paragraphs.
const mechanicalBaselines: Record<string, string> = {
  fogo: '5532d898a758ce4eefdaf1024519d61b0a69ee9f9d022078813b4230544671b8',
  terra: 'd06f797a064e581c66c59656a6f39b6e90840d75a68321d5c7e22a8aeee6f44e',
  agua: '0f89531b6fd450953b46208e69ea303832318aa724ff1fb9210de224976511f4',
  vento: 'e6b13935b42f745ec83a068974b24a799a40a7f03f3411f6d212fbe45bf51ada',
  raio: '6ec45f8d07733fd89a38f80ed3e4ca4598b162418c58dac221a826616ea1ba96',
  metal: 'b040b0b9de8ed0b1f6a5564efd02c6b08550227553d4e575373d16c0cd799745',
  gelo: '667832c509b181b18c10b17106e3d203c790aa430fdf45d998536a6fcd6d30d5',
  som: '4300d2bfc64d708de9bcd8b31a70e99f9164fe293d069790f3b093df1ff19531',
  natureza: '2587669943d5edee87fd516cc80658227eb77a2d47baedb42ff44a5a626b6895',
  acido: 'f09b0392677de8e00b29f58f3f5fe1bc63716d8f246363636b82da8d5fd7ee2b',
  ilusao: 'df022d10f5aec00270bb86f3d297ef9843321c9cf0402ca5d24f0cd768f6b2d7',
  luz: 'c0efc45d3befb359602433977a75ff0b17275d053dc72f7ea7f1ff1d46ed05c6',
  sombra: '36608f9c1dc664337b19e9a7e36a47a0bed898b44b7e820e030ca3466f9fde9a',
  materia: 'fe7ec36f33184249357d2e00688f421dc7566a7b00f88cc7fe4b0d46def9288a',
  gravidade: 'a72ea8bf650b23cd070f6e6fbffbd513194ace80397b0a3dbcbbe1fa3013e124',
  espaco: '766cdd1c7a156cc797e0538f4068eebcfd27e0e8d5e41b619adb339e7ccd7c92'
};

describe('Material-independent maintained directed stream narrative', () => {
  it('covers exactly the sixteen physical body materials, excluding all eight concepts', () => {
    expect(materials).toHaveLength(16);
    expect(CONCEPT_RUNES.size).toBe(8);
    expect(Object.keys(mechanicalBaselines)).toEqual(materials);
    expect(Object.keys(matter).sort()).toEqual([...materials].sort());
  });

  it.each(materials)('the original ex2 with %s emits a continuous material-specific stream', material => {
    const m = substitute(material), { a, ap, sheet } = interpret(m);
    expect(m.nodes.filter(n => n.rune === material).map(n => n.id)).toEqual(['prism_center', 'n_top']);
    expect(ap.beings).toHaveLength(1);
    const b = ap.beings[0];
    expect(b).toMatchObject({ elements: [material], shapes: [], estado: true, direction: 'forward', placement: 'front', projectile: false, orbit: false });
    expect(isMaintainedDirectedStream(b)).toBe(true);
    expect(sheet.description).toEqual([
      `Um jato contínuo de ${matter[material]} surge diante de quem lança e avança em linha reta. Estado mantém a emissão estável.`
    ]);
    const name = RUNES[material].name.split(' (')[0].split(' /')[0];
    expect(describeBeing(b, ap.orbitCount)).toContain(`${name} em um jato contínuo`);
    expect(sheet.description.join(' ')).not.toMatch(/projétil|nunca|infinita|etern|sem se apagar|dano|duração|temperatura/);
    if (material !== 'fogo') expect(sheet.description.join(' ')).not.toMatch(/chamas|fogo|calor|incinera|derret|queim|magma/i);
    const before = serialize({ m, a, ap });
    narrate(b, ap.orbitCount); describeBeing(b, ap.orbitCount); isMaintainedDirectedStream(b);
    expect(serialize({ m, a, ap })).toBe(before);
  });

  it.each(materials)('%s retains the complete pre-change interpretation, energy, checker and effects', async material => {
    const m = substitute(material), { a, ap, sheet: { description, ...sheet } } = interpret(m);
    void description;
    expect(await signature({ m, a, ap, sheet })).toBe(mechanicalBaselines[material]);
  });

  it.each(materials)('%s requires actual Estado and forward Direction in the ex2 model', material => {
    for (const control of ['no-estado', 'no-direction', 'back-direction'] as const) {
      const m = substitute(material);
      m.nodes.forEach(n => {
        if (control === 'no-estado' && n.rune === 'mod_estado') n.rune = null;
        if (control !== 'no-estado' && n.rune === 'dir_padrao') n.rune = control === 'back-direction' ? 'dir_contraria' : null;
      });
      const { ap, sheet } = interpret(m);
      expect(ap.beings).toHaveLength(1);
      const b = ap.beings[0], text = [...sheet.description, describeBeing(b, ap.orbitCount)].join(' ');
      expect(isMaintainedDirectedStream(b)).toBe(false);
      expect(text).not.toContain('jato');
      if (control === 'no-estado') expect(b.estado).toBe(false);
      if (control === 'no-direction') expect(b.direction).toBe(null);
      if (control === 'back-direction') {
        expect(b).toMatchObject({ direction: 'back', placement: 'self' });
        expect(text).toContain('retorna a quem lança pela Direção Contrária');
        expect(text).not.toMatch(/avança em linha reta|segue para a frente/);
      }
    }
  });

  it.each<Partial<Being>>([
    { estado: false }, { direction: null }, { direction: 'back' },
    { placement: 'self' }, { placement: 'flight' }, { placement: 'touch' }, { placement: 'far' }, { placement: 'escort' },
    { projectile: true }, { orbit: true }, { shapes: ['forma_esfera'] },
    { intentForm: 'lanca' }, { intentGlyph: 'Aurion' }, { elements: [] },
    { elements: ['not-a-rune'] }, { elements: ['forma_esfera'] }, { elements: ['mod_estado'] },
    ...[...CONCEPT_RUNES].map(id => ({ elements: [id], concepts: [id] }))
  ])('preserves every non-material gate and rejects absent/invalid body material: %j', patch => {
    const b = being(patch);
    expect(isMaintainedDirectedStream(b)).toBe(false);
    expect(narrate(b, 0)).not.toContain('jato contínuo');
    expect(describeBeing(b, 0)).not.toContain('jato contínuo');
  });

  it('retains fire-only compatibility until the renderer migrates to the generic predicate', () => {
    expect(isMaintainedFireJet(being({ elements: ['fogo', 'agua'] }))).toBe(true);
    expect(isMaintainedFireJet(being({ elements: ['agua', 'fogo'] }))).toBe(false);
    expect(isMaintainedFireJet(being({ elements: ['terra'] }))).toBe(false);
    expect(isMaintainedFireJet(being({ elements: ['fogo'], estado: false }))).toBe(false);
  });

  it.each([['agua', 'fogo'], ['terra', 'metal'], ['agua', 'gelo'], ['metal', 'gelo', 'terra']])(
    'keeps all actual ex2 mixture constituents without inferring fusion: %j', (...elements: string[]) => {
      const m = substitute(elements[0]);
      const top = m.nodes.find(n => n.id === 'n_top')!;
      top.rune = elements[1];
      if (elements.length > 2) top.inner = elements.slice(2);
      const { ap, sheet } = interpret(m), b = ap.beings[0];
      expect([...b.elements].sort()).toEqual([...elements].sort());
      expect(isMaintainedDirectedStream(b)).toBe(true);
      expect(b.materialFusion ?? []).toEqual([]);
      const text = sheet.description.join(' ');
      for (const element of elements) expect(text).toContain(matter[element]);
      expect(text).toContain('Um jato contínuo');
      expect(text).not.toMatch(/fund|mescla|Ligação/);
      if (!elements.includes('fogo')) expect(text).not.toMatch(/chama|calor|fogo|queim|magma/i);
    }
  );

  it.each([narrate, describeBeing])('does not expand fusion metadata or omit separate stream constituents (%#)', render => {
    const b = being({ elements: ['agua', 'gelo', 'terra'], linked: true, merged: true,
      materialFusion: [{ family: 'tempo', elements: ['agua', 'gelo'] }] });
    const before = serialize(b), text = render(b, 0);
    expect(text).toContain('jato contínuo');
    expect(text).toContain('Água e Gelo se fundem pela Ligação');
    expect(text).toContain('Terra permanece na composição, sem se fundir a esses grupos');
    expect(text).not.toMatch(/Terra e (Água|Gelo) se fundem|chama|calor|queim/);
    expect(serialize(b)).toBe(before);
  });

  it('retains all 44 existing preset descriptions outside the new gate, character for character', async () => {
    const outside = Object.keys(PRESETS).flatMap(key => {
      const m = modelOf(key), a = analyzeCircuit(m, options), ap = describeAppearance(m, a.flow);
      return ap.beings.some(isMaintainedDirectedStream) ? [] : [{
        key, short: ap.beings.map(b => describeBeing(b, ap.orbitCount)),
        long: buildSpellSheet(m, a, ap, m.preset.info.name).description
      }];
    });
    expect(outside).toHaveLength(44);
    expect(await signature(outside)).toBe('549aba5fd475b968052a043cc6242d3774296bc6f743a5100897c9d8e64c31ab');
  });
});
