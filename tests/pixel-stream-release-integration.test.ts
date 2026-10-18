import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { describeAppearance } from '../src/core/appearance';
import { renderPixelScene } from '../src/ui/pixel-scene';
import baseline from './fixtures/stream-approved-release.json';
import { modelOf } from './helpers';

const hash = async (data: Uint8ClampedArray): Promise<string> => Array.from(new Uint8Array(
  await crypto.subtle.digest('SHA-256', new Uint8Array(data))
)).map(n => n.toString(16).padStart(2, '0')).join('');

describe('Approved maintained streams survive the concurrent renderer integration', () => {
  it.each(baseline.entries)('retains every approved pixel of $key', async entry => {
    const m = modelOf('ex2'); let index = 0;
    m.nodes.forEach(n => { if (n.rune === 'fogo') n.rune = entry.elements[Math.min(index++, entry.elements.length - 1)]; });
    if (entry.elements.length > 2) m.nodes.find(n => n.id === 'n_top')!.inner = entry.elements.slice(2);
    const ap = describeAppearance(m, analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false }).flow);
    if (entry.copies > 1) ap.beings[0].intentCount = String(entry.copies);
    const snapshot = JSON.stringify(ap), hashes: string[] = [];
    for (const night of [false, true]) for (let frame = 0; frame < 8; frame++)
      hashes.push(await hash(renderPixelScene(ap, night, frame).pix.data));
    expect(hashes).toEqual(entry.hashes);
    expect(JSON.stringify(ap)).toBe(snapshot);
  });
});
