import { analyzeCircles } from '../core/circles';
import type { Activation, Circle, Connection, ConnectionType, MagicNode, Preset, RingStyle, ShapeId } from '../core/types';

// Livro de Magias: magias de exemplo montadas com as regras do sistema
// (Matriz com ciclo fechado, ○ na saída do cabo; com a energia da Ativação perfeita, não podem falhar).
/** Matriz de um círculo */
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
 * círculos dentro, cada um com a sua Matriz, e a Matriz da lança embaixo, como fonte.
 * Matriz da lança ➔ círculo do Fogo/Raio ➔ círculo da lança ➔ Matriz da lança.
 */
function lanceParts(ox = 0, oy = 0): { nodes: MagicNode[]; links: Omit<Connection, 'id'>[]; circles: Circle[] } {
  // Fogo/Raio em cima à esquerda, a lança embaixo à direita e a Matriz da lança entre os dois
  const L1 = { x: ox - 133, y: oy - 127 }, L2 = { x: ox + 91, y: oy + 85 };
  const at = (c: { x: number; y: number }, dx: number, dy: number): [number, number] => [c.x + dx, c.y + dy];
  const node = (id: string, shape: ShapeId, [x, y]: [number, number], rune: string | null, size: number): MagicNode =>
    ({ id, shape, x, y, size, rot: 0, rune, activation: 'ativacao', charge: 1 });
  return {
    circles: [
      { id: 'c1', x: ox, y: oy, r: 330, name: 'Lança de fogo plasmática' },
      { id: 'c_fogo', x: L1.x, y: L1.y, r: 112, name: 'Fogo e Raio com Estado' },
      { id: 'c_lanca', x: L2.x, y: L2.y, r: 162, name: 'A lança: formatos unidos pelo Projétil' }
    ],
    nodes: [
      // Matriz da lança, entre os dois círculos de dentro (a fonte do círculo da lança)
      { id: 'prism_center', shape: 'prism', x: ox + 45, y: oy - 124, size: 32, rot: 0, rune: null, activation: 'ativacao', charge: 1, lockedCenter: true, circleId: 'c1' },
      // Círculo do Fogo e do Raio: Matriz com Estado à esquerda, ida e volta para cada runa
      { id: 'prism_fogo', shape: 'prism', x: L1.x - 64, y: L1.y, size: 26, rot: 0, rune: 'mod_estado', activation: 'ativacao', charge: 1, lockedCenter: true, circleId: 'c_fogo' },
      node('f_raio', 'circle', at(L1, 32, -50), 'raio', 28),
      node('f_fogo', 'circle', at(L1, 32, 50), 'fogo', 28),
      // Círculo da lança: Matriz no meio; Estado, Estado e Ligação de um lado; Cubo, Projétil, Cubo e Pirâmide do outro
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
      // Lado dos formatos: o Projétil une tudo e devolve à Matriz
      L('prism_lanca', 'l_cubo1'), L('l_cubo1', 'l_pir'), L('l_pir', 'l_cubo2'), L('l_cubo2', 'l_proj'), L('l_proj', 'prism_lanca'),
      // Entre os círculos, por fora, de anel a anel: cada círculo funciona sozinho
      // Matriz da lança ➔ círculo do Fogo/Raio ➔ círculo da lança ➔ Matriz da lança
      L('prism_center', 'ring:c_fogo'), L('ring:c_fogo', 'ring:c_lanca'), L('ring:c_lanca', 'prism_center')
    ]
  };
}

/**
 * As 4 bolas de fogo que giram em volta da lança: a Matriz com Movimento no meio,
 * 4 Fogos nas diagonais, um Ser ao lado de cada um e 4 Estados por fora, numa corrente.
 * Desenhado para um anel de raio 261 e reduzido para o raio pedido.
 */
function fireballParts(cx: number, cy: number, r: number): { nodes: MagicNode[]; links: Omit<Connection, 'id'>[]; circle: Circle } {
  const k = r / 261;
  const n = (id: string, dx: number, dy: number, rune: string, size: number): MagicNode =>
    N(id, 'circle', Math.round(cx + dx * k), Math.round(cy + dy * k), rune, Math.round(size * k));
  return {
    circle: { id: 'c3', x: cx, y: cy, r, name: '4 bolas de fogo que giram em volta da lança' },
    nodes: [
      { ...P('movimento', 'ativacao', 'c3', cx, cy, 'prism_c3'), size: Math.round(33 * k) },
      n('f_et', 0, -142, 'mod_estado', 34),
      n('f_ftl', -73, -71, 'fogo', 36), n('f_st', 0, -73, 'mod_ser', 24), n('f_ftr', 75, -71, 'fogo', 36),
      n('f_el', -149, 2, 'mod_estado', 34), n('f_sl', -75, 2, 'mod_ser', 24),
      n('f_sr', 75, 1, 'mod_ser', 24), n('f_er', 151, 2, 'mod_estado', 34),
      n('f_fbl', -73, 71, 'fogo', 36), n('f_sb', 0, 71, 'mod_ser', 24), n('f_fbr', 75, 71, 'fogo', 36),
      n('f_eb', 0, 146, 'mod_estado', 34)
    ],
    links: [
      // a corrente gira em volta da Matriz (cada Estado logo depois de um Fogo)
      L('prism_c3', 'f_ftr'), L('f_ftr', 'f_et'), L('f_et', 'f_st'), L('f_st', 'f_ftl'), L('f_ftl', 'f_el'), L('f_el', 'f_sl'),
      L('f_sl', 'f_fbl'), L('f_fbl', 'f_eb'), L('f_eb', 'f_sb'), L('f_sb', 'f_fbr'), L('f_fbr', 'f_er'), L('f_er', 'f_sr'),
      L('f_sr', 'prism_c3')
    ]
  };
}

const LANCE = lanceParts();
/** Na magia completa: a lança em cima e as bolas de fogo embaixo, dentro do círculo grande */
const LANCE_R = lanceParts(0, -160);
const BALLS = fireballParts(0, 370, 175);

export const SPELLS: Record<string, Preset> = {
  m_muralha: spell(
    { name: 'Muralha de Terra', desc: 'Escudo vertical: a Terra (Perfeito) sobe pelo Paralelepípedo num Círculo+Triângulo ○+△, passa pelo Círculo ○ (Estabilizador) e volta à Matriz pela D.N. Vertical, que impede que a muralha seja empurrada para cima ou para baixo. O Quadrado □ com Estado sustenta a muralha de pé. Quem é atingido sofre Lentidão e, no Perfeito, Petrificação.' },
    'double',
    [P('terra', 'perfeito', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'salor', 0, -185, 'forma_paralelepipedo', 62),
     N('n_sal', 'circle', 185, 0, null, 54),
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
    { name: 'Descarga Distante', desc: 'Triângulo invertido, como um raio descendo: o Raio (24 de energia já no Mínimo) vira uma Esfera, e logo depois o Projétil, num Círculo+Triângulo ○+△, junta tudo num só objeto. A Área reprojeta a descarga na superfície mais distante: o raio não cai perto de quem lança, mas lá longe, na Direção escolhida; o Círculo ○ mantém a volta estável. Quem estiver nessa superfície sofre Paralisia (−1d8 nos movimentos).' },
    'runic',
    [P('raio', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'circle', 0, -190, 'forma_esfera', 50),
     N('n_proj', 'salor', 180, -60, 'mod_projetil', 58),
     N('n_area', 'circle', 112, 155, 'mod_area', 50),
     N('n_dir', 'circle', -150, 120, 'dir_padrao', 52)],
    [L('prism_center', 'n_forma'),
     L('n_forma', 'n_proj', 'arc-cw'),
     L('n_proj', 'n_area', 'arc-cw'),
     L('n_area', 'n_dir', 'arc-cw'),
     L('n_dir', 'prism_center')]),

  m_cubo_gelo: spell(
    { name: 'Cubo de Gelo', desc: 'Cruz com dois ciclos: o Gelo vira um Cubo e o Ser fecha os dois num único conjunto — o cubo de gelo; o Círculo ○ (Estabilizador) mantém o outro ciclo estável. Os dois alimentam o Quadrado □ com Estado, que mantém o gelo no estado mais estável: ele não derrete com o calor nem com a umidade do ambiente. Quem fica preso dentro sofre Congelamento (−1d4 no movimento e nos processos energéticos).' },
    'double',
    [P('gelo', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'circle', 0, -185, 'forma_cubo', 54),
     N('n_ser', 'circle', 185, 0, 'mod_ser', 54),
     N('n_sal', 'circle', -185, 0, null, 54),
     N('n_estado', 'square', 0, 185, 'mod_estado', 54)],
    [L('prism_center', 'n_forma'),
     L('n_forma', 'n_ser', 'arc-cw'),
     L('n_forma', 'n_sal', 'arc-cw'),
     L('n_ser', 'prism_center'),
     L('n_sal', 'prism_center'),
     L('n_ser', 'n_estado', 'arc-cw'),
     L('n_sal', 'n_estado', 'arc-cw')]),

  m_grito: spell(
    { name: 'Grito Atordoante', desc: 'Anel de ondas: o Som toma a forma de uma Esfera (num Círculo ○, que a mantém estável) e o Ser fecha os dois num único ser — a onda sai inteira, sem se espalhar pelo caminho; a Direção aponta a onda para a frente antes de voltar à Matriz. Quem a onda atinge sofre Atordoamento (−2 no pensamento e −1d4 na comunicação).' },
    'runic',
    [P('som', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'circle', 135, -135, 'forma_esfera', 54),
     N('n_ser', 'circle', 135, 135, 'mod_ser', 54),
     N('n_dir', 'circle', -135, 135, 'dir_padrao', 54)],
    [L('prism_center', 'n_forma'),
     L('n_forma', 'n_ser', 'arc-cw'),
     L('n_ser', 'n_dir', 'arc-cw'),
     L('n_dir', 'prism_center')]),

  m_passo: spell(
    { name: 'Passo Veloz', desc: 'O Movimento é uma runa de conceito (sem forma física): o Ser o fecha num conjunto e, logo depois, o Toque leva esse efeito à superfície mais próxima — quem é tocado (ou o próprio conjurador) ganha +1 m/s; a D.N. Lateral impede que empurrões para os lados o desviem. Logo depois do Ser, o Quadrado □ com Estado mantém o Movimento enquanto durar.' },
    'single',
    [P('movimento', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_ser', 'circle', -190, 0, 'mod_ser', 54),
     N('n_toque', 'circle', 0, -190, 'mod_toque', 54),
     N('n_dir', 'circle', 190, 0, 'dir_lateral', 54),
     N('n_estado', 'square', 0, 190, 'mod_estado', 54)],
    [L('prism_center', 'n_ser'),
     L('n_ser', 'n_toque', 'arc-cw'),
     L('n_toque', 'n_dir', 'arc-cw'),
     L('n_dir', 'prism_center'),
     L('n_ser', 'n_estado', 'arc-ccw')]),

  m_falsa_acao: spell(
    { name: 'Falsa Ação', desc: 'A Ilusão custa caro (32 de energia já no Mínimo). A Intenção, num Círculo+Triângulo ○+△ embaixo, põe nela a vontade de quem lança, com a palavra de vínculo «Esconder»; o Ser fecha a Ilusão e a Intenção num conjunto e o Toque leva esse conjunto à superfície mais próxima. Um Círculo ○ mantém a volta estável. Quem é tocado tem 1 ação congelada ou escondida no turno.' },
    'runic',
    [P('ilusao', 'ativacao', 'c1', 0, 0, 'prism_center'),
     { ...N('n_int', 'salor', 0, 190, 'mod_intencao', 60), bond: 'Esconder' },
     N('n_ser', 'circle', -165, -110, 'mod_ser', 54),
     N('n_toque', 'circle', 165, -110, 'mod_toque', 54),
     N('n_sal', 'circle', 190, 75, null, 54)],
    [L('prism_center', 'n_int'),
     L('n_int', 'n_ser', 'arc-cw'),
     L('n_ser', 'n_toque', 'arc-cw'),
     L('n_toque', 'n_sal', 'arc-cw'),
     L('n_sal', 'prism_center')]),

  m_meteoro: spell(
    { name: 'Meteoro Flamejante', desc: 'Dois círculos na diagonal, unidos pela Estrela ☆. A Estrela sobrepõe o Fogo (círculo de cima), que aponta na Direção, à Terra (círculo de baixo), que forma a rocha em Esfera; logo depois da Esfera, o Projétil une a rocha em chamas num só objeto aerodinâmico e a lança, como último passo antes de voltar à Matriz. Impacto com Lentidão e Queimação; no Perfeito, Petrificação e Incineração.' },
    'single',
    [P('terra', 'perfeito', 'c1', 0, 0, 'prism_center'),
     P('fogo', 'perfeito', 'c2', 372, -215, 'prism_c2'),
     N('n_star', 'star', 186, -107, null, 58),
     N('n_forma', 'circle', -179, -70, 'forma_esfera', 54),
     N('n_proj', 'circle', -95, 165, 'mod_projetil', 54),
     N('n_dir', 'circle', 551, -145, 'dir_padrao', 54)],
    [L('prism_center', 'n_star'),
     L('n_star', 'prism_c2'),
     L('prism_c2', 'n_dir'),
     L('n_dir', 'n_star'),
     L('n_star', 'n_forma'),
     L('n_forma', 'n_proj', 'arc-ccw'),
     L('n_proj', 'prism_center')],
    [{ id: 'c1', x: 0, y: 0 }, { id: 'c2', x: 372, y: -215 }]),

  m_tempestade: spell(
    { name: 'Tempestade Elétrica', desc: 'Dois círculos na vertical, como nuvem e chão: no círculo de cima, o Raio vira uma Pirâmide e o Projétil, num Círculo+Triângulo, une tudo num só raio; ele cai pela Estrela ☆ no Vento (círculo de baixo), e a Área reprojeta a tempestade na superfície mais distante — ela desaba lá longe, não sobre quem lança. A Estrela sobrepõe os dois: Corte Mágico (+1d12) e Paralisia (−1d8) em quem estiver nessa superfície.' },
    'runic',
    [P('vento', 'perfeito', 'c1', 0, 0, 'prism_center'),
     P('raio', 'ativacao', 'c2', 0, -430, 'prism_c2'),
     N('n_star', 'star', 0, -215, null, 58),
     N('n_area', 'circle', -150, 120, 'mod_area', 54),
     N('n_forma', 'circle', 150, -550, 'forma_piramide', 50),
     N('n_proj', 'salor', -150, -550, 'mod_projetil', 58)],
    [L('prism_center', 'n_star'),
     L('n_star', 'prism_c2'),
     L('prism_c2', 'n_forma'),
     L('n_forma', 'n_proj', 'arc-ccw'),
     L('n_proj', 'prism_c2'),
     L('n_star', 'n_area'),
     L('n_area', 'prism_center')],
    [{ id: 'c1', x: 0, y: 0 }, { id: 'c2', x: 0, y: -430 }]),

  m_escudo_agua: spell(
    { name: 'Escudo d\'Água', desc: 'Uma Esfera de água gira em volta da magia: a Órbita (num Círculo ○, que mantém o giro estável) cria a linha invisível paralela ao círculo e a Esfera passa a orbitá-la, protegendo quem está no meio. Do outro lado, o Ser fecha a Água e a Esfera num único ser. Os dois alimentam o Quadrado □ com Estado, que mantém a água no estado mais estável. O que atinge o escudo sofre Inibição (a água interage contra o elemento base); no Perfeito, Extração.' },
    'double',
    [P('agua', 'perfeito', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'circle', 0, -185, 'forma_esfera', 54),
     N('n_orb', 'circle', 185, 0, 'mod_orbita', 54),
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
    { name: 'Órbita de Chamas', desc: 'Anel orbital: o Fogo (Perfeito) vira uma Esfera, a Órbita cria a linha invisível paralela ao círculo e o Ser fecha Fogo e Esfera num único ser, que gira em volta da magia; um Círculo ○ mantém o giro estável antes de voltar à Matriz. Quem se aproxima da esfera sofre Queimação; no Perfeito, Incineração.' },
    'single',
    [P('fogo', 'perfeito', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'circle', -135, -135, 'forma_esfera', 54),
     N('n_orb', 'circle', 135, -135, 'mod_orbita', 54),
     N('n_ser', 'circle', 135, 135, 'mod_ser', 54),
     N('n_sal', 'circle', -135, 135, null, 54)],
    [L('prism_center', 'n_forma'),
     L('n_forma', 'n_orb', 'arc-cw'),
     L('n_orb', 'n_ser', 'arc-cw'),
     L('n_ser', 'n_sal', 'arc-cw'),
     L('n_sal', 'prism_center')]),

  m_lanca_gelo: spell(
    { name: 'Lança de Gelo', desc: 'A Matriz fica neutra e irradia a energia para um Pentágono ⬠ (Comparador) com Gelo: ele só passa a energia adiante quando a entrada está ativa. O gelo vira Pirâmide, sai como Projétil e o Círculo ○ mantém a volta estável pela Direção. A lança causa Congelamento (−1d4).' },
    'runic',
    [P(null, 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_rad', 'hexagon', -185, 0, 'gelo', 56, 2),
     N('n_forma', 'circle', 0, -185, 'forma_piramide', 54),
     N('n_proj', 'circle', 185, 0, 'mod_projetil', 54),
     N('n_dir', 'circle', 0, 185, 'dir_padrao', 54)],
    [L('prism_center', 'n_rad'),
     L('n_rad', 'n_forma', 'arc-cw'),
     L('n_forma', 'n_proj', 'arc-cw'),
     L('n_proj', 'n_dir', 'arc-cw'),
     L('n_dir', 'prism_center')]),

  m_prensa: spell(
    { name: 'Prensa Barométrica', desc: 'A Pressão (runa de conceito, 20 de energia já no Mínimo) passa pela Área, num Círculo+Triângulo ○+△, que a reprojeta na superfície mais distante: a prensa cai lá longe, não sobre quem lança. A D.N. Vertical impede que a pressão seja empurrada para cima e o Círculo ○ mantém a volta estável. Quem estiver nessa superfície sofre Diminuição (−2 em todos os mods).' },
    'double',
    [P('pressao', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_area', 'salor', -160, -120, 'mod_area', 60),
     N('n_dir', 'circle', 160, -120, 'dir_vertical', 54),
     N('n_sal', 'circle', 0, 190, null, 54)],
    [L('prism_center', 'n_area'),
     L('n_area', 'n_dir', 'arc-cw'),
     L('n_dir', 'n_sal', 'arc-cw'),
     L('n_sal', 'prism_center')]),

  m_mistura: spell(
    { name: 'Mistura Caótica', desc: 'O Caos (runa de conceito) vira uma Esfera; logo depois dos formatos, o Projétil une tudo num só objeto aerodinâmico e o Ser fecha Caos, Esfera e Projétil num único ser. Quem é atingido tem 1 atributo misturado ao caos. O Círculo ○ mantém estável a energia do Caos na volta à Matriz.' },
    'runic',
    [P('caos', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'circle', 0, -185, 'forma_esfera', 54),
     N('n_proj', 'circle', 185, 0, 'mod_projetil', 54),
     N('n_ser', 'circle', 0, 185, 'mod_ser', 54),
     N('n_sal', 'circle', -185, 0, null, 54)],
    [L('prism_center', 'n_forma'),
     L('n_forma', 'n_proj', 'arc-cw'),
     L('n_proj', 'n_ser', 'arc-cw'),
     L('n_ser', 'n_sal', 'arc-cw'),
     L('n_sal', 'prism_center')]),

  m_supressao: spell(
    { name: 'Campo de Supressão', desc: 'Pentágono de cinco pontas: o Metal (33 de energia já no Mínimo) passa pela Área num Pentágono+Estrela ⬠+☆ (Absorvedor), que o reprojeta na superfície mais distante, e se divide em dois ciclos. Num, o Ser fecha Metal e Área num conjunto, o Círculo ○ estabiliza e o Quadrado □ com Estado mantém o campo; no outro, a Intenção põe na Área a vontade de quem lança, com a palavra de vínculo «Hostil»: só energia hostil é afetada. Lá, energias externas hostis são dispersas (Supressão Energética: até 6/10 de poder 5).' },
    'runic',
    [P('metal', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_area', 'redor', 0, -185, 'mod_area', 62),
     N('n_ser', 'circle', 176, -57, 'mod_ser', 54),
     N('n_sal', 'circle', 109, 150, null, 54),
     N('n_estado', 'square', -109, 150, 'mod_estado', 54),
     { ...N('n_int', 'circle', -176, -57, 'mod_intencao', 54), bond: 'Hostil' }],
    [L('prism_center', 'n_area'),
     L('n_area', 'n_ser', 'arc-cw'),
     L('n_ser', 'n_sal', 'arc-cw'),
     L('n_sal', 'prism_center'),
     L('n_sal', 'n_estado', 'arc-cw'),
     L('n_area', 'n_int', 'arc-cw'),
     L('n_int', 'prism_center')]),

  m_passo_ilusorio: spell(
    { name: 'Passo Ilusório', desc: 'Dois círculos unidos pela Estrela ☆: o Movimento (direita) leva o conjurador na Direção escolhida e a Ilusão (esquerda, com o Ser num Círculo+Triângulo) deixa uma imagem falsa no lugar. O inimigo erra: a ação contra o conjurador é escondida (Falsa Ação) e ele ganha +1 m/s.' },
    'double',
    [P('ilusao', 'ativacao', 'c1', 0, 0, 'prism_center'),
     P('movimento', 'ativacao', 'c2', 430, 0, 'prism_c2'),
     N('n_star', 'star', 215, 0, null, 58),
     N('n_ser', 'salor', -140, -150, 'mod_ser', 58),
     N('n_sal', 'circle', -140, 150, null, 54),
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
    { name: 'Erupção', desc: 'Três círculos unidos por uma só Estrela ☆ no meio, onde os três se sobrepõem: a Pressão (círculo de cima) comprime a Terra e o Fogo, e a D.N. Vertical impede que a coluna da erupção seja empurrada para cima ou para baixo. Cada círculo volta à sua Matriz pela sua runa. No círculo do Fogo, a Área reprojeta a erupção na superfície mais distante: ela estoura lá longe, não aos pés de quem lança. Quem estiver lá sofre Lentidão, Queimação e Diminuição (−2 em todos os mods).' },
    'single',
    [P('terra', 'perfeito', 'c1', 0, 0, 'prism_center'),
     P('fogo', 'perfeito', 'c2', 430, 0, 'prism_c2'),
     P('pressao', 'ativacao', 'c3', 215, -372, 'prism_c3'),
     N('n_star', 'star', 215, -124, null, 60),
     N('n_terra', 'circle', -170, -60, 'forma_esfera', 54),
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
    { name: 'Pele de Pedra', desc: 'A Direção Contrária faz a magia voltar para quem a lançou: a Terra envolve o próprio conjurador num Cubo de pedra e aplica Endurecimento nele (+0,2 de durabilidade). O Círculo ○ estabiliza a energia e o Quadrado □ com Estado, logo depois do Cubo, mantém a pedra no estado mais estável.' },
    'double',
    [P('terra', 'ativacao', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'circle', -190, 0, 'forma_cubo', 54),
     N('n_dir', 'circle', 0, -190, 'dir_contraria', 54),
     N('n_sal', 'circle', 190, 0, null, 54),
     N('n_estado', 'square', 0, 190, 'mod_estado', 54)],
    [L('prism_center', 'n_forma'),
     L('n_forma', 'n_dir', 'arc-cw'),
     L('n_dir', 'n_sal', 'arc-cw'),
     L('n_sal', 'prism_center'),
     L('n_forma', 'n_estado', 'arc-ccw')]),

  m_projetil_fogo: spell(
    { name: 'Projétil de Fogo', desc: 'Do seu desenho: a Matriz neutra manda a energia ao Fogo, que passa pelos formatos (Cubo e Pirâmide unidos), e logo depois o Projétil junta tudo num só objeto aerodinâmico; a Direção aponta para onde ele vai e devolve a energia à Matriz. Causa Queimação.' },
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
    { name: 'Lança de Fogo Plasmática (só a lança)', desc: 'Do seu caderno, versão refinada (2º círculo: círculos dentro de um círculo). A Matriz da lança, embaixo, é a fonte: manda a energia ao círculo do Fogo e do Raio, onde a Matriz com Estado vai e volta a cada runa (linhas duplas) e mantém o fogo aceso; daí ela passa ao círculo da lança, onde a Matriz do meio liga Estado, Estado e Ligação de um lado e Cubo, Pirâmide e Cubo do outro, e o Projétil une os formatos num só objeto aerodinâmico; e volta à Matriz da lança.' },
    'single', LANCE.nodes, LANCE.links, LANCE.circles),

  m_lanca_plasmatica: spell(
    { name: 'Lança de Fogo Plasmática', desc: 'Do seu caderno, versão refinada (2º e 3º círculo). Tudo dentro de um círculo grande: em cima, a lança — a Matriz da lança fica entre o círculo do Fogo e do Raio (a Matriz com Estado vai e volta a cada runa) e o círculo da lança (Estado, Ligação, Cubos e Pirâmide unidos pelo Projétil), e a energia passa entre eles por fora, de anel a anel; embaixo, as 4 bolas de fogo que giram em volta da lança (a Matriz com Movimento no meio e uma corrente de Fogo, Estado e Ser em volta). A lança manda a energia às bolas de anel a anel, e ela volta pela Matriz que fica entre os dois círculos.' },
    'single',
    [...LANCE_R.nodes, ...BALLS.nodes,
      // Entre a lança e as bolas, fora dos dois círculos
      { ...N('n_ponte', 'prism', 355, 217, null, 30) }],
    [...LANCE_R.links, ...BALLS.links,
      // Lança ➔ bolas de fogo, de anel a anel; as bolas devolvem pela ponte (Matriz) até a lança
      L('ring:c1', 'ring:c3'), L('ring:c3', 'n_ponte'), L('n_ponte', 'ring:c1')],
    [...LANCE_R.circles, BALLS.circle],
    true),

  m_dardo: spell(
    { name: 'Dardo Inabalável', desc: 'Um dardo de Fogo em Pirâmide lançado como Projétil que vento, explosões ou empurrões não desviam: a D.N. Vertical e a D.N. Lateral anulam as forças externas para cima/baixo e para os lados. O Projétil fica num Círculo ○, que mantém a volta estável. Causa Queimação e, no Perfeito, Incineração.' },
    'runic',
    [P('fogo', 'perfeito', 'c1', 0, 0, 'prism_center'),
     N('n_forma', 'circle', -185, 0, 'forma_piramide', 54),
     N('n_vert', 'circle', 0, -185, 'dir_vertical', 54),
     N('n_lat', 'circle', 185, 0, 'dir_lateral', 54),
     N('n_proj', 'circle', 0, 185, 'mod_projetil', 54)],
    [L('prism_center', 'n_forma'),
     L('n_forma', 'n_vert', 'arc-cw'),
     L('n_vert', 'n_lat', 'arc-cw'),
     L('n_lat', 'n_proj', 'arc-cw'),
     L('n_proj', 'prism_center')])
};
