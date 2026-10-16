import { afterEach, describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { applyOverrides, CALC, normalizeOverrides, sheetOf } from '../src/data/rules';
import { RUNES } from '../src/data/runes';
import { SHAPE_META } from '../src/data/shapes';
import { renderRuneData, rich } from '../src/ui/grimoire-runes';
import { modelOf } from './helpers';

const opts = { specMode: 'simultaneous', missingMat: false } as const;
afterEach(() => applyOverrides({}));

describe('Regras do Sistema (o que o admin muda pelo site)', () => {
  it('ignora o que não existe ou tem o tipo errado (os dados vêm da internet)', () => {
    const o = normalizeOverrides({
      runas: { fogo: { stats: { perfeito: { cost: 9, power: -3 } }, name: 42 }, inventada: { name: 'x' } },
      formas: { circle: { cost: { ativacao: -1 } }, triangle: { cost: { perfeito: 12, hack: 3 } } },
      calculo: { falhaInicial: 25, hack: 5 },
      outra: true
    });
    expect(o).toEqual({ runas: { fogo: { stats: { perfeito: { cost: 9 } } } }, formas: { triangle: { cost: { perfeito: 12 } } }, calculo: { falhaInicial: 25 } });
  });

  it('energia e poder de uma runa mudam o cálculo', () => {
    const m = modelOf('ex1');
    const before = analyzeCircuit(m, opts).metrics.cost;
    applyOverrides({ runas: { fogo: { stats: { ativacao: { cost: 40 } } } } });
    expect(RUNES.fogo.stats?.ativacao.cost).toBe(40);
    expect(RUNES.fogo.stats?.ativacao.power).toBe(5);
    expect(analyzeCircuit(modelOf('ex1'), opts).metrics.cost).not.toBe(before);
  });

  it('voltar ao padrão desfaz tudo', () => {
    applyOverrides({ runas: { fogo: { name: 'Chama', missingPenalty: 0.5 } }, formas: { circle: { cost: { instavel: 30 } } }, calculo: { falhaInicial: 25 } });
    expect(RUNES.fogo.name).toBe('Chama');
    expect(SHAPE_META.circle.cost).toEqual({ ativacao: 0.2, perfeito: 2, instavel: 30 });
    expect(CALC.falhaInicial).toBe(25);
    applyOverrides({});
    expect(RUNES.fogo.name).toBe('Fogo (Ig)');
    expect(RUNES.fogo.missingPenalty).toBeCloseTo(0.3333);
    expect(SHAPE_META.circle.cost.instavel).toBe(20);
    expect(CALC.falhaInicial).toBe(20);
  });

  it('custo dos selos muda os limites da magia', () => {
    const before = analyzeCircuit(modelOf('m_muralha'), opts).charge.perfect;
    applyOverrides({ formas: { circle: { cost: { perfeito: 12 } } } });
    expect(analyzeCircuit(modelOf('m_muralha'), opts).charge.perfect).toBeGreaterThan(before);
  });

  it('a chance de falha inicial vem das regras', () => {
    const m = { ...modelOf('ex1') };
    const perfect = analyzeCircuit(m, opts).charge.perfect;
    const over = { ...m, mage: { energia: perfect + 0.1 } };
    expect(analyzeCircuit(over, opts).charge.failure).toBeCloseTo(20, 5);
    applyOverrides({ calculo: { falhaInicial: 30 } });
    expect(analyzeCircuit(over, opts).charge.failure).toBeCloseTo(30, 5);
  });

  it('a ficha da Terra no Grimório mostra a densidade e o volume que o admin colocar', () => {
    const sheet = { ...sheetOf('terra'), columns: [{ name: 'Densidade', unit: 'g/cm³', values: { ativacao: '2,5', perfeito: '5,5', instavel: '7' } }] };
    applyOverrides({ runas: { terra: { sheet, stats: { perfeito: { cost: 15 } } } } });
    const html = renderRuneData();
    const ficha = html.slice(html.indexOf('id="ficha-terra"'), html.indexOf('id="ficha-agua"'));
    expect(ficha).toContain('<th>Densidade</th>');
    expect(ficha).toContain('5,5 g/cm³');
    expect(ficha).toContain('<td>15</td>');
    expect(html).toContain('5,8 ~ 15 ~ 21,7'); // Tabela Geral (energia da Terra)
  });

  it('os textos são escapados; só **negrito** e `código` viram formatação', () => {
    expect(rich('**Queima** `1 + 0,1%` <script>x</script>')).toBe('<strong>Queima</strong> <code>1 + 0,1%</code> &lt;script&gt;x&lt;/script&gt;');
  });

  it('Componentes Faltantes usa o % da regra', () => {
    applyOverrides({ runas: { agua: { missingPenalty: 0.75 } } });
    expect(renderRuneData()).toContain('aumentando o Custo de Mana em <strong>+75%</strong>');
  });
});
