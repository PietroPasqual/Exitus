import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { layoutPdfPage, type PdfTextPiece } from '../src/core/pdf-layout';
import { readCharacterText } from '../src/core/character-text';
import { PdfReadError, readPdfText } from '../src/ui/pdf-import';

const piece = (str: string, x: number, y: number, width = str.length * 6, size = 12): PdfTextPiece => ({ str, x, y, width, size });
// PDF gerado no Chromium a partir de fixtures/ficha-texto.md, como uma página impressa do Notion.
async function fixture(): Promise<Uint8Array> {
  const fs = await import(/* @vite-ignore */ 'node:fs/promises' as string) as { readFile: (path: string) => Promise<Uint8Array> };
  return new Uint8Array(await fs.readFile('tests/fixtures/ficha-texto.pdf'));
}

describe('Montagem do texto de um PDF', () => {
  it('junta pedaços da mesma linha, separa parágrafos e mantém a ordem de cima para baixo', () => {
    expect(layoutPdfPage([
      piece('24 anos', 52, 700), piece('Idade:', 10, 700, 40),
      piece('Raça: Dríade', 10, 685),
      piece('Extra: cicatriz', 10, 640)
    ])).toEqual(['Idade: 24 anos', 'Raça: Dríade', '', 'Extra: cicatriz']);
  });
  it('alinha as células da tabela pelo cabeçalho, mesmo com células vazias e texto quebrado', () => {
    expect(layoutPdfPage([
      piece('STATUS', 10, 500), piece('MOD', 120, 500), piece('ALT', 180, 500), piece('DR', 240, 500),
      piece('Força (12)', 10, 480), piece('-8 / 30', 120, 480), piece('+2', 180, 480),
      piece('Constituição (15)', 10, 460), piece('-5 / ??', 120, 460), piece('1', 240, 460),
      piece('continuação da ALT', 180, 445),
      piece('• Ações', 10, 420)
    ])).toEqual([
      '| STATUS | MOD | ALT | DR |', '| --- | --- | --- | --- |',
      '| Força (12) | -8 / 30 | +2 |  |', '| Constituição (15) | -5 / ?? |  | 1 |', '• Ações'
    ]);
  });
});

describe('Ficha importada de um PDF', () => {
  it('lê a ficha impressa em PDF com tabelas, listas e textos', async () => {
    const text = await readPdfText(pdfjs, await fixture());
    const reading = readCharacterText(text, 'ficha.pdf', { strikethrough: false });
    if (!reading.ok) throw new Error(reading.problem);
    const { identidade, rpg, secoes } = reading.character;
    expect(identidade).toMatchObject({ nome: 'Kael Ventobravo', jogador: 'Pietro', notas: 'Lembrar de cobrar a dívida do ferreiro.' });
    expect(rpg!.descricao).toMatchObject({ idade: 24, raca: 'Dríade', aparencia: 9, extra: 'Cicatriz no ombro esquerdo.\nOlhos verdes que brilham no escuro.' });
    expect(rpg!.arquetipo).toBe('ente');
    expect(rpg!.progressao.classes.map(c => c.nome)).toEqual(['Guardião da Floresta']);
    expect(rpg!.elementos).toMatchObject({ alma: 'Natureza', pilar: 'Raiz Antiga', proficiencias: [] });
    expect(rpg!.recursos.vida).toEqual({ atual: 42, maximo: 65 });
    expect(rpg!.recursos.psicologico).toEqual({ atual: 12, maximo: 12 });
    expect(rpg!.estatisticas.forca).toMatchObject({ valor: 12, modificador: -8, limite: '30', alteracao: '+2 anel', dr: 0 });
    expect(rpg!.estatisticas.constituicao).toMatchObject({ valor: 15, alteracao: '', dr: 1 });
    // O riscado não chega ao texto do PDF: o bloqueio padrão de Poder e Energia é mantido.
    expect([rpg!.estatisticas.poder.desbloqueada, rpg!.estatisticas.energia.desbloqueada]).toEqual([false, false]);
    expect(rpg!.acoes.fisica).toEqual({ atual: 2, maximo: 3, mvs: 1, dr: 2 });
    expect(rpg!.pericias.map(p => [p.nome, p.etapa, p.grau, p.execucao, p.tipo])).toEqual([['Furtividade', '2', 'C', 'Ação', 'Aprendizado']]);
    expect(rpg!.inventario.map(i => [i.local, i.nome, i.quantidade])).toEqual([
      ['Acesso rápido', 'Arco longo', ''], ['Acesso rápido', 'Flechas', '20'], ['Mochila', 'Corda', '2'], ['Mochila', 'Poção de cura', '3']
    ]);
    expect(rpg!.titulos).toEqual([{ nome: 'Guardião', valor: 'D', notas: '' }]);
    expect(secoes.habilidades.map(h => h.nome)).toEqual(['Chuva de espinhos']);
    expect(rpg!.historia.jornada).toContain('Nasceu entre as raízes do Bosque Velho.');
    expect(reading.unrecognized).toEqual([]);
  });
  it('explica quando o arquivo não é um PDF legível', async () => {
    await expect(readPdfText(pdfjs, new TextEncoder().encode('não sou um pdf'))).rejects.toBeInstanceOf(PdfReadError);
  });
});
