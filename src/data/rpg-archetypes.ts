/** Regras de arquétipo transcritas da referência de criação fornecida pelo mestre.
 * São textos de consulta; nenhuma vantagem ou desvantagem altera a ficha sozinha.
 */
export type ArchetypeId = '' | 'ramo' | 'adepto' | 'ente' | 'amago' | 'tracos' | 'justo' | 'tales';

export interface RpgArchetype {
  id: Exclude<ArchetypeId, ''>;
  nome: string;
  vantagens: string[];
  desvantagens: string[];
}

export const ARCHETYPES: readonly RpgArchetype[] = [
  {
    "id": "ramo",
    "nome": "Ramo",
    "vantagens": [
      "Permite ignorar 1 dos requisitos para obtenção de classe e sub-classe;",
      "Permite descartar uma classe durante um avanço, para ganhar existência e bloqueá-la permanentemente.",
      "Permite escolher uma entre três classes ou sub-classes (especial) a cada despertar;",
      "Permite fundir duas classes de mesmo rank (apenas 2/2 vezes) ou trocar três classes ou sub-classes de mesmo rank por uma “aleatória” de rank maior;",
      "Permite fundir duas habilidades de mesmo rank (apenas 4/4 vezes) ou trocar três habilidades de mesmo rank por uma “aleatória” de rank maior;",
      "Permite aumentar os efeitos de uma habilidade em 10% por uma vez a cada descanso longo concluído;",
      "Permite a obtenção de mais uma sub-classe na ficha;",
      "Permite em até 3 vezes a evolução de habilidades;"
    ],
    "desvantagens": [
      "Entidades Elevadas podem forçar uma ligação com o indivíduo.",
      "Torna-se obrigatório o processo de conversão de energia para utilizar os poderes de uma entidade vinculada.",
      "Interações diretas ou indiretas com Entidades Elevadas são dificultadas.",
      "Possibilita-se receber punições ou penalidades de uma Entidade Superior.",
      "Estatísticas de Poder e Energia não podem ser aprimoradas antes do desbloqueio.",
      "Impossibilita a utilização da mecânica de Proficiência Elemental.",
      "Torna-se obrigatório adquirir o primeiro elemento que for sorteado na “Roleta Elemental”.",
      "Todos os “Elementos Etérios” começam com 0,1 de porcentagem elemental.",
      "Torna-se dependente de sua herança genética.",
      "Permite desbloquear apenas 0/3 estatísticas, sejam comuns ou secretas.",
      "Bloqueia a estatística de Poder ou Energia permanentemente.",
      "DRs só são contabilizados a partir de 2 dados jogados em conjunto.",
      "Adquire 2 características negativas ao nascer.",
      "Características negativas podem ser enfraquecidas, mas não eliminadas.",
      "Características negativas têm uma probabilidade de se fundirem naturalmente.",
      "Características negativas têm uma probabilidade muito baixa de evoluir."
    ]
  },
  {
    "id": "adepto",
    "nome": "Adepto",
    "vantagens": [
      "Permite escolher ou recusar uma Entidade Elevada, durante todos os avanços;",
      "Permite converter a energia do usuário para a da entidade vinculada temporariamente, dobrando a energia atual do indivíduo, uma vez a cada 12 descansos longos;",
      "Permite estabelecer um vínculo mais profundo com sua Entidade Elevada, possibilitando virar um receptáculo de sua vontade por 6 segundos, uma vez a cada 24 descansos longos;",
      "Permite sentir a presença de Entidades Elevadas;",
      "Permite solicitar ajuda para Entidade Elevada vinculada;",
      "Permite que Entidades Elevadas interajam com o indivíduo de forma não direta;",
      "Permite se tornar um Pilar ao concluir sua transcendência."
    ],
    "desvantagens": [
      "Adiciona mais 2 requisitos para obtenção de todas as classes e sub-classes",
      "Cumprir com todos os requisitos de uma classe força sua obtenção imediata.",
      "Classes passam a ganhar apenas 2 habilidades por Evolução.",
      "Habilidades podem evoluir apenas uma vez.",
      "Estatísticas de Poder e Energia não podem ser aprimoradas antes do desbloqueio.",
      "Impossibilita a utilização da mecânica de Proficiência Elemental.",
      "Torna-se obrigatório adquirir o primeiro elemento que for sorteado na “Roleta Elemental”.",
      "Todos os “Elementos Etérios” começam com 0,1 de porcentagem elemental.",
      "Torna-se dependente de sua herança genética.",
      "Permite desbloquear apenas 0/3 estatísticas, sejam comuns ou secretas.",
      "Bloqueia a estatística de Poder ou Energia permanentemente.",
      "DRs só são contabilizados a partir de 2 dados jogados em conjunto.",
      "Adquire 2 características negativas ao nascer.",
      "Características negativas podem ser enfraquecidas, mas não eliminadas.",
      "Características negativas têm uma probabilidade de se fundirem naturalmente.",
      "Características negativas têm uma probabilidade muito baixa de evoluir."
    ]
  },
  {
    "id": "ente",
    "nome": "Ente",
    "vantagens": [
      "Permite aprimorar as estatísticas de “Poder e Energia” antes de desbloqueá-las;",
      "Permite utilizar a mecânica de Proficiência Elemental;",
      "Permite trocar (apenas 5/5 vezes) o elemento escolhido pela “Roleta Elemental” durante a criação do indivíduo;",
      "Permite adicionar mais um “Elemento Etéreo” comum (Fogo, Água, Vento e Terra) à ficha;",
      "Permite evoluir (apenas 1/1 vez) um dos “Elementos Etérios” comuns da ficha;",
      "Permite executar uma rolagem de dados (1d4+1d6+1d8) para cada porcentagem “Elemental Etéria”;",
      "Permite transformar “Pontos Evolutivos” em habilidades de Rank E (evolução 6);"
    ],
    "desvantagens": [
      "Adiciona mais 2 requisitos para obtenção de todas as classes e sub-classes",
      "Cumprir com todos os requisitos de uma classe força sua obtenção imediata.",
      "Classes passam a ganhar apenas 2 habilidades por Evolução.",
      "Habilidades podem evoluir apenas uma vez.",
      "Entidades Elevadas podem forçar uma ligação com o indivíduo.",
      "Torna-se obrigatório o processo de conversão de energia para utilizar os poderes de uma entidade vinculada.",
      "Interações diretas ou indiretas com Entidades Elevadas são dificultadas.",
      "Possibilita-se receber punições ou penalidades de uma Entidade Superior.",
      "Torna-se dependente de sua herança genética.",
      "Permite desbloquear apenas 0/3 estatísticas, sejam comuns ou secretas.",
      "Bloqueia a estatística de Poder ou Energia permanentemente.",
      "DRs só são contabilizados a partir de 2 dados jogados em conjunto.",
      "Adquire 2 características negativas ao nascer.",
      "Características negativas podem ser enfraquecidas, mas não eliminadas.",
      "Características negativas têm uma probabilidade de se fundirem naturalmente.",
      "Características negativas têm uma probabilidade muito baixa de evoluir."
    ]
  },
  {
    "id": "amago",
    "nome": "Âmago",
    "vantagens": [
      "Permite aprimorar o talento das estatísticas (apenas 6/6 vezes);",
      "Permite aprimorar o limite das estatísticas (apenas 12/12 vezes);",
      "Permite desbloquear até 0/10 estatísticas secretas;",
      "Permite transferir DRs (Dados Rolados) de uma estatística para outra do mesmo conjunto (Físico, Mental, Comunicação ou Sobrenatural);",
      "Adicionar +1d12 no valor de aparência da ficha;",
      "Permite definir o fator estético da aparência do indivíduo;",
      "Permite desbloquear a estatística de poder ou energia antecipadamente;"
    ],
    "desvantagens": [
      "Adiciona mais 2 requisitos para obtenção de todas as classes e sub-classes",
      "Cumprir com todos os requisitos de uma classe força sua obtenção imediata.",
      "Classes passam a ganhar apenas 2 habilidades por Evolução.",
      "Habilidades podem evoluir apenas uma vez.",
      "Entidades Elevadas podem forçar uma ligação com o indivíduo.",
      "Torna-se obrigatório o processo de conversão de energia para utilizar os poderes de uma entidade vinculada.",
      "Interações diretas ou indiretas com Entidades Elevadas são dificultadas.",
      "Possibilita-se receber punições ou penalidades de uma Entidade Superior.",
      "Estatísticas de Poder e Energia não podem ser aprimoradas antes do desbloqueio.",
      "Impossibilita a utilização da mecânica de Proficiência Elemental.",
      "Torna-se obrigatório adquirir o primeiro elemento que for sorteado na “Roleta Elemental”.",
      "Todos os “Elementos Etérios” começam com 0,1 de porcentagem elemental.",
      "Adquire 2 características negativas ao nascer.",
      "Características negativas podem ser enfraquecidas, mas não eliminadas.",
      "Características negativas têm uma probabilidade de se fundirem naturalmente.",
      "Características negativas têm uma probabilidade muito baixa de evoluir."
    ]
  },
  {
    "id": "tracos",
    "nome": "Traços",
    "vantagens": [
      "Permite a chance (de 1d20, com DT 20) de a cada teste para sobreviver, gerar uma característica relacionada à solução deste teste;",
      "Permite forçar a geração (até 3/3 vezes) de uma “Característica de Solução”;",
      "Permite desfazer (até 20/20 vezes) uma característica de até um Rank acima do indivíduo;",
      "Permite criar uma característica inicial de Rank E;",
      "Permite executar a mecânica de duplo avanço;",
      "Diminui em 20% os consumos dos descansos",
      "Permite a obtenção de qualquer elemento;"
    ],
    "desvantagens": [
      "Adiciona mais 2 requisitos para obtenção de todas as classes e sub-classes",
      "Cumprir com todos os requisitos de uma classe força sua obtenção imediata.",
      "Classes passam a ganhar apenas 2 habilidades por Evolução.",
      "Habilidades podem evoluir apenas uma vez.",
      "Entidades Elevadas podem forçar uma ligação com o indivíduo.",
      "Torna-se obrigatório o processo de conversão de energia para utilizar os poderes de uma entidade vinculada.",
      "Interações diretas ou indiretas com Entidades Elevadas são dificultadas.",
      "Possibilita-se receber punições ou penalidades de uma Entidade Superior.",
      "Estatísticas de Poder e Energia não podem ser aprimoradas antes do desbloqueio.",
      "Impossibilita a utilização da mecânica de Proficiência Elemental.",
      "Torna-se obrigatório adquirir o primeiro elemento que for sorteado na “Roleta Elemental”.",
      "Todos os “Elementos Etérios” começam com 0,1 de porcentagem elemental.",
      "Torna-se dependente de sua herança genética.",
      "Permite desbloquear apenas 0/3 estatísticas, sejam comuns ou secretas.",
      "Bloqueia a estatística de Poder ou Energia permanentemente.",
      "DRs só são contabilizados a partir de 2 dados jogados em conjunto."
    ]
  },
  {
    "id": "justo",
    "nome": "Justo",
    "vantagens": [
      "Permite adquirir mais 1 espaço de perícia e adicionar mais 1 por avanço;",
      "Ganha 5 pontos evolutivos a cada cada avanço;",
      "Permite em até 3/3 vezes cancelar a obtenção de classes ou sub-classes por 1 semana;",
      "Permite escolher uma classes ou sub-classes (especial) a cada despertar;",
      "Permite sentir a presença de Entidades Elevadas;",
      "Permite adicionar mais um “Elemento Etéreo” comum (Fogo, Água, Vento e Terra) à ficha;",
      "Permite definir o fator estético da aparência do indivíduo;",
      "Permite a obtenção de qualquer elemento natural;"
    ],
    "desvantagens": [
      "Adiciona mais 1 requisito para obtenção de todas as classes e sub-classes",
      "Sub-Classes passam a ganhar apenas 1 habilidade por Evolução.",
      "Habilidades podem evoluir apenas duas vezes.",
      "Entidades Elevadas podem forçar uma ligação com o indivíduo.",
      "Torna-se obrigatório o processo de conversão de energia para utilizar os poderes de uma entidade vinculada.",
      "Estatísticas de Poder e Energia não podem ser aprimoradas antes do desbloqueio.",
      "Todos os “Elementos Etérios” começam com 0,1 de porcentagem elemental.",
      "Torna-se dependente de sua herança genética.",
      "Permite desbloquear apenas 0/3 estatísticas, sejam comuns ou secretas.",
      "Adquire 1 característica negativa ao nascer.",
      "Características negativas têm uma probabilidade muito baixa de evoluir."
    ]
  },
  {
    "id": "tales",
    "nome": "Tales",
    "vantagens": [
      "Permite solicitar talentos de outros seres até 25/25 vezes;",
      "Permite oferecer seus talentos a outros seres por contato físico;",
      "Começa com 5 espaços de talentos vazios;",
      "Ganha +1 espaço de talento por avanço e ascensão;",
      "Permite compreender os talentos dos seres a partir de contato físico ou sobrenatural;",
      "Permite até 3/3 vezes evoluir um talento;",
      "Ganha +1 chance de evoluir talento a cada avanço;",
      "Permite ter até 0/1 vantagens de um arquétipo como talento;",
      "Permite solicitar uma vantagem aleatória do arquétipo de alguém como talento;"
    ],
    "desvantagens": [
      "Adiciona mais 2 requisitos para obtenção de todas as classes e sub-classes",
      "Cumprir com todos os requisitos de uma classe força sua obtenção imediata.",
      "Classes passam a ganhar apenas 2 habilidades por Evolução.",
      "Habilidades podem evoluir apenas uma vez.",
      "Entidades Elevadas podem forçar uma ligação com o indivíduo.",
      "Torna-se obrigatório o processo de conversão de energia para utilizar os poderes de uma entidade vinculada.",
      "Interações diretas ou indiretas com Entidades Elevadas são dificultadas.",
      "Possibilita-se receber punições ou penalidades de uma Entidade Superior.",
      "Estatísticas de Poder e Energia não podem ser aprimoradas antes do desbloqueio.",
      "Impossibilita a utilização da mecânica de Proficiência Elemental.",
      "Torna-se obrigatório adquirir o primeiro elemento que for sorteado na “Roleta Elemental”.",
      "Todos os “Elementos Etérios” começam com 0,1 de porcentagem elemental.",
      "Torna-se dependente de sua herança genética.",
      "Permite desbloquear apenas 0/3 estatísticas, sejam comuns ou secretas.",
      "Bloqueia a estatística de Poder ou Energia permanentemente.",
      "DRs só são contabilizados a partir de 2 dados jogados em conjunto.",
      "Adquire 2 características negativas ao nascer.",
      "Características negativas podem ser enfraquecidas, mas não eliminadas.",
      "Características negativas têm uma probabilidade de se fundirem naturalmente.",
      "Características negativas têm uma probabilidade muito baixa de evoluir."
    ]
  }
];
