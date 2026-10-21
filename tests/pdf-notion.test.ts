import { describe, expect, it } from 'vitest';
import { readSpanActualTexts } from '../src/core/pdf-actual-text';
import { layoutPdfPage, layoutPdfPages, type PdfTextPiece } from '../src/core/pdf-layout';
import { readPdfText } from '../src/ui/pdf-import';

const piece = (str: string, x: number, y: number, width = str.length * 6, size = 12): PdfTextPiece => ({ str, x, y, width, size });
async function deflate(text: string): Promise<Uint8Array> {
  const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
const bytes = (text: string): number[] => [...new TextEncoder().encode(text)];
/**
 * PDF mínimo como o do Notion: catálogo, árvore de páginas e um fluxo de conteúdo compactado por
 * página. Os fluxos são gravados na ordem de `streamOrder` (índices das páginas), que pode não ser
 * a das páginas.
 */
async function pdfWithPages(contents: string[], streamOrder = contents.map((_, i) => i)): Promise<Uint8Array> {
  const pageObject = (i: number) => 10 + i, streamObject = (i: number) => 20 + i;
  const out = bytes('%PDF-1.4\n1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n');
  out.push(...bytes(`2 0 obj\n<</Type /Pages /Count ${contents.length} /Kids [${contents.map((_, i) => `${pageObject(i)} 0 R`).join(' ')}]>>\nendobj\n`));
  contents.forEach((_, i) => out.push(...bytes(`${pageObject(i)} 0 obj\n<</Type /Page /Parent 2 0 R /Contents ${streamObject(i)} 0 R>>\nendobj\n`)));
  for (const i of streamOrder) {
    const compressed = await deflate(contents[i]);
    out.push(...bytes(`${streamObject(i)} 0 obj\n<</Length ${compressed.length} /Filter /FlateDecode>>\nstream\n`), ...compressed, ...bytes('\nendstream\nendobj\n'));
  }
  out.push(...bytes('30 0 obj\n<</Length 3>>\nstream\nabc\nendstream\nendobj\n%%EOF'));
  return new Uint8Array(out);
}
const pdfWithContent = (content: string): Promise<Uint8Array> => pdfWithPages([content]);

describe('Caracteres que o Notion grava só no ActualText', () => {
  it('lê o ActualText de cada /Span na ordem do arquivo, em cadeia literal ou UTF-16', async () => {
    const data = await pdfWithContent('BT /Span<</ActualText (\\()>> BDC <4C> Tj EMC /Span <</ActualText <FEFF005B>>> BDC <47> Tj EMC /Span /P0 BDC (x) Tj EMC ET');
    expect(await readSpanActualTexts(data)).toEqual([['(', '[', null]]);
  });
  it('segue a árvore de páginas mesmo quando os fluxos estão gravados em outra ordem no arquivo', async () => {
    const data = await pdfWithPages(['/Span<</ActualText (\\()>> BDC <4C> Tj EMC', '/Span<</ActualText ([)>> BDC <47> Tj EMC /Span<</ActualText (-)>> BDC <59> Tj EMC'], [1, 0]);
    expect(await readSpanActualTexts(data)).toEqual([['('], ['[', '-']]);
  });
  it('troca o caractere sem tradução pelo ActualText e tira o rodapé repetido das páginas', async () => {
    const data = await pdfWithPages(['/Span<</ActualText (\\()>> BDC <4C> Tj EMC', '/Span<</ActualText (-)>> BDC <59> Tj EMC'], [1, 0]);
    const text = (str: string, x: number, y: number) => ({ str, transform: [12, 0, 0, 12, x, y], width: str.length * 6 });
    const span = { type: 'beginMarkedContentProps', tag: 'Span' }, end = { type: 'endMarkedContent' };
    const pages = [
      [text('Raça: Humano-Vampiro', 72, 700), span, text('\u0000', 198, 700), end, text('Domingo)', 204, 700), text('Kael    1', 72, 20)],
      [text('MOD', 72, 700), span, text('\u0000', 72, 680), end, text('9 / 0', 78, 680), text('Kael    2', 72, 20)]
    ];
    const fake = {
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: pages.length,
          getPage: async (number: number) => ({ getTextContent: async () => ({ items: pages[number - 1] }), cleanup() {} })
        }),
        destroy: async () => {}
      })
    };
    const result = await readPdfText(fake as never, data);
    expect(result).toBe('Raça: Humano-Vampiro (Domingo)\nMOD\n-9 / 0');
  });
  it('não inventa caracteres quando as marcações do arquivo e do pdf.js não batem', async () => {
    const data = await pdfWithContent('/Span<</ActualText (\\()>> BDC <4C> Tj EMC');
    const items = [{ str: 'A\u0000B', transform: [12, 0, 0, 12, 72, 700], width: 18 }];
    const fake = { getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items }), cleanup() {} }) }), destroy: async () => {} }) };
    expect(await readPdfText(fake as never, data)).toBe('AB');
  });
});

describe('Montagem de páginas do Notion', () => {
  it('marca o recuo dos blocos internos e junta o parágrafo quebrado pela largura', () => {
    expect(layoutPdfPage([
      piece('Características', 72, 700),
      piece('Rim defeituoso (F)', 84, 680),
      piece('Diminui em 20% da recuperação natural de vida por descanso e', 90, 662, 400),
      piece('mais um pouco.', 90, 648, 80)
    ])).toEqual(['Características', '    Rim defeituoso (F)', '      Diminui em 20% da recuperação natural de vida por descanso e mais um pouco.']);
  });
  it('monta a linha da tabela com célula de duas linhas e as demais centralizadas na vertical', () => {
    const cell = (str: string, x: number, y: number) => piece(str, x, y, str.length * 5, 10);
    expect(layoutPdfPage([
      cell('STATUS', 100, 500), cell('VALOR', 200, 500), cell('MOD', 300, 500),
      cell('Força (0,005)', 100, 480), cell('-52,00', 200, 480), cell('-26 / 20', 300, 480),
      cell('Constituição', 100, 458), cell('-42,00', 200, 452), cell('-21 / 25', 300, 452), cell('(0,01)', 100, 446),
      cell('Ações', 80, 420)
    ])).toEqual([
      '       | STATUS | VALOR | MOD |', '       | --- | --- | --- |', '       | Força (0,005) | -52,00 | -26 / 20 |',
      '       | Constituição (0,01) | -42,00 | -21 / 25 |', '', 'Ações'
    ]);
  });
  it('só tira linhas repetidas no topo ou no rodapé de mais de uma página', () => {
    expect(layoutPdfPages([[piece('Kael', 72, 700), piece('Kael 1', 72, 20)]]).join('|')).toBe('Kael||Kael 1');
    expect(layoutPdfPages([
      [piece('Kael', 72, 700), piece('Idade: 10', 72, 680), piece('Kael 1', 72, 20)],
      [piece('Raça: Humano', 72, 700), piece('Kael 2', 72, 20)]
    ])).toEqual(['Kael', 'Idade: 10', 'Raça: Humano']);
  });
});
