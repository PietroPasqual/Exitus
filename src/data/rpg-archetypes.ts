/** Regras de arquétipo transcritas do Livro de Regras fornecido pelo mestre.
 * São textos de consulta; nenhuma vantagem ou desvantagem altera a ficha sozinha.
 *
 * Cada arquétipo principal impõe uma "penalidade" aos outros: as desvantagens de um
 * arquétipo são as penalidades dos arquétipos que ele não escolheu. Justo tem versões
 * reduzidas e Tales carrega todas.
 */
export type ArchetypeId = '' | 'ramo' | 'adepto' | 'ente' | 'amago' | 'tracos' | 'justo' | 'tales';
type MainArchetype = 'ramo' | 'adepto' | 'ente' | 'amago' | 'tracos';

export interface ArchetypePenaltyGroup { de: string; regras: string[] }
export interface RpgArchetype {
  id: Exclude<ArchetypeId, ''>;
  nome: string;
  /** Área de atuação, com artigo (ex.: "das habilidades e classes") */
  foco: string;
  /** Característica especial do arquétipo */
  especial: string;
  descricao: string;
  vantagens: string[];
  /** Desvantagens agrupadas pelo arquétipo de origem */
  grupos: ArchetypePenaltyGroup[];
  /** Todas as desvantagens, na ordem dos grupos */
  desvantagens: string[];
  /** O que este arquétipo impõe aos outros (vazio para Justo e Tales) */
  penalidade: string[];
}

const PENALTIES: Record<MainArchetype, string[]> = {
  ramo: [
    'Adiciona mais 2 requisitos para obtenção de todas as classes e sub-classes.',
    'Cumprir com todos os requisitos de uma classe força sua obtenção imediata.',
    'Classes passam a ganhar apenas 2 habilidades por Evolução.',
    'Habilidades podem evoluir apenas uma vez.'
  ],
  adepto: [
    'Entidades Elevadas podem forçar uma ligação com o indivíduo.',
    'Torna-se obrigatório o processo de conversão de energia para utilizar os poderes de uma entidade vinculada.',
    'Interações diretas ou indiretas com Entidades Elevadas são dificultadas.',
    'Possibilita-se receber punições ou penalidades de uma Entidade Superior.'
  ],
  ente: [
    'Estatísticas de Poder e Energia não podem ser aprimoradas antes do desbloqueio.',
    'Impossibilita a utilização da mecânica de Proficiência Elemental.',
    'Torna-se obrigatório adquirir o primeiro elemento que for sorteado na “Roleta Elemental”.',
    'Todos os “Elementos Etérios” começam com 0,1 de porcentagem elemental.'
  ],
  amago: [
    'Torna-se dependente de sua herança genética.',
    'Permite desbloquear apenas 0/3 estatísticas, sejam comuns ou secretas.',
    'Bloqueia a estatística de Poder ou Energia permanentemente.',
    'DRs só são contabilizados a partir de 2 dados jogados em conjunto.'
  ],
  tracos: [
    'Adquire 2 características negativas ao nascer.',
    'Características negativas podem ser enfraquecidas, mas não eliminadas.',
    'Características negativas têm uma probabilidade de se fundirem naturalmente.',
    'Características negativas têm uma probabilidade muito baixa de evoluir.'
  ]
};
const MAIN_NAMES: Record<MainArchetype, string> = { ramo: 'Ramo', adepto: 'Adepto', ente: 'Ente', amago: 'Âmago', tracos: 'Traços' };
const MAIN_ORDER: MainArchetype[] = ['ramo', 'adepto', 'ente', 'amago', 'tracos'];

const from = (ids: MainArchetype[]): ArchetypePenaltyGroup[] => ids.map(id => ({ de: MAIN_NAMES[id], regras: PENALTIES[id] }));
const others = (self: MainArchetype): ArchetypePenaltyGroup[] => from(MAIN_ORDER.filter(id => id !== self));

type ArchetypeSource = Omit<RpgArchetype, 'desvantagens'>;
const SOURCES: ArchetypeSource[] = [
  {
    id: 'ramo', nome: 'Ramo', foco: 'das habilidades e classes', especial: 'Fusão de Classes',
    descricao: 'Seu foco é na obtenção de classe e sub-classes. Quando uma sub-classe é obtida, o indivíduo pode fundir as classes caso sejam do mesmo Rank.',
    vantagens: [
      'Permite ignorar 1 dos requisitos para obtenção de classe e sub-classe.',
      'Permite descartar uma classe durante um avanço, para ganhar existência e bloqueá-la permanentemente.',
      'Permite escolher uma entre três classes ou sub-classes (especial) a cada avanço.',
      'Permite fundir duas classes de mesmo rank (apenas 2/2 vezes) ou trocar três classes ou sub-classes de mesmo rank por uma “aleatória” de rank maior.',
      'Permite fundir duas habilidades de mesmo rank (apenas 4/4 vezes) ou trocar três habilidades de mesmo rank por uma “aleatória” de rank maior.',
      'Permite aumentar os efeitos de uma habilidade em 10% por uma vez a cada descanso longo concluído.',
      'Permite a obtenção de mais uma sub-classe na ficha.',
      'Permite em até 3 vezes a evolução de habilidades.'
    ],
    grupos: others('ramo'), penalidade: PENALTIES.ramo
  },
  {
    id: 'adepto', nome: 'Adepto', foco: 'dos Deuses e Pilares', especial: 'Manifestação da Herança',
    descricao: 'Seu foco é na herança de outros Pilares. Possibilita escolher ou recusar entidades a cada evolução. Quando vinculado a uma entidade, pode encarnar sua vontade por um preço.',
    vantagens: [
      'Permite escolher ou recusar uma Entidade Elevada, durante todos os avanços.',
      'Permite converter a energia do usuário para a da entidade vinculada temporariamente, dobrando a energia atual do indivíduo, uma vez a cada 12 descansos longos.',
      'Permite estabelecer um vínculo mais profundo com sua Entidade Elevada, possibilitando virar um receptáculo de sua vontade por 6 segundos, uma vez a cada 24 descansos longos.',
      'Permite sentir a presença de Entidades Elevadas.',
      'Permite solicitar ajuda para Entidade Elevada vinculada.',
      'Permite que Entidades Elevadas interajam com o indivíduo de forma não direta.',
      'Permite se tornar um Pilar ao concluir sua transcendência.'
    ],
    grupos: others('adepto'), penalidade: PENALTIES.adepto
  },
  {
    id: 'ente', nome: 'Ente', foco: 'dos Elementos', especial: 'Criação de Habilidades Elementais',
    descricao: 'Seu foco é na obtenção de porcentagens elementais. Permite transformar “Pontos Evolutivos” em uma habilidade relacionada aos elementos do indivíduo.',
    vantagens: [
      'Permite aprimorar as estatísticas de “Poder e Energia” antes de desbloqueá-las.',
      'Permite utilizar a mecânica de Proficiência Elemental.',
      'Permite escolher entre 3 dos elementos girados na “Roleta Elemental” durante a criação do indivíduo.',
      'Permite adicionar mais um “Elemento Etéreo” comum (Fogo, Água, Vento e Terra) à ficha.',
      'Permite evoluir (apenas 1/1 vez) um dos “Elementos Etérios” comuns da ficha.',
      'Permite executar uma rolagem de dados (1d4+1d6+1d8) para cada porcentagem “Elemental Etéria”.',
      'Permite transformar “Pontos Evolutivos” em habilidades de Rank E (evolução 6).'
    ],
    grupos: others('ente'), penalidade: PENALTIES.ente
  },
  {
    id: 'amago', nome: 'Âmago', foco: 'das estatísticas', especial: 'Desbloqueio de Estatísticas Ocultas',
    descricao: 'Seu foco é no aprimoramento de status. Melhora os talentos e limites das estatísticas. Permite transformar valor de estatísticas principais em estatísticas secundárias.',
    vantagens: [
      'Permite aprimorar o talento das estatísticas (apenas 6/6 vezes).',
      'Permite aprimorar o limite das estatísticas (apenas 12/12 vezes).',
      'Permite desbloquear até 0/10 estatísticas secretas.',
      'Permite transferir DRs (Dados Rolados) de uma estatística para outra do mesmo conjunto (Físico, Mental, Comunicação ou Sobrenatural).',
      'Adiciona +1d12 no valor de aparência da ficha.',
      'Permite definir o fator estético da aparência do indivíduo.',
      'Permite desbloquear a estatística de poder ou energia antecipadamente.'
    ],
    grupos: others('amago'), penalidade: PENALTIES.amago
  },
  {
    id: 'tracos', nome: 'Traços', foco: 'das características', especial: 'Geração Evolutiva',
    descricao: 'Seu foco é na adaptação e aprimoramento do indivíduo. Cria características baseadas nas principais necessidades do indivíduo.',
    vantagens: [
      'Permite a chance (de 1d20, com DT 20) de a cada teste para sobreviver, gerar uma característica (F~D) relacionada à solução deste teste.',
      'Permite forçar a geração (até 3/3 vezes) de uma “Característica de Solução”.',
      'Permite desfazer (até 20/20 vezes) uma característica de até um Rank acima do indivíduo.',
      'Permite criar uma característica inicial de Rank E.',
      'Permite executar a mecânica de duplo avanço.',
      'Diminui em 20% os consumos dos descansos.',
      'Permite a obtenção de qualquer elemento.'
    ],
    grupos: others('tracos'), penalidade: PENALTIES.tracos
  },
  {
    id: 'justo', nome: 'Justo', foco: 'do equilíbrio', especial: 'Vantagens de outros arquétipos com penalidades reduzidas',
    descricao: 'Não possui um foco específico. É possível explorar e evoluir em qualquer aspecto da ficha. É a exceção à regra: escolher Justo não gera desvantagens para nenhum dos outros arquétipos.',
    vantagens: [
      'Permite adquirir mais 1 espaço de perícia e adicionar mais 1 por avanço.',
      'Ganha 5 pontos evolutivos a cada avanço.',
      'Permite em até 3/3 vezes cancelar a obtenção de classes ou sub-classes por 1 semana.',
      'Permite escolher uma classe ou sub-classe (especial) a cada despertar.',
      'Permite sentir a presença de Entidades Elevadas.',
      'Permite adicionar mais um “Elemento Etéreo” comum (Fogo, Água, Vento e Terra) à ficha.',
      'Permite definir o fator estético da aparência do indivíduo.',
      'Permite a obtenção de qualquer elemento natural.'
    ],
    grupos: [
      { de: 'Ramo', regras: ['Adiciona mais 1 requisito para obtenção de todas as classes e sub-classes.', 'Sub-Classes passam a ganhar apenas 1 habilidade por Evolução.', 'Habilidades podem evoluir apenas duas vezes.'] },
      { de: 'Adepto', regras: ['Entidades Elevadas podem forçar uma ligação com o indivíduo.', 'Torna-se obrigatório o processo de conversão de energia para utilizar os poderes de uma entidade vinculada.'] },
      { de: 'Ente', regras: ['Estatísticas de Poder e Energia não podem ser aprimoradas antes do desbloqueio.', 'Todos os “Elementos Etérios” começam com 0,1 de porcentagem elemental.'] },
      { de: 'Âmago', regras: ['Torna-se dependente de sua herança genética.', 'Permite desbloquear apenas 0/3 estatísticas, sejam comuns ou secretas.'] },
      { de: 'Traços', regras: ['Adquire 1 característica negativa ao nascer.', 'Características negativas têm uma probabilidade muito baixa de evoluir.'] }
    ],
    penalidade: []
  },
  {
    id: 'tales', nome: 'Tales', foco: 'do talento', especial: 'Talentomania',
    descricao: 'Seu foco é o entendimento e coleta de talentos. Pode evoluir talentos e consegue solicitar ou oferecer um talento. Carrega as desvantagens de todos os arquétipos.',
    vantagens: [
      'Permite solicitar talentos de outros seres até 25/25 vezes.',
      'Permite oferecer seus talentos a outros seres por contato físico.',
      'Começa com 5 espaços de talentos vazios.',
      'Ganha +1 espaço de talento por avanço e ascensão.',
      'Permite compreender os talentos e arquétipos dos seres a partir de contato físico ou sobrenatural.',
      'Permite até 3/3 vezes evoluir um talento.',
      'Ganha +1 chance de evoluir talento a cada avanço.',
      'Permite ter até 0/1 vantagens de um arquétipo como talento.',
      'Permite solicitar uma vantagem aleatória do arquétipo de alguém como talento.'
    ],
    grupos: from(MAIN_ORDER), penalidade: []
  }
];

export const ARCHETYPES: readonly RpgArchetype[] = SOURCES.map(source => ({
  ...source, desvantagens: source.grupos.flatMap(group => group.regras)
}));

export const ARCHETYPE_INTRO = 'O arquétipo são “Áreas de Atuação” que determinam como a ficha irá evoluir; cada escolha carrega seus pontos fortes e suas deficiências. São seis arquétipos — Ramo, Adepto, Ente, Âmago, Traços e Justo — além de Tales, o arquétipo do talento. Quando um arquétipo é escolhido, os outros são enfraquecidos: suas desvantagens são as penalidades dos caminhos não escolhidos. A exceção é o Justo, que não gera desvantagens para nenhum dos outros.';
