import { readZipEntry, ZipError } from '../core/zip';

/** O .docx compacta bem; o limite do XML descompactado protege contra arquivos maliciosos. */
export const DOCX_FILE_LIMIT = 20_000_000;
/** Orçamento do XML descompactado do documento inteiro (texto e estilos somados). */
export const DOCX_XML_LIMIT = 40_000_000;
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export class DocxReadError extends Error {}

interface StyleInfo { basedOn: string; list: { ilvl: number } | null; title: boolean }
const child = (element: Element, name: string): Element | null =>
  Array.from(element.children).find(node => node.namespaceURI === W && node.localName === name) ?? null;
const attr = (element: Element | null, name: string): string | null => element?.getAttributeNS(W, name) ?? element?.getAttribute(`w:${name}`) ?? null;
/** Propriedades como <w:strike/> valem "ligado" sem atributo; w:val="0"/"false" desliga. */
const on = (element: Element | null): boolean => !!element && !['0', 'false', 'off', 'none'].includes(attr(element, 'val') ?? 'true');

function numbering(pPr: Element | null): { ilvl: number } | null | undefined {
  const numPr = pPr && child(pPr, 'numPr');
  if (!numPr) return undefined;
  if (attr(child(numPr, 'numId'), 'val') === '0') return null;
  return { ilvl: Number(attr(child(numPr, 'ilvl'), 'val') ?? 0) || 0 };
}

/** Estilos de lista (como "List Bullet") e de título, seguindo a herança "basedOn". */
function readStyles(xml: string | null): (id: string) => StyleInfo {
  const styles = new Map<string, StyleInfo>();
  if (xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    for (const style of Array.from(doc.getElementsByTagNameNS(W, 'style'))) {
      if (attr(style, 'type') !== 'paragraph') continue;
      const id = attr(style, 'styleId') ?? '';
      const name = (attr(child(style, 'name'), 'val') ?? '').toLowerCase();
      const list = numbering(child(style, 'pPr'));
      styles.set(id, { basedOn: attr(child(style, 'basedOn'), 'val') ?? '', list: list ?? null, title: name === 'title' || name === 'heading 1' });
    }
  }
  return id => {
    const result: StyleInfo = { basedOn: '', list: null, title: false };
    // Sobe a cadeia de herança (com teto, caso o arquivo tenha um ciclo).
    for (let current = styles.get(id), depth = 0; current && depth < 12; current = styles.get(current.basedOn), depth++) {
      result.list ??= current.list;
      result.title ||= current.title;
    }
    return result;
  };
}

/** Texto de um parágrafo com o riscado marcado como ~~assim~~, ignorando revisões apagadas e códigos de campo. */
function paragraphText(paragraph: Element): string {
  const parts: { text: string; struck: boolean }[] = [];
  const visit = (node: Element): void => {
    for (const element of Array.from(node.children)) {
      if (element.namespaceURI !== W) continue;
      const name = element.localName;
      if (name === 'pPr' || name === 'del' || name === 'moveFrom') continue;
      if (name !== 'r') { visit(element); continue; }
      const rPr = child(element, 'rPr');
      const struck = !!rPr && (on(child(rPr, 'strike')) || on(child(rPr, 'dstrike')));
      for (const piece of Array.from(element.children)) {
        if (piece.namespaceURI !== W) continue;
        const text = piece.localName === 't' ? piece.textContent ?? ''
          : piece.localName === 'tab' ? '    '
          : piece.localName === 'br' || piece.localName === 'cr' ? '\n'
          : piece.localName === 'noBreakHyphen' ? '-' : '';
        if (!text) continue;
        const last = parts[parts.length - 1];
        if (last && last.struck === struck) last.text += text;
        else parts.push({ text, struck });
      }
    }
  };
  visit(paragraph);
  return parts.map(({ text, struck }) => {
    if (!struck || !text.trim()) return text;
    const lead = text.match(/^\s*/)![0], trail = text.match(/\s*$/)![0];
    return `${lead}~~${text.trim()}~~${trail}`;
  }).join('');
}

/** Converte o corpo do documento no formato da ficha em texto: listas com "- ", tabelas com "|". */
export function docxToText(documentXml: string, stylesXml: string | null = null): string {
  const doc = new DOMParser().parseFromString(documentXml, 'application/xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  if (!body || doc.getElementsByTagName('parsererror').length) throw new DocxReadError('o conteúdo do documento do Word está corrompido.');
  const style = readStyles(stylesXml);
  const lines: string[] = [];
  const paragraph = (p: Element): void => {
    const pPr = child(p, 'pPr');
    const info = style(attr(pPr && child(pPr, 'pStyle'), 'val') ?? '');
    const direct = numbering(pPr);
    const list = direct === undefined ? info.list : direct;
    const text = paragraphText(p);
    const [first, ...rest] = text.split('\n');
    const prefix = !first.trim() ? '' : list ? `${'    '.repeat(Math.min(list.ilvl, 8))}- ` : info.title ? '# ' : '';
    lines.push(prefix + first, ...rest);
  };
  const cellText = (cell: Element): string =>
    Array.from(cell.getElementsByTagNameNS(W, 'p')).map(paragraphText).map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
  const block = (node: Element): void => {
    for (const element of Array.from(node.children)) {
      if (element.namespaceURI !== W) continue;
      if (element.localName === 'p') paragraph(element);
      else if (element.localName === 'tbl') {
        for (const row of Array.from(element.children).filter(e => e.namespaceURI === W && e.localName === 'tr')) {
          const cells = Array.from(row.children).filter(e => e.namespaceURI === W && e.localName === 'tc').map(cellText);
          lines.push(`| ${cells.map(cell => cell.replace(/\|/g, '/')).join(' | ')} |`);
        }
        lines.push('');
      } else if (element.localName === 'sdt') {
        const content = child(element, 'sdtContent');
        if (content) block(content);
      }
    }
  };
  block(body);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Abre o .docx (um ZIP) e devolve o texto da ficha. */
export async function extractDocxText(data: Uint8Array, xmlLimit = DOCX_XML_LIMIT): Promise<string> {
  // Assinatura de documento OLE: .doc antigo ou .docx protegido por senha.
  if (data[0] === 0xd0 && data[1] === 0xcf && data[2] === 0x11 && data[3] === 0xe0) {
    throw new DocxReadError('é um .doc antigo ou um documento protegido por senha; no Word, salve como .docx sem senha ou como PDF.');
  }
  if (typeof DecompressionStream === 'undefined') throw new DocxReadError('este navegador não abre arquivos .docx; atualize-o ou salve o documento como PDF.');
  try {
    const decoder = new TextDecoder();
    const document = await readZipEntry(data, 'word/document.xml', xmlLimit);
    if (!document) throw new DocxReadError('o arquivo não é um documento do Word (.docx).');
    // Os estilos só servem para reconhecer listas e títulos: se não couberem no que sobrou, o texto é lido sem eles.
    const remaining = xmlLimit - document.byteLength;
    const styles = remaining > 0
      ? await readZipEntry(data, 'word/styles.xml', remaining).catch(error => { if (error instanceof ZipError) return null; throw error; })
      : null;
    const text = docxToText(decoder.decode(document), styles && decoder.decode(styles));
    if (!text) throw new DocxReadError('o documento do Word está vazio.');
    return text;
  } catch (error) {
    if (error instanceof DocxReadError) throw error;
    if (error instanceof ZipError) throw new DocxReadError(`não foi possível abrir o documento do Word: ${error.message}`);
    throw error;
  }
}
