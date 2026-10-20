/** Livro de Regras: conteúdo transcrito da Ficha Existus (explicação) e do Livro de Regras do mestre.
 * Os textos são consulta; o site não aplica estas regras sozinho à ficha.
 * Nos textos, **assim** fica em negrito.
 */

export type RuleBlock =
  | { t: 'p'; text: string }
  | { t: 'nota'; text: string }
  | { t: 'lista'; items: string[]; titulo?: string; tom?: 'bom' | 'ruim' }
  | { t: 'termos'; items: [string, string][] }
  | { t: 'tabela'; caption: string; head: string[]; rows: string[][] }
  | { t: 'tags'; titulo?: string; items: string[] }
  | { t: 'formulas'; items: [string, string][] };

export interface RuleSection { id: string; titulo: string; blocos: RuleBlock[] }
export interface RuleChapter { id: string; numeral: string; titulo: string; resumo: string; secoes: RuleSection[] }

// ───────────── Idade ─────────────

export type PhaseMark = '+' | '~' | '-';
export interface LifePhase { ate: number; anos: string; estado: string; defesas: PhaseMark; recuperacao: PhaseMark; status: PhaseMark }

/** Fases da vida em % do tempo de vida (exemplo humano, ~100 anos). `ate` é o limite superior em %. */
export const LIFE_PHASES: readonly LifePhase[] = [
  { ate: 2, anos: '0~2% (2 anos)', estado: 'Nascimento', defesas: '-', recuperacao: '+', status: '-' },
  { ate: 5, anos: '3~5% (5 anos)', estado: 'Maturação', defesas: '-', recuperacao: '+', status: '-' },
  { ate: 10, anos: '6~10% (10 anos)', estado: 'Infância', defesas: '~', recuperacao: '+', status: '~' },
  { ate: 17, anos: '11~17% (17 anos)', estado: 'Adolescência', defesas: '~', recuperacao: '+', status: '~' },
  { ate: 24, anos: '18~24% (24 anos)', estado: 'Adultização', defesas: '+', recuperacao: '+', status: '+' },
  { ate: 35, anos: '25~35% (35 anos)', estado: 'Amadurecimento', defesas: '+', recuperacao: '+', status: '+' },
  { ate: 50, anos: '36~50% (50 anos)', estado: 'Adulto', defesas: '~', recuperacao: '~', status: '~' },
  { ate: 75, anos: '51~75% (75 anos)', estado: 'Envelhecimento', defesas: '~', recuperacao: '~', status: '~' },
  { ate: 100, anos: '76~100% (100 anos)', estado: 'Velhice', defesas: '-', recuperacao: '-', status: '-' },
  { ate: Infinity, anos: '+100% (+100 anos)', estado: 'Definhação', defesas: '-', recuperacao: '-', status: '-' }
];
export const HUMAN_LIFESPAN = 100;

export const PHASE_EFFECTS: Record<'defesas' | 'recuperacao' | 'status', { nome: string; efeitos: Record<PhaseMark, string> }> = {
  defesas: {
    nome: 'Defesas',
    efeitos: {
      '+': 'O ser adquire a característica destacável “Imunidade Absoluta (F~S)”: 1% (+1% por Rank) de todos os danos direcionados ao ser são anulados e a defesa geral aumenta em 2,5% (+1,25% por Rank) dos modificadores de constituição e poder natural.',
      '~': 'O ser é impossibilitado de alterar, em um curto período de tempo, suas defesas naturais em mais que 500 unidades ou 25%.',
      '-': 'O ser adquire a característica temporária “Vulnerabilidade Absoluta (A)”: todos os tipos de danos são aumentados em 50%.'
    }
  },
  recuperacao: {
    nome: 'Recuperação',
    efeitos: {
      '+': 'Aumento de 4% / 1% / 0,2% em Fadiga / Energia / Vida para todos os descansos. Todos os efeitos de cura externa são amplificados em 10%.',
      '~': 'Impede que recuperações sejam completamente perdidas: quando interrompidas sofrem uma redução de 75%, e quando impedidas reduzem em 90%.',
      '-': 'Todos os efeitos de recuperação, descansos, curas… têm sua eficiência reduzida em 50%.'
    }
  },
  status: {
    nome: 'Status',
    efeitos: {
      '+': 'O “Valor Diário” pode ser alocado em qualquer estatística que tenha sido elevada (Desbloqueio, Quebra, Além ou Conquistada).',
      '~': 'O “Valor Diário” não sofre alterações externas, positivas ou negativas, e pode ser alocado em qualquer estatística natural (não elevada).',
      '-': 'O “Valor Diário” passa a ser negativado e é dobrado, retirando valor de um status natural aleatório a cada descanso longo.'
    }
  }
};
export const PHASE_MARK_LABEL: Record<PhaseMark, string> = { '+': 'Vantagem', '~': 'Neutro', '-': 'Desvantagem' };

/** Fase da vida para uma idade, em anos, numa escala de tempo de vida (padrão humano). */
export function lifePhase(idade: number | null, lifespan = HUMAN_LIFESPAN): (LifePhase & { pct: number }) | null {
  if (idade === null || !Number.isFinite(idade) || idade < 0 || !(lifespan > 0)) return null;
  const pct = (idade / lifespan) * 100;
  const phase = LIFE_PHASES.find(p => pct <= p.ate) ?? LIFE_PHASES[LIFE_PHASES.length - 1];
  return { ...phase, pct };
}

// ───────────── Aparência ─────────────

export const APPEARANCE_TABLES: { id: string; titulo: string; regra: string; itens: [string, string][] }[] = [
  {
    id: 'estetica', titulo: 'Estética', regra: 'Rolar 1d6',
    itens: [['Bonito', 'Beleza e Atração'], ['Feio', 'Desprezo e Medo'], ['Exótico', 'Beleza e Desprezo'], ['Encantador', 'Atração e Neutro'], ['Macabro', 'Medo e Neutro'], ['Mediano', 'Desprezo e Neutro']]
  },
  {
    id: 'impacto', titulo: 'Impacto Emocional', regra: 'Escolha 2',
    itens: [['Acolhedor', 'Conforto e Confiança'], ['Imponente', 'Confiança e Dominante'], ['Fascinante', 'Atração e Curiosidade'], ['Caótico', 'Desconforto e Agressivo'], ['Assustador', 'Medo e Tristeza'], ['Provocador', 'Agressivo e Atração'], ['Intimidante', 'Dominante e Medo'], ['Misterioso', 'Ocultação e Desconforto'], ['Observador', 'Curiosidade e Conforto'], ['Opaco', 'Tristeza e Ocultação']]
  },
  {
    id: 'estilo', titulo: 'Estilo Visual', regra: 'Valor de Aparência',
    itens: [['Elegante', 'Atração e Beleza'], ['Desleixado', 'Desprezo e Medo'], ['Rústico', 'Beleza e Desprezo'], ['Exagerado', 'Medo e Atração'], ['Minimalista', 'Neutro']]
  },
  {
    id: 'presenca', titulo: 'Presença', regra: 'Efeitos',
    itens: [['Sombrio', 'Desconforto e Medo'], ['Radiante', 'Confiança e Atração'], ['Frio', 'Tristeza e Dominante'], ['Caloroso', 'Conforto e Confiança'], ['Confuso', 'Curiosidade e Agressivo'], ['Sereno', 'Ocultação e Curiosidade']]
  },
  {
    id: 'caracteristicas', titulo: 'Características', regra: 'Traços',
    itens: [['Marcante', 'traços fortes'], ['Delicado', 'traços suaves'], ['Robusto', 'estrutura forte'], ['Frágil', 'estrutura leve'], ['Equilibrado', 'traços e estrutura comum']]
  }
];

// ───────────── Pilares ─────────────

export const PILLARS = [
  { id: 'espada', nome: 'Pilar do Armamento', alias: 'Espada', tipo: 'duplo', entidades: ['Original', 'Derivação'] },
  { id: 'aura', nome: 'Pilar do Aprimoramento', alias: 'Aura', tipo: 'único', entidades: ['Ordeu Ciriza (Aura Original)', 'Uedro', 'Ignir', 'Aziric', '— (Mana?)', '— (Aura?)', 'Natureza', 'Vermondy'] },
  { id: 'mana', nome: 'Pilar da Magia', alias: 'Mana', tipo: 'duplo', entidades: ['Original', 'Parceira', 'Parceira'] },
  { id: 'reliquias', nome: 'Pilar das Relíquias', alias: 'Espírito', tipo: 'a definir', entidades: [] }
] as const;

/** Sugestões para o campo Pilar da ficha */
export const PILLAR_SUGGESTIONS: string[] = [
  'Espada · Original', 'Espada · Derivação',
  'Aura · Ignir', 'Aura · Natureza', 'Aura · Aziric', 'Aura · Vermondy', 'Aura · Uedro',
  'Mana · Original', 'Mana · Parceira', 'Relíquias · Espírito',
  'Rei Demônio', 'Rei Elemental', 'Santidade', 'Apóstolo de Pilar', 'Herói', 'Pilar Menor', 'Deus', 'Imperador'
];

export const DERIVED_WEAPON_SLOTS = [5, 10, 25, 40, 65, 80, 90];
/** Espaços de armamento derivado para uma porcentagem elemental */
export const derivedWeaponSlots = (pct: number): number => DERIVED_WEAPON_SLOTS.filter(limit => pct >= limit).length;

// ───────────── Classes ─────────────

export interface ClassRank {
  id: string; nome: string; plural: string; evolucoes: string; escala: string; crescimento: string; descricao: string;
  inicio?: string[]; classes: string[]; nota?: string;
}

const COMMON_CLASSES = [
  'Investigador', 'Armadilheiro', 'Juiz', 'Lutie', 'Palhaço', 'Cientista', 'Relojoeiro', 'Joalheiro', 'Espião', 'Assassino',
  'Mercenário', 'Médico', 'Atendente', 'Entregador', 'Domador', 'Cartógrafo', 'Cozinheiro', 'Lenhador', 'Pescador', 'Zelador',
  'Lanceiro', 'Arqueiro', 'Caçador', 'Mineiro', 'Construtor', 'Ferreiro', 'Barqueiro', 'Herbalista', 'Besteiro', 'Artista',
  'Músico', 'Bardo', 'Ladino', 'Bibliotecário', 'Pesquisador', 'Mercador', 'Escriba', 'Pintor', 'Escultor', 'Soldado',
  'Traficante', 'Cortador de Gelo', 'Monge', 'Provocador', 'Espadachim', 'Berserker', 'Alquimista', 'Trabalhador', 'Líder', 'Vidente',
  'Avaliador', 'Caçador de Demônios', 'Dobrador Elemental', 'Invocador Espiritual', 'Gladiador', 'Bárbaro', 'Aventureiro', 'Cavaleiro', 'Atirador', 'Invocador',
  'Guerreiro', 'Escudeiro', 'Batedor', 'Curandeiro', 'Artesão', 'Arremessador', 'Ladrão'
];
const RARE_CLASSES = ['Cartomante', 'Executor', 'Clérigo', 'Ocultista', 'Mago', 'Feiticeiro', 'Vozmander', 'Devoto', 'Usuário de Artefato', 'Seguidor do Sol', 'Xamã', 'Nobre', 'Príncipe'];
const ADVANCE_NOTE = 'A evolução só ocorre durante um avanço e, para a evolução acontecer, os requisitos de evolução da classe precisam ser concluídos antes do avanço.';

export const CLASS_RANKS: ClassRank[] = [
  {
    id: 'F', nome: 'Comum', plural: 'Comuns', evolucoes: '1', escala: 'Baixo efeito e boa versatilidade (ou bom efeito e pouca versatilidade)', crescimento: 'Trabalho geral da região',
    descricao: 'Classes comumente atreladas a trabalhos gerais de suas regiões de origem. Algumas se tornam impossíveis de adquirir dependendo da região. Possuem apenas **uma evolução**, comumente para “melhoria” ou “variação” de sua função original.',
    inicio: ['Começa com todas as habilidades no comum (F) e possui 0/3 usos de evolução para habilidades.', 'Começa com a classe no comum (F) e pode aprimorá-la (+) ou evoluí-la (F→E), apenas 1 vez.'],
    classes: COMMON_CLASSES, nota: ADVANCE_NOTE
  },
  {
    id: 'E', nome: 'Incomum', plural: 'Incomuns', evolucoes: '2', escala: 'Eficiência da função: melhorias consideráveis de efeito ou versatilidade', crescimento: 'Função de maior domínio na área',
    descricao: 'Classes que podem ser consideradas uma função ao contrário de um trabalho. Possuem fatores de obtenção mais difíceis ou específicos e **duas evoluções** para funções de maior domínio dentro de sua área de origem.',
    inicio: ['Começa com 2 habilidades no comum (F), uma no incomum (E) e possui 0/3 usos de evolução para habilidades.', 'Começa com a classe no comum (F) e pode aprimorá-la (+) e evoluí-la (F→E), apenas 1 vez.'],
    classes: COMMON_CLASSES, nota: ADVANCE_NOTE
  },
  {
    id: 'D', nome: 'Rara', plural: 'Raras', evolucoes: '1', escala: 'Ligada diretamente à entidade vinculada', crescimento: 'Limitado pela entidade vinculada',
    descricao: 'Classes em sua maioria vinculadas a entidades superiores de forma direta ou indireta. Seu fator de evolução é limitado pela entidade vinculada. Possuem apenas **uma evolução**.',
    classes: RARE_CLASSES, nota: ADVANCE_NOTE
  },
  {
    id: 'C', nome: 'Elite', plural: 'Elites', evolucoes: '2', escala: 'Ligada à quantidade de vínculos', crescimento: 'Quantidade de vínculos estabelecidos',
    descricao: 'Classes em sua maioria sobre conexões e vínculos, normalmente ligadas à fama do indivíduo. Seu fator de evolução está ligado à quantidade de vínculos estabelecidos. Possuem **duas evoluções**.',
    classes: RARE_CLASSES, nota: ADVANCE_NOTE
  },
  {
    id: 'B', nome: 'Lenda', plural: 'Lendas', evolucoes: '2 a 4', escala: 'Ligada diretamente à sua história', crescimento: 'Conquistas',
    descricao: 'Classes atreladas a histórias e mitos comumente inacreditáveis. Seu fator evolutivo está ligado a conquistas. Possuem de **duas a quatro evoluções**, que podem estar ligadas às suas histórias de origem. Estão ligadas à quantidade de feitos e seres que acreditam nelas; podem ser de escala regional ou global.',
    classes: ['Descendente de Pagma', 'Caçador de Demônios'],
    nota: 'As evoluções de classes lendárias podem ocorrer fora de avanços, imediatamente ao cumprir os requisitos de evolução.'
  },
  {
    id: 'A', nome: 'Milagre', plural: 'Milagres', evolucoes: '1 (torna-se Divina)', escala: 'Quase ilimitada para entidades reais (abaixo do Rank S)', crescimento: 'Necessidade do Mundo',
    descricao: 'Classes comuns elevadas além do limite da sua original, consideradas classes **“únicas”**: apenas um indivíduo nos mundos pode possuí-la por vez. Possuem apenas uma evolução, que as transforma em “Classes Divinas”. Nascem da necessidade do mundo por mudanças globais ou multiversais; portadores de classes Lendárias podem se tornar portadores de classe Milagre por interferência do Mundo ou de Entidades Absolutas.',
    classes: [
      'Santo da (Espada, Arco, Alabarda, Punhos, Adaga, Grimório, Ferraria, Construção…)',
      'Herói (Humana, Demoníaca, Celestial, Bestial, Vazia…)',
      'Santidade (Humana, Demoníaca, Celestial, Bestial, Vazia…)',
      'Rei Demônio (Herdeiro dos 33 Tronos)',
      'Pecado Capital (Soberba, Avareza, Inveja, Ira, Luxúria, Gula e Preguiça)',
      'Fonteine (Fogo, Terra, Água, Vento…)'
    ],
    nota: 'A maioria dos seres que obtiveram classes milagrosas fizeram, de forma não intencional, classes lendárias a partir de suas histórias e conquistas.'
  },
  {
    id: 'S', nome: 'Divino', plural: 'Divinos', evolucoes: '—', escala: 'Seres elevados', crescimento: 'Transcendência',
    descricao: 'Classes pertencentes a seres elevados ou que transcenderam os limites de suas classes.',
    classes: ['Quebra Mundos', 'Dragon Slayer', 'Asura', 'Criador de Masmorras']
  }
];

/** Nomes de classe para sugestão na ficha (sem repetir) */
export const CLASS_SUGGESTIONS: string[] = [...new Set(CLASS_RANKS.flatMap(rank => rank.classes.map(name => name.replace(/\s*\(.*\)$/, ''))))];

// ───────────── Capítulos ─────────────

export const RULEBOOK: RuleChapter[] = [
  {
    id: 'ficha', numeral: 'I', titulo: 'Ficha Existus', resumo: 'Como ler a descrição do personagem: idade, raça, corpo e aparência.',
    secoes: [
      {
        id: 'descricao', titulo: 'Descrição',
        blocos: [
          { t: 'p', text: 'A descrição é a “Visualização” dos outros sobre o indivíduo: **Nome, Idade, Sexo, Raça, Altura, Peso, Pele, Cabelo, Olhos, Extra e Aparência**. Quando a descrição é estabelecida, ela passa a ser usada como uma das métricas para discernir níveis da personalidade ou até metagame dentro do jogo.' }
        ]
      },
      {
        id: 'nome', titulo: 'Nome e Existência',
        blocos: [
          { t: 'p', text: 'O **Nome** não é um ponto relevante até o desbloqueio da estatística de **Existência**. Quando um indivíduo com existência pronuncia o nome de outro com existência, esses seres são notificados dessa ação, de diversas formas diferentes, podendo até interferir ou atacar com isso.' },
          { t: 'nota', text: 'As mecânicas de maldições e votos são fortemente vinculadas ao fator existencial de cada ser.' }
        ]
      },
      {
        id: 'idade', titulo: 'Idade',
        blocos: [
          { t: 'p', text: 'A **Idade** determina quantos pontos de status serão disponibilizados para alteração de modificadores, recuperações por descansos, ganho e perda de estatísticas diárias e o período da idade. Cada raça tem uma métrica de tempo de vida diferente, mas uma mecânica vale para todas: **“Tempo de Vida por Eficiência”**.' },
          { t: 'nota', text: 'A idade máxima de um indivíduo está vinculada à estatística de constituição, características e observações diárias.' },
          { t: 'tabela', caption: 'Exemplo humano (até ~100 anos)', head: ['Idade', 'Estado', 'Defesas', 'Recuperação', 'Status'], rows: LIFE_PHASES.map(p => [p.anos, p.estado, ...[p.defesas, p.recuperacao, p.status].map(m => `${m === '-' ? '−' : m} ${PHASE_MARK_LABEL[m]}`)]) },
          { t: 'p', text: 'Usos: **−** (5) / **+** (5) / **~** (5). Em cada fase, o sinal indica Vantagem (+), Neutro (~) ou Desvantagem (−).' },
          ...(['defesas', 'recuperacao', 'status'] as const).map((key): RuleBlock => ({
            t: 'termos', items: (['+', '~', '-'] as PhaseMark[]).map(mark => [`${PHASE_EFFECTS[key].nome} (${mark}) · ${PHASE_MARK_LABEL[mark]}`, PHASE_EFFECTS[key].efeitos[mark]] as [string, string])
          }))
        ]
      },
      {
        id: 'sexo', titulo: 'Sexo',
        blocos: [{ t: 'p', text: 'Usado principalmente para definir o sexo (masculino, feminino e intersexo) e a preferência sexual (heterossexual, homossexual, bissexual, pansexual e assexual). O gênero do indivíduo pode ser citado aqui, caso necessário.' }]
      },
      {
        id: 'raca', titulo: 'Raça',
        blocos: [
          { t: 'p', text: 'A **Raça** é um dos fatores mais importantes da ficha: dita a explicação de estatística do estado atual e pode influenciar no ganho ou desbloqueio de estatísticas específicas. É determinada por dois fatores:' },
          { t: 'termos', items: [['Espécie', 'Determina características específicas de cada indivíduo (elfo negro, lebre montanhosa, grifo de coroa, hidra titânica, goblin cinza…).'], ['Classificação', 'Usada como base para a explicação do estado atual (humano, animal, besta, monstro, vampiro, demônio…).']] },
          { t: 'formulas', items: [['Vida (Lobo)', '[(ModConst + 15) * 3] + 40'], ['Energia (Lobo)', '[(ModEner + 10) * 1] + 20'], ['Fadiga (Lobo)', '[(ModConst + ModVont + 20) * 2] + 60'], ['Psicológico (Lobo)', '[(ModVont + 5) * 1] + 30'], ['Dano C. (Lobo)', '(Arma + ModForça + 1) * Críticos']] },
          { t: 'nota', text: 'Exemplo de Lobo (classificação animal). As fórmulas de cada classificação substituem as fórmulas gerais da ficha.' }
        ]
      },
      {
        id: 'corpo', titulo: 'Altura, Peso, Pele, Cabelo, Olhos e Extra',
        blocos: [
          { t: 'termos', items: [
            ['Altura', 'Mede a dimensão do indivíduo no espaço (pode ser só a vertical). As dimensões do ser podem afetar sua locomoção por “movimentos” executados de uma “ação física”.'],
            ['Peso', 'Avaliação do peso do indivíduo em relação à gravidade ambiente, mais os itens e recursos equipados ou carregados. Pode afetar a locomoção por “movimentos” de uma “ação física”.'],
            ['Pele, Cabelo, Olhos e Extra', 'Usados de modo estético e descritivo caso o indivíduo tenha características marcantes.']
          ] }
        ]
      },
      {
        id: 'aparencia', titulo: 'Aparência',
        blocos: [
          { t: 'p', text: 'A **Aparência** é um dos fatores mais importantes para um combatente comunicativo. Cada traço anterior pode determinar diferentes tipos de aparência, e cada um pode ser quantificado e classificado.' },
          ...APPEARANCE_TABLES.map((table): RuleBlock => ({ t: 'tabela', caption: `${table.titulo} (${table.regra})`, head: [table.titulo, 'Efeito'], rows: table.itens.map(([a, b]) => [a, b]) })),
          { t: 'formulas', items: [
            ['Aparência (Adicionais) [Tipo]', '2d6 (+?) [Exótico, Acolhedor, Elegante…]'],
            ['Efeito Externo', '(Aparência + ModLábia) * Críticos'],
            ['Efeito Interno', '(Aparência + ModCharme) * Críticos'],
            ['Auxílio e Distração', '[Aparência + (ModCharme + ModLábia) / 2] * Críticos'],
            ['Zombaria', '(Auxílio ou Distração ou Efeito) / 100 = Dano no Psicológico']
          ] }
        ]
      }
    ]
  },
  {
    id: 'pilares', numeral: 'II', titulo: 'Pilares', resumo: 'Entidades de vinculação: Espada, Aura, Mana e Relíquias.',
    secoes: [
      {
        id: 'pilar', titulo: 'O que é um Pilar',
        blocos: [
          { t: 'p', text: 'Os pilares são **“Entidades de Vinculação”** que oferecem sua Existência a outros indivíduos, permitindo que eles utilizem as capacidades ou poderes que elas mesmas criaram. De acordo com a entidade vinculada, o indivíduo pode receber mais ou menos de sua existência.' },
          { t: 'termos', items: [['Regente', 'Quando a semelhança entre o indivíduo e a entidade alcança **25%**.'], ['Apóstolo', 'O regente aceito pela entidade; pode representar sua entidade em KalLuniA.']] },
          { t: 'p', text: 'Entre milhares de entidades vinculantes, quatro se destacam pela “facilidade” de obtenção e versatilidade:' },
          { t: 'tabela', caption: 'Os quatro pilares', head: ['Pilar', 'Chamado', 'Tipo', 'Entidades'], rows: PILLARS.map(p => [p.nome, p.alias, p.tipo, p.entidades.length ? p.entidades.join(', ') : 'a definir']) },
          { t: 'nota', text: 'Outras entidades comumente vinculadas: Reis Demônio, Reis Elementais, Santidades, Apóstolos de Pilar, Heróis, Pilares Menores, Deuses, Imperadores…' }
        ]
      },
      {
        id: 'espada', titulo: 'Espada · Pilar do Armamento',
        blocos: [
          { t: 'p', text: 'Pilar **“duplo”**, com duas entidades de vinculação: uma “Original” e outra “Derivação”. Dependendo do método de obtenção, é possível adquirir as capacidades originais do pilar ou sua derivação.' },
          { t: 'termos', items: [['Ritual', 'O indivíduo cria dois círculos conectados por uma linha: num fica o indivíduo, no outro o sacrifício. Círculos e linha devem ser feitos da essência vital do usuário (sangue, ossos ou carne). Depois, insere-se no sistema energia equivalente ao “Valor” do sacrifício.'], ['Falha', 'Se a energia for insuficiente, corrompida, degradada, infectada ou adulterada, recursos e sacrifícios são consumidos e o ritual é concluído, mas o armamento obtido é de proporções inferiores ao valor do sacrifício.']] },
          { t: 'nota', text: 'Se nem todos os processos envolverem diretamente o usuário (Ritual, Energia e Sacrifício), o aspecto obtido pelo pilar será o derivado.' },
          { t: 'p', text: '**Armamentos Originais** começam no estado mais primitivo e mudam de forma para atender às necessidades do portador. Evoluem de forma “infinita” acompanhando o portador, sem precisar de recursos — mas, quando fornecidos, mostram resultados significativos a curto e longo prazo.' },
          { t: 'termos', items: [
            ['Molde', 'O armamento muda de forma livremente. Cada mudança leva de cinco a quatorze dias, conforme complexidade ou tamanho.'],
            ['Forja', 'Após a primeira evolução. O armamento ganha aprimoramentos e habilidades específicas a cada avanço, priorizando a necessidade do portador. Se o portador fornecer existência, obtém-se uma habilidade passiva proporcional à existência fornecida.'],
            ['Ascensão', 'Quando ocorre uma transcendência: o armamento obtém consciência própria e pode compartilhar existência livremente com o portador…']
          ] },
          { t: 'nota', text: 'Dependendo dos sentimentos, vontades, desejos e sacrifícios escolhidos durante o ritual, o portador pode “perecer” e se tornar um armamento.' },
          { t: 'p', text: '**Armamentos Derivados** são pré-forjados, descartados, destruídos ou abandonados por outros usuários de armamentos originais. Suas melhorias não podem ser guiadas e podem ocorrer defeitos nas evoluções. Destacam-se pela variedade e pela quantidade que o usuário pode portar.' },
          { t: 'tabela', caption: 'Espaços de armamento derivado por porcentagem elemental', head: ['Porcentagem elemental', ...DERIVED_WEAPON_SLOTS.map(v => `${v}%`)], rows: [['Espaços', ...DERIVED_WEAPON_SLOTS.map((_, i) => String(i + 1))]] }
        ]
      },
      {
        id: 'aura', titulo: 'Aura · Pilar do Aprimoramento',
        blocos: [
          { t: 'p', text: 'Pilar **“único”**, com sete entidades de vinculação: uma “Original” e as outras “Sósias”. Conforme as ações e escolhas tomadas durante o uso e criação dos aprimoramentos, quando reconhecido pelo pilar, um **“aspecto”** é fornecido ao indivíduo.' },
          { t: 'p', text: 'O indivíduo deve adquirir **“Conquistas”** referentes a esforços reais: quanto maior a dificuldade e o Rank, maior a probabilidade de obter o reconhecimento da “Natureza e Aura”.' },
          { t: 'nota', text: 'Quando a Aura é obtida a partir dos sósias Natureza, Mana, Ignir ou Vermondy, torna-se quase impossível obter um aspecto.' },
          { t: 'p', text: '**Perguntas** são os métodos de obtenção dos aprimoramentos de Aura — “guias” para o real aprimoramento. São seis perguntas, de três tipos, duas de cada em sequência. Os aprimoramentos podem evoluir por Feitos ou Existência; quanto maior o Rank, maior a grandeza ou custo para evoluir.' },
          { t: 'tabela', caption: 'As três perguntas', head: ['Pergunta', 'Afeta', 'Categorias'], rows: [
            ['O que mudaria no seu Corpo?', 'Apenas e diretamente o indivíduo', 'Interno · Externo · Imaginário'],
            ['O que mudaria no seu Ser?', 'O indivíduo', 'Contato · Direcional · Campo'],
            ['O que mudaria no Ambiente?', 'A área ao redor do usuário', 'Terreno · Construto · Condição']
          ] },
          { t: 'nota', text: 'Não é necessário responder à pergunta para obter um aprimoramento.' },
          { t: 'p', text: '**Respostas** são os aprimoramentos oferecidos conforme a interpretação de cada sósia sobre a intenção do indivíduo. Cada sósia tem limitações e características; pode interpretar a intenção claramente ou ignorá-la por completo.' },
          { t: 'termos', items: [
            ['Uedro (O Cerberus do Inferno)', 'Não pode ser alcançado. Pode conceder a “Centelha do Caos”, para evoluir para “Aura Caótica”.'],
            ['Ignir (Rei Demônio das Três Chamas)', 'Tende a ignorar intenções fracas; respostas diretas e destrutivas.'],
            ['Aziric (O Novo Céu)', 'Não considera as intenções; respostas claras e definitivas. Pode conceder a “Centelha do Estado”, para evoluir para “Aura Estática”.'],
            ['— (Mana?)', 'Ignora intenções “tediosas”; respostas complexas e grandiosas.'],
            ['— (Aura?)', 'Considera as intenções de cada indivíduo; respostas criativas e ousadas. Pode conceder a “Centelha da Mudança”, para evoluir para “Aura Morfa”.'],
            ['Natureza (Mundo)', 'Tende a considerar a intenção, mas suas respostas possuem conceitos elementares.'],
            ['Ordeu Ciriza (Aura Original)', '“…deixou de existir…”'],
            ['Vermondy Bermérioldy Cardelhudy (Último Soldado de Ranadya)', 'Concede respostas incompletas propositalmente. Pode conceder a “Verdadeira Aura”.']
          ] },
          { t: 'nota', text: 'Os mais comuns de oferecer aura são Ignir e a Natureza. Outros, como O Cerberus e a Aura Original, nem podem ser interagidos.' }
        ]
      },
      {
        id: 'mana', titulo: 'Mana · Pilar da Magia',
        blocos: [
          { t: 'p', text: 'Pilar **“duplo”**, com três entidades de vinculação: uma “Original” e as outras “Parceiras”. Todas as formas de uso do pilar estão disponíveis independentemente da entidade vinculativa, mas fatores rúnicos são facilitados ou dificultados de acordo com o aspecto primário da entidade.' },
          { t: 'termos', items: [
            ['Runas', 'Os símbolos da magia. No ateliê de Círculos deste site, são as runas de elemento, ação, forma, alvo e apoio (veja o Grimório).'],
            ['Estrutura', 'Como a magia é montada. No ateliê: Selos Estruturais (Matriz, Círculo, Quadrado, Triângulo, Pentágono e Estrela) e as runas estruturais.'],
            ['Expressão', 'Como a magia se manifesta. No ateliê: forma, intenção e aparência do feitiço.']
          ] },
          { t: 'nota', text: 'Cada entidade vinculativa tem sua especialização e ramo. O ateliê de Círculos Mágicos deste site é a ferramenta do Pilar da Magia.' }
        ]
      },
      {
        id: 'reliquias', titulo: 'Relíquias · Pilar do Espírito',
        blocos: [{ t: 'p', text: 'Um dos quatro pilares de destaque. As regras deste pilar ainda não foram publicadas no livro.' }]
      }
    ]
  },
  {
    id: 'classes', numeral: 'III', titulo: 'Classes', resumo: 'Trabalhos e funções reconhecidos pelo mundo, do Rank F ao S.',
    secoes: [
      {
        id: 'classe', titulo: 'O que é uma Classe',
        blocos: [
          { t: 'p', text: 'Classes são **“Trabalhos ou Funções”** que outros indivíduos enxergam como algo especial: quando muitos têm uma consciência similar sobre um trabalho, ele se torna uma classe. Praticamente todas possuem habilidades especiais ligadas ao trabalho ou função de origem.' },
          { t: 'p', text: 'Dependendo da região, raça ou cultura, classes diferentes podem nascer em lugares e períodos específicos. Classes “limitadas” por fatores secundários normalmente têm condições de obtenção ligadas a quem as gerou: ser ou participar de uma raça, nacionalidade, genética local, ritos…' },
          { t: 'termos', items: [
            ['Aprimoramento (+)', 'A classe melhora sem mudar de função: todas as habilidades atuais e a passiva de classe recebem um aprimoramento que dobra todas as vantagens, sem aumentar as desvantagens.'],
            ['Evolução (→)', 'A classe melhora e muda de função: recebe mais habilidades, troca sua passiva pela da nova classe e dobra o limite de evoluções…']
          ] },
          { t: 'tabela', caption: 'Ranks de classe', head: ['Rank', 'Classe', 'Evoluções', 'Cresce por', 'Escala'], rows: CLASS_RANKS.map(r => [r.id, r.plural, r.evolucoes, r.crescimento, r.escala]) },
          { t: 'p', text: 'Comuns e incomuns ligam-se ao entendimento no subconsciente de quem acredita nelas (escala regional ou quase continental). Raras e elites ligam-se à quantidade de indivíduos que acreditam nelas (escala continental ou global).' }
        ]
      },
      ...CLASS_RANKS.map((rank): RuleSection => ({
        id: `rank-${rank.id.toLowerCase()}`, titulo: `${rank.plural} · Rank ${rank.id}`,
        blocos: [
          { t: 'p', text: rank.descricao },
          ...(rank.inicio ? [{ t: 'lista', items: rank.inicio } as RuleBlock] : []),
          ...(rank.id === 'E' || rank.id === 'C' ? [{ t: 'nota', text: `As classes deste rank compartilham a lista do Rank ${rank.id === 'E' ? 'F' : 'D'}.` } as RuleBlock] : [{ t: 'tags', titulo: rank.id === 'F' ? 'Classes Comuns (F) e Incomuns (E)' : rank.id === 'D' ? 'Classes Raras (D) e Elites (C)' : `Classes ${rank.plural} (${rank.id})`, items: rank.classes } as RuleBlock]),
          ...(rank.nota ? [{ t: 'nota', text: rank.nota } as RuleBlock] : [])
        ]
      }))
    ]
  }
];
