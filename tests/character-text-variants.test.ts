import { describe, expect, it } from 'vitest';
import { readCharacterText, type CharacterTextReading } from '../src/core/character-text';

// Estruturas das fichas reais exportadas do Notion (versão mais nova do modelo), em texto recuado
// como o leitor de PDF produz: o recuo mostra o que está dentro de cada item.
const sheet = `# Specchio Fosbery

Descrição: Natural
  Idade: 3 Dias (26 Anos)
  Pele: Pardo Cinza
  Aparência: 8
================
Arquétipo: Pilarasdaar
Talento: Injustiça (Quando morre, ao invés de morrer entra em estado de morrendo por 10 segundos).
Proficiência: Aura Cancerígena 13,7% (1/3)
Estado Atual: Pilar
Vitalidade: 350/350    Energia: 10/10
Status: 0/0,21 Adicionar 1.74 Valor
  | STATUS | VALOR | MOD | CRI | ALT | DR |
  | --- | --- | --- | --- | --- | --- |
  | Força (0,005) | -52,00 | -26 / 20 | -1 | +2 |  |
Ações
  | Tipos de Ação | Usos | Tempo | Valor | Execução |
  | Pensamento | 0/1 | 0,5s | 1,0 | 1 Pensamento |
  | Comunicação | 2/3 | 1s | 1,0 | 1 Comunicação |
Habilidades:
  Lua
    “Eu seria mais como os outros”
  Aura
    Copia de Mentalidade (E) [Evo.4]
      Ao olhar para um ser vivo, assimila sentimentos.
Pericias [1/15]
  Variante Doppler [Etapa Boa] [Grau 0] [Tier 1] [Xp 85,7/250]
    Regente: Consequência
    Classe: Talento
    Buffs: Após um assobio diminui o tempo.
    Buffs: Custa 1 de energia.
    Critério: Assobiar
================
Inventario:
  Acesso rápido:
    Lança de Fibra de carbono
      Dano: 20 ; 24
      Material: Fibra de carbono (F)
    Lápis; Chave de carro
  Outros:
    Por Historia (A “Classificação” e “Quantidade” dos Item por historia vai de acordo com o Mestre) 17 Grimorio e tinta
  Itens KalLuniA:
================
Títulos:
  Conquistas
    Observado pela Aura (D)
      Descrição: Um título ganho pelo interesse da Aura.
    Trazido da Morte (B)
    Estatísticas Secretas (??)
      Descrição: Títulos ocultos.
        ???
  Feitos
    Evolução Forçada (E)
      Liberação de estatística sobrenatural
================
Características
  Traços de Sangue (F)
    Os Constantinos são vampiros puros.
    Amigo do Monstro (Crepuscular)
      Gerar 0/1 clone do usuário.
================
História
  — Então, como você está se sentindo?
  Specchio — Uma herança de família: um Webley-Fosbery.
================
Anotações
  Pericia [Etapa -] [Grau -] [Tier -] [Xp -]
  Regente: Consequência / Ação / Consenso
  Buffs: - - -
  Lembrar da dívida.
`;
function read(text: string): Extract<CharacterTextReading, { ok: true }> {
  const reading = readCharacterText(text);
  if (!reading.ok) throw new Error(reading.problem);
  return reading;
}

describe('Variações do modelo nas fichas do Notion', () => {
  it('lê a descrição com título de seção, idade em anos, traços extras e listas sem cortar parênteses', () => {
    const { character } = read(sheet);
    expect(character.identidade.nome).toBe('Specchio Fosbery');
    expect(character.rpg!.descricao).toMatchObject({ idade: 26, aparencia: 8, extra: 'Pele: Pardo Cinza' });
    expect(character.rpg!.progressao.talentos.map(t => t.nome)).toEqual(['Injustiça (Quando morre, ao invés de morrer entra em estado de morrendo por 10 segundos).']);
    expect(character.rpg!.elementos.proficiencias.map(t => t.nome)).toEqual(['Aura Cancerígena 13,7%']);
  });
  it('avisa arquétipo e estado que não existem nas regras, em vez de ignorá-los calado', () => {
    const { character, unrecognized } = read(sheet);
    expect(unrecognized).toEqual(['Arquétipo “Pilarasdaar”', 'Estado “Pilar”']);
    expect([character.rpg!.arquetipo, character.rpg!.estado]).toEqual(['', 'Natural']);
  });
  it('entende Vitalidade, a coluna VALOR do Status e as ações Pensamento e Comunicação', () => {
    const { rpg } = read(sheet).character;
    expect(rpg!.recursos.vida).toEqual({ atual: 350, maximo: 350 });
    expect(rpg!.estatisticas.forca).toMatchObject({ valor: -52, modificador: -26, limite: '20', alteracao: '+2' });
    expect(rpg!.acoes.mental).toMatchObject({ atual: 0, maximo: 1 });
    expect(rpg!.acoes.expressao).toMatchObject({ atual: 2, maximo: 3 });
  });
  it('lê perícias com Regente, Classe, Buffs, Critério, Tier e Xp', () => {
    expect(read(sheet).character.rpg!.pericias).toEqual([{
      nome: 'Variante Doppler', etapa: 'Boa', grau: '0', execucao: 'Consequência', tipo: 'Talento',
      efeito: 'Após um assobio diminui o tempo.\nCusta 1 de energia.', condicao: '',
      complementar: 'Tier: 1\nXp: 85,7/250\nCritério: Assobiar', fundamentos: ''
    }]);
  });
  it('guarda o conteúdo recuado de cada item nas notas e usa grupos como nome', () => {
    const { character } = read(sheet);
    const rpg = character.rpg!;
    expect(character.secoes.habilidades).toEqual([
      { nome: 'Lua', valor: '', notas: '“Eu seria mais como os outros”' },
      { nome: 'Aura · Copia de Mentalidade (E) [Evo.4]', valor: '', notas: 'Ao olhar para um ser vivo, assimila sentimentos.' }
    ]);
    expect(rpg.caracteristicas).toEqual([
      { nome: 'Traços de Sangue', valor: 'F', notas: 'Os Constantinos são vampiros puros.' },
      { nome: 'Amigo do Monstro', valor: 'Crepuscular', notas: 'Gerar 0/1 clone do usuário.' }
    ]);
    expect(rpg.titulos).toEqual([
      { nome: 'Observado pela Aura', valor: 'D', notas: 'Descrição: Um título ganho pelo interesse da Aura.' },
      { nome: 'Trazido da Morte', valor: 'B', notas: '' },
      { nome: 'Estatísticas Secretas', valor: '??', notas: 'Descrição: Títulos ocultos.' }
    ]);
    expect(rpg.feitos).toEqual([{ nome: 'Evolução Forçada', valor: 'E', notas: 'Liberação de estatística sobrenatural' }]);
  });
  it('lê itens com atributos, a quantidade depois da observação do modelo e locais desconhecidos', () => {
    expect(read(sheet).character.rpg!.inventario.map(i => [i.local, i.nome, i.quantidade, i.notas])).toEqual([
      ['Acesso rápido', 'Lança de Fibra de carbono', '', 'Dano: 20 ; 24\nMaterial: Fibra de carbono (F)'],
      ['Acesso rápido', 'Lápis', '', ''], ['Acesso rápido', 'Chave de carro', '', ''],
      ['Outros', 'Grimorio e tinta', '17', '']
    ]);
  });
  it('guarda a história escrita direto na seção e ignora o molde de perícia nas anotações', () => {
    const { character } = read(sheet);
    expect(character.rpg!.historia.jornada).toBe('— Então, como você está se sentindo?\nSpecchio — Uma herança de família: um Webley-Fosbery.');
    expect(character.identidade.notas).toBe('Lembrar da dívida.');
  });
  it('diz quais textos foram encurtados e continua a história longa na História livre', () => {
    const long = `Características\n  Item longo (F)\n    ${'a'.repeat(1200)}\nHistória\n  ${'b'.repeat(5000)}\n  ${'c'.repeat(3000)}`;
    const reading = read(long);
    expect(reading.trimmedFields).toEqual(['Item longo']);
    expect(reading.character.rpg!.caracteristicas[0].notas).toHaveLength(1000);
    expect(reading.character.rpg!.historia.jornada).toBe('b'.repeat(5000));
    expect(reading.character.identidade.historia).toBe('c'.repeat(3000));
  });
});
