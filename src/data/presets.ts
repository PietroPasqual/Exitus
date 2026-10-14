import type { Preset } from '../core/types';
import { SPELLS } from './spells';

// Exemplos do caderno (desenhos originais) e estudos de regras
const BASE_PRESETS: Record<string, Preset> = {
  // Bola de Fogo: Prisma ➔ Fogo ➔ Esfera ➔ Direção ➔ Prisma
  ex1: {
    info: { name: 'Bola de Fogo', kind: 'caderno', desc: 'Do seu caderno. O Prisma manda energia para o Fogo, que vira uma Esfera e sai na Direção, voltando ao Prisma. Causa Queimação (1 + 0,1% da vida atual).' },
    ringStyle: 'single',
    strokeWidth: 7,
    showGrid: false,
    nodes: [
      { id: 'prism_center', shape: 'prism', x: 0, y: 10, size: 52, rot: 0, rune: null, activation: 'ativacao', charge: 1, lockedCenter: true },
      { id: 'n_top', shape: 'circle', x: 0, y: -155, size: 58, rot: 0, rune: 'forma_esfera', activation: 'ativacao', charge: 1 },
      { id: 'n_bl', shape: 'circle', x: -120, y: 125, size: 64, rot: 0, rune: 'dir_padrao', activation: 'ativacao', charge: 1 },
      { id: 'n_br', shape: 'circle', x: 115, y: 120, size: 58, rot: 0, rune: 'fogo', activation: 'ativacao', charge: 1 }
    ],
    connections: [
      { id: 'c1', from: 'prism_center', to: 'n_br', type: 'straight', mode: 'simultaneous' },
      { id: 'c2', from: 'n_br', to: 'n_top', type: 'arc-cw', mode: 'simultaneous' },
      { id: 'c3', from: 'n_top', to: 'n_bl', type: 'arc-cw', mode: 'simultaneous' },
      { id: 'c4', from: 'n_bl', to: 'prism_center', type: 'straight', mode: 'simultaneous' }
    ]
  },
  // Lança-Chamas: dois ciclos de Fogo pelas Direções + Estado retido no Col (□)
  ex2: {
    info: { name: 'Lança-Chamas', kind: 'caderno', desc: 'Do seu caderno. Fogo no Prisma e no Selo de cima (Perfeito), com duas Direções; o Col □ com Estado pega a energia e mantém o jato aceso. Causa Queimação e, no Perfeito, Incineração.' },
    ringStyle: 'single',
    strokeWidth: 7,
    showGrid: false,
    nodes: [
      { id: 'prism_center', shape: 'prism', x: 0, y: 0, size: 54, rot: 0, rune: 'fogo', activation: 'perfeito', charge: 1, lockedCenter: true },
      { id: 'n_top', shape: 'circle', x: 0, y: -165, size: 58, rot: 0, rune: 'fogo', activation: 'perfeito', charge: 1 },
      { id: 'n_left', shape: 'circle', x: -175, y: 0, size: 58, rot: 0, rune: 'dir_padrao', activation: 'ativacao', charge: 1 },
      { id: 'n_right', shape: 'circle', x: 175, y: 0, size: 58, rot: 0, rune: 'dir_padrao', activation: 'ativacao', charge: 1 },
      { id: 'n_bottom', shape: 'square', x: 0, y: 165, size: 58, rot: 0, rune: 'mod_estado', activation: 'perfeito', charge: 1 }
    ],
    connections: [
      { id: 'c1', from: 'n_top', to: 'prism_center', type: 'straight', mode: 'simultaneous' },
      { id: 'c2', from: 'n_left', to: 'prism_center', type: 'straight', mode: 'simultaneous' },
      { id: 'c3', from: 'prism_center', to: 'n_right', type: 'straight', mode: 'simultaneous' },
      { id: 'c4', from: 'prism_center', to: 'n_bottom', type: 'straight', mode: 'simultaneous' },
      { id: 'c5', from: 'n_top', to: 'n_left', type: 'straight', mode: 'simultaneous' },
      { id: 'c6', from: 'n_right', to: 'n_top', type: 'straight', mode: 'simultaneous' },
      { id: 'c7', from: 'n_left', to: 'n_bottom', type: 'straight', mode: 'simultaneous' }
    ]
  },
  ex3: {
    info: { name: 'Tornado Perfeito', kind: 'estudo', desc: 'Estudo de regras: Vento no Prisma e numa Estrela com carga 3x no Extremo; o Triângulo estabiliza. Mostra um círculo perto do limite de carga.' },
    ringStyle: 'runic',
    strokeWidth: 6,
    showGrid: true,
    nodes: [
      { id: 'prism_center', shape: 'prism', x: 0, y: 0, size: 54, rot: 0, rune: 'vento', activation: 'perfeito', charge: 1, lockedCenter: true },
      { id: 'n_star', shape: 'star', x: 0, y: -170, size: 62, rot: 0, rune: 'vento', activation: 'instavel', charge: 3 },
      { id: 'n_tri', shape: 'triangle', x: -165, y: -40, size: 56, rot: 0, rune: 'vento', activation: 'ativacao', charge: 1 },
      { id: 'n_hex', shape: 'hexagon', x: 165, y: -40, size: 56, rot: 0, rune: 'mod_area', activation: 'perfeito', charge: 2 },
      { id: 'n_bl', shape: 'circle', x: -110, y: 150, size: 54, rot: 0, rune: 'forma_piramide', activation: 'perfeito', charge: 1 },
      { id: 'n_br', shape: 'square', x: 110, y: 150, size: 54, rot: 0, rune: 'mod_estado', activation: 'perfeito', charge: 1 }
    ],
    connections: [
      { id: 'c1', from: 'n_star', to: 'prism_center', type: 'straight', mode: 'simultaneous' },
      { id: 'c2', from: 'prism_center', to: 'n_tri', type: 'straight', mode: 'simultaneous' },
      { id: 'c3', from: 'prism_center', to: 'n_hex', type: 'straight', mode: 'simultaneous' },
      { id: 'c4', from: 'n_tri', to: 'n_star', type: 'straight', mode: 'simultaneous' },
      { id: 'c5', from: 'n_hex', to: 'n_star', type: 'straight', mode: 'simultaneous' },
      { id: 'c6', from: 'n_tri', to: 'n_bl', type: 'arc-ccw', mode: 'sequential' },
      { id: 'c7', from: 'n_hex', to: 'n_br', type: 'arc-cw', mode: 'sequential' },
      { id: 'c8', from: 'n_bl', to: 'n_br', type: 'straight', mode: 'simultaneous' },
      { id: 'c9', from: 'n_bl', to: 'prism_center', type: 'straight', mode: 'simultaneous' }
    ]
  },
  ex4: {
    info: { name: 'Prisão de Terra', kind: 'estudo', desc: 'Estudo de regras: Terra no Prisma (Perfeito) e num Salor (Extremo), com Cubo, Ligação e Estado. Fica perto do limite de carga.' },
    ringStyle: 'double',
    strokeWidth: 6,
    showGrid: true,
    nodes: [
      { id: 'prism_center', shape: 'prism', x: 0, y: 0, size: 54, rot: 0, rune: 'terra', activation: 'perfeito', charge: 1, lockedCenter: true },
      { id: 'n1', shape: 'square', x: 0, y: -170, size: 58, rot: 0, rune: 'mod_estado', activation: 'perfeito', charge: 2 },
      { id: 'n2', shape: 'salor', x: 165, y: 0, size: 58, rot: 0, rune: 'terra', activation: 'instavel', charge: 1 },
      { id: 'n3', shape: 'circle', x: 0, y: 170, size: 58, rot: 0, rune: 'forma_cubo', activation: 'perfeito', charge: 1 },
      { id: 'n4', shape: 'hexagon', x: -165, y: 0, size: 58, rot: 0, rune: 'mod_ligacao', activation: 'perfeito', charge: 2 }
    ],
    connections: [
      { id: 'c1', from: 'prism_center', to: 'n1', type: 'straight', mode: 'simultaneous' },
      { id: 'c2', from: 'prism_center', to: 'n2', type: 'straight', mode: 'simultaneous' },
      { id: 'c3', from: 'n3', to: 'prism_center', type: 'straight', mode: 'simultaneous' },
      { id: 'c4', from: 'n4', to: 'prism_center', type: 'straight', mode: 'simultaneous' },
      { id: 'c5', from: 'n2', to: 'n1', type: 'arc-cw', mode: 'simultaneous' },
      { id: 'c6', from: 'n2', to: 'n3', type: 'arc-cw', mode: 'simultaneous' },
      { id: 'c7', from: 'n3', to: 'n4', type: 'arc-cw', mode: 'simultaneous' },
      { id: 'c8', from: 'n4', to: 'n1', type: 'arc-cw', mode: 'simultaneous' }
    ]
  },
  ex5: {
    info: { name: 'Tríade de Intenção', kind: 'estudo', desc: 'Estudo da Tríade: a Intenção no Prisma governa Projétil, Ser e Toque. Órbita, Área e Ligação ficam soltas de propósito, só para mostrar as relações.' },
    ringStyle: 'double',
    strokeWidth: 6,
    showGrid: true,
    nodes: [
      { id: 'prism_center', shape: 'prism', x: 0, y: 15, size: 50, rot: 0, rune: 'mod_intencao', activation: 'perfeito', charge: 1, lockedCenter: true },
      { id: 'n_proj', shape: 'circle', x: 0, y: -175, size: 54, rot: 0, rune: 'mod_projetil', activation: 'perfeito', charge: 1 },
      { id: 'n_ser', shape: 'circle', x: -165, y: 110, size: 54, rot: 0, rune: 'mod_ser', activation: 'perfeito', charge: 1 },
      { id: 'n_toque', shape: 'circle', x: 165, y: 110, size: 54, rot: 0, rune: 'mod_toque', activation: 'perfeito', charge: 1 },
      { id: 'n_orbita', shape: 'triangle', x: -95, y: -45, size: 46, rot: 0, rune: 'mod_orbita', activation: 'ativacao', charge: 1 },
      { id: 'n_area', shape: 'triangle', x: 95, y: -45, size: 46, rot: 0, rune: 'mod_area', activation: 'ativacao', charge: 1 },
      { id: 'n_ligacao', shape: 'square', x: 0, y: 145, size: 46, rot: 0, rune: 'mod_ligacao', activation: 'ativacao', charge: 1 }
    ],
    connections: [
      { id: 'c1', from: 'n_proj', to: 'n_ser', type: 'straight', mode: 'simultaneous' },
      { id: 'c2', from: 'n_proj', to: 'n_toque', type: 'straight', mode: 'simultaneous' },
      { id: 'c3', from: 'n_ser', to: 'n_toque', type: 'straight', mode: 'simultaneous' },
      { id: 'c4', from: 'prism_center', to: 'n_proj', type: 'straight', mode: 'simultaneous' },
      { id: 'c5', from: 'n_ser', to: 'prism_center', type: 'straight', mode: 'simultaneous' },
      { id: 'c6', from: 'n_toque', to: 'prism_center', type: 'straight', mode: 'simultaneous' }
    ]
  },
  ex6: {
    info: { name: 'Formas Compostas', kind: 'estudo', desc: 'Estudo das formas compostas: Corp ◇+□ no centro com Raio, um Salor ○+△ com Som e dois Redor ⬠+☆ com Gelo e Metal.' },
    ringStyle: 'runic',
    strokeWidth: 6,
    showGrid: true,
    nodes: [
      { id: 'prism_center', shape: 'corp', x: 0, y: 0, size: 56, rot: 0, rune: 'raio', activation: 'ativacao', charge: 1, lockedCenter: true },
      { id: 'n_top', shape: 'salor', x: 0, y: -170, size: 60, rot: 0, rune: 'som', activation: 'ativacao', charge: 3 },
      { id: 'n_bl', shape: 'redor', x: -155, y: 100, size: 60, rot: 0, rune: 'gelo', activation: 'ativacao', charge: 2 },
      { id: 'n_br', shape: 'redor', x: 155, y: 100, size: 60, rot: 0, rune: 'metal', activation: 'ativacao', charge: 2 }
    ],
    connections: [
      { id: 'c1', from: 'n_top', to: 'prism_center', type: 'straight', mode: 'simultaneous' },
      { id: 'c2', from: 'prism_center', to: 'n_bl', type: 'straight', mode: 'simultaneous' },
      { id: 'c3', from: 'prism_center', to: 'n_br', type: 'straight', mode: 'simultaneous' },
      { id: 'c4', from: 'n_bl', to: 'n_top', type: 'arc-cw', mode: 'simultaneous' },
      { id: 'c5', from: 'n_br', to: 'n_top', type: 'arc-cw', mode: 'simultaneous' },
      { id: 'c6', from: 'n_bl', to: 'n_br', type: 'arc-cw', mode: 'sequential' }
    ]
  }
};

// Fogo (Círculo 1) e Vento (Círculo 2) unidos pela Estrela na sobreposição
BASE_PRESETS.ex8 = {
  info: { name: 'Círculos Unidos pela Estrela', kind: 'estudo', desc: 'Estudo de círculos sobrepostos: Fogo e Vento, cada um com seu Prisma, unidos pela Estrela ☆ na sobreposição.' },
  ringStyle: 'single',
  strokeWidth: 7,
  showGrid: false,
  circles: [{ id: 'c1', x: 0, y: 0 }, { id: 'c2', x: 430, y: 0 }],
  nodes: [
    { id: 'prism_center', shape: 'prism', x: 0, y: 0, size: 50, rot: 0, rune: 'fogo', activation: 'ativacao', charge: 1, lockedCenter: true, circleId: 'c1' },
    { id: 'prism_c2', shape: 'prism', x: 430, y: 0, size: 50, rot: 0, rune: 'vento', activation: 'ativacao', charge: 1, lockedCenter: true, circleId: 'c2' },
    { id: 'n_star', shape: 'star', x: 215, y: 0, size: 58, rot: 0, rune: null, activation: 'ativacao', charge: 1, double: true },
    { id: 'n_a', shape: 'circle', x: -120, y: -150, size: 54, rot: 0, rune: 'dir_padrao', activation: 'ativacao', charge: 1 },
    { id: 'n_b', shape: 'circle', x: 550, y: -150, size: 54, rot: 0, rune: 'forma_esfera', activation: 'ativacao', charge: 1 }
  ],
  connections: [
    { id: 'c1', from: 'prism_center', to: 'n_star', type: 'straight', mode: 'simultaneous' },
    { id: 'c2', from: 'n_star', to: 'prism_c2', type: 'straight', mode: 'simultaneous' },
    { id: 'c3', from: 'prism_c2', to: 'n_b', type: 'straight', mode: 'simultaneous' },
    { id: 'c4', from: 'n_b', to: 'n_star', type: 'straight', mode: 'simultaneous' },
    { id: 'c5', from: 'n_star', to: 'n_a', type: 'straight', mode: 'simultaneous' },
    { id: 'c6', from: 'n_a', to: 'prism_center', type: 'straight', mode: 'simultaneous' }
  ]
};

BASE_PRESETS.ex7 = {
  info: { name: 'Projétil de Fogo em Esfera', kind: 'caderno', desc: 'Do seu caderno. Direção ➔ Prisma (Fogo) ➔ Esfera, e o arco leva a energia de volta à Direção: uma pequena esfera de fogo lançada.' },
  ringStyle: 'single',
  strokeWidth: 7,
  showGrid: false,
  nodes: [
    { id: 'prism_center', shape: 'prism', x: 0, y: 0, size: 50, rot: 0, rune: 'fogo', activation: 'ativacao', charge: 1, lockedCenter: true },
    { id: 'n_left', shape: 'circle', x: -175, y: 0, size: 54, rot: 0, rune: 'dir_padrao', activation: 'ativacao', charge: 1 },
    { id: 'n_right', shape: 'circle', x: 175, y: 0, size: 54, rot: 0, rune: 'forma_esfera', activation: 'ativacao', charge: 1 }
  ],
  connections: [
    { id: 'c1', from: 'n_left', to: 'prism_center', type: 'straight', mode: 'simultaneous' },
    { id: 'c2', from: 'prism_center', to: 'n_right', type: 'straight', mode: 'simultaneous' },
    { id: 'c3', from: 'n_right', to: 'n_left', type: 'arc-cw', mode: 'simultaneous' }
  ]
};

/** Todos os exemplos na ordem do menu: caderno, estudos e o Livro de Magias */
export const PRESETS: Record<string, Preset> = { ...BASE_PRESETS, ...SPELLS };

export const PRESET_GROUPS: [Preset['info']['kind'], string][] = [
  ['caderno', 'Do caderno'],
  ['magia', 'Livro de Magias'],
  ['estudo', 'Estudos de regras']
];
