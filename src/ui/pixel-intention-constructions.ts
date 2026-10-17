import type { IntentionForm } from '../core/intention';
import { part, rect, type IntentionPart, type IntentionPoint } from './pixel-intention-geometry';

/** A positive-width strip: the spaces between strips remain genuinely transparent. */
function beam(a: IntentionPoint, b: IntentionPoint, width: number, light: number): IntentionPart {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
  const ox = -dy / length * width / 2, oy = dx / length * width / 2;
  return part(light, [a[0] + ox, a[1] + oy], [b[0] + ox, b[1] + oy],
    [b[0] - ox, b[1] - oy], [a[0] - ox, a[1] - oy]);
}

function portal(): IntentionPart[] {
  const outer: IntentionPoint[] = [[-19, 20], [-19, -6], [-16, -14], [-9, -20], [0, -22], [9, -20], [16, -14], [19, -6], [19, 20]];
  const inner: IntentionPoint[] = [[-11, 20], [-11, -5], [-8, -10], [-4, -13], [0, -14], [4, -13], [8, -10], [11, -5], [11, 20]];
  return [
    ...outer.slice(0, -1).map((point, i) => part(i < 4 ? .86 : .38, point, outer[i + 1], inner[i + 1], inner[i])),
    rect(-21, 17, -9, 21, .62), rect(9, 17, 21, 21, .43),
    part(.98, [-4, -22], [4, -22], [3, -14], [-3, -14]),
    rect(-19, -1, -17, 16, .96), rect(12, 0, 14, 15, .68),
    // Voussoir joints and inset pillar channels stay entirely on the arch stones.
    rect(-18, -4, -12, -2, .22), rect(-18, 4, -12, 6, .23), rect(-18, 12, -12, 14, .22),
    rect(12, -4, 18, -2, .22), rect(12, 4, 18, 6, .23), rect(12, 12, 18, 14, .22),
    part(.23, [-15, -15], [-11, -11], [-10, -12], [-14, -16]),
    part(.24, [10, -12], [14, -16], [15, -15], [11, -11]),
    part(.97, [-15, -12], [-13, -15], [-9, -18], [-7, -16], [-11, -13]),
    part(.64, [7, -16], [9, -18], [13, -15], [15, -12], [11, -13]),
    part(.23, [-3, -20], [3, -20], [2, -16], [-2, -16]),
    part(.96, [-2, -20], [1, -20], [0, -17], [-1, -17]),
    rect(-20, 18, -10, 19, .95), rect(10, 18, 20, 19, .77)
  ];
}

function web(): IntentionPart[] {
  const rays = Array.from({ length: 8 }, (_, i): IntentionPoint => {
    const angle = i * Math.PI / 4;
    return [Math.cos(angle) * 21, Math.sin(angle) * 20];
  });
  const parts = rays.map((p, i) => beam([0, 0], p, 1.8, i < 4 ? .54 : .9));
  for (const radius of [.32, .64, .96]) {
    for (let i = 0; i < rays.length; i++) {
      const a = rays[i], b = rays[(i + 1) % rays.length];
      const middle: IntentionPoint = [(a[0] + b[0]) * radius * .42, (a[1] + b[1]) * radius * .42];
      parts.push(beam([a[0] * radius, a[1] * radius], middle, 1.5, i < 4 ? .55 : .89));
      parts.push(beam(middle, [b[0] * radius, b[1] * radius], 1.5, i < 4 ? .55 : .89));
    }
  }
  // Small wrapped knots catch the light at each radial crossing; cells stay open.
  for (const radius of [.32, .64, .96]) for (let i = 0; i < rays.length; i++) {
    const x = rays[i][0] * radius, y = rays[i][1] * radius, knot = radius > .9 ? .8 : 1.5;
    parts.push(part(.25, [x - knot, y], [x, y - knot], [x + knot, y], [x, y + knot]));
    parts.push(part(i < 4 ? .73 : .96, [x - knot * .8, y], [x, y - knot * .8], [x + knot * .3, y], [x, y + knot * .3]));
  }
  parts.push(part(.94, [-2.5, 0], [0, -2.5], [2.5, 0], [0, 2.5]));
  parts.push(part(.26, [-.7, 0], [0, -.7], [.7, 0], [0, .7]));
  return parts;
}

function net(): IntentionPart[] {
  const parts: IntentionPart[] = [];
  // Clip the diagonal threads to a rectangle; no opaque backing fills the mesh.
  for (const direction of [-1, 1]) {
    for (let offset = -32; offset <= 32; offset += 8) {
      const candidates: IntentionPoint[] = [[-18, direction * -18 + offset], [18, direction * 18 + offset],
        [(-16 - offset) / direction, -16], [(16 - offset) / direction, 16]];
      const edges = candidates.filter(([x, y]) => x >= -18 && x <= 18 && y >= -16 && y <= 16);
      if (edges.length >= 2 && Math.hypot(edges[0][0] - edges[1][0], edges[0][1] - edges[1][1]) > .01)
        parts.push(beam(edges[0], edges[1], 1.4, direction < 0 ? .88 : .48));
    }
  }
  // Knotted crossings and a braided selvage refine the open mesh, without a backing.
  for (let x = -16; x <= 16; x += 4) for (let y = -12; y <= 12; y += 4) {
    if ((x + y) % 8 !== 0) continue;
    parts.push(part(.23, [x - 1.4, y], [x, y - 1.4], [x + 1.4, y], [x, y + 1.4]));
    parts.push(part(.95, [x - 1, y - .4], [x, y - 1.1], [x + .7, y], [x, y + .5]));
  }
  for (const x of [-12, -4, 4, 12]) {
    parts.push(beam([x - 1, -16.7], [x + 1, -15.3], .8, .35));
    parts.push(beam([x - 1, 15.3], [x + 1, 16.7], .8, .87));
  }
  return [
    ...parts,
    beam([-18, -16], [18, -16], 2.2, .95), beam([-18, 16], [18, 16], 2.2, .52),
    beam([-18, -16], [-18, 16], 2.2, .82), beam([18, -16], [18, 16], 2.2, .36),
    beam([-21, -20], [-15, -13], 2, .76), beam([21, -20], [15, -13], 2, .72),
    beam([-21, 20], [-15, 13], 2, .58), beam([21, 20], [15, 13], 2, .58)
  ];
}

function gear(): IntentionPart[] {
  const outer = Array.from({ length: 32 }, (_, i): IntentionPoint => {
    const angle = (i - .5) / 32 * Math.PI * 2, radius = i % 4 < 2 ? 21 : 16;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
  const inner = Array.from({ length: 32 }, (_, i): IntentionPoint => {
    const angle = (i - .5) / 32 * Math.PI * 2;
    return [Math.cos(angle) * 8, Math.sin(angle) * 8];
  });
  const parts = outer.map((point, i) => part(i < 16 ? .44 : .87, point, outer[(i + 1) % 32], inner[(i + 1) % 32], inner[i]));
  // Machined tooth bevels and a recessed inner lip never cover the axle opening.
  for (let i = 0; i < 32; i++) {
    const a = outer[i], b = outer[(i + 1) % 32];
    parts.push(part(i < 16 ? .7 : .97, a, b, [b[0] * .89, b[1] * .89], [a[0] * .89, a[1] * .89]));
    const c = inner[i], d = inner[(i + 1) % 32];
    parts.push(part(i < 16 ? .22 : .42, c, d, [d[0] * 1.23, d[1] * 1.23], [c[0] * 1.23, c[1] * 1.23]));
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, x = Math.cos(a) * 12.5, y = Math.sin(a) * 12.5;
    parts.push(rect(x - 1.6, y - 1.6, x + 1.6, y + 1.6, .24));
    parts.push(rect(x - 1.2, y - 1.2, x + .6, y + .6, .94));
  }
  return parts;
}

function anchorLoop(): IntentionPart[] {
  const points = Array.from({ length: 8 }, (_, i) => i * Math.PI / 4);
  const edge = (angle: number, radius: number): IntentionPoint => [Math.cos(angle) * radius, -17 + Math.sin(angle) * radius];
  return points.map((angle, i) => {
    const next = points[(i + 1) % points.length];
    return part(i < 4 ? .48 : .91, edge(angle, 5), edge(next, 5), edge(next, 2.5), edge(angle, 2.5));
  });
}

/** Structures and mechanisms, authored at size 15 in the spell's own material. */
export const CONSTRUCTION_FORMS = {
  portal: portal(),
  jaula: [
    beam([-17, -8], [-12, -16], 3, .87), beam([-12, -16], [0, -20], 3, .91),
    beam([0, -20], [12, -16], 3, .58), beam([12, -16], [17, -8], 3, .38),
    rect(-18, -9, 18, -6, .72),
    rect(-17, -6, -14, 16, .92), rect(-9, -6, -6, 16, .76),
    rect(-1.5, -6, 1.5, 16, .69), rect(6, -6, 9, 16, .5), rect(14, -6, 17, 16, .34),
    rect(-19, 15, 19, 19, .54), rect(-19, 15, 19, 17, .9),
    rect(-17, 19, -13, 22, .52), rect(13, 19, 17, 22, .34),
    // Cross-braced crown, folded bar faces and a latch keep every gap transparent.
    beam([-12, -15], [0, -7], 1.2, .23), beam([12, -15], [0, -7], 1.2, .23),
    rect(-17, -5, -16, 14, .98), rect(-9, -5, -8, 14, .94),
    rect(-1, -5, 0, 14, .9), rect(6, -5, 7, 14, .78),
    rect(14, -5, 15, 14, .6),
    rect(-18, -8, 18, -7, .97), rect(-18, -6, 18, -5, .23),
    rect(-3, 2, 3, 7, .26), rect(-2, 2, 2, 4, .95), rect(0, 4, 1, 6, .16),
    rect(-16, 16, -14, 18, .24), rect(-8, 16, -6, 18, .24),
    rect(6, 16, 8, 18, .24), rect(14, 16, 16, 18, .24)
  ],
  ponte: [
    part(.69, [-24, 17], [-24, 6], [-18, 0], [-10, -5], [0, -8], [10, -5], [18, 0], [24, 6], [24, 17],
      [17, 17], [17, 9], [11, 4], [5, 1], [0, 0], [-5, 1], [-11, 4], [-17, 9], [-17, 17]),
    beam([-23, 5], [-17, 0], 2, .95), beam([-17, 0], [-9, -5], 2, .95),
    beam([-9, -5], [0, -8], 2, .95), beam([0, -8], [9, -5], 2, .86),
    rect(-24, 14, -17, 19, .51), rect(17, 14, 24, 19, .35),
    rect(-22, -2, -19, 5, .81), rect(-13, -8, -10, 0, .85),
    rect(-2, -11, 2, -5, .92), rect(10, -8, 13, 0, .53), rect(19, -2, 22, 5, .4),
    beam([-21, -3], [-11, -9], 2, .91), beam([-11, -9], [0, -12], 2, .91),
    beam([0, -12], [11, -9], 2, .62), beam([11, -9], [21, -3], 2, .5),
    // Fitted arch stones and cap joints follow the bridge opening.
    beam([-23, 8], [-18, 10], 1.5, .23), beam([-21, 1], [-16, 5], 1.5, .23),
    beam([-14, -2], [-11, 3], 1.5, .23), beam([-6, -6], [-5, 0], 1.5, .23),
    beam([5, -6], [5, 0], 1.5, .23), beam([14, -2], [11, 3], 1.5, .23),
    beam([21, 1], [16, 5], 1.5, .23), beam([23, 8], [18, 10], 1.5, .23),
    rect(-23, 15, -18, 16, .96), rect(18, 15, 23, 16, .71),
    part(.96, [-3, -7], [0, -8], [3, -7], [2, -3], [-2, -3]),
    rect(-13, -7, -10, -5, .25), rect(10, -7, 13, -5, .25)
  ],
  escada: [
    beam([-17, 21], [3, -21], 3.5, .88), beam([-3, 21], [17, -21], 3.5, .42),
    ...Array.from({ length: 7 }, (_, i) => {
      const y = 16 - i * 5.5, x = -17 + (21 - y) * 20 / 42;
      return beam([x, y], [x + 14, y], 2.4, i % 2 ? .63 : .79);
    }),
    // Socketed rungs and long timber edge facets stay aligned to the leaning rails.
    beam([-16.6, 19], [2.4, -20], .9, .97),
    beam([-2.7, 19], [16.3, -20], .9, .71),
    ...Array.from({ length: 7 }, (_, i) => {
      const y = 16 - i * 5.5, x = -17 + (21 - y) * 20 / 42;
      return [rect(x + 1, y - .6, x + 13, y + .2, .96),
        rect(x - .6, y - 1, x + 1.2, y + 1, .24), rect(x + 12.8, y - 1, x + 14.6, y + 1, .24)];
    }).flat()
  ],
  torre: [
    part(.64, [-16, -21], [-9, -21], [-9, -16], [-3, -16], [-3, -21], [3, -21], [3, -16], [9, -16], [9, -21], [16, -21], [16, -10], [-16, -10]),
    rect(-13, -10, 13, 5, .61), rect(-13, 5, -5, 19, .74), rect(5, 5, 13, 19, .4),
    part(.7, [-5, 5], [-5, 2], [-3, -1], [3, -1], [5, 2], [5, 5]),
    rect(-13, -10, -10, 18, .9), rect(10, -10, 13, 18, .3),
    rect(-16, -12, 16, -9, .86), rect(-16, 18, -5, 22, .68), rect(5, 18, 16, 22, .41),
    rect(-7, -7, -4, -3, .23), rect(4, -7, 7, -3, .23),
    rect(-10, 1, -6, 2.5, .43), rect(7, 10, 11, 11.5, .23),
    // Bevelled merlons, recessed arrowslits and staggered masonry frame the open arch.
    rect(-15, -20, -10, -19, .96), rect(-2, -20, 2, -19, .96), rect(10, -20, 15, -19, .83),
    rect(-15, -16, -10, -14, .23), rect(-2, -16, 2, -14, .23), rect(10, -16, 15, -14, .23),
    rect(-12, -5, -7, -4, .38), rect(-3, -5, 3, -4, .35), rect(8, -5, 12, -4, .24),
    rect(-8, -9, -3, -7, .92), rect(3, -9, 8, -7, .72),
    rect(-7, -7, -4, -3, .18), rect(4, -7, 7, -3, .18),
    rect(-12, 4, -6, 5, .28), rect(6, 4, 12, 5, .24),
    rect(-12, 11, -6, 12, .29), rect(6, 11, 12, 12, .24),
    rect(-10, 6, -9, 10, .35), rect(8, 0, 9, 3, .23),
    part(.96, [-5, 2], [-3, -1], [0, -1], [-2, 2], [-3, 5], [-5, 5]),
    part(.3, [1, -1], [3, -1], [5, 2], [5, 5], [4, 5], [3, 2]),
    rect(-15, 19, -6, 20, .96), rect(6, 19, 15, 20, .7)
  ],
  pilar: [
    rect(-15, -22, 15, -18, .9), rect(-12, -18, 12, -14, .57),
    part(.76, [-11, -14], [11, -14], [7, -9], [-7, -9]),
    part(.7, [-7, -9], [7, -9], [9, 16], [-9, 16]),
    part(.95, [-7, -9], [-4, -9], [-5, 16], [-9, 16]),
    part(.36, [4, -9], [7, -9], [9, 16], [5, 16]),
    rect(-1, -8, 1, 15, .89), rect(-11, 15, 11, 19, .59),
    rect(-16, 19, 16, 22, .67), rect(-16, 19, 16, 20.5, .95),
    // Fluted shaft channels, carved capital collars and stepped base moulding.
    rect(-14, -21, 14, -20, .98), rect(-12, -18, 12, -17, .23),
    rect(-11, -15, 11, -14, .94),
    part(.23, [-5, -8], [-3, -8], [-3, 14], [-5, 14]),
    rect(-2, -8, -.5, 14, .98), rect(1, -8, 2.5, 14, .23),
    part(.74, [3, -8], [4, -8], [5, 14], [3, 14]),
    rect(-9, 15, 9, 16, .95), rect(-10, 18, 10, 19, .24),
    rect(-15, 21, 15, 22, .32)
  ],
  teia: web(),
  rede: net(),
  ancora: [
    ...anchorLoop(),
    rect(-2, -12, 2, 18, .66), rect(-2, -12, -.5, 16, .94),
    rect(-11, -7, 11, -4, .7), rect(-11, -7, 11, -5.5, .94),
    part(.73, [0, 21], [-11, 17], [-18, 11], [-21, 2], [-14, 6], [-16, 8], [-11, 12], [-2, 15]),
    part(.43, [0, 21], [11, 17], [18, 11], [21, 2], [14, 6], [16, 8], [11, 12], [2, 15]),
    part(.95, [-21, 2], [-20, -2], [-13, 4], [-14, 6], [-18, 5], [-18, 10]),
    part(.67, [21, 2], [20, -2], [13, 4], [14, 6], [18, 5], [18, 10]),
    // Forged shank bevels, wrapped crossbar ends and fluke ridges.
    rect(.5, -11, 2, 14, .23), rect(-2, -3, 0, 14, .97),
    rect(-10, -6, -8, -4, .23), rect(8, -6, 10, -4, .23),
    part(.22, [-16, 8], [-12, 12], [-2, 16], [0, 19], [-8, 16], [-14, 12]),
    part(.95, [-19, 7], [-17, 10], [-12, 13], [-8, 14], [-12, 12], [-16, 8]),
    part(.24, [16, 8], [12, 12], [2, 16], [0, 19], [8, 16], [14, 12]),
    part(.83, [19, 7], [17, 10], [12, 13], [8, 14], [12, 12], [16, 8]),
    part(.97, [-19, 1], [-16, 3], [-15, 4], [-18, 3]),
    part(.86, [19, 1], [16, 3], [15, 4], [18, 3])
  ],
  engrenagem: gear(),
  sino: [
    rect(-3, -21, 3, -15, .72), rect(-3, -21, -1, -15, .94),
    part(.66, [0, -16], [-7, -14], [-11, -8], [-12, 5], [-17, 12], [-17, 15], [17, 15], [17, 12], [12, 5], [11, -8], [7, -14]),
    part(.9, [-6, -12], [-8, -6], [-9, 5], [-13, 10], [-7, 10], [-4, 5], [-3, -10]),
    part(.32, [6, -13], [10, -8], [11, 5], [16, 12], [8, 12], [6, 5], [5, -7]),
    rect(-17, 12, 17, 15, .53), rect(-17, 12, 17, 13.5, .98),
    part(.77, [-3, 16], [3, 16], [4, 19], [2, 22], [-2, 22], [-4, 19]),
    beam([-20, -3], [-22, 4], 1.7, .79), beam([20, -3], [22, 4], 1.7, .58),
    // Cast relief bands, a rounded crown and dark hollow lip around the clapper.
    part(.96, [-4, -14], [0, -15], [4, -14], [6, -11], [2, -12], [-3, -12]),
    part(.23, [-10, -4], [-7, -5], [-3, -4], [3, -4], [8, -5], [10, -4], [9, -2], [4, -2], [-5, -2], [-10, -2]),
    part(.95, [-9, -5], [-5, -6], [4, -6], [9, -5], [7, -4], [-6, -4]),
    part(.23, [-14, 10], [-8, 9], [8, 9], [14, 10], [16, 12], [-16, 12]),
    rect(-15, 14, 15, 15, .2), rect(-15, 12, 15, 13, .97),
    part(.96, [-2, 17], [1, 17], [2, 19], [0, 21], [-2, 20]),
    rect(1, 18, 3, 20, .23)
  ],
  lanterna: [
    beam([-6, -13], [-6, -19], 2.4, .92), beam([-6, -19], [0, -22], 2.4, .89),
    beam([0, -22], [6, -19], 2.4, .6), beam([6, -19], [6, -13], 2.4, .4),
    part(.7, [-15, -8], [-5, -15], [5, -15], [15, -8], [14, -5], [-14, -5]),
    part(.95, [-15, -8], [-5, -15], [0, -15], [-5, -8]),
    part(.35, [3, -15], [5, -15], [15, -8], [14, -5], [9, -5]),
    beam([-10, -5], [-8, 14], 2.5, .89), beam([10, -5], [8, 14], 2.5, .36),
    part(.92, [-4, 9], [-5, 5], [-2, 0], [0, -4], [1, 2], [4, 0], [5, 6], [2, 10], [-2, 10]),
    part(.55, [-1, 10], [-2, 7], [0, 4], [2, 7], [2, 10]),
    rect(-5, 10, 5, 12, .61), rect(-11, 13, 11, 17, .62),
    part(.46, [-11, 17], [11, 17], [14, 21], [-14, 21]), rect(-14, 19, 14, 21, .88),
    // Folded roof, window rails, wick cup and chased feet preserve the open glass gaps.
    part(.23, [-5, -14], [0, -15], [5, -14], [10, -9], [7, -8], [2, -12], [-2, -12], [-7, -8]),
    rect(-12, -7, 12, -5, .96), rect(-11, -5, 11, -4, .23),
    beam([-9, -3], [-7.5, 12], .8, .98), beam([9, -3], [7.5, 12], .8, .67),
    beam([-9, 2], [-5, 2], 1.3, .72), beam([5, 2], [9, 2], 1.3, .44),
    rect(-4, 11, 4, 12, .23), rect(-9, 14, 9, 15, .96),
    rect(-10, 17, 10, 18, .23), rect(-12, 20, -9, 21, .23), rect(9, 20, 12, 21, .23)
  ]
} satisfies Partial<Record<IntentionForm, IntentionPart[]>>;
