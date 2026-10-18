import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { describeAppearance } from '../src/core/appearance';
import { renderPixelScene } from '../src/ui/pixel-scene';
import baseline from './fixtures/stream-tip-controls.json';
import { modelOf } from './helpers';

const hash = async (data: Uint8ClampedArray): Promise<string> => Array.from(new Uint8Array(
  await crypto.subtle.digest('SHA-256', new Uint8Array(data))
)).map(n => n.toString(16).padStart(2, '0')).join('');

describe('Scoped terminal-flow and leaf construction', () => {
  // The five mixed contacts are deliberately refined after this checkpoint;
  // their behavior is covered by the current mixed/contact tests. Retain every
  // historical pure-material pixel assertion rather than refreshing its hash.
  it.each(baseline.entries.filter(entry => entry.elements.length === 1))('preserves the delivered d89b929 $key stream exactly', async ({ elements, hashes }) => {
    const model = modelOf('ex2'); let index = 0;
    model.nodes.forEach(n => { if (n.rune === 'fogo') n.rune = elements[Math.min(index++, elements.length - 1)]; });
    if (elements.length === 3) model.nodes.find(n => n.id === 'n_top')!.inner = [elements[2]];
    const analysis = analyzeCircuit(model, { specMode: 'simultaneous', missingMat: false });
    const ap = describeAppearance(model, analysis.flow), actual: string[] = [];
    expect(ap.beings[0].elements).toEqual(elements);
    for (const night of [false, true]) for (let f = 0; f < 8; f++) actual.push(await hash(renderPixelScene(ap, night, f).pix.data));
    expect(actual).toEqual(hashes);
  });
});
