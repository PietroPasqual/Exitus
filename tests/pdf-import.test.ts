import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { layoutPdfPage, type PdfTextPiece } from '../src/core/pdf-layout';
import { readCharacterText } from '../src/core/character-text';
import { PdfReadError, readPdfText } from '../src/ui/pdf-import';
import { expectKael } from './fixtures/kael-expectations';

const piece = (str: string, x: number, y: number, width = str.length * 6, size = 12): PdfTextPiece => ({ str, x, y, width, size });
// ficha-texto.pdf foi gerado no Chromium a partir de fixtures/ficha-texto.md, como uma página impressa do Notion.
async function fixture(name: string): Promise<Uint8Array> {
  const fs = await import(/* @vite-ignore */ 'node:fs/promises' as string) as { readFile: (path: string) => Promise<Uint8Array> };
  return new Uint8Array(await fs.readFile(`tests/fixtures/${name}`));
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
      piece('continuação', 180, 455),
      piece('• Ações', 10, 420)
    ])).toEqual([
      '| STATUS | MOD | ALT | DR |', '| --- | --- | --- | --- |',
      '| Força (12) | -8 / 30 | +2 |  |', '| Constituição (15) | -5 / ?? | continuação | 1 |', '• Ações'
    ]);
  });
  it('não perde recursos lado a lado que a montagem transforma em tabela', () => {
    const lines = layoutPdfPage([
      piece('Vida: 42/65', 10, 500), piece('Energia: 18/30', 150, 500), piece('Fadiga: 20/25', 290, 500), piece('Psicológico: 12/12', 430, 500)
    ]);
    expect(lines[0]).toBe('| Vida: 42/65 | Energia: 18/30 | Fadiga: 20/25 | Psicológico: 12/12 |');
    const reading = readCharacterText(lines.join('\n'));
    if (!reading.ok) throw new Error(reading.problem);
    expect(reading.character.rpg!.recursos).toEqual({
      vida: { atual: 42, maximo: 65 }, energia: { atual: 18, maximo: 30 }, fadiga: { atual: 20, maximo: 25 }, psicologico: { atual: 12, maximo: 12 }
    });
  });
});

describe('Ficha importada de um PDF', () => {
  it('lê a ficha impressa em PDF com tabelas, listas e textos', async () => {
    const text = await readPdfText(pdfjs, await fixture('ficha-texto.pdf'));
    expectKael(readCharacterText(text, 'ficha.pdf', { strikethrough: false }), { strikethrough: false });
  });
  it('lê o PDF salvo por um editor de texto: marcadores da fonte Symbol, tabela entre páginas e cabeçalho quebrado', async () => {
    // Gerado pelo LibreOffice a partir de ficha-texto.docx, como "Salvar como PDF" do Word.
    const text = await readPdfText(pdfjs, await fixture('ficha-word.pdf'));
    expect(text).toContain('| Tipos de Ação | Usos | Tempo | MVs | DRs | Explicação |');
    expectKael(readCharacterText(text, 'ficha.pdf', { strikethrough: false }), { strikethrough: false });
  });
  it('explica quando o arquivo não é um PDF legível', async () => {
    await expect(readPdfText(pdfjs, new TextEncoder().encode('não sou um pdf'))).rejects.toBeInstanceOf(PdfReadError);
  });
});
