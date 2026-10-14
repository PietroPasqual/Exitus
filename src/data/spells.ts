import { analyzeCircles } from '../core/circles';
import type { Activation, Circle, Connection, ConnectionType, MagicNode, Preset, RingStyle, ShapeId } from '../core/types';

// Livro de Magias: magias de exemplo montadas com as regras do sistema
// (Prisma com ciclo fechado, ○ na saída do cabo, carga abaixo de 70%).
/** Prisma de um círculo */
const P = (rune: string | null, activation: Activation, circleId = 'c1', x = 0, y = 0, id = 'prism_center'): MagicNode =>
  ({ id, shape: 'prism', x, y, size: 52, rot: 0, rune, activation, charge: 1, lockedCenter: true, circleId });

/** Nó comum */
const N = (id: string, shape: ShapeId, x: number, y: number, rune: string | null, size = 54, charge = 1): MagicNode =>
  ({ id, shape, x, y, size, rot: 0, rune, activation: 'ativacao', charge });

/** Cabo: de (○) → para */
const L = (from: string, to: string, type: ConnectionType = 'straight'): Omit<Connection, 'id'> =>
  ({ from, to, type, mode: 'simultaneous' });

const spell = (
  info: { name: string; desc: string },
  ringStyle: RingStyle,
  nodes: MagicNode[],
  links: Omit<Connection, 'id'>[],
  circles: Circle[] = [{ id: 'c1', x: 0, y: 0 }],
  envelope = false
): Preset => {
  const connections = links.map((l, i) => ({ id: 'l' + (i + 1), ...l }));
  // Estrela na sobreposição: sempre dupla (uma para cada círculo)
  analyzeCircles({ nodes, connections, circles }).pairs.forEach(pr => { if (pr.star) pr.star.double = true; });
  return { ringStyle, strokeWidth: 7, showGrid: false, info: { kind: 'magia', ...info }, circles, nodes, connections, ...(envelope ? { envelope: true } : {}) };
};


/**
 * A lança de fogo plasmática, como no caderno (versão refinada): um círculo com dois
 * círculos dentro, cada um com o seu Prisma, e o Prisma da lança embaixo, como fonte.
 * Prisma da lança ➔ círculo do Fogo/Raio ➔ círculo da lança ➔ Prisma da lança.
 */
function lanceParts(): { nodes: MagicNode[]; links: Omit<Connection, 'id'>[]; circles: Circle[] } {
  const L1 = { x: -165, y: -25 }, L2 = { x: 135, y: -40 };
  const at = (c: { x: number; y: number }, dx: number, dy: number): [number, number] => [c.x + dx, c.y + dy];
  const node = (id: string, shape: ShapeId, [x, y]: [number, number], rune: string | null, size: number): MagicNode =>
    ({ id, shape, x, y, size, rot: 0, rune, activation: 'ativacao', charge: 1 });
  return {
    circles: [
      { id: 'c1', x: 0, y: 0, r: 330, name: 'Lança de fogo plasmática' },
      { id: 'c_fogo', x: L1.x, y: L1.y, r: 120, name: 'Fogo e Raio com Estado' },
      { id: 'c_lanca', x: L2.x, y: L2.y, r: 170, name: 'A lança: formatos unidos pelo Projétil' }
    ],
    nodes: [
      // Prisma da lança, embaixo (a fonte do círculo de fora)
      { id: 'prism_center', shape: 'prism', x: 0, y: 235, size: 34, rot: 0, rune: null, activation: 'ativacao', charge: 1, lockedCenter: true, circleId: 'c1' },
      // Círculo do Fogo e do Raio: Prisma com Estado à esquerda, ida e volta para cada runa
      { id: 'prism_fogo', shape: 'prism', x: L1.x - 70, y: L1.y, size: 26, rot: 0, rune: 'mod_estado', activation: 'ativacao', charge: 1, lockedCenter: true, circleId: 'c_fogo' },
      node('f_raio', 'circle', at(L1, 35, -55), 'raio', 30),
      node('f_fogo', 'circle', at(L1, 35, 55), 'fogo', 30),
      // Círculo da lança: Prisma no meio; Estado, Estado e Ligação de um lado; Cubo, Projétil, Cubo e Pirâmide do outro
      { id: 'prism_lanca', shape: 'prism', x: L2.x, y: L2.y, size: 22, rot: 0, rune: null, activation: 'ativacao', charge: 1, lockedCenter: true, circleId: 'c_lanca' },
      node('l_est1', 'circle', at(L2, -48, -50), 'mod_estado', 23),
      node('l_est2', 'circle', at(L2, -100, 0), 'mod_estado', 23),
      node('l_lig', 'circle', at(L2, -48, 50), 'mod_ligacao', 23),
      node('l_cubo1', 'circle', at(L2, 50, -50), 'forma_cubo', 23),
      node('l_proj', 'circle', at(L2, 52, 0), 'mod_projetil', 23),
      node('l_cubo2', 'circle', at(L2, 50, 50), 'forma_cubo', 23),
      node('l_pir', 'circle', at(L2, 103, 0), 'forma_piramide', 23)
    ],
    links: [
      // Ida e volta (linhas duplas)
      L('prism_fogo', 'f_raio'), L('f_raio', 'prism_fogo'),
      L('prism_fogo', 'f_fogo'), L('f_fogo', 'prism_fogo'),
      // Lado do Estado e da Ligação
      L('prism_lanca', 'l_est2'), L('l_est2', 'l_est1'), L('l_est1', 'prism_lanca'),
      L('l_est2', 'l_lig'), L('l_lig', 'prism_lanca'),
      // Lado dos formatos: o Projétil une tudo e devolve ao Prisma
      L('prism_lanca', 'l_cubo1'), L('l_cubo1', 'l_pir'), L('l_pir', 'l_cubo2'), L('l_cubo2', 'l_proj'), L('l_proj', 'prism_lanca'),
      // Entre os círculos: Prisma da lança ➔ Fogo/Raio ➔ lança (pelo Estado) ➔ Prisma da lança (pela Ligação)
      L('prism_center', 'prism_fogo'), L('prism_fogo', 'l_est2'), L('l_lig', 'prism_center')
    ]
  };
}

const LANCE = lanceParts();

export const SPELLS: Record<string, Preset> = {
  m_muralha: spell(
    { name: 'Muralha de Terra', desc: 'Escudo vertical: a Terra (Perfeito) sobe pelo Paralelepípedo num Salor ○+△, passa pelo Sal △ (Equilíbrio) e volta ao Prisma pela D.N. Vertical, que impede que a muralha seja empurrada para cima ou para baixo. O Col □ com Estado sustenta a muralha de pé. Quem é atingido sofre Lentidão e, no Perfeito, Petrificação.' },
    'double',
    [P('terra', 'perfeito', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'salor', 0, -185, 'forma_paralelepipedo', 62),
     N('n_sal', 'triangle', 185, 0, null, 54),
     N('n_dir', 'circle', 0, 185, 'dir_vertical', 54),
     N('n_estado', 'square', -185, 0, 'mod_estado', 54)],
    [L('prism_center', 'n_forma'),
     L('n_forma', 'n_sal', 'arc-cw'),
     L('n_sal', 'n_dir', 'arc-cw'),
     L('n_dir', 'prism_center'),
     L('prism_center', 'n_estado')]),

  m_lamina: spell(
    { name: 'Lâmina de Vento', desc: 'Varredura em arco: o Vento (Perfeito = Ventania) é moldado em Pirâmide, como uma lâmina, varre por cima pela Direção e sai como Projétil. Causa Corte Mágico (+1d12 de dano mágico) e as correntes cortantes da Ventania.' },
    'single',
    [P('vento', 'perfeito', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'circle', -190, 0, 'forma_piramide', 54),
     N('n_dir', 'circle', 0, -190, 'dir_padrao', 54),
     N('n_proj', 'circle', 190, 0, 'mod_projetil', 54)],
    [L('prism_center', 'n_forma'),
     L('n_forma', 'n_dir', 'arc-cw'),
     L('n_dir', 'n_proj', 'arc-cw'),
     L('n_proj', 'prism_center')]),

  m_descarga: spell(
    { name: 'Descarga em Área', desc: 'Triângulo invertido, como um raio descendo: o Raio é pesado (24 de energia já no Mínimo), então o Projétil fica num Salor ○+△; a energia passa pela Área e desce para o Sal △, que regulariza a volta. Todos na área sofrem Paralisia (−1d8 nos movimentos).' },
    'runic',
    [P('raio', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_proj', 'salor', -160, -120, 'mod_projetil', 60),
     N('n_area', 'circle', 160, -120, 'mod_area', 54),
     N('n_dir', 'triangle', 0, 190, 'dir_padrao', 54)],
    [L('prism_center', 'n_proj'),
     L('n_proj', 'n_area', 'arc-cw'),
     L('n_area', 'n_dir', 'arc-cw'),
     L('n_dir', 'prism_center')]),

  m_cubo_gelo: spell(
    { name: 'Cubo de Gelo', desc: 'Cruz com dois ciclos: o Gelo sobe para o Cubo e se divide entre o Ser e o Sal △ (Equilíbrio), que voltam ao Prisma; os dois alimentam o Col □ com Estado, que sustenta o congelamento. O Ser fica preso num cubo de gelo: Congelamento (−1d4 no movimento e nos processos energéticos).' },
    'double',
    [P('gelo', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'circle', 0, -185, 'forma_cubo', 54),
     N('n_ser', 'circle', 185, 0, 'mod_ser', 54),
     N('n_sal', 'triangle', -185, 0, null, 54),
     N('n_estado', 'square', 0, 185, 'mod_estado', 54)],
    [L('prism_center', 'n_forma'),
     L('n_forma', 'n_ser', 'arc-cw'),
     L('n_forma', 'n_sal', 'arc-cw'),
     L('n_ser', 'prism_center'),
     L('n_sal', 'prism_center'),
     L('n_ser', 'n_estado', 'arc-cw'),
     L('n_sal', 'n_estado', 'arc-cw')]),

  m_grito: spell(
    { name: 'Grito Atordoante', desc: 'Anel de ondas: o Som corre em arcos pela Área, pela Esfera (num Sal △ que regulariza) e pelos Seres, e a Direção aponta a onda para a frente antes de voltar ao Prisma. Causa Atordoamento (−2 no pensamento e −1d4 na comunicação).' },
    'runic',
    [P('som', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_area', 'circle', -135, -135, 'mod_area', 54),
     N('n_forma', 'triangle', 135, -135, 'forma_esfera', 54),
     N('n_ser', 'circle', 135, 135, 'mod_ser', 54),
     N('n_dir', 'circle', -135, 135, 'dir_padrao', 54)],
    [L('prism_center', 'n_area'),
     L('n_area', 'n_forma', 'arc-cw'),
     L('n_forma', 'n_ser', 'arc-cw'),
     L('n_ser', 'n_dir', 'arc-cw'),
     L('n_dir', 'prism_center')]),

  m_passo: spell(
    { name: 'Passo Veloz', desc: 'Ao tocar um Ser (ou a si mesmo), o Movimento aumenta a velocidade dele em 1 m/s, e a D.N. Lateral impede que empurrões para os lados o desviem. Ser + Toque formam Ligação, e o Col □ com Estado sustenta o bônus enquanto durar.' },
    'single',
    [P('movimento', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_ser', 'circle', -190, 0, 'mod_ser', 54),
     N('n_dir', 'circle', 0, -190, 'dir_lateral', 54),
     N('n_toque', 'circle', 190, 0, 'mod_toque', 54),
     N('n_estado', 'square', 0, 190, 'mod_estado', 54)],
    [L('prism_center', 'n_ser'),
     L('n_ser', 'n_dir', 'arc-cw'),
     L('n_dir', 'n_toque', 'arc-cw'),
     L('n_toque', 'prism_center'),
     L('n_toque', 'n_estado', 'arc-cw')]),

  m_falsa_acao: spell(
    { name: 'Falsa Ação', desc: 'A Ilusão custa caro (32 de energia já no Mínimo): a Intenção fica num Salor ○+△ embaixo, a energia sobe pelo Ser e pelo Toque e um Sal △ regulariza a volta. Tocando o alvo, congela ou esconde 1 ação dele no turno.' },
    'runic',
    [P('ilusao', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_int', 'salor', 0, 190, 'mod_intencao', 60),
     N('n_ser', 'circle', -165, -110, 'mod_ser', 54),
     N('n_toque', 'circle', 165, -110, 'mod_toque', 54),
     N('n_sal', 'triangle', 190, 75, null, 54)],
    [L('prism_center', 'n_int'),
     L('n_int', 'n_ser', 'arc-cw'),
     L('n_ser', 'n_toque', 'arc-cw'),
     L('n_toque', 'n_sal', 'arc-cw'),
     L('n_sal', 'prism_center')]),

  m_meteoro: spell(
    { name: 'Meteoro Flamejante', desc: 'Dois círculos na diagonal, unidos pela Estrela ☆. A Terra (círculo de baixo) forma a rocha em Esfera; a Estrela sobrepõe o Fogo (círculo de cima), que a incendeia, e o Projétil a lança na Direção. Impacto com Lentidão e Queimação; no Perfeito, Petrificação e Incineração.' },
    'single',
    [P('terra', 'perfeito', 'c1', 0, 0, 'prism_center'),
     P('fogo', 'perfeito', 'c2', 372, -215, 'prism_c2'),
     N('n_star', 'star', 186, -107, null, 58),
     N('n_forma', 'circle', -179, -70, 'forma_esfera', 54),
     N('n_proj', 'circle', 401, -405, 'mod_projetil', 54),
     N('n_dir', 'circle', 551, -145, 'dir_padrao', 54)],
    [L('prism_center', 'n_star'),
     L('n_star', 'prism_c2'),
     L('prism_c2', 'n_proj'),
     L('n_proj', 'n_star'),
     L('prism_c2', 'n_dir'),
     L('n_dir', 'n_star'),
     L('n_star', 'n_forma'),
     L('n_forma', 'prism_center')],
    [{ id: 'c1', x: 0, y: 0 }, { id: 'c2', x: 372, y: -215 }]),

  m_tempestade: spell(
    { name: 'Tempestade Elétrica', desc: 'Dois círculos na vertical, como nuvem e chão: o Raio (círculo de cima, com o Projétil num Salor) cai pela Estrela ☆ e o Vento (círculo de baixo) espalha a tempestade pela Área. A Estrela sobrepõe os dois: Corte Mágico (+1d12) e Paralisia (−1d8) em todos na área.' },
    'runic',
    [P('vento', 'perfeito', 'c1', 0, 0, 'prism_center'),
     P('raio', 'ativacao', 'c2', 0, -430, 'prism_c2'),
     N('n_star', 'star', 0, -215, null, 58),
     N('n_area', 'circle', -150, 120, 'mod_area', 54),
     N('n_proj', 'salor', -150, -550, 'mod_projetil', 58)],
    [L('prism_center', 'n_star'),
     L('n_star', 'prism_c2'),
     L('prism_c2', 'n_proj'),
     L('n_proj', 'n_star'),
     L('n_star', 'n_area'),
     L('n_area', 'prism_center')],
    [{ id: 'c1', x: 0, y: 0 }, { id: 'c2', x: 0, y: -430 }]),

  m_escudo_agua: spell(
    { name: 'Escudo d\'Água', desc: 'Uma Esfera de água orbita o Ser e o protege. O Sal △ com Órbita regulariza o giro e o Col □ com Estado sustenta o escudo. O que atinge o escudo sofre Inibição (a água interage contra o elemento base); no Perfeito, Extração.' },
    'double',
    [P('agua', 'perfeito', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'circle', 0, -185, 'forma_esfera', 54),
     N('n_orb', 'triangle', 185, 0, 'mod_orbita', 54),
     N('n_ser', 'circle', -185, 0, 'mod_ser', 54),
     N('n_estado', 'square', 0, 185, 'mod_estado', 54)],
    [L('prism_center', 'n_forma'),
     L('n_forma', 'n_orb', 'arc-cw'),
     L('n_forma', 'n_ser', 'arc-cw'),
     L('n_orb', 'prism_center'),
     L('n_ser', 'prism_center'),
     L('n_orb', 'n_estado', 'arc-cw'),
     L('n_ser', 'n_estado', 'arc-cw')]),

  m_orbita_chamas: spell(
    { name: 'Órbita de Chamas', desc: 'Anel orbital: esferas de Fogo (Perfeito) giram em Órbita em volta de um Ser, passando por um Sal △ que regulariza o giro antes de voltar ao Prisma. Quem se aproxima sofre Queimação; no Perfeito, Incineração.' },
    'single',
    [P('fogo', 'perfeito', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'circle', -135, -135, 'forma_esfera', 54),
     N('n_orb', 'circle', 135, -135, 'mod_orbita', 54),
     N('n_ser', 'circle', 135, 135, 'mod_ser', 54),
     N('n_sal', 'triangle', -135, 135, null, 54)],
    [L('prism_center', 'n_forma'),
     L('n_forma', 'n_orb', 'arc-cw'),
     L('n_orb', 'n_ser', 'arc-cw'),
     L('n_ser', 'n_sal', 'arc-cw'),
     L('n_sal', 'prism_center')]),

  m_lanca_gelo: spell(
    { name: 'Lança de Gelo', desc: 'O Prisma fica neutro e irradia mana para um Rad ⬠ (Capacitor) com Gelo em carga 2x: ele acumula duas cargas antes de soltar. O gelo vira Pirâmide, sai como Projétil e o Sal △ regulariza a volta pela Direção. Lança com o dobro de Poder e Congelamento (−1d4).' },
    'runic',
    [P(null, 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_rad', 'hexagon', -185, 0, 'gelo', 56, 2),
     N('n_forma', 'circle', 0, -185, 'forma_piramide', 54),
     N('n_proj', 'circle', 185, 0, 'mod_projetil', 54),
     N('n_dir', 'triangle', 0, 185, 'dir_padrao', 54)],
    [L('prism_center', 'n_rad'),
     L('n_rad', 'n_forma', 'arc-cw'),
     L('n_forma', 'n_proj', 'arc-cw'),
     L('n_proj', 'n_dir', 'arc-cw'),
     L('n_dir', 'prism_center')]),

  m_prensa: spell(
    { name: 'Prensa Barométrica', desc: 'A Pressão (20 de energia já no Mínimo) cai sobre a Área, que fica num Salor ○+△; a D.N. Vertical impede que a pressão seja empurrada para cima e o Sal △ regulariza a volta. Todos na área sofrem Diminuição (−2 em todos os mods).' },
    'double',
    [P('pressao', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_area', 'salor', -160, -120, 'mod_area', 60),
     N('n_dir', 'circle', 160, -120, 'dir_vertical', 54),
     N('n_sal', 'triangle', 0, 190, null, 54)],
    [L('prism_center', 'n_area'),
     L('n_area', 'n_dir', 'arc-cw'),
     L('n_dir', 'n_sal', 'arc-cw'),
     L('n_sal', 'prism_center')]),

  m_mistura: spell(
    { name: 'Mistura Caótica', desc: 'Um Projétil de Caos atinge um Ser e mistura 1 atributo dele ao caos. O Sal △ regulariza a energia instável do Caos na volta ao Prisma.' },
    'runic',
    [P('caos', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_proj', 'circle', 0, -185, 'mod_projetil', 54),
     N('n_ser', 'circle', 160, 95, 'mod_ser', 54),
     N('n_sal', 'triangle', -160, 95, null, 54)],
    [L('prism_center', 'n_proj'),
     L('n_proj', 'n_ser', 'arc-cw'),
     L('n_ser', 'n_sal', 'arc-cw'),
     L('n_sal', 'prism_center')]),

  m_supressao: spell(
    { name: 'Campo de Supressão', desc: 'Pentágono de cinco pontas: o Metal (33 de energia já no Mínimo) abre a Área num Redor ⬠+☆ (Absorvedor) e se divide em dois ciclos, um pelo Ser e pelo Sal △ e outro pela Intenção (só energia hostil). O Col □ com Estado sustenta o campo. Dentro dele, energias externas são dispersas (Supressão Energética: até 6/10 de poder 5).' },
    'runic',
    [P('metal', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_area', 'redor', 0, -185, 'mod_area', 62),
     N('n_ser', 'circle', 176, -57, 'mod_ser', 54),
     N('n_sal', 'triangle', 109, 150, null, 54),
     N('n_estado', 'square', -109, 150, 'mod_estado', 54),
     N('n_int', 'circle', -176, -57, 'mod_intencao', 54)],
    [L('prism_center', 'n_area'),
     L('n_area', 'n_ser', 'arc-cw'),
     L('n_ser', 'n_sal', 'arc-cw'),
     L('n_sal', 'prism_center'),
     L('n_sal', 'n_estado', 'arc-cw'),
     L('n_area', 'n_int', 'arc-cw'),
     L('n_int', 'prism_center')]),

  m_passo_ilusorio: spell(
    { name: 'Passo Ilusório', desc: 'Dois círculos unidos pela Estrela ☆: o Movimento (direita) leva o conjurador na Direção escolhida e a Ilusão (esquerda, com o Ser num Salor) deixa uma imagem falsa no lugar. O inimigo erra: a ação contra o conjurador é escondida (Falsa Ação) e ele ganha +1 m/s.' },
    'double',
    [P('ilusao', 'ativacao', 'c1', 0, 0, 'prism_center'),
     P('movimento', 'ativacao', 'c2', 430, 0, 'prism_c2'),
     N('n_star', 'star', 215, 0, null, 58),
     N('n_ser', 'salor', -140, -150, 'mod_ser', 58),
     N('n_sal', 'triangle', -140, 150, null, 54),
     N('n_lat', 'circle', 570, -140, 'dir_padrao', 54)],
    [L('prism_center', 'n_star'),
     L('n_star', 'prism_c2'),
     L('prism_c2', 'n_lat'),
     L('n_lat', 'n_star'),
     L('n_star', 'n_ser'),
     L('n_ser', 'n_sal', 'arc-cw'),
     L('n_sal', 'prism_center')],
    [{ id: 'c1', x: 0, y: 0 }, { id: 'c2', x: 430, y: 0 }]),

  m_erupcao: spell(
    { name: 'Erupção', desc: 'Três círculos unidos por uma só Estrela ☆ no meio, onde os três se sobrepõem: a Pressão (círculo de cima) comprime a Terra e o Fogo, e a D.N. Vertical impede que a coluna da erupção seja empurrada para cima ou para baixo. Cada círculo volta ao seu Prisma pela sua runa. A erupção estoura em Área: Lentidão, Queimação e Diminuição (−2 em todos os mods).' },
    'single',
    [P('terra', 'perfeito', 'c1', 0, 0, 'prism_center'),
     P('fogo', 'perfeito', 'c2', 430, 0, 'prism_c2'),
     P('pressao', 'ativacao', 'c3', 215, -372, 'prism_c3'),
     N('n_star', 'star', 215, -124, null, 60),
     N('n_terra', 'triangle', -170, -60, 'forma_esfera', 54),
     N('n_fogo', 'salor', 600, -60, 'mod_area', 58),
     N('n_pressao', 'salor', 60, -470, 'dir_vertical', 58)],
    [L('prism_center', 'n_star'),
     L('n_star', 'n_terra'),
     L('n_terra', 'prism_center'),
     L('prism_c2', 'n_star'),
     L('n_star', 'n_fogo'),
     L('n_fogo', 'prism_c2'),
     L('prism_c3', 'n_star'),
     L('n_star', 'n_pressao'),
     L('n_pressao', 'prism_c3')],
    [{ id: 'c1', x: 0, y: 0 }, { id: 'c2', x: 430, y: 0 }, { id: 'c3', x: 215, y: -372 }]),

  m_pele_pedra: spell(
    { name: 'Pele de Pedra', desc: 'A Direção Contrária faz a magia voltar para quem a lançou: a Terra envolve o próprio conjurador num Cubo de pedra e aplica Endurecimento nele (+0,2 de durabilidade). O Sal △ regulariza a energia e o Col □ com Estado sustenta a proteção.' },
    'double',
    [P('terra', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'circle', -190, 0, 'forma_cubo', 54),
     N('n_dir', 'circle', 0, -190, 'dir_contraria', 54),
     N('n_sal', 'triangle', 190, 0, null, 54),
     N('n_estado', 'square', 0, 190, 'mod_estado', 54)],
    [L('prism_center', 'n_forma'),
     L('n_forma', 'n_dir', 'arc-cw'),
     L('n_dir', 'n_sal', 'arc-cw'),
     L('n_sal', 'prism_center'),
     L('n_sal', 'n_estado', 'arc-cw')]),

  m_projetil_fogo: spell(
    { name: 'Projétil de Fogo', desc: 'Do seu desenho: o Prisma neutro manda a energia ao Fogo, que passa pelos formatos (Cubo e Pirâmide unidos), e logo depois o Projétil junta tudo num só objeto aerodinâmico; a Direção aponta para onde ele vai e devolve a energia ao Prisma. Causa Queimação.' },
    'single',
    [P(null, 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_fogo', 'circle', 0, 190, 'fogo', 52),
     { ...N('n_forma', 'circle', -200, 0, 'forma_cubo', 52), inner: ['forma_piramide'] },
     N('n_proj', 'circle', 0, -190, 'mod_projetil', 52),
     N('n_dir', 'circle', 200, 0, 'dir_padrao', 52)],
    [L('prism_center', 'n_fogo'),
     L('n_fogo', 'n_forma'),
     L('n_forma', 'n_proj'),
     L('n_proj', 'n_dir'),
     L('n_dir', 'prism_center')]),

  m_lanca_so: spell(
    { name: 'Lança de Fogo Plasmática (só a lança)', desc: 'Do seu caderno, versão refinada (2º círculo: círculos dentro de um círculo). O Prisma da lança, embaixo, é a fonte: manda a energia ao círculo do Fogo e do Raio, onde o Prisma com Estado vai e volta a cada runa (linhas duplas) e mantém o fogo aceso; daí ela passa ao círculo da lança, onde o Prisma do meio liga Estado, Estado e Ligação de um lado e Cubo, Pirâmide e Cubo do outro, e o Projétil une os formatos num só objeto aerodinâmico; e volta ao Prisma da lança.' },
    'single', LANCE.nodes, LANCE.links, LANCE.circles),

  m_lanca_plasmatica: spell(
    { name: 'Lança de Fogo Plasmática', desc: 'Do seu caderno (3º e 2º círculo). A lança é um círculo com dois círculos dentro, cada um com o seu Prisma: o Prisma da lança (embaixo) manda a energia ao círculo do Fogo e do Raio (o Prisma com Estado vai e volta a cada runa), que passa ao círculo da lança — Estado, Ligação, Cubos e Pirâmide unidos pelo Projétil num só objeto — e volta ao Prisma da lança. Três círculos separados ficam ligados a ela por cabo, dentro de um círculo em volta de tudo: o Movimento sônico (não inerente, num quadrado), as 4 bolas de fogo que orbitam a lança (pela Órbita) e o gatilho que, quando a lança é destruída, aplica gravidade aos restos, que se fundem com tudo o que tocam.' },
    'single',
    [
      ...LANCE.nodes,
      // Movimento sônico (círculo 2, dentro de um quadrado)
      P('mod_estado', 'ativacao', 'c2', 760, -40, 'prism_c2'),
      N('s_l', 'circle', 590, -40, 'som', 50),
      N('s_t', 'circle', 760, -210, 'vento', 50),
      N('s_r', 'circle', 930, -40, 'som', 50),
      N('s_b', 'circle', 760, 130, 'vento', 50),
      N('s_n1', 'circle', 640, -160, 'natureza', 42),
      N('s_n2', 'circle', 880, 80, 'natureza', 42),
      // 4 bolas de fogo que orbitam a lança (círculo 3)
      P('fogo', 'ativacao', 'c3', -360, 700, 'prism_c3'),
      N('f_orb', 'circle', -360, 530, 'mod_orbita', 50),
      N('f_a', 'circle', -530, 700, 'fogo', 50),
      N('f_b', 'circle', -190, 700, 'fogo', 50),
      N('f_c', 'circle', -360, 870, 'mod_ser', 50),
      // Quando a lança é destruída: gravidade nos restos (círculo 4)
      P('gravidade', 'ativacao', 'c4', 400, 700, 'prism_c4'),
      N('t_int', 'circle', 400, 530, 'mod_intencao', 50),
      N('t_lig', 'circle', 570, 700, 'mod_ligacao', 50),
      N('t_ser', 'circle', 400, 870, 'mod_ser', 50),
      N('t_metal', 'circle', 230, 700, 'metal', 50)
    ],
    [
      ...LANCE.links,
      L('prism_c2', 's_l'), L('s_l', 's_t', 'arc-cw'), L('s_t', 's_r', 'arc-cw'), L('s_r', 's_b', 'arc-cw'), L('s_b', 'prism_c2'),
      L('prism_c2', 's_n1'), L('s_n1', 's_t'), L('s_r', 's_n2'), L('s_n2', 'prism_c2'),
      L('prism_c3', 'f_a'), L('f_a', 'f_orb', 'arc-cw'), L('f_orb', 'f_b', 'arc-cw'), L('f_b', 'prism_c3'), L('prism_c3', 'f_c'), L('f_c', 'f_b', 'arc-ccw'),
      L('prism_c4', 't_int'), L('t_int', 't_lig', 'arc-cw'), L('t_lig', 't_ser', 'arc-cw'), L('t_ser', 't_metal', 'arc-cw'), L('t_metal', 'prism_c4'),
      // Ligações entre círculos separados
      L('l_pir', 'prism_c2'), L('prism_center', 'f_orb'), L('prism_center', 't_int')
    ],
    [
      ...LANCE.circles,
      { id: 'c2', x: 760, y: -40, name: 'Movimento sônico (não inerente)', frame: 'square' },
      { id: 'c3', x: -360, y: 700, name: '4 bolas de fogo que orbitam a lança' },
      { id: 'c4', x: 400, y: 700, name: 'Quando a lança é destruída: gravidade nos restos, que se fundem com o que tocam' }
    ],
    true),

  m_dardo: spell(
    { name: 'Dardo Inabalável', desc: 'Um dardo de Fogo em Pirâmide lançado como Projétil que vento, explosões ou empurrões não desviam: a D.N. Vertical e a D.N. Lateral anulam as forças externas para cima/baixo e para os lados. O Projétil fica num Sal △, que regulariza a volta. Causa Queimação e, no Perfeito, Incineração.' },
    'runic',
    [P('fogo', 'perfeito', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'circle', -185, 0, 'forma_piramide', 54),
     N('n_vert', 'circle', 0, -185, 'dir_vertical', 54),
     N('n_lat', 'circle', 185, 0, 'dir_lateral', 54),
     N('n_proj', 'triangle', 0, 185, 'mod_projetil', 54)],
    [L('prism_center', 'n_forma'),
     L('n_forma', 'n_vert', 'arc-cw'),
     L('n_vert', 'n_lat', 'arc-cw'),
     L('n_lat', 'n_proj', 'arc-cw'),
     L('n_proj', 'prism_center')])
};
