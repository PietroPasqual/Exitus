import { describe, expect, it } from 'vitest';
import {
  PROP_LIMIT, TERRAINS, createScene, encodeTable, newScene, newTable, normalizeScene, normalizeTable, placeProp, playerView, propAt,
  removePropAt, resizeScene, templateProps, templateTerrain, type TableScene, type TableToken
} from '../src/core/game-table';
import { publishTable, readPublishedTable } from '../src/core/campaign';
import { renderBoard } from '../src/ui/game-table';

const token = (change: Partial<TableToken> = {}): TableToken => ({
  id: 'k', nome: 'Lira', cor: '#4cc3ff', tipo: 'jogador', x: 0, y: 0, tamanho: 1, oculto: false, personagemId: '', vida: null, notas: 'segredo',
  sprite: '', avatar: null, classe: '', ...change
});
const grid = (rows: string[]): string => rows.join('');
const SIZE = 6;

describe('Terrenos', () => {
  it('têm os dez tipos, cada um com nome e cor, e as cenas aceitam todos', () => {
    expect(Object.keys(TERRAINS)).toEqual(['p', 'e', 'm', 't', 'r', 'n', 'v', 'a', 'd', 'l']);
    const scene = { ...newScene('x', 10, 1 + 3), terreno: Object.keys(TERRAINS).join('').padEnd(40, '.') };
    expect(normalizeScene(JSON.parse(JSON.stringify(scene)))!.terreno).toBe(scene.terreno);
    expect(normalizeScene({ ...scene, terreno: 'xyz!'.padEnd(40, 'p') })!.terreno).toMatch(/^\.{4}p+$/);
  });
});

describe('Objetos no mapa', () => {
  const base = (): TableScene => newScene('Sala', 8, 6);
  it('põem um objeto por quadrado, trocam o que estava lá e giram ao tocar no mesmo', () => {
    let scene = placeProp(base(), 'bau', { x: 2, y: 3 });
    expect(scene.objetos).toHaveLength(1);
    expect(propAt(scene, { x: 2, y: 3 })).toMatchObject({ tipo: 'bau', rot: 0, oculto: false });
    scene = placeProp(scene, 'bau', { x: 2, y: 3 }, { girar: true });
    expect(propAt(scene, { x: 2, y: 3 })!.rot).toBe(1);
    for (let i = 0; i < 3; i++) scene = placeProp(scene, 'bau', { x: 2, y: 3 }, { girar: true });
    expect(propAt(scene, { x: 2, y: 3 })!.rot).toBe(0);
    const same = placeProp(scene, 'bau', { x: 2, y: 3 });
    expect(same).toBe(scene);
    const swapped = placeProp(scene, 'mesa', { x: 2, y: 3 }, { rot: 2, oculto: true });
    expect(swapped.objetos).toHaveLength(1);
    expect(propAt(swapped, { x: 2, y: 3 })).toMatchObject({ tipo: 'mesa', rot: 2, oculto: true, id: propAt(scene, { x: 2, y: 3 })!.id });
    expect(placeProp(base(), 'bau', { x: 8, y: 0 }).objetos).toHaveLength(0);
    expect(placeProp(base(), 'dragao' as never, { x: 0, y: 0 }).objetos).toHaveLength(0);
  });
  it('apagam e respeitam o limite de objetos', () => {
    const scene = placeProp(base(), 'tocha', { x: 1, y: 1 });
    expect(removePropAt(scene, { x: 1, y: 1 }).objetos).toHaveLength(0);
    expect(removePropAt(scene, { x: 0, y: 0 })).toBe(scene);
    const big = newScene('Grande', 40, 40);
    let filled = big;
    for (let i = 0; i < PROP_LIMIT + 5; i++) filled = placeProp(filled, 'pedra', { x: i % 40, y: Math.floor(i / 40) });
    expect(filled.objetos).toHaveLength(PROP_LIMIT);
    expect(placeProp(filled, 'arvore', { x: 0, y: 0 }).objetos).toHaveLength(PROP_LIMIT); // trocar ainda pode
    expect(placeProp(filled, 'arvore', { x: 0, y: 0 }).objetos[0].tipo).toBe('arvore');
  });
  it('são salvos e lidos de volta; dados fora das regras são corrigidos ou descartados', () => {
    const scene = placeProp(placeProp(base(), 'porta', { x: 1, y: 1 }, { rot: 3 }), 'armadilha', { x: 4, y: 2 }, { oculto: true });
    const state = { ...newTable(), cenas: [scene], ativa: scene.id, exibida: scene.id };
    expect(normalizeTable(JSON.parse(encodeTable(state)!))!.cenas[0].objetos).toEqual(scene.objetos);
    const raw = JSON.parse(JSON.stringify(scene));
    raw.objetos = [
      { id: 'a', tipo: 'bau', x: 1, y: 1, rot: 9, oculto: 'sim' }, { id: 'b', tipo: 'bau', x: 1, y: 1 }, { tipo: 'dragao', x: 2, y: 2 },
      { tipo: 'mesa', x: 99, y: 0 }, { tipo: 'mesa', x: 'a', y: 0 }, 7, { tipo: 'cama', x: 3, y: 3, rot: 2 }
    ];
    expect(normalizeScene(raw)!.objetos.map(o => [o.tipo, o.x, o.y, o.rot, o.oculto])).toEqual([['bau', 1, 1, 3, false], ['cama', 3, 3, 2, false]]);
    expect(normalizeScene({ ...raw, objetos: 'nada' })!.objetos).toEqual([]);
    const old = JSON.parse(JSON.stringify(scene)); delete old.objetos;
    expect(normalizeScene(old)!.objetos).toEqual([]);
  });
  it('saem do mapa quando a grade diminui', () => {
    let scene = placeProp(placeProp(base(), 'bau', { x: 7, y: 5 }), 'mesa', { x: 1, y: 1 });
    scene = resizeScene(scene, 5, 4);
    expect(scene.objetos.map(o => o.tipo)).toEqual(['mesa']);
  });
  it('os modelos trazem os objetos: portas nas passagens, tochas na sala e colunas na arena', () => {
    const salas = templateProps('salas', 12, 8);
    expect(salas).toHaveLength(8);
    expect(new Set(salas.map(o => o.tipo))).toEqual(new Set(['porta']));
    const terrain = templateTerrain('salas', 12, 8);
    for (const door of salas) expect(terrain[door.y * 12 + door.x], `porta em ${door.x},${door.y} fica numa passagem`).toBe('.');
    expect(templateProps('sala', 10, 8).map(o => o.tipo)).toEqual(['tocha', 'tocha']);
    expect(templateProps('arena', 20, 14).filter(o => o.tipo === 'coluna')).toHaveLength(4);
    expect(templateProps('vazio', 10, 8)).toEqual([]);
    expect(createScene({ modelo: 'salas', colunas: 24, linhas: 16 }).objetos).toHaveLength(8);
    expect(new Set(templateProps('arena', 4, 4).map(o => `${o.x},${o.y}`)).size).toBeLessThanOrEqual(4);
  });
});

describe('Retratos dos tokens', () => {
  it('guardam o retrato de criatura e o avatar com a classe, e descartam o que não existe', () => {
    const scene = { ...newScene('x', 6, 6), tokens: [token({ sprite: 'lobo', avatar: { pele: '#f6d7bd', olhos: '#3b2414', cabelo: '#1c1410' }, classe: 'Mago' })] };
    const back = normalizeScene(JSON.parse(JSON.stringify(scene)))!.tokens[0];
    expect(back).toMatchObject({ sprite: 'lobo', classe: 'Mago', avatar: { pele: '#f6d7bd' } });
    const raw = JSON.parse(JSON.stringify(scene));
    Object.assign(raw.tokens[0], { sprite: 'unicornio', avatar: { pele: 'verde' }, classe: 'x'.repeat(200) });
    expect(normalizeScene(raw)!.tokens[0]).toMatchObject({ sprite: '', classe: 'x'.repeat(60), avatar: { pele: '#eec39a' } });
    delete raw.tokens[0].sprite; delete raw.tokens[0].avatar; delete raw.tokens[0].classe;
    expect(normalizeScene(raw)!.tokens[0]).toMatchObject({ sprite: '', avatar: null, classe: '' });
  });
});

describe('O que os jogadores recebem', () => {
  const scene = (): TableScene => {
    let s: TableScene = { ...newScene('Cripta', SIZE, SIZE), nevoa: true };
    s.terreno = grid(['pppppp', 'p.ee.p', 'p.mm.p', 'p....p', 'p.aa.p', 'pppppp']);
    s.coberto = grid(['111111', '110011', '110011', '111111', '111111', '111111']);
    s = placeProp(s, 'bau', { x: 2, y: 1 });
    s = placeProp(s, 'armadilha', { x: 3, y: 1 }, { oculto: true });
    s = placeProp(s, 'tocha', { x: 1, y: 4 });
    return { ...s, tokens: [token({ x: 2, y: 2 }), token({ id: 'oculto', oculto: true, x: 3, y: 2 }), token({ id: 'longe', x: 4, y: 4 })] };
  };
  const view = (s: TableScene) => playerView({ ...newTable(), cenas: [s], exibida: s.id }).scene!;
  it('não inclui objetos ocultos nem os que estão sob a névoa', () => {
    expect(view(scene()).objetos.map(o => o.tipo)).toEqual(['bau']);
    expect(view({ ...scene(), nevoa: false }).objetos.map(o => o.tipo)).toEqual(['bau', 'tocha']);
  });
  it('apaga o terreno que está sob a névoa: só o revelado vai', () => {
    expect(rowsOf(view(scene()).terreno)).toEqual(['......', '..ee..', '..mm..', '......', '......', '......']);
    expect(view({ ...scene(), nevoa: false }).terreno).toBe(scene().terreno);
  });
  it('mantém a cena do mestre intacta', () => {
    const s = scene(); view(s);
    expect(s.objetos).toHaveLength(3); expect(s.terreno).toContain('a');
  });
  it('a publicação leva o avatar e a classe da ficha junto do token e os objetos visíveis', () => {
    const s = scene();
    s.tokens = [token({ personagemId: 'lira', x: 2, y: 2 })];
    const avatar = { pele: '#8d5a36', olhos: '#3f7d3a', cabelo: '#b8442a' };
    const { mesa, fundo } = publishTable({ ...newTable(), cenas: [s], exibida: s.id }, [{ id: 'lira', nome: 'Lira', vida: null, avatar, classe: 'Xamã' }]);
    const received = readPublishedTable(JSON.parse(JSON.stringify(mesa)), fundo).scene!;
    expect(received.tokens[0]).toMatchObject({ nome: 'Lira', classe: 'Xamã', avatar, personagemId: '', notas: '' });
    expect(received.objetos.map(o => o.tipo)).toEqual(['bau']);
    expect(received.terreno).toBe(mesa.scene!.terreno);
  });
});
const rowsOf = (terrain: string): string[] => terrain.match(/.{6}/g) ?? [];

describe('Desenho do mapa com pixel art', () => {
  const draw = (s: TableScene, mode: 'mestre' | 'jogadores' = 'mestre', sheets?: Parameters<typeof renderBoard>[1]['sheets']): string => renderBoard(s, { mode, zoom: 40, sheets });
  it('usa as texturas dos terrenos (uma definição por tipo usado) em vez de cores lisas', () => {
    const s = { ...newScene('x', 6, 6), terreno: grid(['..vv..', '..aa..', '......', 'eemm..', '......', '......']) };
    const svg = draw(s);
    for (const id of ['v', 'a', 'e', 'm']) {
      expect(svg).toContain(`id="tb-mestre-t-${id}"`);
      expect(svg).toContain(`fill="url(#tb-mestre-t-${id})"`);
    }
    expect(svg).not.toContain('id="tb-mestre-t-p"');
    expect(svg).not.toContain('id="tb-mestre-t-n"');
    expect(svg.match(/data:image\/png;base64/g)!.length).toBe(4);
    expect(svg).toContain('class="table-px"');
  });
  it('parede: topo de pedra quando há parede abaixo, frente de tijolos quando não, e sombra no chão abaixo', () => {
    const s = { ...newScene('x', 6, 6), terreno: grid(['......', '.p....', '.p....', '......', '......', '......']) };
    const svg = draw(s);
    expect(svg).toContain('id="tb-mestre-t-p"'); // célula de cima: tem parede abaixo
    expect(svg).toContain('id="tb-mestre-t-pf"'); // célula de baixo: frente
    expect(svg).toContain('fill="#000000" fill-opacity=".3"'); // sombra sob a parede
    expect(svg).toContain('x="1" y="3" width="1" height="0.3"'); // no chão logo abaixo da parede
    const single = draw({ ...newScene('x', 6, 6), terreno: grid(['......', '.p....', '......', '......', '......', '......']) });
    expect(single).toContain('id="tb-mestre-t-pf"'); expect(single).not.toContain('id="tb-mestre-t-p"');
  });
  it('objetos viram `use` girado em volta do centro do quadrado, com os ocultos marcados', () => {
    let s = placeProp(newScene('x', 6, 6), 'porta', { x: 2, y: 3 }, { rot: 1 });
    s = placeProp(s, 'bau', { x: 0, y: 0 }); s = placeProp(s, 'bau', { x: 5, y: 5 }, { oculto: true });
    const svg = draw(s);
    expect(svg).toContain('transform="translate(2 3) rotate(90 .5 .5)"');
    expect(svg).toContain('transform="translate(0 0)"');
    expect(svg).toContain('class="table-prop is-hidden"');
    expect(svg).toContain('<title>Porta</title>');
    // Os dois baús compartilham a mesma imagem
    expect(svg.match(/<image id="tb-mestre-s\d+"/g)).toHaveLength(2);
  });
  it('token mostra o retrato de criatura, ou o avatar da ficha/do token, ou as iniciais', () => {
    const avatar = { pele: '#8d5a36', olhos: '#3f7d3a', cabelo: '#b8442a' };
    const s: TableScene = { ...newScene('x', 6, 6), tokens: [
      token({ id: 'a', nome: 'Lobo', sprite: 'lobo', x: 0 }), token({ id: 'b', nome: 'Lira', personagemId: 'f', x: 2 }),
      token({ id: 'c', nome: 'Borin Pedra', avatar, classe: 'Guerreiro', x: 4 }), token({ id: 'd', nome: 'Sem Retrato', x: 0, y: 3 })
    ] };
    const svg = draw(s, 'mestre', [{ id: 'f', nome: 'Lira', vida: null, avatar, classe: 'Mago' }]);
    expect(svg.match(/scale\(0\.84\)/g)).toHaveLength(3);
    expect(svg).toContain('>SR<'); // só o último usa as iniciais
    expect(svg).not.toContain('>LO<');
    expect(svg.match(/<image id="tb-mestre-s\d+"/g)).toHaveLength(3);
  });
  it('névoa: o mestre vê pontilhada e transparente, os jogadores opaca; ids não colidem entre as duas telas', () => {
    const s = { ...newScene('x', 6, 6), nevoa: true };
    const mestre = draw(s), jogadores = draw(s, 'jogadores');
    expect(mestre).toContain('<g class="table-fog" fill="url(#tb-mestre-t-nevoa)">');
    expect(jogadores).toContain('<g class="table-fog" fill="url(#tb-jogadores-t-nevoa)">');
    expect(draw({ ...s, nevoa: false })).not.toContain('table-fog');
  });
  it('a imagem de fundo do mapa não recebe o efeito pixelado (só os sprites)', () => {
    const svg = draw({ ...newScene('x', 6, 6), fundo: 'data:image/png;base64,AAAA', fundoRazao: 1 });
    expect(svg).toMatch(/<image class="table-map" href="data:image\/png;base64,AAAA"/);
  });
});
