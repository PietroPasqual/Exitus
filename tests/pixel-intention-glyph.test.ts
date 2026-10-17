import { describe, expect, it } from 'vitest';
import { glyphBounds, glyphHasUnsupportedCharacters, paintIntentionGlyph } from '../src/ui/pixel-intention-glyph';
import { Pix, rgb } from '../src/ui/pixel';

const ramp = ['#0b2a6b', '#1864ab', '#1c7ed6', '#4dabf7', '#a5d8ff', '#e7f5ff'].map(rgb);
function pixels(word: string): Uint8ClampedArray {
  const pix = new Pix(180, 105);
  paintIntentionGlyph(pix, word, 90, 50, 15, ramp, 'water', 7, 'agua');
  return pix.data;
}

describe('pixel intention glyph support', () => {
  it('supports Latin accents, digits and the font punctuation without a replacement warning', () => {
    expect(glyphHasUnsupportedCharacters('Fênix AÇÃO Kael7 3,14 -2 +4/2?!')).toBe(false);
    expect(glyphHasUnsupportedCharacters('cura\nvento')).toBe(false);
  });

  it.each(['cura火', '水', 'Kael😀'])('reports unsupported characters in %s', word => {
    expect(glyphHasUnsupportedCharacters(word)).toBe(true);
  });

  it.each([
    ['Fogo\u2010Água', 'FOGO-AGUA'],
    ['Fogo\u2011Água', 'FOGO-AGUA'],
    ['d\u2019água', "D'AGUA"]
  ])('normalises %s to supported glyphs matching %s', (word, normalized) => {
    expect(glyphHasUnsupportedCharacters(word)).toBe(false);
    expect(glyphBounds(word, 15)).toEqual(glyphBounds(normalized, 15));
    expect(pixels(word)).toEqual(pixels(normalized));
  });
});
