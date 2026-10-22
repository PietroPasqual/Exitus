import { describe, expect, it } from 'vitest';
import {
  TABLE_SIZE_MAX, cellRuns, encodeTable, gridDistance, hiddenByFog, newScene, newTable, normalizeTable, playerView,
  resizeScene, rollDice, setCell, rectCells, type TableState
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

import {
  SCENE_SIZES, SCENE_TEMPLATES, brushCells, cellName, createScene, fitGridToImage, floodFill, imageBox, lineCells, newHistory,
  paintCells, recordHistory, redoHistory, templateTerrain, undoHistory, HISTORY_LIMIT, type Cell, type SceneTemplateId
} from '../src/core/game-table';

const key = (list: Cell[]): string => list.map(c => `${c.x},${c.y}`).sort().join(' ');
const rows = (grid: string, colunas: number): string[] => grid.match(new RegExp(`.{${colunas}}`, 'g')) ?? [];

describe('Pincéis e formas do grid', () => {
  it('pincel de n × n fica centrado no quadrado clicado', () => {
    expect(brushCells({ x: 5, y: 5 }, 1)).toEqual([{ x: 5, y: 5 }]);
    expect(key(brushCells({ x: 5, y: 5 }, 3))).toBe(key(rectCellsFor(4, 4, 6, 6)));
    expect(brushCells({ x: 5, y: 5 }, 2)).toHaveLength(4);
    expect(brushCells({ x: 0, y: 0 }, 99)).toHaveLength(64);
  });
  it('linha sem buracos, inclusive na diagonal e de volta', () => {
    expect(lineCells({ x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
    expect(lineCells({ x: 0, y: 0 }, { x: 3, y: 3 })).toHaveLength(4);
    const back = lineCells({ x: 6, y: 2 }, { x: 0, y: 0 });
    expect(back[0]).toEqual({ x: 6, y: 2 }); expect(back[back.length - 1]).toEqual({ x: 0, y: 0 });
    expect(back).toHaveLength(7);
    for (let i = 1; i < back.length; i++) expect(Math.max(Math.abs(back[i].x - back[i - 1].x), Math.abs(back[i].y - back[i - 1].y))).toBe(1);
    expect(lineCells({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual([{ x: 2, y: 2 }]);
  });
  it('retângulo cheio ou só o contorno, em qualquer ordem dos cantos', () => {
    expect(rectCellsFor(1, 1, 4, 3)).toHaveLength(12);
    const outline = rows(paintCells('.'.repeat(30), 6, 5, rectCells({ x: 4, y: 3 }, { x: 1, y: 1 }, false), 'p'), 6);
    expect(outline).toEqual(['......', '.pppp.', '.p..p.', '.pppp.', '......']);
  });
  it('pintar ignora o que está fora da grade e devolve a mesma cadeia se nada mudou', () => {
    const grid = '.'.repeat(9);
    expect(paintCells(grid, 3, 3, [{ x: -1, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 3 }], 'p')).toBe(grid);
    expect(paintCells(grid, 3, 3, [{ x: 2, y: 2 }], 'p')).toBe('........p');
    expect(paintCells('p', 1, 1, [{ x: 0, y: 0 }], 'p')).toBe('p');
  });
  it('balde enche só a região ligada, sem vazar na diagonal', () => {
    const grid = ['..p..', '..p..', 'pp...', '.....'].join('');
    expect(rows(floodFill(grid, 5, 4, { x: 0, y: 0 }, 'a'), 5)).toEqual(['aap..', 'aap..', 'pp...', '.....']);
    expect(rows(floodFill(grid, 5, 4, { x: 4, y: 0 }, 'a'), 5)).toEqual(['..paa', '..paa', 'ppaaa', 'aaaaa']);
    expect(floodFill(grid, 5, 4, { x: 2, y: 0 }, 'p')).toBe(grid);
    expect(floodFill(grid, 5, 4, { x: 9, y: 9 }, 'a')).toBe(grid);
    expect(floodFill('0'.repeat(25 * 25), 25, 25, { x: 3, y: 3 }, '1')).toBe('1'.repeat(25 * 25));
  });
  it('nomeia os quadrados como num mapa de papel', () => {
    expect([cellName(0, 0), cellName(2, 6), cellName(25, 0), cellName(26, 9), cellName(51, 0), cellName(52, 0)]).toEqual(['A1', 'C7', 'Z1', 'AA10', 'AZ1', 'BA1']);
  });
});
function rectCellsFor(x0: number, y0: number, x1: number, y1: number): Cell[] { return rectCells({ x: x0, y: y0 }, { x: x1, y: y1 }, true); }

describe('Criação de cenas', () => {
  it('oferece tamanhos prontos dentro dos limites e os quatro modelos', () => {
    for (const size of SCENE_SIZES) { expect(size.colunas).toBeGreaterThanOrEqual(4); expect(size.colunas).toBeLessThanOrEqual(TABLE_SIZE_MAX); expect(size.linhas).toBeLessThanOrEqual(TABLE_SIZE_MAX); }
    expect(Object.keys(SCENE_TEMPLATES)).toEqual(['vazio', 'sala', 'salas', 'arena']);
  });
  it('modelos geram paredes só onde devem, para qualquer tamanho', () => {
    expect(templateTerrain('vazio', 8, 6)).toBe('.'.repeat(48));
    expect(rows(templateTerrain('sala', 6, 4), 6)).toEqual(['pppppp', 'p....p', 'p....p', 'pppppp']);
    const salas = rows(templateTerrain('salas', 12, 8), 12);
    expect(salas[0]).toBe('pppppppppppp');
    expect(salas[4].split('').filter(c => c === '.').length).toBe(4);
    expect(salas.map(row => row[6]).filter(c => c === '.').length).toBe(4);
    const arena = rows(templateTerrain('arena', 20, 14), 20);
    expect(arena[0][10]).toBe('p'); expect(arena[7][10]).toBe('.');
    expect(arena[13].slice(9, 11)).toBe('..'); expect(arena[13][8]).toBe('p');
    for (const id of Object.keys(SCENE_TEMPLATES) as SceneTemplateId[]) for (const [c, l] of [[4, 4], [5, 7], [80, 80]]) {
      const grid = templateTerrain(id, c, l);
      expect(grid).toHaveLength(c * l); expect(grid).toMatch(/^[.p]+$/);
    }
  });
  it('cria a cena com nome, medida e modelo, corrigindo valores fora dos limites', () => {
    const scene = createScene({ nome: '  Taverna  ', colunas: 20, linhas: 10, metros: 2.54, modelo: 'sala' });
    expect(scene).toMatchObject({ nome: 'Taverna', colunas: 20, linhas: 10, metros: 2.5, fundo: '', fundoRazao: 0 });
    expect(scene.terreno).toHaveLength(200); expect(scene.coberto).toBe('1'.repeat(200));
    expect(createScene({ nome: '   ', colunas: 1, linhas: 500, modelo: 'x' as SceneTemplateId })).toMatchObject({ nome: 'Nova cena', colunas: 4, linhas: 80 });
  });
  it('com imagem, a grade segue a proporção dela e os quadrados não deformam', () => {
    const image = 'data:image/jpeg;base64,AAAA';
    const wide = createScene({ fundo: image, razao: 1.5, quadradosNaLargura: 30, modelo: 'sala' });
    expect(wide).toMatchObject({ colunas: 30, linhas: 20, fundo: image, fundoRazao: 1.5, fundoLargura: 30 });
    expect(imageBox(wide)).toEqual({ x: 0, y: 0, w: 30, h: 20 });
    expect(createScene({ fundo: image, razao: 0.5, quadradosNaLargura: 20 })).toMatchObject({ colunas: 20, linhas: 40 });
    // Razão absurda ou sem imagem: ignora a imagem em vez de quebrar
    expect(createScene({ razao: 2 })).toMatchObject({ fundoRazao: 0, fundo: '' });
    expect(createScene({ fundo: image, razao: 99, colunas: 10, linhas: 8 })).toMatchObject({ fundoRazao: 0, colunas: 10, linhas: 8 });
    // Cena antiga (sem proporção) continua esticando a imagem sobre a grade toda
    expect(imageBox({ ...newScene('x', 10, 8), fundo: image })).toEqual({ x: 0, y: 0, w: 10, h: 8 });
  });
  it('ajusta a grade ao tamanho da imagem, contando o deslocamento', () => {
    const base = { ...newScene('Mapa', 24, 16), fundo: 'data:image/png;base64,AA==', fundoRazao: 2 };
    expect(fitGridToImage({ ...base, fundoLargura: 30 })).toMatchObject({ colunas: 30, linhas: 15 });
    expect(fitGridToImage({ ...base, fundoLargura: 30, fundoX: -2, fundoY: 1 })).toMatchObject({ colunas: 28, linhas: 16 });
    expect(fitGridToImage({ ...base, fundoLargura: 500 })).toMatchObject({ colunas: TABLE_SIZE_MAX });
    expect(fitGridToImage(newScene('sem imagem', 10, 10))).toMatchObject({ colunas: 10, linhas: 10 });
  });
  it('lê de volta o ajuste da imagem e da grade e corrige valores fora das regras', () => {
    const scene = { ...createScene({ fundo: 'data:image/png;base64,AA==', razao: 1.25, quadradosNaLargura: 25 }), fundoX: 1.5, fundoY: -0.5, gradeCor: 'escura' as const, gradeOpacidade: 0.6, coordenadas: true };
    const state = { ...newTable(), cenas: [scene], ativa: scene.id, exibida: scene.id };
    expect(normalizeTable(JSON.parse(encodeTable(state)!))!.cenas[0]).toEqual(scene);
    const raw = JSON.parse(encodeTable(state)!);
    Object.assign(raw.cenas[0], { fundoRazao: 'larga', fundoLargura: 9999, fundoX: 'x', gradeCor: 'rosa', gradeOpacidade: 5, coordenadas: 'sim' });
    expect(normalizeTable(raw)!.cenas[0]).toMatchObject({ fundoRazao: 0, fundoLargura: 200, fundoX: 0, gradeCor: 'auto', gradeOpacidade: 1, coordenadas: false });
    // Sem imagem não há proporção; cenas salvas antes desta versão abrem com os padrões
    const old = JSON.parse(encodeTable(newTable())!); for (const f of ['fundoRazao', 'fundoLargura', 'fundoX', 'fundoY', 'gradeCor', 'gradeOpacidade', 'coordenadas']) delete old.cenas[0][f];
    expect(normalizeTable(old)!.cenas[0]).toMatchObject({ fundoRazao: 0, fundoLargura: 24, gradeCor: 'auto', gradeOpacidade: 0.35, coordenadas: false });
  });
});

describe('Desfazer e refazer', () => {
  it('volta e avança pelos estados e uma mudança nova apaga o refazer', () => {
    let history = recordHistory(newHistory<string>(), 'a');
    history = recordHistory(history, 'b');
    const undone = undoHistory(history, 'c')!;
    expect(undone.value).toBe('b');
    const twice = undoHistory(undone.history, 'b')!;
    expect(twice.value).toBe('a');
    expect(undoHistory(twice.history, 'a')).toBeNull();
    const redone = redoHistory(twice.history, 'a')!;
    expect(redone.value).toBe('b');
    expect(recordHistory(redone.history, 'z').future).toEqual([]);
    expect(redoHistory(newHistory<string>(), 'x')).toBeNull();
  });
  it('guarda no máximo 40 estados', () => {
    let history = newHistory<number>();
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) history = recordHistory(history, i);
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0]).toBe(10);
  });
});
