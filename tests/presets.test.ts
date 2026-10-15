import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { getNodeCircles, isPrism, releasesEnergy } from '../src/core/circles';
import { PRESETS } from '../src/data/presets';
import { RUNES } from '../src/data/runes';
import { issuesOf, modelOf } from './helpers';

const keys = Object.keys(PRESETS);
const spells = keys.filter(k => PRESETS[k].info.kind === 'magia');
const failed = keys.filter(k => PRESETS[k].info.kind === 'falha');
const working = keys.filter(k => PRESETS[k].info.kind !== 'falha');

describe('exemplos e Livro de Magias', () => {
  it('tem os exemplos do caderno, os estudos e as magias', () => {
    expect(keys.length).toBe(45);
    expect(spells.length).toBe(22);
    expect(failed.length).toBe(15);
  });

  it.each(keys)('%s: cabos e runas apontam para coisas que existem', key => {
    const m = modelOf(key);
    const ids = new Set(m.nodes.map(n => n.id));
    // Ponta de cabo: uma forma ou o anel de um círculo que existe (ring:<id>)
    m.circles.forEach(c => ids.add('ring:' + c.id));
    for (const c of m.connections) {
      expect(ids.has(c.from), `${c.from}`).toBe(true);
      expect(ids.has(c.to), `${c.to}`).toBe(true);
    }
    for (const n of m.nodes) if (n.rune) expect(RUNES[n.rune], n.rune).toBeDefined();
  });

  it.each(working)('%s: circuito estável', key => {
    const m = modelOf(key);
    const a = analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false });
    expect(a.badge.text).toBe('✓ Circuito Estável');
  });

  it.each(spells)('%s: carga até 70%, sem formas encostando e sem nada fora do anel', key => {
    const m = modelOf(key);
    const a = analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false });
    expect(a.load.level).toBe('estavel');
    expect(a.load.ratio).toBeLessThanOrEqual(0.7);
    for (let i = 0; i < m.nodes.length; i++) {
      for (let j = i + 1; j < m.nodes.length; j++) {
        const p = m.nodes[i], q = m.nodes[j];
        expect(Math.hypot(p.x - q.x, p.y - q.y) - p.size - q.size).toBeGreaterThan(0);
      }
    }
    for (const n of m.nodes.filter(x => !isPrism(x))) expect(getNodeCircles(m, n).length).toBeGreaterThan(0);
    for (const c of m.connections) expect(releasesEnergy(m, c.from)).toBe(true);
  });

  it.each(working)('%s: a Leitura do Círculo não aponta nenhum erro', key => {
    const m = modelOf(key);
    const a = analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false, spellInfo: m.preset.info });
    expect(issuesOf(a)).toEqual([]);
  });
});

describe('Magias Falhas', () => {
  it.each(failed)('%s: guarda o que estava errado e aponta a versão corrigida', key => {
    const p = PRESETS[key];
    expect(p.info.errors?.length).toBeGreaterThan(0);
    const fixed = PRESETS[p.info.fixedIn as string];
    expect(fixed).toBeDefined();
    expect(fixed.info.kind).not.toBe('falha');
    // a versão guardada é a antiga: diferente da corrigida
    expect(JSON.stringify({ n: p.nodes, c: p.connections, d: p.info.desc })).not.toBe(JSON.stringify({ n: fixed.nodes, c: fixed.connections, d: fixed.info.desc }));
  });

  it('a leitura mostra o que estava errado', () => {
    const m = modelOf('falha_m_meteoro');
    const a = analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false, spellInfo: m.preset.info });
    expect(a.logs.find(l => l.title === '✕ Magia Falha')?.text).toContain('Projétil');
  });
});
