import { describe, expect, it } from 'vitest';
import { readCharacterText } from '../src/core/character-text';
import { normalizeCharacter } from '../src/core/character';
import filled from './fixtures/ficha-texto.md?raw';
import template from '../docs/rpg/creation-reference.txt?raw';
function read(text: string, fileName = '') {
  const reading = readCharacterText(text, fileName);
  if (!reading.ok) throw new Error(reading.problem);
  return reading;
}

describe('Ficha escrita em texto no modelo do Livro de Regras', () => {
  it('lê identidade, descrição, arquétipo e progressão sem as regras transcritas do modelo', () => {
    const { character, unrecognized } = read(filled);
    expect(character.identidade).toMatchObject({ nome: 'Kael Ventobravo', jogador: 'Pietro', campanha: 'Ecos de Existus' });
    expect(character.rpg!.descricao).toEqual({
      idade: 24, sexo: 'Masculino', raca: 'Dríade', altura: '1,82 m', peso: '75 kg',
      extra: 'Cicatriz no ombro esquerdo.\nOlhos verdes que brilham no escuro.', aparencia: 9, estetica: 'Elegante, Acolhedor'
    });
    expect(character.rpg!.arquetipo).toBe('ente');
    expect(character.rpg!.progressao).toMatchObject({
      rank: 'D', avancos: 2, pilar: 'Gaia',
      classes: [{ nome: 'Guardião da Floresta', valor: '', notas: '' }], subclasses: [{ nome: 'Arqueiro', valor: 'D', notas: '' }],
      estilos: [{ nome: 'Arco longo', valor: '', notas: '' }, { nome: 'Esquiva', valor: '', notas: '' }],
      talentos: [{ nome: 'Pontaria', valor: '', notas: '' }]
    });
    expect(unrecognized).toEqual([]);
  });
  it('separa o pilar dos elementos, ignora campos riscados e lê recursos lado a lado', () => {
    const { rpg } = read(filled).character;
    expect(rpg!.elementos).toMatchObject({ alma: 'Natureza', pilar: 'Raiz Antiga', proficiencias: [], extus: 'Folhas cortantes ao redor do corpo.' });
    expect(rpg!.elementos.runas.map(r => r.nome)).toEqual(['Brota', 'Espinho']);
    expect(rpg!.estado).toBe('Antinatural');
    expect(rpg!.recursos).toEqual({ vida: { atual: 42, maximo: 65 }, fadiga: { atual: 20, maximo: 25 }, psicologico: { atual: 12, maximo: 12 }, energia: { atual: 18, maximo: 30 } });
    expect(rpg!.defesas).toEqual({ fisica: '3 + ( 2 )', mental: '', energetica: '1', geral: '' });
    expect(rpg!.efeitos).toEqual({ primeiro: 'Sangramento leve', resumo: 'Lento por 2 rodadas' });
  });
  it('lê as tabelas de Status e Ações, mantendo bloqueadas as estatísticas riscadas', () => {
    const { rpg } = read(filled).character;
    expect(rpg!.estatisticas.forca).toMatchObject({ valor: 12, modificador: -8, limite: '30', alteracao: '+2 anel', dr: 0, desbloqueada: true });
    expect(rpg!.estatisticas.constituicao).toMatchObject({ valor: 15, modificador: -5, limite: '', dr: 1 });
    expect(rpg!.estatisticas.poder).toMatchObject({ valor: 4, modificador: -16, desbloqueada: true });
    expect(rpg!.estatisticas.energia.desbloqueada).toBe(false);
    expect(rpg!.acoes.fisica).toEqual({ atual: 2, maximo: 3, mvs: 1, dr: 2 });
  });
  it('lê perícias, inventário por local, conquistas, características e textos de várias linhas', () => {
    const { character } = read(filled);
    const rpg = character.rpg!;
    expect(rpg.pericias).toEqual([{
      nome: 'Furtividade', etapa: '2', grau: 'C', execucao: 'Ação', tipo: 'Aprendizado',
      efeito: 'Some na vegetação.\nDura até o próximo turno.', condicao: 'Estar em área de mata.', complementar: '', fundamentos: 'Treino com os druidas.'
    }]);
    expect(rpg.inventario.map(i => [i.local, i.nome, i.quantidade])).toEqual([
      ['Acesso rápido', 'Arco longo', ''], ['Acesso rápido', 'Flechas', '20'], ['Mochila', 'Corda', '2'], ['Mochila', 'Poção de cura', '3']
    ]);
    expect(rpg.feitos.map(f => f.nome)).toEqual(['Salvou a vila de Ermo']);
    expect(rpg.titulos).toEqual([{ nome: 'Guardião', valor: 'D', notas: '' }]);
    expect(rpg.caracteristicas).toEqual([{ nome: 'Coração da floresta', valor: 'regenera fora de combate', notas: '' }]);
    expect(character.secoes.habilidades.map(h => h.nome)).toEqual(['Chuva de espinhos']);
    expect(rpg.historia.jornada).toBe('Nasceu entre as raízes do Bosque Velho.\n\nDisse ao mestre: "vou proteger a floresta".');
    expect(character.identidade.notas).toBe('Lembrar de cobrar a dívida do ferreiro.');
  });
  it('produz uma ficha válida e transforma o modelo vazio numa ficha em branco', () => {
    expect(normalizeCharacter(JSON.parse(JSON.stringify(read(filled).character)))).not.toBeNull();
    const blank = read(template, 'Ficha Existus 0123456789abcdef0123456789abcdef.md');
    expect(blank.unrecognized).toEqual([]);
    expect(blank.character.identidade.nome).toBe('Ficha Existus');
    expect(blank.character.identidade.notas).toBe('');
    const rpg = blank.character.rpg!;
    expect([rpg.arquetipo, rpg.estado, rpg.pericias, rpg.inventario, rpg.progressao.classes]).toEqual(['', 'Natural', [], [], []]);
    expect(rpg.estatisticas.poder.desbloqueada).toBe(false);
  });
  it('aceita Markdown com negrito, Windows (CRLF) e lista campos desconhecidos', () => {
    const reading = read('**Nome:** Lia\r\n**Idade:** 19\r\n**Signo:** Lua\r\n**Arquétipo:** Âmago\r\n');
    expect(reading.character.identidade.nome).toBe('Lia');
    expect(reading.character.rpg!.descricao.idade).toBe(19);
    expect(reading.character.rpg!.arquetipo).toBe('amago');
    expect(reading.unrecognized).toEqual(['Signo']);
  });
  it('encurta o que passa dos limites da ficha e recusa textos sem nenhuma informação', () => {
    const reading = read(`Raça: ${'x'.repeat(500)}\nRunas: ${Array.from({ length: 60 }, (_, i) => `R${i}`).join(', ')}`);
    expect(reading.trimmed).toBe(true);
    expect(reading.character.rpg!.descricao.raca).toHaveLength(120);
    expect(reading.character.rpg!.elementos.runas).toHaveLength(50);
    const empty = readCharacterText('Uma lista de compras\nleite, pão');
    expect(empty.ok).toBe(false);
  });
});
