import { describe, expect, it } from 'vitest';
import { describeAppearance, describeBeing } from '../src/core/appearance';
import { analyzeFlow } from '../src/core/flow';
import { PRESETS } from '../src/data/presets';
import { RUNES } from '../src/data/runes';
import { modelOf } from './helpers';

const appearanceOf = (key: string) => {
  const m = modelOf(key);
  return describeAppearance(m, analyzeFlow(m));
};

describe('Aparência da Magia', () => {
  it('Bola de Fogo: uma esfera de fogo à frente, indo para a frente', () => {
    const [b, ...rest] = appearanceOf('ex1').beings;
    expect(rest).toEqual([]);
    expect(b).toMatchObject({ elements: ['fogo'], shapes: ['forma_esfera'], placement: 'front', direction: 'forward' });
  });

  it('Lança Plasmática: a lança voa e as 4 bolas de fogo a acompanham, girando', () => {
    const ap = appearanceOf('m_lanca_plasmatica');
    const lance = ap.beings.find(b => b.placement === 'flight')!;
    expect(lance.elements).toEqual(expect.arrayContaining(['raio', 'fogo']));
    expect(lance.shapes).toEqual(['forma_cubo', 'forma_piramide', 'forma_cubo']);
    expect(lance).toMatchObject({ projectile: true, linked: true, estado: true, concepts: [] });
    const balls = ap.beings.filter(b => b.placement === 'escort');
    expect(balls.length).toBe(4);
    balls.forEach(b => expect(b).toMatchObject({ elements: ['fogo'], concepts: ['movimento'], estado: true }));
  });

  it('Ser e Órbita: 3 seres girando, um a cada 120°', () => {
    const ap = appearanceOf('ex5');
    expect(ap.orbitCount).toBe(3);
    expect(ap.beings.map(b => b.elements[0]).sort()).toEqual(['fogo', 'terra', 'vento']);
    expect(describeBeing(ap.beings[0], ap.orbitCount)).toContain('um a cada 120°');
  });

  it('Área: reprojetada na superfície mais distante; Toque: na mais próxima', () => {
    expect(appearanceOf('m_descarga').beings[0].placement).toBe('far');
    expect(appearanceOf('m_passo').beings[0]).toMatchObject({ placement: 'touch', concepts: ['movimento'], guards: ['lateral'] });
  });

  it('Direção Contrária volta para quem lança; a Intenção leva a palavra', () => {
    expect(appearanceOf('m_pele_pedra').beings[0]).toMatchObject({ placement: 'self', direction: 'back', estado: true });
    expect(appearanceOf('m_falsa_acao').beings[0].bond).toBe('Esconder');
  });

  it.each(Object.keys(PRESETS))('%s: toda magia que funciona tem pelo menos um ser para desenhar', key => {
    const ap = appearanceOf(key);
    const m = modelOf(key);
    const flow = analyzeFlow(m);
    // Com elemento ou formato no caminho da energia, aparece algo na cena
    const visible = m.nodes.some(n => flow.working.has(n.id) && [n.rune, ...(n.inner ?? [])].some(r => r && ['elemental', 'shape'].includes(RUNES[r]?.category)));
    if (visible) expect(ap.beings.length).toBeGreaterThan(0);
    ap.beings.forEach(b => expect(describeBeing(b, ap.orbitCount)).toMatch(/: .+\.$/));
  });
});
