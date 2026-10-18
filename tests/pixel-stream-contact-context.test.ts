import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { describeAppearance } from '../src/core/appearance';
import { isMaintainedDirectedStream } from '../src/core/spell-narrative-semantics';
import { renderPixelScene } from '../src/ui/pixel-scene';
import baseline from './fixtures/stream-contact-controls.json';
import { modelOf } from './helpers';

const hash = async (data: Uint8ClampedArray): Promise<string> => Array.from(new Uint8Array(
  await crypto.subtle.digest('SHA-256', new Uint8Array(data))
)).map(n => n.toString(16).padStart(2, '0')).join('');

describe('Mixed-stream contact scope across the approved and integrated releases', () => {
  it.each(baseline.entries)('preserves $key against its recorded release baseline', async entry => {
    const model = modelOf('ex2'); let index = 0;
    const variant = 'variant' in entry ? entry.variant : undefined;
    model.nodes.forEach(n => {
      if (n.rune === 'fogo') n.rune = entry.elements[Math.min(index++, entry.elements.length - 1)];
      if (variant === 'return' && n.rune === 'dir_padrao') n.rune = 'dir_contraria';
      if (variant === 'no-state' && n.rune === 'mod_estado') n.rune = null;
      if (variant === 'no-direction' && n.rune === 'dir_padrao') n.rune = null;
    });
    const top = model.nodes.find(n => n.id === 'n_top')!;
    if (entry.elements.length === 3) top.inner = [entry.elements[2]];
    if (variant === 'shape') top.inner = ['forma_esfera'];
    if (variant === 'orbit') top.inner = ['mod_orbita'];
    const ap = describeAppearance(model, analyzeCircuit(model, { specMode: 'simultaneous', missingMat: false }).flow);
    const snapshot = JSON.stringify(ap), hashes: string[] = [];
    if (variant) expect(ap.beings.every(b => !isMaintainedDirectedStream(b))).toBe(true);
    for (const night of [false, true]) for (let f = 0; f < 8; f++) hashes.push(await hash(renderPixelScene(ap, night, f).pix.data));
    expect(hashes).toEqual(entry.hashes);
    expect(JSON.stringify(ap)).toBe(snapshot);
  });
});
