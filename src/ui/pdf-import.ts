import { readSpanActualTexts } from '../core/pdf-actual-text';
import { layoutPdfPages, type PdfTextPiece } from '../core/pdf-layout';

/** PDFs de ficha costumam ter poucas páginas; o teto evita travar o navegador com arquivos enormes. */
export const PDF_FILE_LIMIT = 20_000_000;
export const PDF_PAGE_LIMIT = 60;

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
export class PdfReadError extends Error {}

/** Extrai o texto de um PDF já carregado, página por página, montando linhas e tabelas. */
export async function readPdfText(pdfjs: PdfJs, data: Uint8Array): Promise<string> {
  // Lido antes de abrir: o pdf.js pode transferir os bytes para o worker.
  const actualTexts = await readSpanActualTexts(data).catch(() => null);
  // Só o texto interessa: sem carregar fontes nem formulários XFA do arquivo.
  const task = pdfjs.getDocument({ data: data.slice(), disableFontFace: true, enableXfa: false, useSystemFonts: false });
  let document;
  try {
    document = await task.promise;
  } catch (error) {
    void task.destroy();
    if ((error as { name?: string })?.name === 'PasswordException') throw new PdfReadError('o PDF está protegido por senha.');
    throw new PdfReadError('não foi possível abrir o PDF; o arquivo pode estar corrompido.');
  }
  try {
    if (document.numPages > PDF_PAGE_LIMIT) throw new PdfReadError(`o PDF tem ${document.numPages} páginas; o limite é ${PDF_PAGE_LIMIT}.`);
    const pages: { piece: PdfTextPiece; span: number }[][] = [];
    // Cada marcação /Span recebe um número dentro da página, para achar o seu ActualText.
    const spanCounts: number[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      let spans = 0;
      const page = await document.getPage(number);
      const content = await page.getTextContent({ includeMarkedContent: true });
      const pieces: { piece: PdfTextPiece; span: number }[] = [];
      const open: number[] = [];
      for (const item of content.items) {
        if (!('str' in item)) {
          if (item.type === 'endMarkedContent') open.pop();
          else open.push((item as { tag?: string }).tag === 'Span' ? spans++ : -1);
          continue;
        }
        const [a, b, c, d, x, y] = item.transform as number[];
        const span = [...open].reverse().find(index => index >= 0) ?? -1;
        pieces.push({ piece: { str: item.str, x, y, width: item.width, size: Math.hypot(c, d) || Math.hypot(a, b) || item.height }, span });
      }
      pages.push(pieces);
      spanCounts.push(spans);
      page.cleanup();
    }
    const text = layoutPdfPages(pages.map((page, index) => {
      // Só usa os ActualText da página se as marcações dela no arquivo e no pdf.js forem as mesmas.
      const fromFile = actualTexts && actualTexts.length === pages.length ? actualTexts[index] : null;
      const actual = fromFile && fromFile.length === spanCounts[index] ? fromFile : null;
      return page.map(({ piece, span }) => {
      if (!piece.str.includes('\u0000')) return piece;
      // Caractere sem tradução: usa o ActualText da marcação em volta, ou descarta o caractere nulo.
      const replacement = actual && span >= 0 ? actual[span] : null;
      return { ...piece, str: piece.str.replace(/\u0000+/g, replacement ?? '') };
      });
    })).join('\n').trim();
    if (!text) throw new PdfReadError('o PDF não tem texto selecionável (parece ser uma imagem ou digitalização).');
    return text;
  } finally {
    void task.destroy();
  }
}

/** Carrega o pdf.js só quando um PDF é importado, para não pesar na abertura do site. */
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  let pdfjs: PdfJs;
  try {
    const [library, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    ]);
    pdfjs = library;
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  } catch {
    throw new PdfReadError('não foi possível carregar o leitor de PDF; verifique a conexão e tente de novo.');
  }
  return readPdfText(pdfjs, new Uint8Array(data));
}
