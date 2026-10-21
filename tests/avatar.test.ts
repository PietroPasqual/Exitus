import { describe, expect, it } from 'vitest';
import { AVATAR_PALETTES, EYE_COLORS, HAIR_COLORS, OUTFITS, SKIN_TONES, avatarPixels, newAvatar, normalizeAvatar, outfitForClass, type OutfitId } from '../src/core/avatar';
import { normalizeCharacter, newCharacter } from '../src/core/character';

describe('Mini avatar', () => {
  it('veste a roupa pela classe, ignorando acentos e maiúsculas', () => {
    expect(outfitForClass('')).toBe('aventureiro');
    expect(outfitForClass('Guerreiro')).toBe('guerreiro');
    expect(outfitForClass('Caçador de Demônios')).toBe('guerreiro');
    expect(outfitForClass('caçador')).toBe('arqueiro');
    expect(outfitForClass('Invocador Espiritual')).toBe('druida');
    expect(outfitForClass('Invocador')).toBe('mago');
    expect(outfitForClass('XAMÃ')).toBe('druida');
    expect(outfitForClass('Clérigo')).toBe('clerigo');
    expect(outfitForClass('Ladrão')).toBe('ladino');
    expect(outfitForClass('Ferreiro')).toBe('artesao');
    expect(outfitForClass('Classe inventada')).toBe('aventureiro');
  });
  it('desenha 16×16 com as cores escolhidas para pele, olhos e cabelo', () => {
    const avatar = { pele: SKIN_TONES[4], olhos: EYE_COLORS[3], cabelo: HAIR_COLORS[5] };
    for (const outfit of Object.keys(OUTFITS) as OutfitId[]) {
      const pixels = avatarPixels(avatar, outfit);
      expect(pixels.every(p => p.x >= 0 && p.x < 16 && p.y >= 0 && p.y < 16), outfit).toBe(true);
      expect(new Set(pixels.map(p => `${p.x},${p.y}`)).size, outfit).toBe(pixels.length);
      expect(pixels.some(p => p.cor === avatar.pele), outfit).toBe(true);
      expect(pixels.filter(p => p.cor === avatar.olhos), outfit).toHaveLength(2);
      expect(pixels.some(p => p.cor === OUTFITS[outfit].O), outfit).toBe(true);
    }
    expect(avatarPixels(avatar, 'aventureiro').some(p => p.cor === avatar.cabelo)).toBe(true);
  });
  it('aceita só cores das paletas e guarda o avatar na ficha', () => {
    expect(normalizeAvatar({ pele: SKIN_TONES[2].toUpperCase(), olhos: '#123456', cabelo: HAIR_COLORS[0] }))
      .toEqual({ pele: SKIN_TONES[2], olhos: newAvatar().olhos, cabelo: HAIR_COLORS[0] });
    expect(normalizeAvatar('x')).toBeNull();
    expect(Object.values(AVATAR_PALETTES).every(list => new Set(list).size === list.length)).toBe(true);
    const character = newCharacter();
    expect(normalizeCharacter(JSON.parse(JSON.stringify(character)))!.avatar).toBeUndefined();
    const withAvatar = { ...character, avatar: { pele: SKIN_TONES[5], olhos: EYE_COLORS[2], cabelo: HAIR_COLORS[3] } };
    expect(normalizeCharacter(JSON.parse(JSON.stringify(withAvatar)))!.avatar).toEqual(withAvatar.avatar);
    expect(normalizeCharacter({ ...JSON.parse(JSON.stringify(character)), avatar: 7 })!.avatar).toBeUndefined();
  });
});
