import type { Activation } from '../core/types';

// Fichas das runas no Grimório: os textos e as colunas extras de cada estado
// (Temperatura, Densidade, Volume…). Poder e Energia vêm das runas (runes.ts),
// que são os números usados nos cálculos. Tudo isso o admin pode mudar pelo site.
// Nos textos, **assim** vira negrito e `assim` vira código.

export interface SheetColumn {
  /** Nome da coluna (ex.: Densidade) */
  name: string;
  /** Unidade (ex.: g/cm³), mostrada depois do valor */
  unit: string;
  /** Valor em Mínimo, Perfeito e Extremo */
  values: Record<Activation, string>;
}

export interface RuneSheet {
  /** Citação do caderno */
  quote: string;
  /** Função Principal */
  role: string;
  /** Efeito principal (coluna da Tabela Geral) */
  effect: string;
  /** Efeito do 2º estágio / limite (coluna da Tabela Geral) */
  effect2: string;
  /** Nome de cada estado na ficha (ex.: Brisa, Ventania, Tempestade); vazio = só o estado */
  stateNames: Record<Activation, string>;
  /** Colunas extras da tabela da ficha */
  columns: SheetColumn[];
  /** Componentes Faltantes: o que acontece sem a matéria (o % vem da penalidade da runa) */
  missing: string;
  passiveTitle: string;
  passiveText: string;
  perfectTitle: string;
  perfectText: string;
  /** Observações extras */
  notes: string;
}

export const emptySheet = (): RuneSheet => ({
  quote: '', role: '', effect: '', effect2: '',
  stateNames: { ativacao: '', perfeito: '', instavel: '' },
  columns: [], missing: '', passiveTitle: '', passiveText: '', perfectTitle: '', perfectText: '', notes: ''
});

const sheet = (s: Partial<RuneSheet>): RuneSheet => ({ ...emptySheet(), ...s });
const col = (name: string, unit: string, a: string, p: string, e: string): SheetColumn => ({ name, unit, values: { ativacao: a, perfeito: p, instavel: e } });

/** Fichas iniciais (do caderno). As runas sem ficha usam a passiva e o efeito perfeito da própria runa. */
export const SHEETS: Record<string, RuneSheet> = {
  fogo: sheet({
    quote: '"Do início, a todas as coisas... ...queime e mude sua forma!" — Natural | Primeiro Estágio',
    role: 'Geração espontânea de fogo manipulando a matéria ambiente. (1 de Poder = 20°C e 0,3 cm³).',
    effect: '**Queimação:** reduz `1 + 0,1%` da vida atual / durabilidade',
    effect2: '**Incineração:** reduz `1 + 0,01%` da vida máxima por segundo',
    columns: [col('Temperatura', '°C', '100', '280', '420'), col('Volume', 'cm³', '1,5', '4,2', '6,3')],
    missing: 'Sem oxigênio ou combustível, cria artificialmente',
    passiveTitle: 'Combustão',
    passiveText: 'Alvos atingidos sofrem o efeito por 0,1s, reduzindo `1 + 0,1%` da Vida ou Durabilidade atual.',
    perfectTitle: 'Incineração',
    perfectText: 'No estágio Perfeito, aplica por 3s, reduzindo `1 + 0,01%` da Vida ou Durabilidade máxima por segundo (em materiais energizados altamente inflamáveis ou alvos sob Combustão).',
    notes: '**Especialização (Poder Total = Principal + 50% das Auxiliares):** Uso Simultâneo (Foco: Refino/Temperatura) aplica bônus `0,9 + (N × 0,1)`. Uso Sequencial (Foco: Expansão/Volume) aplica bônus `1,8 + (N × 0,2)`.'
  }),
  terra: sheet({
    quote: '"Do encontro de tudo..." "...una, o que antes se separou!" (...TERRA...) — Natural | Primeiro Estágio',
    role: 'Geração de Solo a partir de acúmulo de matéria ambiente.',
    effect: '**Lentidão:** reduz a velocidade geral em `0,2` (até `5:1`)',
    effect2: '**Petrificação:** transforma parte do alvo em pedra',
    columns: [col('Densidade', 'g/cm³', '0', '0', '0'), col('Volume', 'cm³', '0', '0', '0')],
    missing: 'Se não houver matéria, cria artificialmente',
    passiveTitle: 'Endurecimento',
    passiveText: 'Aplica Endurecimento por 3s, aumenta em 0,2 a durabilidade (até 10 de limite), mas diminui em 0,2% a mobilidade (até 10% de limite) do alvo atingido.',
    perfectTitle: 'Petrificação',
    perfectText: 'Gera Petrificação por 3s (até 31.557.600s), transforma 0,05% do alvo em pedra (limite 50%~99%). A cada 1% de Petrificação, Defesa Física +50, Defesa Mágica +30 e mobilidade geral -2%. Condição: utilizada em Rochas/Pedras ou ao manter Endurecimento ativo por mais de 300s consecutivos.'
  }),
  agua: sheet({
    quote: '"O fluxo que todos seguem..." — Natural | Primeiro Estágio',
    role: 'Geração de Água a partir de manipulação da matéria ambiente.',
    effect: '**Inibição:** interage contra elemento base (exceto variações/evoluções)',
    effect2: '**Extração:** cria um líquido com 5% da propriedade diluída',
    missing: 'Se não houver água, cria artificialmente',
    passiveTitle: 'Diluição',
    passiveText: 'Aplica Diluição por 12 segundos, permitindo que interaja com outros elementos e materiais, fazendo com que eles percam 5% das suas propriedades originais temporariamente.',
    perfectTitle: 'Extração',
    perfectText: 'Gera Extração, criando uma substância líquida contendo 5% da principal propriedade afetada pela Diluição. Condição: utilizada em água energizada ou ao manter Diluição ativa por 72.000 segundos.',
    notes: 'Especialização: `Poder Total = Principal + 50% das Auxiliares`.'
  }),
  vento: sheet({
    quote: 'Natural | Primeiro Estágio — Influência do ar em fatores climáticos e temporológicos',
    effect: '**Corte Mágico:** causa `+1d12` de dano mágico adicional',
    effect2: '**Tornado:** junta Brisa, Ventania e Tempestade',
    stateNames: { ativacao: 'Brisa', perfeito: 'Ventania', instavel: 'Tempestade' },
    columns: [col('Aplicação / Efeito de Estado', '',
      'Corrente de ar suave (0,5 Poder), absorve 5% do elemento dominante no ambiente (área 0,5m).',
      '2d4 corrente(s) de ar cortante com 3 (+ Poder da Runa) de dano mágico Cortante (alcance 15m).',
      'Corrente de ar densa com 20 (+ Poder da Runa) de dano físico Contundente (alcance 10m).')],
    missing: 'Sem ar para mover',
    perfectTitle: 'Tornado',
    perfectText: 'Quando todas as passivas (Brisa, Ventania e Tempestade) são aplicadas ao mesmo tempo, puxa tudo à volta com `35 (+ Poder da Runa)` de força física e causa dano adaptativo (Mágico/Físico de Corte/Contundente) de `3d20+50`, absorvendo 20% de dois elementos diferentes (até 80%) com alcance em cone de 90° (25m).',
    notes: 'Valores base do caderno: Poder 2 ~ 10 ~ 13 e Custo 4,8 ~ 8,2 ~ 16,4.'
  }),
  raio: sheet({ effect: '**Paralisia:** diminui os movimentos em `-1d8`' }),
  som: sheet({ effect: '**Atordoamento:** diminui pensamento em `-2` e comunicação em `-1d4`' }),
  gelo: sheet({ effect: '**Congelamento:** diminui o movimento e processos energéticos em `-1d4`' }),
  metal: sheet({ effect: '**Supressão Energética:** dispersa energias externas em até `6/10` de poder 5 (`1,75`)' }),
  ilusao: sheet({ effect: '**Falsa Ação:** congela ou esconde 1 ação', effect2: 'Ocultação completa de ação no turno' }),
  pressao: sheet({ effect: '**Diminuição:** diminui em `-2` todos os mods', effect2: 'Supressão gravitacional/barométrica de modificadores' }),
  movimento: sheet({ effect: '**Velocidade:** aumenta ou diminui a velocidade em `1 m/s`', effect2: 'Controle vetorial cinético por estágio' }),
  caos: sheet({ effect: '**Mistura:** mistura 1 atributo ao caos', effect2: 'Embaralhamento caótico de atributos' }),
  vida: sheet({ effect: 'Mantém `0,01%` (até 50,0% do poder) do indivíduo no mesmo estado', effect2: 'Em 50%: o ser não pode ser alterado' }),
  morte: sheet({ effect: 'Volta o ser para um estado anterior `0,01%` (até 50,0%)', effect2: 'Em 50%: condições do indivíduo são negadas' }),
  natureza: sheet({ effect: 'Acelera o crescimento natural em 5%', effect2: 'Acima de 100%: o crescimento pode gerar mutação' }),
  acido: sheet({ effect: 'Separa componentes próximos em 2', effect2: 'Aumenta o grau de pureza da matéria' })
};
