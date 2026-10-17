// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppearanceAnimation, type AppearanceAnimation } from '../src/ui/appearance-animation';

let callbacks: Map<number, FrameRequestCallback>;
let nextRaf: number;
let hidden: boolean;
let ready: boolean;
let motion: EventTarget & { matches: boolean };
let intersections: FakeIntersection[];
let players: AppearanceAnimation[];

class FakeIntersection {
  callback: IntersectionObserverCallback;
  target?: Element;
  disconnected = false;
  constructor(callback: IntersectionObserverCallback) { this.callback = callback; intersections.push(this); }
  observe(target: Element): void { this.target = target; }
  disconnect(): void { this.disconnected = true; }
  visible(value: boolean): void {
    this.callback([{ target: this.target, isIntersecting: value } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

const get = <T extends Element = HTMLElement>(id: string): T => document.getElementById(id) as unknown as T;
const flush = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve(); };
function step(time: number): void {
  const pending = [...callbacks.values()];
  callbacks.clear();
  pending.forEach(callback => callback(time));
}
function source(tag = 'spell'): ReturnType<typeof vi.fn<(night: boolean, frame: number) => string>> {
  return vi.fn((night: boolean, frame: number) => `${tag}:${night ? 'night' : 'day'}:${frame}`);
}
function create(render = source(), seeds: { day?: string; night?: string } = { day: 'day0', night: 'night0' }, fps?: number) {
  const setFrame = vi.fn();
  const player = createAppearanceAnimation({
    inline: get('inline'), dialog: get<HTMLDialogElement>('dialog'), shell: get<HTMLElement>('shell'),
    buttons: [get<HTMLButtonElement>('play'), get<HTMLButtonElement>('playExpanded')],
    setFrame, isReady: () => ready, fps
  });
  players.push(player);
  player.setSource('first', render, seeds);
  return { player, render, setFrame, intersection: intersections[intersections.length - 1] };
}

beforeEach(() => {
  callbacks = new Map(); nextRaf = 0; hidden = false; ready = true; players = []; intersections = [];
  document.body.className = '';
  document.body.innerHTML = `<main id="shell" data-rpg-view="circulos"><section id="card"><svg id="inline"></svg><button id="play"></button></section>
    <dialog id="dialog"><svg></svg><button id="playExpanded"></button></dialog></main>`;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  motion = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal('matchMedia', vi.fn(() => motion));
  vi.stubGlobal('IntersectionObserver', FakeIntersection);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { callbacks.set(++nextRaf, callback); return nextRaf; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => callbacks.delete(id)));
});

afterEach(() => { players.forEach(player => player.destroy()); vi.unstubAllGlobals(); });

describe('Relógio da ilustração da magia', () => {
  it('aguarda a prévia visível e aproveita os quadros estáticos existentes', () => {
    const { player, render, setFrame, intersection } = create();
    expect(callbacks.size).toBe(0);
    expect(render).not.toHaveBeenCalled();
    expect(player.getState()).toMatchObject({ active: false, cacheSize: 2 });
    intersection.visible(true);
    expect(callbacks.size).toBe(1);
    step(0);
    expect(render).not.toHaveBeenCalled();
    expect(setFrame).toHaveBeenCalledWith(true, 'night0', 0);
    expect(get('inline').getAttribute('data-animation-state')).toBe('playing');
  });

  it('usa tempo real a oito quadros por segundo sem gerar quadros intermediários atrasados', () => {
    const { player, render, intersection } = create();
    intersection.visible(true);
    step(0); step(16); step(124);
    expect(render).not.toHaveBeenCalled();
    step(125);
    expect(render).toHaveBeenLastCalledWith(true, 1);
    step(875);
    expect(render).toHaveBeenLastCalledWith(true, 7);
    expect(render).toHaveBeenCalledTimes(2);
    expect(player.getState().frame).toBe(7);
    expect(callbacks.size).toBe(1);
  });

  it.each([NaN, Infinity, 1000])('limita uma frequência inválida ou excessiva: %s', fps => {
    const { render, intersection } = create(source(), {}, fps);
    intersection.visible(true); step(0); step(125);
    expect(render).toHaveBeenLastCalledWith(true, 1);
  });

  it('mantém somente dezesseis URLs para a aparência atual e renderiza só o tema ativo', () => {
    const { player, render, intersection } = create();
    intersection.visible(true);
    for (let frame = 0; frame < 24; frame++) step(frame * 125);
    expect(render).toHaveBeenCalledTimes(7);
    expect(render.mock.calls.every(([night]) => night)).toBe(true);
    document.body.classList.add('theme-sketch');
    player.refresh();
    for (let frame = 24; frame < 48; frame++) step(frame * 125);
    expect(render).toHaveBeenCalledTimes(14);
    expect(player.getState().cacheSize).toBe(16);
    document.body.classList.remove('theme-sketch');
    player.refresh(); step(48 * 125);
    expect(render).toHaveBeenCalledTimes(14);
  });

  it('suspende totalmente fora da tela e retoma sem avançar o tempo que ficou oculto', () => {
    const { player, render, intersection } = create();
    intersection.visible(true); step(0); step(125);
    intersection.visible(false);
    expect(callbacks.size).toBe(0);
    expect(get('inline').getAttribute('data-animation-state')).toBe('suspended');
    step(10_000);
    expect(render).toHaveBeenCalledTimes(1);
    intersection.visible(true); step(10_000);
    expect(player.getState().frame).toBe(1);
    step(10_125);
    expect(player.getState().frame).toBe(2);
  });

  it('suspende ao ocultar o documento mesmo com modal aberto', () => {
    const { player, render, intersection } = create();
    get<HTMLDialogElement>('dialog').open = true;
    intersection.visible(true); step(0);
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    expect(callbacks.size).toBe(0);
    step(9000); expect(render).not.toHaveBeenCalled();
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    expect(player.getState().active).toBe(true);
    step(9000); expect(player.getState().frame).toBe(0);
  });

  it('usa o mesmo relógio no modal e para ao fechá-lo se a prévia pequena estiver fora da tela', async () => {
    const { player, intersection } = create();
    intersection.visible(false);
    const dialog = get<HTMLDialogElement>('dialog');
    dialog.open = true; await flush();
    expect(callbacks.size).toBe(1);
    step(0); step(125);
    intersection.visible(true);
    expect(callbacks.size).toBe(1);
    intersection.visible(false);
    expect(player.getState().active).toBe(true);
    dialog.open = false; dialog.dispatchEvent(new Event('close'));
    expect(callbacks.size).toBe(0);
    expect(player.getState().active).toBe(false);
  });

  it.each(['personagens', 'ficha'])('suspende na página %s e volta apenas ao editor', async view => {
    const { player, intersection } = create();
    intersection.visible(true); step(0);
    get<HTMLDialogElement>('dialog').open = true;
    get<HTMLElement>('shell').dataset.rpgView = view; await flush();
    expect(callbacks.size).toBe(0);
    get<HTMLElement>('shell').dataset.rpgView = 'circulos'; await flush();
    expect(player.getState().active).toBe(true);
  });

  it('reage ao login, abas e ancestrais escondidos, mesmo antes da atualização do IntersectionObserver', async () => {
    const { player, intersection } = create();
    intersection.visible(true); step(0);
    get<HTMLElement>('shell').hidden = true; await flush();
    expect(callbacks.size).toBe(0);
    get<HTMLElement>('shell').hidden = false; await flush();
    expect(callbacks.size).toBe(1);
    get<HTMLElement>('card').style.display = 'none'; await flush();
    expect(callbacks.size).toBe(0);
    get<HTMLElement>('card').style.display = ''; await flush();
    expect(player.getState().active).toBe(true);
  });

  it('inicia pausado com movimento reduzido, permite uma escolha explícita e respeita novas mudanças', () => {
    motion.matches = true;
    const { player, intersection } = create();
    intersection.visible(true);
    expect(callbacks.size).toBe(0);
    expect(get('play').textContent).toBe('Animar');
    get<HTMLElement>('playExpanded').click();
    expect(callbacks.size).toBe(1);
    expect(get('play').textContent).toBe('Pausar');
    motion.matches = false; motion.dispatchEvent(new Event('change'));
    motion.matches = true; motion.dispatchEvent(new Event('change'));
    expect(callbacks.size).toBe(0);
    expect(player.getState()).toMatchObject({ playing: false, reducedMotion: true });
  });

  it('sincroniza os dois controles e conserva a pausa manual entre círculos', () => {
    const { player, intersection } = create();
    intersection.visible(true); step(0); step(125);
    get<HTMLElement>('play').click();
    expect(callbacks.size).toBe(0);
    for (const id of ['play', 'playExpanded']) {
      expect(get(id).textContent).toBe('Animar');
      expect(get(id).getAttribute('aria-pressed')).toBe('false');
      expect(get(id).getAttribute('aria-label')).toBe('Animar a magia');
    }
    player.setSource('second', source('second'), { day: 'd', night: 'n' });
    expect(player.getState()).toMatchObject({ playing: false, frame: 0, cacheSize: 2 });
    get<HTMLElement>('playExpanded').click();
    expect(get('play').textContent).toBe('Pausar');
    expect(callbacks.size).toBe(1);
  });

  it('descarta o cache e o renderizador antigo quando outra aparência substitui a atual', () => {
    const { player, render, intersection, setFrame } = create();
    intersection.visible(true); step(0); step(125);
    const next = source('new');
    player.setSource('second', next, { day: 'new:day:0', night: 'new:night:0' });
    expect(player.getState()).toMatchObject({ frame: 0, cacheSize: 2 });
    step(250); step(375);
    expect(render).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledExactlyOnceWith(true, 1);
    expect(setFrame).toHaveBeenLastCalledWith(true, 'new:night:1', 1);
  });

  it('não reinicia o relógio ou o cache ao renomear a mesma aparência', () => {
    const { player, render, intersection } = create();
    intersection.visible(true); step(0); step(125);
    const ignored = source('duplicate');
    player.setSource('first', ignored);
    step(250);
    expect(player.getState()).toMatchObject({ frame: 2, cacheSize: 4 });
    expect(render).toHaveBeenCalledTimes(2);
    expect(ignored).not.toHaveBeenCalled();
  });

  it('rejeita um quadro antigo se seu renderizador trocar de círculo durante a geração', () => {
    const { player, intersection, setFrame } = create();
    const next = source('next');
    player.setSource('reentrant', vi.fn(() => {
      player.setSource('newer', next, { day: 'new:d', night: 'new:n' });
      return 'stale';
    }), { day: 'old:d', night: 'old:n' });
    intersection.visible(true); step(0); step(125);
    expect(setFrame.mock.calls.some(([, url]) => url === 'stale')).toBe(false);
    expect(player.getState()).toMatchObject({ frame: 0, cacheSize: 2 });
    step(250);
    expect(setFrame).toHaveBeenLastCalledWith(true, 'new:n', 0);
  });

  it('não agenda animação de círculos vazios e desativa os controles', () => {
    ready = false;
    const { player, intersection } = create();
    intersection.visible(true);
    expect(callbacks.size).toBe(0);
    expect(get<HTMLButtonElement>('play').disabled).toBe(true);
    expect(get('inline').getAttribute('data-animation-state')).toBe('empty');
    ready = true; player.refresh();
    expect(callbacks.size).toBe(1);
  });

  it('para ao remover a prévia do DOM e retorna somente se for recolocada', async () => {
    const { player, intersection } = create();
    intersection.visible(true); step(0);
    const inline = get('inline'); inline.remove(); await flush();
    expect(callbacks.size).toBe(0);
    get('card').append(inline); await flush();
    expect(player.getState().active).toBe(true);
  });

  it('substitui a configuração anterior sem duplicar relógios ou escutas dos botões', () => {
    const first = create();
    first.intersection.visible(true); step(0);
    const second = create();
    expect(first.intersection.disconnected).toBe(true);
    expect(first.player.getState()).toMatchObject({ active: false, cacheSize: 0 });
    second.intersection.visible(true);
    expect(callbacks.size).toBe(1);
    get<HTMLElement>('play').click();
    expect(second.player.getState().playing).toBe(false);
    expect(callbacks.size).toBe(0);
  });

  it('libera cache, renderizador, observadores e eventos ao destruir repetidamente', async () => {
    const { player, intersection, render } = create();
    intersection.visible(true); step(0);
    player.destroy(); player.destroy();
    expect(intersection.disconnected).toBe(true);
    expect(player.getState()).toMatchObject({ active: false, cacheSize: 0 });
    motion.matches = true; motion.dispatchEvent(new Event('change'));
    document.dispatchEvent(new Event('visibilitychange'));
    document.body.classList.add('theme-sketch'); await flush();
    get<HTMLElement>('play').click();
    player.setSource('dead', source()); player.refresh();
    step(300);
    expect(callbacks.size).toBe(0);
    expect(render).not.toHaveBeenCalled();
  });

  it('sem IntersectionObserver usa os limites da tela, sem animar elementos sem geometria', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { player, render } = create();
    expect(callbacks.size).toBe(0);
    vi.spyOn(get('inline'), 'getBoundingClientRect').mockReturnValue({ x: 1, y: 1, left: 1, top: 1, right: 101, bottom: 51, width: 100, height: 50 } as DOMRect);
    window.dispatchEvent(new Event('resize'));
    expect(callbacks.size).toBe(1);
    step(0); step(125);
    expect(render).toHaveBeenCalledTimes(1);
    player.destroy();
    document.dispatchEvent(new Event('scroll'));
    expect(callbacks.size).toBe(0);
  });

  it('sem IntersectionObserver respeita o recorte do painel com rolagem', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const card = get<HTMLElement>('card');
    card.style.overflow = 'auto';
    vi.spyOn(get('inline'), 'getBoundingClientRect').mockReturnValue({ left: 1, top: 100, right: 101, bottom: 150, width: 100, height: 50 } as DOMRect);
    const clip = vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 200, bottom: 80, width: 200, height: 80 } as DOMRect);
    const { player } = create();
    expect(callbacks.size).toBe(0);
    clip.mockReturnValue({ left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 } as DOMRect);
    card.dispatchEvent(new Event('scroll'));
    expect(callbacks.size).toBe(1);
    player.destroy();
  });
});
