// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { normalizeProject } from '../src/core/project';
import { applyOverrides, normalizeOverrides } from '../src/data/rules';
import { renderRunePalette } from '../src/ui/panels';
import { renderCanvas } from '../src/ui/canvas';
import { store } from '../src/ui/store';

const project = () => ({ nodes: [{ id: 'prism', shape: 'prism', lockedCenter: true }], connections: [] });
afterEach(() => { applyOverrides({}); document.body.innerHTML = ''; });

describe('Entrada externa', () => {
  it('rejeita formas herdadas e remove runas herdadas', () => {
    expect(normalizeProject({ nodes: [{ id: 'x', shape: 'constructor', lockedCenter: true }] })).toBeNull();
    const p = project();
    expect(normalizeProject({ ...p, nodes: [{ ...p.nodes[0], rune: '__proto__', inner: ['constructor', 'fogo'] }] })?.nodes[0]).toMatchObject({ rune: null, inner: ['fogo'] });
  });
  it('ignora chaves de protótipo nas regras', () => {
    const raw = JSON.parse('{"runas":{"__proto__":{"name":"intruso"},"constructor":{"name":"intruso"}},"formas":{"__proto__":{"role":"intruso"},"constructor":{"role":"intruso"}}}');
    expect(normalizeOverrides(raw)).toEqual({});
    expect(() => applyOverrides(raw)).not.toThrow();
  });
  it('rejeita IDs duplicados e projetos excessivos', () => {
    const p = project();
    expect(normalizeProject({ ...p, nodes: [p.nodes[0], p.nodes[0]] })).toBeNull();
    expect(normalizeProject({ nodes: Array(501).fill(p.nodes[0]) })).toBeNull();
    expect(normalizeProject({ ...p, connections: Array(2001).fill({}) })).toBeNull();
    expect(normalizeProject({ ...p, circles: Array(33).fill({}) })).toBeNull();
  });
  it('limita a descrição importada', () => {
    expect(normalizeProject({ ...project(), spellInfo: { name: 'Teste', desc: 'x'.repeat(10000) } })?.spellInfo?.desc.length).toBe(4000);
  });
});

describe('HTML e SVG', () => {
  it('mostra nome e sigilo das regras como texto', () => {
    document.body.innerHTML = '<input id="runeSearch"><div id="runeTargetText"></div><button id="btnClearRune"></button><button id="btnInnerMode"></button><div id="runesGrid"></div>';
    applyOverrides({ runas: { fogo: { name: '<img src=x onerror=alert(1)>', sigil: '<svg onload=alert(1)>' } } });
    store.state.runeCategoryFilter = 'all';
    renderRunePalette();
    const grid = document.getElementById('runesGrid')!;
    expect(grid.querySelector('img,[onerror],[onload]')).toBeNull();
    expect(grid.textContent).toContain('<img src=x onerror=alert(1)>');
  });
  it('preserva IDs importados sem criar atributos no SVG', () => {
    const attack = 'x" onmouseover="alert(1)';
    const p = normalizeProject({ nodes: [{ id: attack, shape: 'prism', lockedCenter: true }], circles: [{ id: attack }] })!;
    Object.assign(store.state, p);
    document.body.innerHTML = '<select id="missingMatSelect"></select><svg id="magicCircleSvg"></svg><div id="layerBar"></div>';
    renderCanvas();
    const svg = document.getElementById('magicCircleSvg')!;
    expect(svg.querySelector('[onmouseover]')).toBeNull();
    expect(svg.querySelector('[data-node-id]')?.getAttribute('data-node-id')).toBe(attack);
  });
});
