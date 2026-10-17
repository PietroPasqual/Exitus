import { describe, expect, it } from 'vitest';
import { rgb, type RGB } from '../src/ui/pixel';
import { intentionMaterialPixel } from '../src/ui/pixel-intention-material';
import { materialPixel, type SpellMaterial } from '../src/ui/pixel-materials';

const materials: SpellMaterial[] = ['fire', 'plasma', 'water', 'ice', 'stone', 'metal', 'wind', 'energy'];
const ramp = ['#162c47', '#245078', '#3686a6', '#6ac4d2', '#b7e8eb', '#f2ffff'].map(rgb);
function sample(mat: SpellMaterial, illumination = .64, seed = 7, element?: string): RGB[] {
  return Array.from({ length: 24 * 24 }, (_, i) => {
    const x = i % 24, y = Math.floor(i / 24);
    return intentionMaterialPixel(ramp, mat, x, y, x / 23, y / 23, illumination, seed, element);
  });
}
const tones = (colors: RGB[]): number[] => colors.map(color => ramp.indexOf(color));

describe('Material esculpido das formas de Intenção', () => {
  it.each(materials)('%s conserva a paleta e os padrões determinísticos sem alterar cores', mat => {
    const original = structuredClone(ramp), colors = sample(mat);
    expect(sample(mat)).toEqual(colors);
    expect(colors.every(color => ramp.includes(color))).toBe(true);
    expect(new Set(colors).size).toBeGreaterThan(1);
    expect(ramp).toEqual(original);
  });

  it.each(materials)('%s mantém os olhos e entalhes escuros inclusive sob o reflexo mais forte', mat => {
    for (const light of [.17, .19, .24]) {
      const dark = tones(sample(mat, light));
      expect(Math.max(...dark)).toBeLessThanOrEqual(1);
      const face = tones(sample(mat, .91));
      expect(face.every((color, i) => color - dark[i] >= 2)).toBe(true);
    }
  });

  it.each(materials)('%s distingue a face sombreada e a iluminada em toda a superfície', mat => {
    const dark = tones(sample(mat, .31)), lit = tones(sample(mat, .91));
    expect(lit.every((color, i) => color - dark[i] >= 2)).toBe(true);
  });

  it.each(materials)('%s mantém blocos conectados de cor sem ruído alternado', mat => {
    const colors = sample(mat);
    let same = 0, pairs = 0;
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      const at = y * 24 + x;
      if (x < 23) { pairs++; if (colors[at] === colors[at + 1]) same++; }
      if (y < 23) { pairs++; if (colors[at] === colors[at + 24]) same++; }
    }
    expect(same / pairs).toBeGreaterThan(.65);
  });

  it('conserva superfícies distintas para os oito materiais usando a mesma paleta', () => {
    const signatures = materials.map(mat => tones(sample(mat)).join(''));
    expect(new Set(signatures).size).toBe(materials.length);
  });

  it.each(['fire', 'plasma', 'water'] as const)('%s conserva correntes diferentes entre sementes', mat => {
    expect(sample(mat, .64, 7)).not.toEqual(sample(mat, .64, 42));
  });

  it.each(['sombra', 'morte', 'vazio'])('%s mantém o corpo escuro com marcas e volume, sem pele prateada', element => {
    const dark = tones(sample('energy', .18, 7, element));
    const lit = tones(sample('energy', .94, 7, element));
    expect(Math.max(...lit)).toBeLessThanOrEqual(2);
    expect(lit.every((color, i) => color - dark[i] >= 1)).toBe(true);
    expect(tones(sample('energy', .31, 7, element))).not.toEqual(lit);
  });

  it('mantém variantes elementais e a entrada de luz ampla da Luz diferentes', () => {
    const variants = ['natureza', 'vida', 'sombra', 'morte', 'vazio', 'espaco', 'infinito'];
    for (const element of variants) {
      expect(sample('energy', .64, 7, element)).not.toEqual(sample('energy'));
    }
    const lit = tones(sample('plasma', .64, 7, 'luz'));
    const electric = tones(sample('plasma', .64, 7, 'raio'));
    expect(lit.reduce((sum, tone) => sum + tone, 0)).toBeGreaterThan(electric.reduce((sum, tone) => sum + tone, 0));
  });

  it('aceita paletas curtas e conserva o recorte das coordenadas e iluminação', () => {
    for (const mat of materials) {
      expect(intentionMaterialPixel([], mat, 0, 0, .5, .5, .5, 7)).toEqual(materialPixel([], mat, 0, 0, .5, .5, .5, 7));
      expect(intentionMaterialPixel([ramp[0]], mat, 0, 0, .5, .5, .5, 7)).toBe(ramp[0]);
      expect(intentionMaterialPixel(ramp, mat, 0, 0, -1, 2, 9, 7)).toBe(intentionMaterialPixel(ramp, mat, 0, 0, 0, 1, 1, 7));
    }
  });
});
