import { describe, expect, it } from 'vitest';
import { normalizePowers, togglePower, POWER_PATH_IDS } from '../src/core/power-paths';
import { newCharacter, normalizeCharacter } from '../src/core/character';

describe('Caminhos de poder', () => {
  it('são os quatro pilares do livro, com a Mana (círculos mágicos) como um deles', () => {
    expect(POWER_PATH_IDS).toEqual(['mana', 'aura', 'espada', 'reliquias']);
  });
  it('aceitam só caminhos conhecidos, sem repetir, na ordem do livro', () => {
    expect(normalizePowers({ caminhos: ['aura', 'x', 'mana', 'aura', 3], notas: { aura: 'a'.repeat(5000), x: 'y', espada: 7 } }))
      .toEqual({ caminhos: ['mana', 'aura'], notas: { aura: 'a'.repeat(4000) } });
    expect(normalizePowers('mana')).toBeNull();
    expect(togglePower(undefined, 'espada', true)).toEqual({ caminhos: ['espada'], notas: {} });
    expect(togglePower({ caminhos: ['mana', 'espada'], notas: { espada: 'Molde' } }, 'mana', false)).toEqual({ caminhos: ['espada'], notas: { espada: 'Molde' } });
  });
  it('ficam guardados na ficha; fichas antigas continuam sem eles', () => {
    const character = newCharacter();
    expect(normalizeCharacter(JSON.parse(JSON.stringify(character)))!.poderes).toBeUndefined();
    const withPowers = { ...character, poderes: { caminhos: ['aura'], notas: { aura: 'Ignir respondeu' } } };
    expect(normalizeCharacter(JSON.parse(JSON.stringify(withPowers)))!.poderes).toEqual(withPowers.poderes);
  });
});
