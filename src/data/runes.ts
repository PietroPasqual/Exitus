import type { Rune, RuneType } from '../core/types';

// Catálogo das 40 runas (traços vetoriais fiéis aos desenhos do caderno)
export const RUNES: Record<string, Rune> = {
  // --- 24 ELEMENTAL & CONCEPTUAL RUNES (Image 1000142968.webp) ---
  fogo: {
    id: 'fogo', name: 'Fogo (Ig)', sigil: 'Uhz', category: 'elemental',
    stats: {
      ativacao: { power: 5, cost: 4.2, temp: 100, vol: 1.5 },
      perfeito: { power: 14, cost: 7.5, temp: 280, vol: 4.2 },
      instavel: { power: 21, cost: 12.1, temp: 420, vol: 6.3 }
    },
    missingPenalty: 0.3333,
    auxFactor: 0.5,
    passive: 'Combustão (0,1s: reduz 1 + 0,1% da Vida/Durabilidade atual)',
    perfectEffect: 'Incineração (3s: reduz 1 + 0,01% da Vida/Durabilidade máx/s)',
    svg: `<path d="M -5,-15 C -12,-7 -12,2 -6,7 C -2,10 3,7 2,3 C 1,-1 -4,1 -4,5 M -11,6 C -13,13 -5,18 3,16 C 12,14 14,4 9,-3 C 5,-8 6,-13 11,-16" stroke-width="2.6" stroke-linecap="round" fill="none"/>`
  },
  terra: {
    id: 'terra', name: 'Terra (Tr)', sigil: 'Já', category: 'elemental',
    stats: {
      ativacao: { power: 5, cost: 5.8, dens: 2.5, vol: 1.5 },
      perfeito: { power: 22, cost: 14.3, dens: 5.5, vol: 6.6 },
      instavel: { power: 28, cost: 21.7, dens: 7.0, vol: 8.4 }
    },
    missingPenalty: 0.3333,
    auxFactor: 0.0,
    passive: 'Endurecimento (3s: +0,2 durabilidade até 10; -0,2% mobilidade até 10%)',
    perfectEffect: 'Petrificação (3s: converte 0,05% em pedra; a cada 1% gera +50 Def Física, +30 Def Mágica, -2% mobilidade)',
    svg: `<path d="M 0,-18 L -9,-3 L 2,4 L -4,11 M 5,-8 L -5,4 L 7,10 L -1,18" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  },
  agua: {
    id: 'agua', name: 'Água (Gu)', sigil: 'Ze', category: 'elemental',
    stats: {
      ativacao: { power: 2, cost: 4.0, vol: 2.0 },
      perfeito: { power: 10, cost: 8.0, vol: 6.0 },
      instavel: { power: 13, cost: 16.0, vol: 9.0 }
    },
    missingPenalty: 0.50,
    auxFactor: 0.5,
    passive: 'Inibição & Diluição (Interage contra elemento base reduzindo 5% das propriedades por 12s, exceto variações/evoluções)',
    perfectEffect: 'Extração (Cria substância líquida contendo 5% da principal propriedade afetada pela Diluição)',
    svg: `<path d="M -14,-5 C -7,-9 7,-1 14,-5 M -14,6 C -7,2 7,10 14,6" stroke-width="2.6" stroke-linecap="round" fill="none"/>`
  },
  vento: {
    id: 'vento', name: 'Vento (Vs)', sigil: 'Vs', category: 'elemental',
    stats: {
      ativacao: { power: 3, cost: 3.5, range: 0.5 },
      perfeito: { power: 8, cost: 4.5, range: 15 },
      instavel: { power: 14, cost: 9.0, range: 10 }
    },
    missingPenalty: 0.20,
    auxFactor: 0.5,
    passive: 'Corte Mágico (+1d12 dano mágico adicional) | Brisa (Ativ.) / Ventania (Perf.: 2d4×[3+Poder]) / Tempestade (Ext.: 20+Poder)',
    perfectEffect: 'Tornado (Combina Brisa+Ventania+Tempestade: puxa com 35+Poder, 3d20+50 dano adaptativo, cone 90° de 25m)',
    svg: `<path d="M -15,0 C -8,-5 0,-5 6,0 C 12,4 17,0 16,-6 C 15,-12 7,-13 4,-7 M -16,7 C -8,3 2,4 10,8 C 15,10 18,6 18,1" stroke-width="2.5" stroke-linecap="round" fill="none"/>`
  },
  vida: {
    id: 'vida', name: 'Vida', sigil: 'Vi', category: 'elemental',
    stats: { ativacao: { power: 5, cost: 5.0 }, perfeito: { power: 15, cost: 9.0 }, instavel: { power: 22, cost: 15.0 } },
    missingPenalty: 0.3333, auxFactor: 0.5,
    provisional: true, costPerPower: { ativacao: 2, perfeito: 3.2, instavel: 5 },
    passive: 'Preservação (Mantém 0,01% — até 50,0% do poder — do indivíduo no mesmo estado)',
    perfectEffect: '2º Estágio — Em 50%: o ser não pode ser alterado',
    svg: `<path d="M -14,10 L 14,10 M -12,7 L -12,13 M 12,7 L 12,13 M -6,10 L -6,0 C -6,-10 -15,-14 -10,-17 C -6,-19 -2,-14 -2,-10 M 6,10 L 6,0 C 6,-10 15,-14 10,-17 C 6,-19 2,-14 2,-10" stroke-width="2.4" stroke-linecap="round" fill="none"/>`
  },
  morte: {
    id: 'morte', name: 'Morte', sigil: 'Mo', category: 'elemental',
    stats: { ativacao: { power: 6, cost: 6.0 }, perfeito: { power: 16, cost: 10.0 }, instavel: { power: 25, cost: 17.0 } },
    missingPenalty: 0.3333, auxFactor: 0.5,
    provisional: true, costPerPower: { ativacao: 2, perfeito: 3.2, instavel: 5 },
    passive: 'Regressão (Volta o ser para um estado anterior 0,01% — até 50,0%)',
    perfectEffect: '2º Estágio — Em 50%: condições do indivíduo são negadas',
    svg: `<path d="M 14,-10 C 16,6 8,15 -4,14 C -14,13 -16,2 -11,-7 C -6,-14 5,-14 9,-6 C 12,1 6,8 -2,7 C -7,6 -8,0 -3,-3 C 0,-4 3,-1 1,2" stroke-width="2.5" stroke-linecap="round" fill="none"/>`
  },
  raio: {
    id: 'raio', name: 'Raio', sigil: 'Ra', category: 'elemental',
    stats: { ativacao: { power: 14, cost: 24.0 }, perfeito: { power: 64, cost: 52.0 }, instavel: { power: 75, cost: 57.0 } },
    missingPenalty: 0.25, auxFactor: 0.5,
    passive: 'Paralisia (Diminui os movimentos do alvo atingido em -1d8)',
    perfectEffect: ' Descarga Voltaica (Paralisia crítica e condução em cadeia com Poder 64~75)',
    svg: `<path d="M 2,-17 L -8,-1 L 0,-1 L -6,11 M 6,-5 L 0,5 L 7,5 L -2,18" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  },
  metal: {
    id: 'metal', name: 'Metal', sigil: 'Me', category: 'elemental',
    stats: { ativacao: { power: 22, cost: 33.0 }, perfeito: { power: 123, cost: 82.0 }, instavel: { power: 132, cost: 132.0 } },
    missingPenalty: 0.3333, auxFactor: 0.5,
    passive: 'Supressão Energética (Dispersa energias externas em até 6/10 de poder 5 | Fator 1,75)',
    perfectEffect: 'Blindagem & Dispersão Absoluta (Anulação estrutural de fluxo externo com Poder 123~132)',
    svg: `<path d="M -15,7 L -9,-6 L 9,-6 L 15,7 L -11,7 M -11,0 L -5,0 M 4,0 L 11,0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  },
  gelo: {
    id: 'gelo', name: 'Gelo', sigil: 'Ge', category: 'elemental',
    stats: { ativacao: { power: 10, cost: 10.0 }, perfeito: { power: 45, cost: 30.0 }, instavel: { power: 60, cost: 40.0 } },
    missingPenalty: 0.3333, auxFactor: 0.5,
    passive: 'Congelamento (Diminui o movimento e processos energéticos em -1d4)',
    perfectEffect: 'Zero Absoluto (Estase criogênica profunda com Poder 45~60)',
    svg: `<path d="M -13,-13 L 13,13 M 13,-13 L -13,13 M 0,-6 L 0,6 M -6,0 L 6,0 M -15,-10 L -10,-15 M 10,-15 L 15,-10 M -15,10 L -10,15 M 10,15 L 15,10" stroke-width="2.3" stroke-linecap="round" fill="none"/>`
  },
  som: {
    id: 'som', name: 'Som', sigil: 'So', category: 'elemental',
    stats: { ativacao: { power: 8, cost: 12.0 }, perfeito: { power: 48, cost: 24.0 }, instavel: { power: 76, cost: 36.0 } },
    missingPenalty: 0.20, auxFactor: 0.5,
    passive: 'Atordoamento (Diminui pensamento em -2 e comunicação em -1d4)',
    perfectEffect: 'Ressonância Desestruturante (Colapso sensorial e cognitivo com Poder 48~76)',
    svg: `<circle cx="0" cy="0" r="15" stroke-width="2.3" fill="none"/><circle cx="0" cy="0" r="9.5" stroke-width="2.1" fill="none"/><circle cx="0" cy="0" r="2.5" stroke-width="2.2" fill="none"/>`
  },
  natureza: {
    id: 'natureza', name: 'Natureza', sigil: 'Na', category: 'elemental',
    stats: { ativacao: { power: 5, cost: 4.5 }, perfeito: { power: 14, cost: 8.0 }, instavel: { power: 21, cost: 13.0 } },
    missingPenalty: 0.3333, auxFactor: 0.5,
    provisional: true, variable: true,
    passive: 'Crescimento (Acelera o crescimento natural em 5%)',
    perfectEffect: '2º Estágio — Acima de 100%: o crescimento pode gerar mutação',
    svg: `<path d="M -2,15 C -1,6 -5,-1 -12,-8 M -6,-2 C -4,-6 -1,-9 2,-11 M 7,-13 C 6,-6 9,-2 15,-5 M 9,-8 L 13,-13" stroke-width="2.4" stroke-linecap="round" fill="none"/>`
  },
  acido: {
    id: 'acido', name: 'Ácido', sigil: 'Ac', category: 'elemental',
    stats: { ativacao: { power: 5, cost: 5.0 }, perfeito: { power: 15, cost: 8.8 }, instavel: { power: 23, cost: 14.2 } },
    missingPenalty: 0.3333, auxFactor: 0.5,
    provisional: true, variable: true,
    passive: 'Separação (Separa componentes próximos em 2)',
    perfectEffect: '2º Estágio — Aumenta o grau de pureza da matéria',
    svg: `<path d="M -10,-14 C -14,-4 -12,8 -5,12 C 1,15 3,6 -2,3 M 4,-12 C 1,-5 10,-2 8,7 C 7,12 2,15 -1,14 M 12,-5 C 15,-1 14,6 10,11" stroke-width="2.4" stroke-linecap="round" fill="none"/><circle cx="7" cy="-15" r="1.8" fill="currentColor"/>`
  },
  ilusao: {
    id: 'ilusao', name: 'Ilusão', sigil: 'Il', category: 'elemental',
    stats: { ativacao: { power: 16, cost: 32.0 }, perfeito: { power: 34, cost: 48.0 }, instavel: { power: 40, cost: 66.0 } },
    missingPenalty: 0.20, auxFactor: 0.5,
    passive: 'Falsa Ação (Congela ou esconde 1 ação)',
    perfectEffect: '2º Estágio — Ocultação completa de ação no turno',
    svg: `<path d="M -10,15 L -10,-13 L 12,-13 M -14,2 L -10,2 M -4,-4 L 8,-4 L 8,9 L 3,9 L 3,13" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="12" cy="-13" r="1.8" fill="currentColor"/>`
  },
  pressao: {
    id: 'pressao', name: 'Pressão', sigil: 'Pr', category: 'elemental',
    stats: { ativacao: { power: 10, cost: 20.0 }, perfeito: { power: 40, cost: 56.0 }, instavel: { power: 50, cost: 80.0 } },
    missingPenalty: 0.25, auxFactor: 0.5,
    passive: 'Diminuição (Diminui em -2 todos os mods)',
    perfectEffect: '2º Estágio — Supressão gravitacional/barométrica de modificadores',
    svg: `<path d="M -5,-15 L -14,4 L 4,13 L 10,1 L -2,-5 L -5,1 M 5,15 L 14,-4 L -4,-13 L -10,-1" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  },
  movimento: {
    id: 'movimento', name: 'Movimento', sigil: 'Mv', category: 'elemental',
    stats: { ativacao: { power: 4, cost: 6.0 }, perfeito: { power: 13, cost: 13.0 }, instavel: { power: 20, cost: 24.0 } },
    missingPenalty: 0.20, auxFactor: 0.5,
    passive: 'Velocidade (Aumenta ou diminui a velocidade em 1 m/s)',
    perfectEffect: '2º Estágio — Controle vetorial cinético por estágio',
    svg: `<path d="M -15,10 C -12,2 -4,2 0,6 C 5,10 11,4 8,-2 C 5,-8 -4,-4 -1,2 C 2,7 12,0 15,-10" stroke-width="2.5" stroke-linecap="round" fill="none"/>`
  },
  caos: {
    id: 'caos', name: 'Caos', sigil: 'Ca', category: 'elemental',
    stats: { ativacao: { power: 6, cost: 12.0 }, perfeito: { power: 20, cost: 26.0 }, instavel: { power: 24, cost: 36.0 } },
    missingPenalty: 0.40, auxFactor: 0.5,
    passive: 'Mistura (Mistura 1 atributo ao caos)',
    perfectEffect: '2º Estágio — Embaralhamento caótico de atributos',
    svg: `<path d="M -12,-2 C -6,-6 0,-2 5,-4 M -14,4 C -4,2 8,8 13,-2 C 16,-8 9,-14 3,-11 M -3,5 L -3,14 M 4,5 L 4,14" stroke-width="2.4" stroke-linecap="round" fill="none"/>`
  },
  luz: {
    id: 'luz', name: 'Luz', sigil: 'Lu', category: 'elemental',
    stats: { ativacao: { power: 5, cost: 4.5 }, perfeito: { power: 15, cost: 8.0 }, instavel: { power: 22, cost: 13.5 } },
    missingPenalty: 0.25, auxFactor: 0.5,
    provisional: true,
    passive: 'Luminescência (Revelação, feixe fotônico e ofuscamento)',
    perfectEffect: 'Clarão Solar (Radiação purificadora de alta frequência)',
    svg: `<path d="M -15,0 L 15,0 M -15,-3 L -15,3 M 15,-3 L 15,3 M -7,14 C -4,4 -4,-6 -13,-8 C -6,-10 0,-6 0,0 C 0,-6 6,-10 13,-8 C 4,-6 4,4 7,14 M -3,-13 L 3,-13 M -3,-17 L 3,-17" stroke-width="2.2" stroke-linecap="round" fill="none"/>`
  },
  sombra: {
    id: 'sombra', name: 'Sombra', sigil: 'Sb', category: 'elemental',
    stats: { ativacao: { power: 5, cost: 4.5 }, perfeito: { power: 15, cost: 8.0 }, instavel: { power: 22, cost: 13.5 } },
    missingPenalty: 0.25, auxFactor: 0.5,
    provisional: true,
    passive: 'Penumbra (Ocultação e absorção luminosa)',
    perfectEffect: 'Eclipse Abissal (Prisão de escuridão tangível)',
    svg: `<path d="M -16,0 L 16,0 M -16,-3 L -16,3 M 16,-3 L 16,3 M 8,-9 C 4,-15 -8,-14 -8,-6 C -8,2 9,2 9,10 C 9,16 -3,16 -8,11 M 5,9 L 12,9" stroke-width="2.3" stroke-linecap="round" fill="none"/>`
  },
  materia: {
    id: 'materia', name: 'Matéria', sigil: 'Mt', category: 'elemental',
    stats: { ativacao: { power: 7, cost: 7.0 }, perfeito: { power: 20, cost: 13.5 }, instavel: { power: 30, cost: 22.0 } },
    missingPenalty: 0.50, auxFactor: 0.5,
    provisional: true,
    passive: 'Coesão Corpuscular (Rearranjo físico de massa)',
    perfectEffect: 'Transmutação Estrutural (Criação ou conversão de matéria bruta)',
    svg: `<path d="M -13,-12 L 0,0 L 13,-12 M 0,0 L 0,16" stroke-width="2.3" stroke-linecap="round"/><circle cx="0" cy="-7" r="4.5" stroke-width="2.2" fill="none"/><circle cx="-6" cy="3" r="4.5" stroke-width="2.2" fill="none"/><circle cx="6" cy="3" r="4.5" stroke-width="2.2" fill="none"/><circle cx="0" cy="0" r="3" fill="currentColor"/>`
  },
  gravidade: {
    id: 'gravidade', name: 'Gravidade', sigil: 'Gr', category: 'elemental',
    stats: { ativacao: { power: 8, cost: 7.5 }, perfeito: { power: 22, cost: 14.5 }, instavel: { power: 34, cost: 24.0 } },
    missingPenalty: 0.3333, auxFactor: 0.5,
    provisional: true,
    passive: 'Atração Gravitacional (Altera peso e vetor de queda)',
    perfectEffect: 'Singularidade Orbital (Poço gravitacional de alta massa)',
    svg: `<circle cx="1" cy="-1" r="14" stroke-width="2.2" fill="none"/><circle cx="1" cy="-1" r="8.5" stroke-width="2" fill="none"/><circle cx="1" cy="-1" r="3" fill="currentColor"/><circle cx="-8" cy="9" r="4.2" fill="currentColor"/><path d="M 1,-1 L -8,9" stroke-width="2.2"/>`
  },
  tempo: {
    id: 'tempo', name: 'Tempo', sigil: 'Tp', category: 'elemental',
    stats: { ativacao: { power: 9, cost: 9.0 }, perfeito: { power: 25, cost: 17.0 }, instavel: { power: 38, cost: 28.0 } },
    missingPenalty: 0.50, auxFactor: 0.5,
    provisional: true,
    passive: 'Dilatação Temporal (Acelera ou desacelera processos locais)',
    perfectEffect: 'Estase Cronológica (Congelamento de fluxo temporal)',
    svg: `<path d="M -14,-13 L 14,-13 M -11,-9 L 9,-9 L -9,9 L 11,9 M -14,13 L 14,13 M -9,-4 C -12,-2 -12,2 -9,4 M 9,-4 C 12,-2 12,2 9,4" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  },
  espaco: {
    id: 'espaco', name: 'Espaço', sigil: 'Es', category: 'elemental',
    stats: { ativacao: { power: 8, cost: 8.5 }, perfeito: { power: 24, cost: 16.0 }, instavel: { power: 36, cost: 26.0 } },
    missingPenalty: 0.50, auxFactor: 0.5,
    provisional: true,
    passive: 'Dobra Espacial (Alteração de distância e coordenadas)',
    perfectEffect: 'Fenda Dimensional (Teleporte ou deslocamento de volume)',
    svg: `<rect x="-13" y="-11" width="14" height="14" stroke-width="2.2" fill="none"/><rect x="-1" y="-3" width="14" height="14" stroke-width="2.2" fill="none"/><rect x="-3" y="-3" width="4" height="4" fill="currentColor"/><path d="M 1,-15 L 1,15" stroke-width="2"/>`
  },
  infinito: {
    id: 'infinito', name: 'Infinito', sigil: 'In', category: 'elemental',
    stats: { ativacao: { power: 10, cost: 11.0 }, perfeito: { power: 28, cost: 20.0 }, instavel: { power: 42, cost: 32.0 } },
    missingPenalty: 0.50, auxFactor: 0.5,
    provisional: true,
    passive: 'Retroalimentação (Ciclo perpétuo de conservação de mana)',
    perfectEffect: 'Horizonte Ilimitado (Sustentação recursiva de circuito)',
    svg: `<path d="M 0,-15 L 0,15 M -12,0 L 12,0 M -7,-14 C -3,-8 -3,-4 -8,-2 M 7,-14 C 3,-8 3,-4 8,-2 M -7,14 C -3,8 -3,4 -8,2 M 7,14 C 3,8 3,4 8,2" stroke-width="2.2" stroke-linecap="round" fill="none"/>`
  },
  vazio: {
    id: 'vazio', name: 'Vazio', sigil: 'Vz', category: 'elemental',
    stats: { ativacao: { power: 10, cost: 11.0 }, perfeito: { power: 28, cost: 20.0 }, instavel: { power: 42, cost: 32.0 } },
    missingPenalty: 0.50, auxFactor: 0.5,
    provisional: true,
    passive: 'Nulidade (Supressão e anulação de energia mágica)',
    perfectEffect: 'Oblívio (Apagamento de matéria/energia no raio de ação)',
    svg: `<path d="M -14,14 L 14,-14 M -9,3 C -5,2 -2,5 -3,9 M 3,-9 C 2,-5 5,-2 9,-3 M -13,8 C -9,7 -7,9 -8,13 M 8,-13 C 7,-9 9,-7 13,-8" stroke-width="2.2" stroke-linecap="round" fill="none"/><circle cx="0" cy="0" r="2.5" fill="currentColor"/>`
  },

  // --- 4 GEOMETRIC MANIFESTATION RUNES (Image 1000142969.webp top row) ---
  forma_esfera: {
    id: 'forma_esfera', name: 'Esfera / Círculo', sigil: 'Forma', category: 'shape',
    desc: 'Molda a manifestação mágica em formato de Esfera (3D) ou Círculo (2D).',
    costMod: 1.0,
    svg: `<path d="M 8,-11 C -4,-16 -15,-7 -13,5 C -11,15 2,17 10,10 C 16,4 13,-5 4,-5 C -2,-5 -5,0 -2,4" stroke-width="2.8" stroke-linecap="round" fill="none"/>`
  },
  forma_cubo: {
    id: 'forma_cubo', name: 'Cubo / Quadrado', sigil: 'Forma', category: 'shape',
    desc: 'Molda a manifestação mágica em formato de Cubo (3D) ou Quadrado (2D), ótimo para barreiras e blocos.',
    costMod: 1.0,
    svg: `<path d="M -12,-12 L -12,12 L 12,12 L 12,-12 L -5,-12 L -5,4" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  },
  forma_paralelepipedo: {
    id: 'forma_paralelepipedo', name: 'Paralelepípedo / Retâng.', sigil: 'Forma', category: 'shape',
    desc: 'Molda a manifestação em Paralelepípedo ou Retângulo (muralhas, pilares, lâminas largas).',
    costMod: 1.05,
    svg: `<path d="M -16,-10 L -16,10 L 16,10 L 16,-10 L -9,-10 L -9,3" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  },
  forma_piramide: {
    id: 'forma_piramide', name: 'Pirâmide / Triângulo', sigil: 'Forma', category: 'shape',
    desc: 'Molda a manifestação em Pirâmide, Cone ou Triângulo (lanças perfurantes, cones de sopro).',
    costMod: 1.0,
    svg: `<path d="M -14,11 L 0,-13 L 14,11 L -6,11 L 0,0" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  },

  // --- 8 APPLICATION / TARGET / BEHAVIOR RUNES (Image 1000142969.webp middle rows) ---
  mod_projetil: {
    id: 'mod_projetil', name: 'Projétil (Proj.)', sigil: 'Ação', category: 'mod',
    desc: 'Une os diferentes formatos num único objeto aerodinâmico. Com um contexto, tenta recriar esse conteúdo com os formatos disponíveis. Use como último passo do ciclo ou logo depois dos formatos.',
    costMod: 1.15,
    svg: `<path d="M -5,-9 C -5,-16 4,-16 4,-8 L 1,15 M -11,2 L 11,2 M -12,-2 L -16,2 L -12,6 M 12,-2 L 16,2 L 12,6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  },
  mod_toque: {
    id: 'mod_toque', name: 'Toque', sigil: 'Ação', category: 'mod',
    desc: 'Canaliza a ativação mágica mediante contato físico direto.',
    costMod: 0.9,
    svg: `<path d="M -2,-16 C -8,-5 -9,8 -3,13 C 3,17 9,9 8,-1 M 5,-13 C 0,-4 -1,4 2,7 M -14,-2 L 11,-2 C 15,-2 16,2 14,5" stroke-width="2.4" stroke-linecap="round" fill="none"/>`
  },
  mod_ser: {
    id: 'mod_ser', name: 'Ser (Alvo Vivo/Entidade)', sigil: 'Alvo', category: 'mod',
    desc: 'Direciona ou vincula o efeito especificamente a um Ser / criatura / organismo.',
    costMod: 1.1,
    svg: `<path d="M -3,-16 C 3,-16 4,-11 0,-8 C 6,-5 9,2 9,15 M 0,-8 C -6,-5 -9,2 -9,15 M -3,15 L -3,2 L 3,2 L 3,15" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  },
  mod_estado: {
    id: 'mod_estado', name: 'Estado', sigil: 'Condição', category: 'mod',
    desc: 'Aplica ou sustenta o Estado elemental (Combustão, Endurecimento, Diluição, Brisa, etc.) no alvo ou meio.',
    costMod: 1.1,
    svg: `<path d="M 0,-13 L 0,13 M -12,2 L 12,2 M -10,2 L 0,13" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  },
  mod_ligacao: {
    id: 'mod_ligacao', name: 'Ligação', sigil: 'Vínculo', category: 'mod',
    desc: 'Cria um elo contínuo de transferência ou vínculo entre dois pontos, runas ou alvos.',
    costMod: 1.15,
    svg: `<path d="M -15,2 L 15,2 M -15,-2 L -15,6 M 15,-2 L 15,6 M -4,-10 L -4,14 M 4,-10 L 4,14 M -7,-7 L -4,-11 L 4,-11 L 7,-7 M -7,11 L -4,15 L 4,15 L 7,11 M -5,-16 C -2,-19 2,-13 5,-16" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  },
  mod_orbita: {
    id: 'mod_orbita', name: 'Órbita', sigil: 'Trajetória', category: 'mod',
    desc: 'Faz a manifestação mágica orbitar ao redor do conjurador, objeto ou ponto central.',
    costMod: 1.2,
    svg: `<circle cx="0" cy="0" r="6" stroke-width="2.4" fill="none"/><path d="M -12,13 L 11,-11 C 14,-14 16,-12 17,-10 M -15,6 C -13,4 -11,8 -14,10" stroke-width="2.3" stroke-linecap="round" fill="none"/>`
  },
  mod_area: {
    id: 'mod_area', name: 'Área', sigil: 'Alcance', category: 'mod',
    desc: 'Expande o efeito mágico em uma zona/área de propagação radial.',
    costMod: 1.25,
    svg: `<path d="M -5,2 C -12,6 -16,-3 -11,-10 C -6,-16 4,-12 2,-3 C 0,4 6,6 6,11 C 6,16 -2,16 -3,11 C -4,8 1,7 2,10 M 8,-12 C 12,-7 12,0 8,5 M 12,-14 C 17,-8 17,2 12,8" stroke-width="2.2" stroke-linecap="round" fill="none"/>`
  },
  mod_intencao: {
    id: 'mod_intencao', name: 'Intenção', sigil: 'Gatilho', category: 'mod',
    desc: 'Sincroniza a magia com a vontade mental ou intenção hostil/protetora.',
    costMod: 1.15,
    svg: `<path d="M -8,-14 C -5,-4 -5,4 -8,14 M 8,-14 C 5,-4 5,4 8,14 M -5,-8 C -2,-4 2,-4 5,-8 M -5,8 C -2,4 2,4 5,8 M -14,-5 C -11,-2 -11,2 -14,5 M 14,-5 C 11,-2 11,2 14,5" stroke-width="2.2" stroke-linecap="round" fill="none"/>`
  },

  // --- 4 DIRECTION RUNES (Image 1000142969.webp bottom row) ---
  dir_padrao: {
    id: 'dir_padrao', name: 'Direção', sigil: 'Vetor', category: 'mod',
    desc: 'Dá a direção da magia: para onde ela vai.',
    costMod: 1.0,
    svg: `<path d="M 0,-15 C 2,-4 4,-2 15,0 C 4,2 2,4 0,15 C -2,4 -4,2 -15,0 C -4,-2 -2,-4 0,-15 Z" stroke-width="2.4" stroke-linejoin="round" fill="none"/>`
  },
  dir_lateral: {
    id: 'dir_lateral', name: 'D. N. Lateral', sigil: 'Vetor', category: 'mod',
    desc: 'A magia não sofre com forças externas que a empurrariam para os lados.',
    costMod: 1.0,
    svg: `<path d="M 0,-15 C 1.5,-4 2.5,-2 8,0 C 2.5,2 1.5,4 0,15 C -1.5,4 -2.5,2 -8,0 C -2.5,-2 -1.5,-4 0,-15 Z" stroke-width="2.4" stroke-linejoin="round" fill="none"/>`
  },
  dir_vertical: {
    id: 'dir_vertical', name: 'D. N. Vertical', sigil: 'Vetor', category: 'mod',
    desc: 'A magia não sofre com forças externas que a empurrariam para cima ou para baixo.',
    costMod: 1.0,
    svg: `<path d="M 0,-8 C 2,-2.5 4,-1.5 15,0 C 4,1.5 2,2.5 0,8 C -2,2.5 -4,1.5 -15,0 C -4,-1.5 -2,-2.5 0,-8 Z" stroke-width="2.4" stroke-linejoin="round" fill="none"/>`
  },
  dir_contraria: {
    id: 'dir_contraria', name: 'Direção Contrária', sigil: 'Vetor Inverso', category: 'mod',
    desc: 'A magia volta para quem a lançou.',
    costMod: 1.05,
    svg: `<path d="M 0,-14 C 2.5,-3.5 3.5,-2.5 14,0 C 3.5,2.5 2.5,3.5 0,14 C -2.5,3.5 -3.5,2.5 -14,0 C -3.5,-2.5 -2.5,-3.5 0,-14 Z" stroke-width="2.2" stroke-linejoin="round" fill="currentColor"/>`
  }
};

// Cada tipo de símbolo interno tem uma cor (vale para o círculo, a lista e as imagens exportadas)
export const RUNE_TYPES: Record<RuneType, { label: string; color: string }> = {
  elemental: { label: 'Elementais', color: '#e8590c' },
  forma: { label: 'Formas', color: '#1c7ed6' },
  acao: { label: 'Ação / Alvo', color: '#2f9e44' },
  direcao: { label: 'Direção', color: '#ae3ec9' }
};

export function getRuneType(r: Rune): RuneType {
  if (r.category === 'elemental') return 'elemental';
  if (r.category === 'shape') return 'forma';
  return r.id.startsWith('dir_') ? 'direcao' : 'acao';
}

export const runeColor = (r: Rune): string => RUNE_TYPES[getRuneType(r)].color;
