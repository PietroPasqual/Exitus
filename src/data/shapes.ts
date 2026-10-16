import type { Activation, ShapeId, ShapeMeta } from '../core/types';

// Selos estruturais: ainda não têm nomes próprios (como as runas de estruturação),
// então são chamados pelo formato. Cada selo gasta energia conforme o estado
// (Mínimo / Perfeito / Instável), como as runas.
const c = (ativacao: number, perfeito: number, instavel: number): Record<Activation, number> => ({ ativacao, perfeito, instavel });

export const SHAPE_META: Record<ShapeId, ShapeMeta> = {
  prism: {
    name: 'Matriz ◇ (Fornecedor / Finalizador)',
    short: 'Matriz',
    cost: c(0.4, 4, 40),
    role: 'Fornecedor / Finalizador: por ela o mago insere energia no círculo mágico. Quando a energia volta para a Matriz, a magia (ou a etapa) é concluída. Pode ter uma runa elemental matriz ou ficar neutra.'
  },
  square: {
    name: 'Quadrado □ (Reativador / Supressor)',
    short: 'Quadrado',
    cost: c(0.3, 3, 30), provisional: true,
    role: 'Reativador / Supressor: a energia entra, mas não sai (não tem fio de saída). Sempre que uma nova fonte de energia entra, a runa escrita nele é reativada.'
  },
  circle: {
    name: 'Círculo ○ (Estabilizador / Escritor)',
    short: 'Círculo',
    cost: c(0.2, 2, 20),
    role: 'Estabilizador / Escritor: mantém a runa estável, usando o mínimo de energia para ativação (ela não sobe nem cai de estado por sorte ou azar). Dois Círculos sobrepostos deixam escrever letras rúnicas entre os seus espaços.'
  },
  triangle: {
    name: 'Triângulo △ (PoderX / EfeitoX)',
    short: 'Triângulo',
    cost: c(0.5, 5, 50), provisional: true,
    role: 'PoderX / EfeitoX: com a base para baixo, a runa tem o Poder triplicado e o custo quintuplicado; com a base para cima, o efeito dobra e o custo quadruplica.'
  },
  hexagon: {
    name: 'Pentágono ⬠ (Comparador / Capacitor)',
    short: 'Pentágono',
    cost: c(0.8, 8, 80), provisional: true,
    role: 'Comparador / Capacitor: só passa energia ao próximo selo quando todas as entradas ligadas a ele estão ativas; com mais de uma entrada, divide a energia dentro dele pelo número de entradas.'
  },
  star: {
    name: 'Estrela ☆ (Sobreposição / Carregador)',
    short: 'Estrela',
    cost: c(1, 10, 100), provisional: true,
    role: 'Sobreposição / Carregador: duas Estrelas alinhadas são a ponte que deixa círculos diferentes interagirem por sobreposição. Sozinha, guarda energia e a devolve à fonte 1,2 vez maior; se for suficiente, reativa a magia. Depois de devolver, apaga e vira parte dos fios.'
  },
  corp: {
    name: 'Matriz+Quadrado ◇+□ (Restrição)',
    short: 'Matriz+Quadrado',
    cost: c(0.7, 7, 70), provisional: true,
    role: 'Composto de Matriz e Quadrado (Restrição): fornece a energia e a segura (entrada e bloqueio).'
  },
  salor: {
    name: 'Círculo+Triângulo ○+△ (Sobrecarga)',
    short: 'Círculo+Triângulo',
    cost: c(0.7, 7, 70), provisional: true,
    role: 'Composto de Círculo e Triângulo (Sobrecarga): estabiliza a runa e multiplica o Poder (ou o efeito) como o Triângulo.'
  },
  redor: {
    name: 'Pentágono+Estrela ⬠+☆ (Absorvedor)',
    short: 'Pentágono+Estrela',
    cost: c(1.8, 18, 180), provisional: true,
    role: 'Composto de Pentágono e Estrela (Absorvedor): compara as entradas e guarda a energia como a Estrela.'
  }
};

/** Nome curto com o símbolo: "Círculo ○", "Estrela ☆"… */
export const shapeName = (shape: ShapeId): string => SHAPE_META[shape].name.split(' (')[0];

/** Selos que mantêm a runa estável (Círculo e o composto que o tem) */
export const STABLE_SHAPES: ShapeId[] = ['circle', 'salor'];
/** Selos que multiplicam a runa como o Triângulo */
export const TRIANGLE_SHAPES: ShapeId[] = ['triangle', 'salor'];

/** Triângulo com a base para cima (girado entre 90° e 270°) */
export function baseUp(rot: number | undefined): boolean {
  const r = (((rot ?? 0) % 360) + 360) % 360;
  return r > 90 && r < 270;
}
