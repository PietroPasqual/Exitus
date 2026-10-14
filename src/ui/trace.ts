import { byId, setHint } from './dom';

// ✒️ Ver traçado: apaga o desenho e o refaz traço por traço, como uma pena no papel:
// primeiro o Prisma, depois os cabos (na ordem), as formas com as runas e por fim os anéis.

let running: Animation[] = [];

export function playTrace(): void {
  const svg = byId('magicCircleSvg');
  running.forEach(a => a.cancel());
  running = [];
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setHint('Animação desligada: o aparelho pede movimento reduzido.');
    return;
  }
  const geom = (root: Element | null): SVGGeometryElement[] =>
    root ? [...root.querySelectorAll<SVGGeometryElement>('path, circle, polygon, rect, line')]
      .filter(el => typeof el.getTotalLength === 'function' && !el.closest('.flow-pulse, .flow-core, .mana-glow')
        && !el.matches('.conn-hit, .curve-hit, .flow-pulse, .flow-core, .mana-glow, .prism-heart, .node-fill')) : [];
  const prisms = [...svg.querySelectorAll('.svg-node')].filter(g => g.querySelector('.prism-heart'));
  const others = [...svg.querySelectorAll('.svg-node')].filter(g => !prisms.includes(g));
  const steps: SVGGeometryElement[][] = [
    ...prisms.map(geom),
    ...[...svg.querySelectorAll('.conn-group')].map(geom),
    ...others.map(geom),
    ...[...svg.querySelectorAll('.ring, .envelope, .circle-frame')].map(g => (g.matches('path, rect') ? [g as SVGGeometryElement] : geom(g)))
  ].filter(list => list.length);

  svg.classList.add('tracing');
  const per = Math.max(60, Math.min(260, 3600 / Math.max(1, steps.length)));
  let delay = 0;
  steps.forEach(list => {
    list.forEach(el => {
      let len = 0;
      try { len = el.getTotalLength(); } catch { len = 0; }
      if (!len || !Number.isFinite(len)) return;
      running.push(el.animate(
        [{ strokeDasharray: `${len} ${len}`, strokeDashoffset: len }, { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 }],
        { duration: per * 1.6, delay, easing: 'ease-in-out', fill: 'backwards' }
      ));
    });
    delay += per;
  });
  const total = delay + per * 1.6;
  window.setTimeout(() => svg.classList.remove('tracing'), total);
  setHint('Desenhando o círculo traço por traço…');
}
