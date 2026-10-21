import { describe, expect, it } from 'vitest';
import { normalizeCode, normalizeSummary, publishTable, readPublishedTable, summarizeCharacter } from '../src/core/campaign';
import { newCharacter } from '../src/core/character';
import { newScene, newTable } from '../src/core/game-table';
import { SKIN_TONES } from '../src/core/avatar';

describe('Resumo do personagem levado à campanha', () => {
  it('leva nome, raça, classe, vida e avatar, e nada além disso', () => {
    const c = newCharacter();
    c.identidade.nome = '  Lira '; c.identidade.historia = 'segredo'; c.rpg!.descricao.raca = 'Dríade';
    c.rpg!.progressao.classes = [{ nome: '', valor: '', notas: '' }, { nome: 'Xamã', valor: '', notas: '' }];
    c.rpg!.recursos.vida = { atual: 31, maximo: 50 };
    c.avatar = { pele: SKIN_TONES[3], olhos: '#3f7d3a', cabelo: '#b8442a' };
    const summary = summarizeCharacter(c);
    expect(summary).toMatchObject({ nome: 'Lira', raca: 'Dríade', classe: 'Xamã', vida: { atual: 31, maximo: 50 }, avatar: c.avatar });
    expect(JSON.stringify(summary)).not.toContain('segredo');
    expect(normalizeSummary(JSON.parse(JSON.stringify(summary)))).toEqual(summary);
  });
  it('limpa resumos vindos do banco', () => {
    expect(normalizeSummary({ nome: '<b>' + 'x'.repeat(100), vida: { atual: 'muita' }, avatar: { pele: 'red' } })).toMatchObject({
      nome: ('<b>' + 'x'.repeat(100)).slice(0, 60), vida: null, avatar: { pele: SKIN_TONES[1] }
    });
    expect(normalizeSummary(null).nome).toBe('');
    expect(normalizeCode(' 7f3a-9c21 ')).toBe('7F3A9C21');
  });
});

describe('Mesa publicada para a campanha', () => {
  it('manda só a cena mostrada, com a vida das fichas gravada e o fundo à parte', () => {
    const state = newTable();
    const scene = { ...newScene('Cripta', 6, 6), fundo: 'data:image/png;base64,AA==' };
    const base = { cor: '#4cc3ff', tamanho: 1, oculto: false, notas: 'só o mestre sabe', vida: null };
    scene.tokens = [
      { ...base, id: 'a', nome: 'x', tipo: 'jogador', x: 0, y: 0, personagemId: 'jogador:u1' },
      { ...base, id: 'b', nome: 'Lobo', tipo: 'inimigo', x: 1, y: 1, personagemId: '', vida: { atual: 3, maximo: 9 } },
      { ...base, id: 'c', nome: 'Espião', tipo: 'inimigo', x: 2, y: 2, personagemId: '', oculto: true }
    ];
    state.cenas = [scene]; state.exibida = scene.id;
    state.rolagens = [{ id: 'r', quando: 1, quem: 'Mestre', expressao: '1d20', detalhe: '', total: 4, secreta: true }];
    const { mesa, fundo } = publishTable(state, [{ id: 'jogador:u1', nome: 'Lira', vida: { atual: 7, maximo: 10 } }]);
    expect(fundo).toBe(scene.fundo);
    expect(mesa.scene!.fundo).toBe('');
    expect(mesa.scene!.tokens.map(t => [t.id, t.nome, t.vida, t.notas, t.personagemId])).toEqual([
      ['a', 'Lira', { atual: 7, maximo: 10 }, '', ''], ['b', 'Lobo', null, '', '']
    ]);
    expect(mesa.rolagens).toEqual([]);
    const read = readPublishedTable(JSON.parse(JSON.stringify(mesa)), fundo);
    expect(read.scene!.fundo).toBe(scene.fundo);
    expect(read.scene!.tokens).toHaveLength(2);
    expect(publishTable({ ...state, exibida: '' }, []).mesa.scene).toBeNull();
    expect(readPublishedTable({ scene: 5, rolagens: [{ total: 2, secreta: true }, { total: 3 }] }, 'javascript:x')).toMatchObject({ scene: null, rolagens: [{ total: 3 }] });
  });
});
