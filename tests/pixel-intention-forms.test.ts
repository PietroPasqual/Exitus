import { describe, expect, it } from 'vitest';
import { INTENTION_CATALOG, type IntentionForm } from '../src/core/intention';
import { darken, Pix, rgb } from '../src/ui/pixel';
import { intentionBounds, paintIntention } from '../src/ui/pixel-intention';
import type { SpellMaterial } from '../src/ui/pixel-materials';

const ramp = ['#162c47', '#245078', '#3686a6', '#6ac4d2', '#b7e8eb', '#f2ffff'].map(rgb);
const allowed = new Set([...ramp, darken(ramp[0], .4)].map(color => color.map(Math.round).join(',')));
function draw(form: IntentionForm, material: SpellMaterial, reverse = false, scale = 15): Pix {
  const pix = new Pix(180, 105);
  paintIntention(pix, form, 90, 50, scale, ramp, material, 7, undefined, reverse);
  return pix;
}

describe('Pixel art das 128 formas de Intenção', () => {
  it.each(INTENTION_CATALOG)('$id mantém pixels dentro do limite, com material fornecido e desenho determinístico', ({ id }) => {
    const first = draw(id, 'water');
    expect(draw(id, 'water').data.every((value, i) => value === first.data[i])).toBe(true);
    expect(draw(id, 'fire').data.some((value, i) => value !== first.data[i])).toBe(true);
    for (const scale of [7.5, 15]) {
      const pix = scale === 15 ? first : draw(id, 'water', false, scale);
      const q = intentionBounds(id, scale);
      let painted = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, unexpectedColors = 0;
      for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++) {
        const i = (y * pix.w + x) * 4;
        if (!pix.data[i + 3]) continue;
        painted++;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        if (!allowed.has([...pix.data.slice(i, i + 3)].join(','))) unexpectedColors++;
      }
      expect(painted).toBeGreaterThan(15);
      expect(minX).toBeGreaterThanOrEqual(90 + q.l);
      expect(maxX).toBeLessThanOrEqual(90 + q.r);
      expect(minY).toBeGreaterThanOrEqual(50 + q.t);
      expect(maxY).toBeLessThanOrEqual(50 + q.b);
      expect(unexpectedColors).toBe(0);
    }
  });

  it('tem 128 silhuetas diferentes, sem substituir uma forma pela palavra escrita', () => {
    const masks = INTENTION_CATALOG.map(({ id }) => {
      const { data } = draw(id, 'metal');
      return Array.from({ length: data.length / 4 }, (_, i) => data[i * 4 + 3] ? '1' : '0').join('');
    });
    expect(new Set(masks).size).toBe(INTENTION_CATALOG.length);
  });

  it.each(['bomba', 'dragao', 'tridente'] as const)('espelha %s e sua matéria no retorno, sem aumentar o corpo', form => {
    const forward = draw(form, 'metal'), back = draw(form, 'metal', true);
    for (let y = 10; y < 90; y++) for (let x = 30; x <= 150; x++) {
      const a = (y * forward.w + x) * 4, b = (y * back.w + 180 - x) * 4;
      expect(back.data.slice(b, b + 4)).toEqual(forward.data.slice(a, a + 4));
    }
  });
});
