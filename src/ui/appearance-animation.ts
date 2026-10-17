/** The animation owns only the current illustration's small, lazy frame cache. */
export const APPEARANCE_ANIMATION_FRAMES = 8;

export interface AppearanceAnimationOptions {
  inline: Element;
  dialog: HTMLDialogElement;
  shell?: HTMLElement | null;
  buttons?: readonly HTMLButtonElement[];
  themeRoot?: Element;
  setFrame: (night: boolean, url: string, frame: number) => void;
  isReady: () => boolean;
  fps?: number;
}

export interface AppearanceAnimationState {
  playing: boolean;
  active: boolean;
  reducedMotion: boolean;
  frame: number;
  cacheSize: number;
}

export interface AppearanceAnimation {
  setSource: (key: string, renderFrame: (night: boolean, frame: number) => string, initial?: { day?: string; night?: string }) => void;
  refresh: () => void;
  toggle: () => void;
  getState: () => AppearanceAnimationState;
  destroy: () => void;
}

const players = new WeakMap<Element, AppearanceAnimation>();

/** One clock drives both sizes. Hidden previews do not render or schedule frames. */
export function createAppearanceAnimation(options: AppearanceAnimationOptions): AppearanceAnimation {
  players.get(options.inline)?.destroy();
  const { inline, dialog, shell, setFrame, isReady } = options;
  const themeRoot = options.themeRoot ?? document.body;
  const buttons = options.buttons ?? [];
  const fps = Number.isFinite(options.fps) ? options.fps! : 8;
  const period = 1000 / Math.max(6, Math.min(8, fps));
  const motion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const cache = new Map<number, string>();
  let reducedMotion = motion?.matches ?? false;
  let motionOverride = false;
  let paused = false;
  let destroyed = false;
  let sourceKey: string | undefined;
  let renderer: ((night: boolean, frame: number) => string) | undefined;
  let generation = 0;
  let frame = 0;
  let raf: number | undefined;
  let lastTime: number | undefined;
  let elapsed = 0;
  let intersecting = false;
  let renderedInline = false;
  let active = false;
  let night = !themeRoot.classList.contains('theme-sketch');
  let paintNeeded = false;

  const playing = (): boolean => !paused && (!reducedMotion || motionOverride);
  const contextAvailable = (): boolean => !destroyed && !document.hidden && inline.isConnected
    && (!shell || (shell.isConnected && !shell.hidden && (!shell.dataset.rpgView || shell.dataset.rpgView === 'circulos')));
  const modalAvailable = (): boolean => dialog.isConnected && dialog.open && !dialog.hidden;
  const canRun = (): boolean => !!renderer && isReady() && playing() && contextAvailable()
    && (modalAvailable() || (intersecting && renderedInline));

  function syncButtons(): void {
    const enabled = !!renderer && isReady();
    const text = playing() ? 'Pausar' : 'Animar';
    const label = playing() ? 'Pausar animação da magia' : 'Animar a magia';
    for (const button of buttons) {
      button.disabled = !enabled;
      if (button.textContent !== text) button.textContent = text;
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      if (button.getAttribute('title') !== label) button.setAttribute('title', label);
      if (button.getAttribute('aria-pressed') !== String(playing())) button.setAttribute('aria-pressed', String(playing()));
    }
  }

  function syncState(): void {
    const state = !renderer || !isReady() ? 'empty' : !playing() ? 'paused' : active ? 'playing' : 'suspended';
    if (inline.getAttribute('data-animation-state') !== state) inline.setAttribute('data-animation-state', state);
  }

  function stop(): void {
    if (raf !== undefined) window.cancelAnimationFrame(raf);
    raf = undefined;
    lastTime = undefined;
    active = false;
    syncState();
  }

  function schedule(): void {
    if (raf === undefined && canRun() && typeof window.requestAnimationFrame === 'function') {
      active = true;
      raf = window.requestAnimationFrame(tick);
      syncState();
    }
  }

  function tick(time: number): void {
    raf = undefined;
    if (!canRun()) { stop(); return; }
    if (lastTime !== undefined) elapsed += Math.max(0, time - lastTime);
    lastTime = time;
    if (elapsed >= period) {
      const steps = Math.floor(elapsed / period);
      frame = (frame + steps) % APPEARANCE_ANIMATION_FRAMES;
      elapsed %= period;
      paintNeeded = true;
    }
    if (paintNeeded && renderer) {
      const version = generation;
      const mode = night;
      const index = frame + (mode ? APPEARANCE_ANIMATION_FRAMES : 0);
      let url = cache.get(index);
      if (url === undefined) url = renderer(mode, frame);
      // A renderer can synchronously trigger another circle or tear down its view.
      if (destroyed || version !== generation) { schedule(); return; }
      cache.set(index, url);
      setFrame(mode, url, frame);
      paintNeeded = false;
    }
    schedule();
  }

  function isRendered(element: Element): boolean {
    for (let current: Element | null = element; current; current = current.parentElement) {
      if (current.hasAttribute('hidden')) return false;
      const style = window.getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    }
    return true;
  }

  function fallbackIntersection(): boolean {
    const rect = inline.getBoundingClientRect();
    let left = Math.max(0, rect.left), right = Math.min(window.innerWidth, rect.right);
    let top = Math.max(0, rect.top), bottom = Math.min(window.innerHeight, rect.bottom);
    if (rect.width <= 0 || rect.height <= 0) return false;
    for (let parent = inline.parentElement; parent; parent = parent.parentElement) {
      const style = window.getComputedStyle(parent);
      const clipX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX || style.overflow);
      const clipY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY || style.overflow);
      if (!clipX && !clipY) continue;
      const bounds = parent.getBoundingClientRect();
      if (clipX) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
      if (clipY) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
    }
    return right > left && bottom > top;
  }

  let intersection: IntersectionObserver | undefined;
  if (typeof IntersectionObserver !== 'undefined') {
    intersection = new IntersectionObserver(entries => {
      const entry = entries.find(item => item.target === inline);
      if (entry) intersecting = entry.isIntersecting;
      refresh();
    });
    intersection.observe(inline);
  }

  function refresh(): void {
    if (destroyed) return;
    const nextNight = !themeRoot.classList.contains('theme-sketch');
    if (nextNight !== night) { night = nextNight; paintNeeded = true; }
    renderedInline = inline.isConnected && isRendered(inline);
    if (!intersection) intersecting = fallbackIntersection();
    syncButtons();
    if (!canRun()) stop();
    else schedule();
    syncState();
  }

  function toggle(): void {
    if (destroyed || !renderer || !isReady()) return;
    if (playing()) paused = true;
    else { paused = false; motionOverride = reducedMotion; }
    refresh();
  }

  function onMotionChange(): void {
    reducedMotion = motion?.matches ?? false;
    motionOverride = false;
    refresh();
  }

  const mutation = new MutationObserver(refresh);
  mutation.observe(document.documentElement, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['hidden', 'data-rpg-view', 'data-view', 'data-rtab', 'class', 'style', 'open']
  });
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('resize', refresh);
  // Native dialog open/close and viewport scroll need no second playback loop.
  dialog.addEventListener('close', refresh);
  dialog.addEventListener('toggle', refresh);
  if (!intersection) document.addEventListener('scroll', refresh, true);
  if (motion?.addEventListener) motion.addEventListener('change', onMotionChange);
  else motion?.addListener(onMotionChange);
  buttons.forEach(button => button.addEventListener('click', toggle));

  const player: AppearanceAnimation = {
    setSource(key, renderFrame, initial) {
      if (destroyed) return;
      if (sourceKey !== key) {
        generation++;
        sourceKey = key;
        renderer = renderFrame;
        cache.clear();
        if (initial?.day !== undefined) cache.set(0, initial.day);
        if (initial?.night !== undefined) cache.set(APPEARANCE_ANIMATION_FRAMES, initial.night);
        frame = 0;
        elapsed = 0;
        lastTime = undefined;
        paintNeeded = true;
      }
      refresh();
    },
    refresh,
    toggle,
    getState: () => ({ playing: playing(), active, reducedMotion, frame, cacheSize: cache.size }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      generation++;
      stop();
      renderer = undefined;
      sourceKey = undefined;
      cache.clear();
      intersection?.disconnect();
      mutation.disconnect();
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('resize', refresh);
      dialog.removeEventListener('close', refresh);
      dialog.removeEventListener('toggle', refresh);
      document.removeEventListener('scroll', refresh, true);
      if (motion?.removeEventListener) motion.removeEventListener('change', onMotionChange);
      else motion?.removeListener(onMotionChange);
      buttons.forEach(button => button.removeEventListener('click', toggle));
      if (players.get(inline) === player) players.delete(inline);
    }
  };
  players.set(inline, player);
  refresh();
  return player;
}
