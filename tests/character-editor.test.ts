// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { resetCircle } from '../src/ui/editor';
import { emptyState, store } from '../src/ui/store';

describe('Editor de um novo personagem', () => {
  it('não herda energia, mago e seleção de conexão do personagem anterior', () => {
    store.state.mage = { refino: 7, energia: 99, velocidade: 120 };
    store.state.envelope = true;
    store.state.connectSourceId = 'personagem-anterior';
    store.state.interactionMode = 'arc';
    store.state.innerMode = true;
    store.savedCircle = { id: 'anterior', nome: 'Magia anterior' };
    resetCircle(true);
    expect(store.state.mage).toEqual(emptyState().mage);
    expect(store.state.envelope).toBe(false);
    expect(store.state.connectSourceId).toBeNull();
    expect(store.state.interactionMode).toBe('move');
    expect(store.state.innerMode).toBe(false);
    expect(store.savedCircle).toBeNull();
    expect(store.state.nodes).toHaveLength(1);
    expect(store.state.nodes[0].rune).toBeNull();
  });
});
