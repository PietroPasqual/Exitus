import { describe, expect, it } from 'vitest';
import {
  CREATURE_IDS, PROP_IDS, SPRITE_SIZE, TILE_IDS, Pix, allSprites, avatarSprite, avatarUriFor, creatureUri, propUri, tileUri
} from '../src/data/table-art';
import { CREATURES, PROPS, TERRAINS } from '../src/core/game-table';
import { newAvatar } from '../src/core/avatar';

const alphaOf = (p: Pix): number[] => Array.from({ length: SPRITE_SIZE * SPRITE_SIZE }, (_, i) => p.data[i * 4 + 3]);
const sprites = allSprites();

describe('Pixel art da Mesa', () => {
  it('tem arte para cada terreno, objeto e criatura do modelo de dados', () => {
    expect(TILE_IDS).toEqual([...Object.keys(TERRAINS), 'pf', 'nevoa']);
    expect(PROP_IDS).toEqual(Object.keys(PROPS));
    expect(CREATURE_IDS).toEqual(Object.keys(CREATURES));
    expect(sprites).toHaveLength(TILE_IDS.length + PROP_IDS.length + CREATURE_IDS.length);
  });
  it('as texturas de terreno cobrem o quadrado inteiro (sem furos) e são todas diferentes', () => {
    const tiles = sprites.filter(s => s.key.startsWith('tile-'));
    for (const { key, sprite } of tiles) expect(alphaOf(sprite).every(a => a === 255), key).toBe(true);
    expect(new Set(TILE_IDS.map(tileUri)).size).toBe(TILE_IDS.length);
  });
  it('objetos e retratos têm fundo transparente, contorno escuro e ocupam bastante o quadrado', () => {
    for (const { key, sprite } of sprites.filter(s => !s.key.startsWith('tile-'))) {
      const alpha = alphaOf(sprite);
      const filled = alpha.filter(a => a > 0).length;
      expect(filled, key).toBeGreaterThan(SPRITE_SIZE * SPRITE_SIZE * 0.25);
      expect(filled, key).toBeLessThan(SPRITE_SIZE * SPRITE_SIZE * 0.97);
      // Cantos livres: o desenho não encosta nas quatro pontas
      for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15]]) expect(alpha[y * SPRITE_SIZE + x], `${key} canto ${x},${y}`).toBe(0);
      expect(Array.from({ length: SPRITE_SIZE * SPRITE_SIZE }, (_, i) => i).some(i => sprite.data[i * 4 + 3] === 255 && sprite.data[i * 4] < 0x50 && sprite.data[i * 4 + 1] < 0x50 && sprite.data[i * 4 + 2] < 0x50), `${key} contorno`).toBe(true);
    }
    expect(new Set([...PROP_IDS.map(propUri), ...CREATURE_IDS.map(creatureUri)]).size).toBe(PROP_IDS.length + CREATURE_IDS.length);
  });
  it('sempre desenha igual (texturas sorteadas com semente) e guarda o PNG em cache', () => {
    expect(allSprites().map(s => s.sprite.uri())).toEqual(sprites.map(s => s.sprite.uri()));
    expect(tileUri('v')).toBe(tileUri('v'));
    expect(tileUri('v')).toMatch(/^data:image\/png;base64,/);
  });
  it('o kit de desenho respeita os limites e as formas básicas', () => {
    const p = new Pix();
    p.set(-1, 0, '#ffffff').set(16, 3, '#ffffff').rect(14, 14, 5, 5, '#ff0000');
    expect(alphaOf(p).filter(a => a > 0)).toHaveLength(4);
    const line = new Pix().line(0, 0, 15, 15, '#00ff00');
    expect(alphaOf(line).filter(a => a > 0)).toHaveLength(16);
    const disc = new Pix().disc(8, 8, 4, 4, '#0000ff');
    expect(disc.filled(8, 8)).toBe(true); expect(disc.filled(1, 1)).toBe(false);
    const boxed = new Pix().rect(4, 4, 3, 3, '#ffffff').outline('#000000');
    expect(alphaOf(boxed).filter(a => a > 0)).toHaveLength(9 + 12);
    expect(new Pix().set(2, 2, '#11223380').data[(2 * 16 + 2) * 4 + 3]).toBe(0x80);
    expect(new Pix().rect(0, 0, 16, 16, '#ffffff').set(5, 5, null).filled(5, 5)).toBe(false);
  });
  it('o retrato do avatar usa a roupa da classe e as cores escolhidas', () => {
    const avatar = { ...newAvatar(), cabelo: '#b8442a' };
    const mage = avatarSprite(avatar, 'Mago'), warrior = avatarSprite(avatar, 'Guerreiro');
    expect(mage.uri()).not.toBe(warrior.uri());
    expect(avatarUriFor(avatar, 'Mago')).toBe(mage.uri());
    expect(avatarUriFor(avatar, 'Mago')).toBe(avatarUriFor(avatar, 'mago'));
    expect(avatarUriFor({ ...avatar, pele: '#5e3a22' }, 'Mago')).not.toBe(avatarUriFor(avatar, 'Mago'));
    expect(alphaOf(mage).filter(a => a > 0).length).toBeGreaterThan(100);
  });
});
