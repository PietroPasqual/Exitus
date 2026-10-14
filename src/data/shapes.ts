import type { ShapeId, ShapeMeta } from '../core/types';

// Formas estruturais: função no circuito, valor base e faixa operacional
export const SHAPE_META: Record<ShapeId, ShapeMeta> = {
  prism: {
    name: 'Core ◇ (Prisma / Fonte)',
    short: 'Core (0,6)',
    factor: 0.6, range: '0,3 ~ 1,1',
    role: 'Core (◇ = 0,6 ou 0,3~1,1) — Fonte: núcleo essencial no centro. Pode ter uma runa elemental matriz ou ficar neutro, irradiando mana aos nós.'
  },
  square: {
    name: 'Col □ (Quadrado / Manter)',
    short: 'Col (0,6)',
    factor: 0.6, range: '0,4 ~ 1,3',
    role: 'Col (□ = 0,6 ou 0,4~1,3) — Manter (só pega): recebe a energia e sustenta o efeito ou a condição ativa continuamente. Nunca solta: não tem cabo de saída. Não segura excesso: pode estourar.'
  },
  circle: {
    name: 'Selo ○ (Círculo / Liberar)',
    short: 'Selo (1,3)',
    factor: 1.3, range: '0,5 ~ 9,9',
    role: 'Selo (○ = 1,3 ou 0,5~9,9) — Liberar (pega e solta): recebe o fluxo de energia e realiza a saída / liberação da runa. Não segura excesso: pode estourar.'
  },
  triangle: {
    name: 'Sal △ (Triângulo / Equilíbrio)',
    short: 'Sal (3,1)',
    factor: 3.1, range: '1,1 ~ 9,5',
    role: 'Sal (△ = 3,1 ou 1,1~9,5) — Equilíbrio (regulariza a energia): estabiliza o circuito e neutraliza o risco de colapso quando há runas no Extremo (Instável). Segura o excesso que faria Selos e Cols estourarem.'
  },
  hexagon: {
    name: 'Rad ⬠ (Pentágono / Capacitor)',
    short: 'Rad (5,0)',
    factor: 5.0, range: '3,3 ~ 9,9',
    role: 'Rad (⬠ = 5,0 ou 3,3~9,9) — Comparador e Capacitor: compara condições (lógica) e armazena mana.'
  },
  star: {
    name: 'Red ☆ (Estrela / Sobrepositor)',
    short: 'Red (10,0)',
    factor: 10.0, range: '5,5 ~ 15,1',
    role: 'Red (☆ = 10,0 ou 5,5~15,1) — Sobrepositor e Carregador: sobrepõe efeitos simultâneos (ex.: Brisa + Ventania + Tempestade = Tornado), multiplica cargas de Poder e une círculos sobrepostos.'
  },
  corp: {
    name: 'Corp ◇+□ (Restrição)',
    short: 'Corp (2,4)',
    factor: 2.4, range: '0,6 ~ 5,2',
    role: 'Corp (◇+□ = 2,4 ou 0,6~5,2): Forma composta de Restrição (Entrada/Bloqueio + Saída/Liberação).'
  },
  salor: {
    name: 'Salor ○+△ (Sobrecarga)',
    short: 'Salor (15,5)',
    factor: 15.5, range: '5,2 ~ 32,3',
    role: 'Salor (○+△ = 15,5 ou 5,2~32,3): Forma composta de Sobrecarga (Estabilizador/Medidor + Fortificador/Triplicador).'
  },
  redor: {
    name: 'Redor ⬠+☆ (Absorvedor)',
    short: 'Redor (33,3)',
    factor: 33.3, range: '22,2 ~ 44,4',
    role: 'Redor (⬠+☆ = 33,3 ou 22,2~44,4): Forma composta Absorvedora (Comparador/Capacitor + Sobrepositor/Carregador).'
  }
};

/** Faixa operacional (mínimo ~ máximo) de uma forma */
export function getShapeRange(shape: ShapeId): { min: number; max: number } {
  const [min, max] = SHAPE_META[shape].range.split('~').map(v => parseFloat(v.trim().replace(',', '.')));
  return { min, max };
}

/** Nome curto: "Selo ○", "Red ☆"… */
export const shapeName = (shape: ShapeId): string => SHAPE_META[shape].name.split(' (')[0];
