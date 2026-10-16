import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { describeAppearance } from '../src/core/appearance';
import { buildSpellSheet } from '../src/core/spellsheet';
import { modelOf } from './helpers';

const sheetOf = (key: string) => {
  const m = modelOf(key);
  const a = analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false });
  return buildSpellSheet(m, a, describeAppearance(m, a.flow), m.preset.info.name);
};
const stat = (sh: ReturnType<typeof sheetOf>, k: string) => sh.stats.find(([l]) => l === k)?.[1];

describe('Ficha da magia (como num livro de RPG)', () => {
  it('Bola de Fogo: escola, números, efeito e descrição', () => {
    const sh = sheetOf('ex1');
    expect(sh.name).toBe('Bola de Fogo');
    expect(sh.tags).toEqual(['1º Círculo', 'Fogo', 'Evocação']);
    expect(stat(sh, 'Alcance')).toBe('À frente, em linha reta');
    expect(stat(sh, 'Duração')).toBe('Instantânea');
    expect(stat(sh, 'Energia')).toContain('perfeita');
    expect(sh.effects.map(e => e.title)).toEqual(['Fogo — Combustão', 'Fogo — Incineração']);
    expect(sh.description).toEqual(['Uma esfera de chamas crepitantes surge diante de quem lança e avança em linha reta.']);
    expect(sh.components).toBe('Selos: 1 Matriz e 3 Círculos · Runas: Esfera, Direção e Fogo');
  });

  it('Lança Plasmática: projétil, 2º e 3º círculo, as quatro bolas iguais numa frase só', () => {
    const sh = sheetOf('m_lanca_plasmatica');
    expect(sh.tags[0]).toBe('2º e 3º Círculo');
    expect(sh.tags[2]).toBe('Projétil');
    expect(stat(sh, 'Duração')).toBe('Sustentada (Estado)');
    expect(sh.description[0]).toMatch(/^Um único projétil aerodinâmico, feito de dois cubos e uma ponta piramidal/);
    expect(sh.description[1]).toMatch(/^Quatro iguais: /);
  });

  it('Pele de Pedra: pessoal, em quem lança', () => {
    const sh = sheetOf('m_pele_pedra');
    expect(stat(sh, 'Alcance')).toBe('Pessoal (em quem lança)');
    expect(stat(sh, 'Área')).toBe('Quem lança');
  });

  it('Vento: o efeito vem da Tabela Geral quando a ficha não tem a passiva', () => {
    const sh = sheetOf('ex5');
    expect(sh.effects.find(e => e.title.startsWith('Vento'))?.title).toBe('Vento — Corte Mágico');
  });
});
