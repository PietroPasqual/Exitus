import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { getNodeCircles, isPrism, releasesEnergy } from '../src/core/circles';
import { PRESETS } from '../src/data/presets';
import { RUNES } from '../src/data/runes';
import { modelOf } from './helpers';

const keys = Object.keys(PRESETS);
const spells = keys.filter(k => PRESETS[k].info.kind === 'magia');

describe('exemplos e Livro de Magias', () => {
  it('tem os exemplos do caderno, os estudos e as magias', () => {
    expect(keys.length).toBe(30);
    expect(spells.length).toBe(22);
  });

  it.each(keys)('%s: cabos e runas apontam para coisas que existem', key => {
    const m = modelOf(key);
    const ids = new Set(m.nodes.map(n => n.id));
    for (const c of m.connections) {
      expect(ids.has(c.from), `${c.from}`).toBe(true);
      expect(ids.has(c.to), `${c.to}`).toBe(true);
    }
    for (const n of m.nodes) if (n.rune) expect(RUNES[n.rune], n.rune).toBeDefined();
  });

  it.each(keys.filter(k => k !== 'ex5'))('%s: circuito estável', key => {
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
});
