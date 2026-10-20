/** Raças (subpágina "Tipos" do Livro de Regras do mestre). Textos de consulta. */
import type { RuleBlock, RuleChapterSource, RuleSection } from './rulebook';

const trait = (nome: string, ...texto: string[]): [string, string] => [nome, texto.join(' ')];
const SUN = 'O sangue de todos os vampiros foi amaldiçoado pelo Sol após a morte de seu filho.';

/** Sugestões para o campo Raça da ficha */
export const RACE_SUGGESTIONS = [
  'Humano', 'Dríade', 'Anão', 'Druida', 'Goblin', 'Elfo', 'Tritão',
  'Vampiro · Dhampir (Sem Casa)', 'Vampiro · Constantino (Domingo)', 'Vampiro · Crepuscular (Segunda)',
  'Vampiro · Apoáclis (Terça)', 'Vampiro · Mercur (Quarta)', 'Vampiro · Caligular (Quinta)',
  'Vampiro · Tezcat (Sexta)', 'Vampiro · Venereus (Sábado)'
];

const house = (id: string, titulo: string, blocos: RuleBlock[]): RuleSection => ({ id, titulo, blocos });

export const RACES_CHAPTER: RuleChapterSource = {
  id: 'racas', titulo: 'Raças', resumo: 'Tipos de espécie: Dríades, Anões, Druidas e as casas de Vampiro.',
  secoes: [
    {
      id: 'tipos', titulo: 'Tipos de raça',
      blocos: [
        { t: 'p', text: 'Uma raça é **Espécie** + **Classificação** (veja Ficha Existus › Raça). Abaixo, as espécies já descritas no livro, com suas características e tendências de estatística.' },
        { t: 'tags', titulo: 'Ainda sem regras', items: ['Goblin', 'Elfo', 'Tritão'] }
      ]
    },
    {
      id: 'driades', titulo: 'Dríades',
      blocos: [
        { t: 'lista', items: [
          '**Pele verde** (característica): permite efetuar fotossíntese.',
          '**Fala verde** (característica): permite se comunicar com plantas.',
          '**Fator natural** (característica/estética): possui 3 traços distintos relacionados à natureza, como flores, cheiros e mudanças visuais como a cor do cabelo.',
          'Converte vida para durabilidade.',
          'Membros não podem ser curados, apenas reconstruídos, ao consumir durabilidade máxima.',
          'A regeneração de vida, fadiga e energia só pode ser efetuada durante a fotossíntese.',
          'É adicionado o elemento **natureza** à ficha.'
        ] },
        { t: 'termos', items: [['Estatísticas', 'Melhoria em Constituição; desvantagem em Vontade.']] },
        { t: 'nota', text: 'Dríades possuem infinitas variações, já que são parasitas que tomam a carne e o controle do hospedeiro.' }
      ]
    },
    {
      id: 'anao', titulo: 'Anão',
      blocos: [
        { t: 'lista', items: [
          'Possui uma altura limite de 1,5 m.',
          'Possui o elemento terra, metal ou fogo como base.',
          'Não possui desvantagens no uso de armas contundentes.',
          'Classes como ferreiro e guerreiro são facilitadas.',
          'Possui resistência a anormalidades físicas.'
        ] },
        { t: 'termos', items: [['Estatísticas', 'Vantagem em Destreza e Constituição; desvantagem em Lábia e Charme.']] },
        { t: 'tags', titulo: 'Variações (a descrever)', items: ['Ferreiro anão', 'Guerreiro', 'Construtor / Arquiteto'] }
      ]
    },
    {
      id: 'druida', titulo: 'Druida',
      blocos: [
        { t: 'lista', items: [
          'Só pode se alimentar de carne.',
          'Pode falar com os animais.',
          'Os fatores regenerativos são muito melhorados durante o consumo de carne.',
          'Possui 3 características animalescas, que influenciam o indivíduo diretamente.',
          'Seus instintos animais fazem com que se sinta desconfortável nas civilizações comuns.',
          'É adicionado o elemento **natureza** à ficha.'
        ] },
        { t: 'termos', items: [['Estatísticas', 'Melhoria em Força e Constituição; desvantagem em Destreza e Sabedoria.']] },
        { t: 'tags', titulo: 'Variações por região (a descrever)', items: ['Montanha', 'Mar', 'Deserto', 'Floresta', 'Geleiras', 'Cavernas'] }
      ]
    },
    {
      id: 'vampiro', titulo: 'Vampiro · regras das Casas',
      blocos: [
        { t: 'lista', items: [
          'É adicionado o elemento **sangue** à ficha.',
          'Essência vital torna-se a única forma de alimento.',
          'Fadiga e Vida são combinadas para formar a **Vitalidade**.'
        ] },
        { t: 'formulas', items: [['Vitalidade', '[(ModConst + 75) * 5] + 25']] },
        { t: 'tabela', caption: 'As casas', head: ['Casa', 'Dia', 'Linhagem'], rows: [
          ['Dhampir', '—', 'Sem Casa'], ['Constantino', 'Domingo', 'Casa de Domingo'], ['Crepuscular', 'Segunda', 'Casa de Segunda'],
          ['Apoáclis', 'Terça', 'Casa de Terça'], ['Mercur', 'Quarta', 'Casa de Quarta'], ['Caligular', 'Quinta', 'Casa de Quinta'],
          ['Tezcat', 'Sexta', 'Casa de Sexta'], ['Venereus', 'Sábado', 'Casa de Sábado']
        ] },
        { t: 'nota', text: `${SUN} Os tipos de sangue Fraco / Diluído / Azul mudam os valores de várias características.` }
      ]
    },
    house('dhampir', 'Vampiro · Dhampir (Sem Casa)', [
      { t: 'termos', items: [
        trait('Armamento Vampírico (F)', 'Permite ao Dhampir expelir e retrair suas garras e presas. As garras e presas podem absorver 0,5% da força vital presente no sangue dos seres vivos de forma sobrenatural. Cada garra e presa absorve vitalidade individualmente. Para cada manipulação energética, pode ser utilizado até 25 de vitalidade para as garras e presas.'),
        trait('Linhagem de Sangue (F)', 'Os Dhampiros consideram-se uma verdadeira família hierárquica, na qual seus antecessores (vampíricos) possuem o comando sobre eles. O sucessor direto possui um sucesso (DR) adicional para comandar, e os antecessores possuem uma tentativa (DR) adicional para influenciar.'),
        trait('Maldição dos Dhampiros (F)', 'Quando um sem-casa é afetado pelo sol, tem uma chance de 1d8 com DT de (1d8) de cair em sono profundo. Caso resista, ganha o efeito “Sono (1)” por 2 horas. Esse efeito pode ser acumulado até que o vampiro conclua um descanso longo.')
      ] },
      { t: 'formulas', items: [['Dano (garras e presas)', '(ModCons / 10) + 2'], ['Durabilidade (garras e presas)', '(ModCons / 20) + 1']] }
    ]),
    house('constantino', 'Vampiro · Constantino (Casa de Domingo)', [
      { t: 'termos', items: [
        trait('Consumista Vital (F)', 'Permite ao Constantino absorver a força vital presente em toda matéria orgânica que consuma, convertendo vida, durabilidade ou vitalidade em vitalidade própria. As presas absorvem de forma quase instantânea, mas menos eficiente que o estômago ao longo do tempo. **Presas:** absorvem 1 / 0,1 / 5 da vida / durabilidade / vitalidade por manipulação energética, recuperando 1 de vitalidade. **Estômago:** digere 10% / 5% / 20% da vida / durabilidade / vitalidade ao longo de 12 segundos, convertendo em vitalidade. Com a vitalidade cheia, o excesso vira energia (5% da vitalidade excedida). Sangue Fraco / Diluído / Azul altera os valores das presas em −0,5 / 0 / +0,5 e do estômago em −10% / 0 / +5%.'),
        trait('Traços de Sangue (F)', 'Os Constantinos são vampiros puros, com desejo e vínculo irracional pelo sangue. O vínculo permite usar os traços de outros vampiros. Quando sua visão, olfato, paladar ou energia sente sangue, perdem o controle sobre o ego, guiados pelo desejo de sangue; nesse estado perdem −20 Mod de Vontade. Os traços despertam após consumir o sangue azul de uma casa, e só um traço pode ser usado por vez.'),
        trait('Maldição do Sol (F)', 'Quando um vampiro de domingo é afetado pelo sol, bloqueia um dos traços despertos das casas durante 2 horas. Na presença (5 metros) de outro demônio, ativa suas maldições de solstício com 50% de eficiência.')
      ] },
      { t: 'termos', items: [
        trait('Amigo do Monstro (Crepuscular)', 'Gera 0/1 clone do usuário, com limite de 20% dos atributos, perícias e habilidades, que compartilha o “Estado Atual” com o original. A criação é extremamente dolorosa e lenta: efeito de Dor (5) e ~8 horas. O clone pode ser melhorado com vitalidade: Atributo, valor 0,1 = 1; Perícia, etapa Ruim = 20; Habilidade, Rank F = 50.'),
        trait('Alma Carnal (Apoáclis)', 'Altera permanentemente a forma do corpo, mudando ossos, nervos, tendões e cartilagem, transferindo Valor de Força para Constituição. Dedo: 10,0 de Valor, custo 200. Mão: 50,0, custo 750. Braço: 80,0, custo 1000.'),
        trait('Vinda Carmim (Mercur)', 'Gera uma onda esférica de vitalidade num raio de 5 metros. Todos os seres vivos atingidos (incluindo o usuário) ganham “Hemorrágico” por 6 segundos: +1 no efeito de sangramento, ou adiciona o efeito (não acumula, só renova). Custa 250 de vitalidade, durante 5 manipulações energéticas contínuas.'),
        trait('Abatedora Sangrenta (Caligular)', 'Ao aplicar sangramento num ser vivo, pode aplicar a “Marca do Sacrifício” em 0/1 alvo a até 10 metros, até a morte dele ou um descanso longo. 10% do dano de sangramento do marcado vira vitalidade. Alvos mortos pela marca transferem 5% da vida máxima como vitalidade; ao entrar em “morrendo”, o alvo é finalizado.'),
        trait('Obsessão Primora (Tezcat)', 'Aprimora o Rank do usuário até o limite da ascensão durante 6 segundos, ao consumir uma habilidade permanentemente.'),
        trait('Miragem (Venereus)', 'Na escuridão, o usuário se camufla (DT para percebê-lo +1 sucesso) e seus ataques têm 1d8 com DT 8 de serem ataques surpresa. Na luz, se destaca (DT −1 sucesso) e suas comunicações têm 1d8 com DT 8 de serem zombaria.')
      ] },
      { t: 'nota', text: 'Cada traço de casa é liberado ao consumir a alma de um vampiro de Sangue Azul daquela casa. Os vampiros da casa Domingo são considerados traidores da raça e aliados do Sol: a luz do sol é uma bênção para eles. Na presença de um vampiro de domingo, as maldições dos irmãos são aplicadas com 50% de potencial. A rainha dos vampiros é uma Constantino.' }
    ]),
    house('crepuscular', 'Vampiro · Crepuscular (Casa de Segunda)', [
      { t: 'termos', items: [
        trait('Casulo Faminto (F)', 'Ao serem mordidos, os Crepusculares passam por uma transformação: o corpo endurece a cada dia até virar uma “estátua” e depois um obelisco vermelho-escuro (parecido com obsidiana), o “casulo”. Leva ~120 dias da mordida ao casulo. O casulo pode criar até 0/5 receptáculos, cada um consumindo permanentemente metade da vitalidade máxima do obelisco. No casulo, consome toda a vitalidade do ambiente num raio de 5 m, até 0,01% da vitalidade máxima por rotação, priorizando a fonte mais compatível com o sangue. Por manipulação energética, o obelisco usa até 25 de vitalidade.'),
        trait('Solidão do Monstro (F)', 'Permite criar um semi-vampiro de linhagem inferior com sua “Mordida”, por meio do casulo. Os semi-vampiros têm vínculo vital com o obelisco e transferem vitalidade por contato físico. Na criação, a marionete absorve os modificadores do obelisco; ela pode se sacrificar fundindo-se de novo ao obelisco, devolvendo 10% dos modificadores e 10% da vitalidade máxima.'),
        trait('Maldição do Sol (F)', 'Quando afetado pelo sol, a vitalidade queima em chamas douradas, extinguindo 10 de vitalidade por segundo enquanto exposto à luz direta.')
      ] }
    ]),
    house('apoaclis', 'Vampiro · Apoáclis (Casa de Terça)', [
      { t: 'termos', items: [
        trait('Praga Difundida (F)', 'Transforma e move uma névoa feita do seu sangue e energia para absorver força vital; a névoa pode ser reabsorvida. **Campo:** fica livre e se espalha num raio de 2,5 m, acumulando até 0/250 de vitalidade e absorvendo 1% da vitalidade atual da névoa por rotação (6 s). **Contida:** controlada por energia, gasta 10 de vitalidade por metro, acumula até 0/100 e absorve 5% em relação à vitalidade atual. Transformar a própria vitalidade em névoa aproveita só 50% ao reabsorver. Dano sobrenatural na névoa destrói a vitalidade dela. Sangue Fraco / Diluído / Azul recebe bônus de 90 / 30 / 10 para ignorar as defesas vital e de refino (constituição e poder). Até 25 de vitalidade por manipulação energética.'),
        trait('Deposição Corpórea (F)', 'Verdadeiros nascidos do sangue: podem alterar o corpo na reconstrução da névoa, modificando Força, Constituição e Sentidos, com perda de 50 a 25% do atributo trocado conforme a qualidade da nova parte. Incompatibilidade pode gerar “Dor (1 ou 2)” e, em casos extremos, “Morrendo (1)” temporário. Cada modificador consome 50 de vitalidade, em 20 manipulações energéticas.'),
        trait('Maldição dos Apoáclises (F)', 'Quando afetado pelo sol, tem 1d8 com DT (1d8) de falhar no controle da vitalidade; a vitalidade perdida sai como sangue “corrompido” pelos orifícios do corpo. Sangue vampírico amaldiçoado pelo sol torna-se venenoso para vampiros.')
      ] }
    ]),
    house('mercur', 'Vampiro · Mercur (Casa de Quarta)', [
      { t: 'termos', items: [
        trait('Sanguessuga (F)', 'Cria uma conexão sobrenatural com a força vital do sangue dos seres vivos; o sangue é puxado até o vampiro e vira vitalidade (10% da vida absorvida). Drenar diminui por 3 segundos as estatísticas do alvo em −0,5 de modificador a cada 20 de vida drenada. A conexão exige combate sobrenatural: **direta** (seu Poder contra a constituição e defesa energética do alvo) ou **à distância** (sua Energia menos a distância em metros, contra as mesmas defesas). Sangue Fraco / Diluído / Azul reduz a defesa vital dos alvos em −40 / −20 / −10. Até 25 de vitalidade por manipulação energética.'),
        trait('Rigor Mortis (F)', 'Verdadeiros cadáveres: mais pálidos e fracos, mas com vínculo maior com a morte. Sangue e força vital imóveis: −6 de modificador em força, destreza, sentidos, sabedoria e poder, mas −10% de dano contundente, −5% de cortante ou perfurante e −15% de dano de sangramento. Aparência reduzida a um fracasso (DR) e presença a um sucesso (DT). Podem reativar o sangue, invertendo vantagens e desvantagens, gastando 25 movimentos das ações físicas.'),
        trait('Maldição dos Mercur (F)', 'Quando afetado pelo sol, tem 1d8 com DT (1d8) de falhar no uso de habilidades e perícias, representado como fadiga e cansaço extremo.')
      ] }
    ]),
    house('caligular', 'Vampiro · Caligular (Casa de Quinta)', [
      { t: 'termos', items: [
        trait('Obra Sanguínea (F)', 'Absorve ou molda fisicamente a força vital do sangue (10% da vida absorvida vira vitalidade). O sangue moldado pode ser duro, maleável ou flexível; sofre corrosão a cada 30 minutos (−1 de durabilidade), evitável imbuindo 100 de vitalidade para reconstruí-lo. Tipo de sangue Fraco / Diluído / Azul vale 0,2 / 0,5 / 1. Até 25 de vitalidade por manipulação energética, por contato físico.'),
        trait('Conexão Vital (F)', 'Liga a força vital do Caligular ao sangue de algo, impedindo a corrosão e permitindo transferência: 10 de vitalidade do vampiro para 1 de vida do vinculado. Seres ligados absorvem vitalidade à força quando estão abaixo de 90% da força vital. Entidades vinculadas perdem o vínculo ao perecer ou quebrar. Cada transferência usa 1 manipulação energética (até 25 de vitalidade).'),
        trait('Maldição dos Calígulas (F)', 'Quando afetado pelo sol, o modificador de Sabedoria cai −30 (até 0) durante 2 horas, representando o selamento das memórias anteriores à maldição.')
      ] },
      { t: 'formulas', items: [
        ['Dano', '[(Tipo * Vitalidade) * (ModDest / 100 + 5) * CritPoder] / 10'],
        ['Durabilidade', '[(Tipo * Vitalidade) * (ModDest / 100 + 20) * CritPoder] / 100'],
        ['Defesa Física', '[(Tipo * Vitalidade) * (ModDest / 100 + 1) * CritPoder] / 100'],
        ['Defesa Ener.', '[(Tipo * Vitalidade) * (ModDest / 100 + 1) * CritPoder] / 100']
      ] }
    ]),
    house('tezcat', 'Vampiro · Tezcat (Casa de Sexta)', [
      { t: 'termos', items: [
        trait('Possessão Obsessiva (F)', 'Apossa-se ou assimila a força vital da carne dos seres vivos (10% da vida absorvida vira vitalidade). A presa perde a sensibilidade da própria carne, mas sente um prazer anormal ao ser consumida. Da carne apossada, pode adquirir uma característica ou imitar parcialmente a aparência (ganhando o fator estético). Com consentimento do alvo, isso pode ser “guardado” no sangue em até 0/2 espaços (Sangue: Nome (Rank) [Portador]). Sangue Fraco / Diluído / Azul: +150% / +50% / −50% de efeito no que for guardado. 25 de vitalidade por manipulação energética.'),
        trait('Reflexo Amargo (F)', 'Verdadeiros espelhos: ao observar um ser executar uma perícia ou aprendizado, podem copiá-la refazendo as mesmas ações. Quanto mais se assemelham ao alvo, mais natural é a obtenção. A perícia copiada não evolui e só 50% dos efeitos são copiados, com um novo requisito de semelhança: **Fraco**, nenhum; **Diluído**, hábitos comportamentais e/ou códigos morais; **Azul**, semelhança de 80% ou mais. Se o DR do alvo não for alcançado, falha. Perícias e aprendizados azuis descontam −1 de Psicológico por uso.'),
        trait('Maldição dos Tezcats (F)', 'Quando afetado pelo sol, apodrece aceleradamente: −10 nos modificadores de Força, Constituição e Sentidos (até 0) por 2 horas, como decomposição avançada, mas sem o cheiro característico.')
      ] }
    ]),
    house('venereus', 'Vampiro · Venereus (Casa de Sábado)', [
      { t: 'termos', items: [
        trait('Transfusão Sanguínea (F)', 'Transfere vitalidade do seu sangue a outros seres pela boca; o afetado é curado em 5% da vitalidade fornecida. Os curados ganham a característica “Marca do Sábado”: quase não geram sangue novo, cortando em 80% a recuperação de vida por descansos, e ficam quase dependentes do vampiro. Seres com a Marca permitem a transfusão reversa (10% da vida absorvida vira vitalidade). Sangue Fraco / Diluído / Azul: −50% / +50% / +150% de vitalidade na transfusão reversa. 25 de vitalidade por manipulação energética.'),
        trait('Beleza Hipnótica (F)', 'Aura, cheiro e aparência considerados belos por todos os seres vivos. Quem sente ou está na presença deles desenvolve um desejo irracional (hipnose): perde 1 de modificador de Vontade por rotação, até um limite de 5 ou até o modificador natural ficar negativo. Pode ser aplicado intencionalmente em até 0/3 alvos, gastando 2 comunicações das ações expressivas por alvo.'),
        trait('Maldição dos Venereus (F)', 'Quando afetado pelo sol, a vitalidade máxima cai 10% durante 2 horas; a perda sai como sangue “corrompido” pelos orifícios do corpo. Sangue vampírico amaldiçoado pelo sol torna-se venenoso para vampiros.')
      ] },
      { t: 'nota', text: 'Os Venereus se alimentam com pequenas transfusões em vários alvos e, quando necessário, absorvem todo o sangue da presa. Se a presa fica viva durante a absorção, transforma-se em vampiro de Venereus; se for de outra raça, em meio-vampiro.' }
    ])
  ]
};
