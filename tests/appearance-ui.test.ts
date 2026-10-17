// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Appearance } from '../src/core/appearance';
import { analyzeCircuit } from '../src/core/analysis';
import type { Model } from '../src/core/circles';
import { model, modelOf, prism } from './helpers';

// Canvas is checked in the browser; keep the real rule interpretation in these UI tests.
const scene = vi.hoisted(() => vi.fn((ap: Appearance) => ({
  pix: { toDataURL: () => 'data:image/png;base64,c2NlbmU=' },
  labels: ap.beings.filter(b => b.bond).map(b => ({ text: b.bond!, x: 178, y: 1 }))
})));
vi.mock('../src/ui/pixel-scene', () => ({ PW: 180, PH: 105, renderPixelScene: scene }));
import { renderAppearance, setupAppearance } from '../src/ui/appearance';

const el = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const show = (m: Model, title = '') => renderAppearance(m, analyzeCircuit(m, { specMode: 'simultaneous', missingMat: false }), title);

beforeEach(() => {
  document.body.innerHTML = `<main id="appShell" data-rpg-view="circulos">
    <section id="appearanceCard"><button id="btnExpandAppearance" disabled>Ampliar</button>
      <svg id="appearanceSvg"></svg><strong id="appearanceState"></strong><p id="appearanceCaption"></p>
      <p id="appearanceBindings" hidden></p><div id="spellSheet"></div>
    </section>
    <dialog id="appearanceDialog"><h2 id="appearanceDialogTitle"></h2><button id="btnCloseAppearance">Fechar</button>
      <svg id="appearanceExpandedSvg"></svg><p id="appearanceExpandedCaption"></p>
    </dialog>
  </main>`;
  const dialog = el<HTMLDialogElement>('appearanceDialog');
  dialog.showModal = vi.fn(() => { dialog.open = true; el('btnCloseAppearance').focus(); });
  dialog.close = vi.fn(() => { dialog.open = false; dialog.dispatchEvent(new Event('close')); });
  vi.spyOn(el('btnExpandAppearance'), 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
  setupAppearance();
});

describe('Prévia ilustrativa da magia', () => {
  it('informa o total exato e a amostragem da quantidade também na prévia ampliada', () => {
    const m = modelOf('m_falsa_acao');
    const intent = m.nodes.find(n => n.rune === 'mod_intencao')!;
    intent.bond = '9999999999999999999999999999999999999999';
    show(m);
    expect(el('appearanceCaption').textContent).toContain('Quantidade indicada pela Intenção: ' + intent.bond);
    expect(el('appearanceCaption').textContent).toContain('amostra de até 6 cópias');
    expect(el('appearanceExpandedCaption').textContent).toContain('amostra de até 6 cópias');
    expect(el('appearanceSvg').getAttribute('aria-label')).toContain(intent.bond + ' manifestações');
    intent.bond = '3';
    show(m);
    expect(el('appearanceCaption').textContent).toContain('Quantidade indicada pela Intenção: 3.');
    expect(el('appearanceCaption').textContent).not.toContain('amostra');
  });

  it('orienta o círculo vazio fora da imagem e não apresenta números fictícios', () => {
    show(model([prism(null)], []));
    expect(el('appearanceCard').dataset.state).toBe('empty');
    expect(el('appearanceCaption').textContent).toContain('feche o caminho de volta à Matriz');
    expect(el('appearanceSvg').querySelector('text')).toBeNull();
    expect(el('spellSheet').querySelector('.spell-stats')).toBeNull();
    expect(el('spellSheet').textContent).toContain('Em construção');
    expect(el<HTMLButtonElement>('btnExpandAppearance').disabled).toBe(false);
  });

  it('preserva os valores, efeitos e descrição calculados pelas runas', () => {
    show(modelOf('ex1'), 'Bola de Fogo');
    expect(el('appearanceCard').dataset.state).toBe('ready');
    expect(el('spellSheet').querySelector('h4')?.textContent).toBe('Bola de Fogo');
    expect(el('spellSheet').querySelectorAll('.spell-stats > div')).toHaveLength(6);
    expect(el('spellSheet').textContent).toContain('Fogo — Combustão');
    expect(el('spellSheet').textContent).toContain('À frente, em linha reta');
    expect(el('appearanceSvg').getAttribute('aria-label')).toContain('Uma esfera de chamas crepitantes');
    expect(el('appearanceCaption').textContent).toContain('Consulte a energia');
    expect(el('spellSheet').querySelector('details')?.open).toBe(false);
  });

  it('mostra o nome completo como texto seguro, sem inseri-lo sobre a arte', () => {
    const title = ('<img src=x onerror=alert(1)> Cântico ' + 'antigo '.repeat(12)).trim();
    show(modelOf('ex1'), title);
    expect(el('spellSheet').querySelector('h4')?.textContent).toBe(title.trim());
    expect(el('appearanceDialogTitle').textContent).toBe(title.trim());
    expect(el('spellSheet').querySelector('img, script')).toBeNull();
    expect(el('appearanceSvg').textContent).toBe('');
  });

  it('mantém o vínculo completo acessível e limita somente a legenda desenhada', () => {
    const m = modelOf('m_falsa_acao');
    const bond = '<script>alert(1)</script> ' + 'Memória '.repeat(10);
    m.nodes.find(n => n.rune === 'mod_intencao')!.bond = bond;
    show(m);
    expect(el('appearanceBindings').hidden).toBe(false);
    expect(el('appearanceBindings').textContent).toBe('Vínculos: ' + bond);
    expect(el('appearanceExpandedCaption').textContent).toContain(bond);
    expect(el('appearanceSvg').getAttribute('aria-label')).toContain(bond);
    expect(document.querySelector('script')).toBeNull();
    const label = el('appearanceSvg').querySelector('text')!;
    expect(Array.from(label.textContent!)).toHaveLength(18);
    expect(label.textContent).toMatch(/…$/);
    expect(Number(label.getAttribute('x'))).toBeLessThanOrEqual(260);
    expect(Number(label.getAttribute('y'))).toBeGreaterThanOrEqual(18);
  });

  it('reutiliza as duas cenas e o DOM ao renomear a magia', () => {
    const m = modelOf('ex1');
    show(m, 'Chama');
    const before = scene.mock.calls.length;
    const image = el('appearanceSvg').firstChild;
    show(m, 'Outra chama');
    expect(scene.mock.calls.length).toBe(before);
    expect(el('appearanceSvg').firstChild).toBe(image);
    expect(el('appearanceDialogTitle').textContent).toBe('Outra chama');
    show(modelOf('m_descarga'));
    expect(scene.mock.calls.length).toBe(before + 2);
  });

  it('preserva a escolha de abrir os componentes ao atualizar o círculo', () => {
    const m = modelOf('ex1');
    show(m);
    el('spellSheet').querySelector('details')!.open = true;
    m.nodes[0].x += 1;
    show(m);
    expect(el('spellSheet').querySelector('details')?.open).toBe(true);
  });

  it('amplia a mesma interpretação e devolve o foco ao fechar', () => {
    show(modelOf('ex1'));
    el('btnExpandAppearance').click();
    const dialog = el<HTMLDialogElement>('appearanceDialog');
    expect(dialog.open).toBe(true);
    expect(el('appearanceExpandedSvg').innerHTML).toBe(el('appearanceSvg').innerHTML);
    expect(document.activeElement).toBe(el('btnCloseAppearance'));
    el('btnCloseAppearance').click();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(el('btnExpandAppearance'));
  });

  it.each(['view', 'gate'])('fecha a ampliação quando o contexto visual muda: %s', async change => {
    show(modelOf('ex1'));
    el('btnExpandAppearance').click();
    if (change === 'view') el('appShell').dataset.rpgView = 'personagens';
    else el('appShell').hidden = true;
    await Promise.resolve();
    expect(el<HTMLDialogElement>('appearanceDialog').open).toBe(false);
  });

  it('não encaminha desfazer/refazer ao editor atrás da ampliação', () => {
    show(modelOf('ex1'));
    el('btnExpandAppearance').click();
    const dialog = el('appearanceDialog');
    const editorKey = vi.fn();
    window.addEventListener('keydown', editorKey);
    try {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', metaKey: true, bubbles: true }));
      expect(editorKey).not.toHaveBeenCalled();
    } finally { window.removeEventListener('keydown', editorKey); }
  });
});
