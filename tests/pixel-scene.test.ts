import { describe, expect, it } from 'vitest';
import { describeAppearance, type Appearance, type Being } from '../src/core/appearance';
import { analyzeFlow } from '../src/core/flow';
import { PRESETS } from '../src/data/presets';
import { PH, PW, renderPixelScene } from '../src/ui/pixel-scene';
import { modelOf } from './helpers';
import type { IntentionForm } from '../src/core/intention';
import { appearanceForScene, layoutScene } from '../src/ui/pixel-scene-layout';
import { paintIntention } from '../src/ui/pixel-intention';
import { paintIntentionGlyph } from '../src/ui/pixel-intention-glyph';
import { Pix, rgb } from '../src/ui/pixel';

const being = (elements: string[], shapes = ['forma_esfera']): Being => ({
  elements, shapes, concepts: [], placement: 'front', projectile: false, orbit: false,
  direction: null, guards: [], estado: false, linked: false, merged: false, bond: null, closed: false
});
const appearance = (b: Being): Appearance => ({ beings: [b], orbitCount: 0 });

describe('Pixel spell scene', () => {
  it('renders quantity as copies instead of a number body and stays bounded for huge quantities', () => {
    const source = being(['agua']);
    const ap = appearance({ ...source, intentCount: '3', bond: '3' });
    const before = structuredClone(ap);
    const triple = renderPixelScene(ap, false);
    expect(triple.pix.data).not.toEqual(renderPixelScene(appearance(source), false).pix.data);
    expect(triple.pix.data).toEqual(renderPixelScene({ beings: [
      { ...source, bond: '3' }, { ...source }, { ...source }
    ], orbitCount: 0 }, false).pix.data);
    const huge = renderPixelScene(appearance({ ...source, intentCount: '9'.repeat(40), bond: '9'.repeat(40) }), false);
    expect(huge.pix.w).toBe(180);
    expect(huge.labels).toHaveLength(1);
    expect(ap).toEqual(before);
  });

  it('makes a complete word out of the material and keeps it readable on return', () => {
    const word = { ...being(['agua']), bond: 'cura', intentGlyph: 'cura', projectile: true };
    expect(renderPixelScene(appearance(word), false).pix.data).not.toEqual(renderPixelScene(appearance({ ...word, intentGlyph: undefined }), false).pix.data);
    expect(renderPixelScene(appearance({ ...word, direction: 'back' }), false).labels[0].text).toBe('cura');
  });

  it('renders seven distinct intended bodies and preserves their material and original runes', () => {
    const forms: IntentionForm[] = ['lanca', 'espada', 'escudo', 'flecha', 'martelo', 'parede', 'machado'];
    const signatures = new Set<string>();
    for (const intentForm of forms) {
      const b = { ...being(['agua']), intentForm, bond: intentForm };
      const original = structuredClone(b);
      const water = renderPixelScene(appearance(b), false);
      const fire = renderPixelScene(appearance({ ...b, elements: ['fogo'] }), false);
      expect(water.pix.data).not.toEqual(fire.pix.data);
      expect(renderPixelScene(appearance(b), false).pix.data).toEqual(water.pix.data);
      expect(water.labels[0].text).toBe(intentForm);
      expect(b).toEqual(original);
      signatures.add(water.pix.data.join(','));
    }
    expect(signatures.size).toBe(forms.length);
  });

  it('keeps returning trajectories behind every authored Intention pixel', () => {
    const ramp = ['#102b4b', '#175775', '#24869a', '#54b6bd', '#a0e0d6', '#e2fbec'].map(rgb);
    for (const intent of ['lanca', 'anel', 'cura'] as const) {
      const source: Being = { ...being(['agua']), direction: 'back', bond: intent,
        ...(intent === 'cura' ? { intentGlyph: intent } : { intentForm: intent }) };
      const ap = appearanceForScene(appearance(source)), b = ap.beings[0];
      const pose = layoutScene(ap).poses.get(b)!;
      const body = new Pix(PW, PH);
      if (b.intentForm) paintIntention(body, b.intentForm, pose.x, pose.y, pose.s, ramp, 'water', 3, 'agua', false);
      else paintIntentionGlyph(body, b.intentGlyph!, pose.x, pose.y, pose.s, ramp, 'water', 3, 'agua', false);
      for (const night of [false, true]) {
        const scene = renderPixelScene(appearance(source), night).pix;
        for (let i = 0; i < body.data.length; i += 4) {
          if (body.data[i + 3]) expect(Array.from(scene.data.slice(i, i + 4)), intent).toEqual(Array.from(body.data.slice(i, i + 4)));
        }
      }
    }
  });

  it('renders every example reproducibly at the original resolution without changing its interpretation', () => {
    for (const key of Object.keys(PRESETS)) {
      const m = modelOf(key);
      const ap = describeAppearance(m, analyzeFlow(m));
      const before = structuredClone(ap);
      for (const night of [false, true]) {
        const scene = renderPixelScene(ap, night);
        const again = renderPixelScene(ap, night);
        expect([scene.pix.w, scene.pix.h]).toEqual([180, 105]);
        expect(scene.pix.data.every((value, i) => value === again.pix.data[i]), `${key}/${night}`).toBe(true);
        expect(scene.labels).toEqual(again.labels);
      }
      expect(ap, key).toEqual(before);
    }
  });

  it('keeps the frame intact around complex projectiles and orbiting bodies', () => {
    const empty = renderPixelScene({ beings: [], orbitCount: 0 }, false).pix;
    for (const key of ['m_lanca_plasmatica', 'ex5', 'm_descarga']) {
      const m = modelOf(key), pix = renderPixelScene(describeAppearance(m, analyzeFlow(m)), false).pix;
      for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
        if (x !== 0 && x !== PW - 1 && y !== 0 && y !== PH - 1) continue;
        const i = (y * PW + x) * 4;
        expect(pix.data.slice(i, i + 4)).toEqual(empty.data.slice(i, i + 4));
      }
    }
  });

  it('leaves the scenery visible inside a concept-only aura instead of adding a solid gold object', () => {
    const concept = being([], []);
    concept.concepts = ['tempo'];
    const pix = renderPixelScene(appearance(concept), false).pix;
    let visibleScenery = 0;
    for (let y = 45; y <= 51; y++) for (let x = 89; x <= 95; x++) {
      // The gold palette has almost no blue; the lit scenery remains beneath the aura.
      if (pix.data[(y * PW + x) * 4 + 2] > 90) visibleScenery++;
    }
    expect(visibleScenery).toBeGreaterThan(40);
  });

  it.each([['agua', 'acido'], ['luz', 'raio']])('shows the second element outside the body even when %s and %s share a material', (first, second) => {
    const single = renderPixelScene(appearance(being([first])), false).pix.data;
    const combined = renderPixelScene(appearance(being([first, second])), false).pix.data;
    let changedOutside = 0;
    // Exclude the body and its secondary inner core; look for the actual accents.
    for (let y = 22; y < 76; y++) for (let x = 60; x < 126; x++) {
      if (x >= 78 && x <= 106 && y >= 34 && y <= 62) continue;
      const i = (y * PW + x) * 4;
      if (single[i] !== combined[i] || single[i + 1] !== combined[i + 1] || single[i + 2] !== combined[i + 2]) changedOutside++;
    }
    expect(changedOutside).toBeGreaterThan(0);
  });
});
