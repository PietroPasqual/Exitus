import { describe, expect, it } from 'vitest';
import {
  TABLE_SIZE_MAX, cellRuns, encodeTable, gridDistance, hiddenByFog, newScene, newTable, normalizeTable, playerView,
  resizeScene, rollDice, setCell, type TableState
} from '../src/core/game-table';

const sequence = (...values: number[]): (() => number) => { let i = 0; return () => values[i++ % values.length]; };

describe('Rolagem de dados da mesa', () => {
  it('soma dados e modificadores e mostra cada resultado', () => {
    // 0 → 1, 0.5 → metade, 0.999 → valor máximo
    const roll = rollDice('2d6 + 3 - 1d4', sequence(0, 0.999, 0.5));
    expect(roll).toEqual({ ok: true, expressao: '2d6+3-1d4', detalhe: '2d6 [1, 6] + 3 − 1d4 [3]', total: 7 });
    expect(rollDice('d20', sequence(0.95))).toMatchObject({ ok: true, expressao: '1d20', total: 20 });
    expect(rollDice('1D100', sequence(0))).toMatchObject({ ok: true, total: 1 });
  });
  it('recusa rolagens sem dados, malformadas ou exageradas', () => {
    for (const bad of ['', '3', '2d', 'd1', '1d20*2', '101d6', '1d1001', 'abc', '1d20+']) {
      expect(rollDice(bad).ok, bad).toBe(false);
    }
  });
});

describe('Cenas da mesa', () => {
  it('guarda terreno e névoa por quadrado e redimensiona preservando o canto', () => {
    let scene = newScene('Teste', 4, 4);
    scene = { ...scene, terreno: setCell(scene.terreno, 4, 1, 1, 'p'), coberto: setCell(scene.coberto, 4, 3, 3, '0') };
    expect(setCell(scene.terreno, 4, 9, 0, 'p')).toBe(scene.terreno);
    scene.tokens.push({ id: 'k1', nome: 'Lobo', cor: '#f2655c', tipo: 'inimigo', x: 3, y: 3, tamanho: 1, oculto: false, personagemId: '', vida: null, notas: '' });
    const bigger = resizeScene(scene, 6, 5);
    expect(bigger.terreno).toHaveLength(30);
    expect(bigger.terreno[1 * 6 + 1]).toBe('p');
    expect(bigger.coberto[3 * 6 + 3]).toBe('0');
    expect(bigger.coberto[4 * 6 + 5]).toBe('1');
    const wide = { ...newScene('Larga', 6, 6), tokens: [{ ...scene.tokens[0], x: 5, y: 5 }] };
    wide.terreno = setCell(wide.terreno, 6, 1, 1, 'p');
    const smaller = resizeScene(wide, 4, 4);
    expect(smaller.terreno).toBe('.....p' + '.'.repeat(10));
    expect(smaller.tokens[0]).toMatchObject({ x: 3, y: 3 });
    expect(resizeScene(scene, 999, 1)).toMatchObject({ colunas: TABLE_SIZE_MAX, linhas: 4 });
  });
  it('agrupa quadrados iguais da mesma linha para desenhar menos', () => {
    expect(cellRuns('pp.a' + 'aaaa', 4, c => c !== '.')).toEqual([
      { x: 0, y: 0, w: 2, c: 'p' }, { x: 3, y: 0, w: 1, c: 'a' }, { x: 0, y: 1, w: 4, c: 'a' }
    ]);
  });
  it('mede em quadrados com diagonal 1 e converte em metros', () => {
    expect(gridDistance({ x: 0, y: 0 }, { x: 3, y: 5 }, 1.5)).toEqual({ quadrados: 5, metros: 7.5 });
  });
});

describe('Arquivo da mesa', () => {
  it('lê de volta o que salvou e corrige valores fora das regras', () => {
    const state = newTable();
    state.cenas[0].tokens.push({ id: 'k1', nome: 'Lira', cor: '#4cc3ff', tipo: 'jogador', x: 2, y: 2, tamanho: 2, oculto: false, personagemId: 'abc', vida: null, notas: '' });
    expect(normalizeTable(JSON.parse(encodeTable(state)!))).toEqual(state);

    const raw = JSON.parse(encodeTable(state)!);
    raw.cenas[0].colunas = 2; raw.cenas[0].terreno = 'xyz'; raw.cenas[0].fundo = 'javascript:alert(1)';
    raw.cenas[0].tokens[0].cor = 'red'; raw.cenas[0].tokens[0].x = 500; raw.cenas[0].tokens.push(raw.cenas[0].tokens[0]);
    raw.ativa = 'outra'; raw.rolagens = [{ total: 'muito' }, { id: 'r1', total: 7, expressao: '1d8', quem: 'Mestre', detalhe: '', quando: 1, secreta: false }];
    const fixed = normalizeTable(raw)!;
    const scene = fixed.cenas[0];
    expect(scene.colunas).toBe(4);
    expect(scene.terreno).toBe('.'.repeat(4 * scene.linhas));
    expect(scene.fundo).toBe('');
    expect(scene.tokens).toHaveLength(1);
    expect(scene.tokens[0]).toMatchObject({ cor: '#d4a853', x: 2 });
    expect(fixed.ativa).toBe(scene.id);
    expect(fixed.rolagens).toHaveLength(1);
    expect(normalizeTable({ kind: 'outra' })).toBeNull();
    expect(normalizeTable({ kind: 'existus-mesa', version: 1, cenas: [] })!.cenas).toHaveLength(1);
  });
});

describe('Janela dos jogadores', () => {
  it('não mostra tokens ocultos, tokens na névoa nem rolagens secretas', () => {
    const state: TableState = newTable();
    const scene = { ...newScene('Cripta', 4, 4), nevoa: true };
    scene.coberto = setCell(scene.coberto, 4, 0, 0, '0');
    const base = { cor: '#4cc3ff', tipo: 'aliado' as const, tamanho: 1, personagemId: '', vida: null, notas: '' };
    scene.tokens = [
      { ...base, id: 'visivel', nome: 'Lira', x: 0, y: 0, oculto: false },
      { ...base, id: 'oculto', nome: 'Espião', x: 0, y: 0, oculto: true },
      { ...base, id: 'nevoa', nome: 'Lobo', x: 3, y: 3, oculto: false }
    ];
    state.cenas = [scene]; state.exibida = scene.id;
    state.rolagens = [
      { id: 'a', quando: 1, quem: 'Mestre', expressao: '1d20', detalhe: '', total: 12, secreta: false },
      { id: 'b', quando: 2, quem: 'Mestre', expressao: '1d20', detalhe: '', total: 3, secreta: true }
    ];
    const view = playerView(state);
    expect(view.scene!.tokens.map(t => t.id)).toEqual(['visivel']);
    expect(view.rolagens.map(r => r.id)).toEqual(['a']);
    expect(hiddenByFog(scene, scene.tokens[2])).toBe(true);
    expect(playerView({ ...state, exibida: '' }).scene).toBeNull();
    expect(playerView({ ...state, cenas: [{ ...scene, nevoa: false }] }).scene!.tokens.map(t => t.id)).toEqual(['visivel', 'nevoa']);
  });
});
