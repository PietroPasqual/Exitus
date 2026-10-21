import { expect } from 'vitest';
import type { CharacterTextReading } from '../../src/core/character-text';

/** O que a ficha de exemplo (ficha-texto.md) deve produzir em qualquer formato de importação. */
export function expectKael(reading: CharacterTextReading, { strikethrough = true } = {}): void {
  if (!reading.ok) throw new Error(reading.problem);
  const { identidade, rpg, secoes } = reading.character;
  expect(reading.unrecognized).toEqual([]);
  expect(identidade).toMatchObject({ nome: 'Kael Ventobravo', jogador: 'Pietro', campanha: 'Ecos de Existus', notas: 'Lembrar de cobrar a dívida do ferreiro.' });
  expect(rpg!.descricao).toMatchObject({ idade: 24, sexo: 'Masculino', raca: 'Dríade', aparencia: 9, estetica: 'Elegante, Acolhedor' });
  expect(rpg!.descricao.extra.replace(/\n+/g, '\n')).toBe('Cicatriz no ombro esquerdo.\nOlhos verdes que brilham no escuro.');
  expect(rpg!.arquetipo).toBe('ente');
  expect(rpg!.progressao).toMatchObject({ rank: 'D', avancos: 2, pilar: 'Gaia' });
  expect(rpg!.progressao.classes.map(c => c.nome)).toEqual(['Guardião da Floresta']);
  expect(rpg!.progressao.estilos.map(c => c.nome)).toEqual(['Arco longo', 'Esquiva']);
  expect(rpg!.elementos).toMatchObject({ alma: 'Natureza', pilar: 'Raiz Antiga', proficiencias: [], extus: 'Folhas cortantes ao redor do corpo.' });
  expect(rpg!.elementos.runas.map(r => r.nome)).toEqual(['Brota', 'Espinho']);
  expect(rpg!.estado).toBe('Antinatural');
  expect(rpg!.recursos).toEqual({ vida: { atual: 42, maximo: 65 }, fadiga: { atual: 20, maximo: 25 }, psicologico: { atual: 12, maximo: 12 }, energia: { atual: 18, maximo: 30 } });
  expect(rpg!.defesas).toEqual({ fisica: '3 + ( 2 )', mental: '', energetica: '1', geral: '' });
  expect(rpg!.efeitos).toEqual({ primeiro: 'Sangramento leve', resumo: 'Lento por 2 rodadas' });
  expect(rpg!.estatisticas.forca).toMatchObject({ valor: 12, modificador: -8, limite: '30', alteracao: '+2 anel', dr: 0, desbloqueada: true });
  expect(rpg!.estatisticas.constituicao).toMatchObject({ valor: 15, modificador: -5, limite: '', alteracao: '', dr: 1 });
  expect(rpg!.estatisticas.labia).toMatchObject({ valor: 0, modificador: -20 });
  expect(rpg!.estatisticas.poder).toMatchObject({ valor: 4, modificador: -16 });
  // Com riscado (texto e .docx), Poder é desbloqueado e Energia, riscada, não. Sem riscado (PDF), vale o padrão.
  expect([rpg!.estatisticas.poder.desbloqueada, rpg!.estatisticas.energia.desbloqueada]).toEqual(strikethrough ? [true, false] : [false, false]);
  expect(rpg!.acoes.fisica).toEqual({ atual: 2, maximo: 3, mvs: 1, dr: 2 });
  expect(rpg!.acoes.mental).toEqual({ atual: 1, maximo: 1, mvs: 0, dr: 0 });
  expect(rpg!.pericias.map(p => [p.nome, p.etapa, p.grau, p.execucao, p.tipo, p.condicao, p.fundamentos])).toEqual([
    ['Furtividade', '2', 'C', 'Ação', 'Aprendizado', 'Estar em área de mata.', 'Treino com os druidas.']
  ]);
  expect(rpg!.pericias[0].efeito.replace(/\n+/g, '\n')).toBe('Some na vegetação.\nDura até o próximo turno.');
  expect(rpg!.inventario.map(i => [i.local, i.nome, i.quantidade])).toEqual([
    ['Acesso rápido', 'Arco longo', ''], ['Acesso rápido', 'Flechas', '20'], ['Mochila', 'Corda', '2'], ['Mochila', 'Poção de cura', '3']
  ]);
  expect(rpg!.feitos.map(f => f.nome)).toEqual(['Salvou a vila de Ermo']);
  expect(rpg!.titulos).toEqual([{ nome: 'Guardião', valor: 'D', notas: '' }]);
  expect(rpg!.caracteristicas).toEqual([{ nome: 'Coração da floresta', valor: 'regenera fora de combate', notas: '' }]);
  expect(secoes.habilidades.map(h => h.nome)).toEqual(['Chuva de espinhos']);
  expect(rpg!.historia.jornada.replace(/\n+/g, '\n')).toBe('Nasceu entre as raízes do Bosque Velho.\nDisse ao mestre: "vou proteger a floresta".');
}
