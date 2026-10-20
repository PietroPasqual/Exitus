import { layoutPdfPages, type PdfTextPiece } from '../core/pdf-layout';

/** PDFs de ficha costumam ter poucas páginas; o teto evita travar o navegador com arquivos enormes. */
export const PDF_FILE_LIMIT = 20_000_000;
export const PDF_PAGE_LIMIT = 60;

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
export class PdfReadError extends Error {}

/** Extrai o texto de um PDF já carregado, página por página, montando linhas e tabelas. */
export async function readPdfText(pdfjs: PdfJs, data: Uint8Array): Promise<string> {
  // Só o texto interessa: sem carregar fontes nem formulários XFA do arquivo.
  const task = pdfjs.getDocument({ data, disableFontFace: true, enableXfa: false, useSystemFonts: false });
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
    const pages: PdfTextPiece[][] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const pieces: PdfTextPiece[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const [a, b, c, d, x, y] = item.transform as number[];
        pieces.push({ str: item.str, x, y, width: item.width, size: Math.hypot(c, d) || Math.hypot(a, b) || item.height });
      }
      pages.push(pieces);
      page.cleanup();
    }
    const text = layoutPdfPages(pages).join('\n').trim();
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
