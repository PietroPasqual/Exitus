import { inflate, InflateLimitError } from './zip';

/**
 * O Notion grava alguns caracteres, como "(", "[", "+" e "-", com glifos alternativos que a
 * tabela Unicode da fonte não traduz, e põe o caractere real numa marcação
 * `/Span <</ActualText (...)>> BDC`. O pdf.js informa onde cada /Span começa, mas não o
 * ActualText; esta leitura busca esses textos direto nos fluxos de conteúdo do arquivo.
 */

const CONTENT_LIMIT = 60_000_000;

/** Bytes como texto de 1 byte por caractere, preservando as posições (latin1 de verdade). */
function latin1(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return text;
}

/** Cadeia literal "(...)" ou hexadecimal "<...>" começando em `start`; devolve seus bytes. */
function pdfString(source: string, start: number): number[] | null {
  if (source[start] === '<') {
    const end = source.indexOf('>', start);
    if (end < 0) return null;
    const hex = source.slice(start + 1, end).replace(/\s+/g, '');
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2).padEnd(2, '0'), 16));
    return bytes.some(Number.isNaN) ? null : bytes;
  }
  if (source[start] !== '(') return null;
  const bytes: number[] = [];
  let depth = 0;
  for (let i = start + 1; i < source.length; i++) {
    const char = source[i];
    if (char === '\\') {
      const next = source[++i];
      const escapes: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 };
      if (next in escapes) bytes.push(escapes[next]);
      else if (/[0-7]/.test(next)) {
        const octal = source.slice(i, i + 3).match(/^[0-7]{1,3}/)![0];
        bytes.push(parseInt(octal, 8) & 0xff); i += octal.length - 1;
      } else if (next === '\r' && source[i + 1] === '\n') i++;
      else if (next !== '\n' && next !== '\r') bytes.push(next.charCodeAt(0));
      continue;
    }
    if (char === '(') depth++;
    else if (char === ')' && depth-- === 0) return bytes;
    bytes.push(char.charCodeAt(0));
  }
  return null;
}

/** Texto de uma cadeia PDF: UTF-16BE com marca FE FF, senão 1 byte por caractere. */
function decodeText(bytes: number[]): string {
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let text = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) text += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return text;
  }
  return String.fromCharCode(...bytes);
}

/** ActualText de cada /Span de um fluxo de conteúdo, na ordem (null para /Span sem ActualText). */
function spansOf(content: string): (string | null)[] {
  const result: (string | null)[] = [];
  if (!content.includes('BDC')) return result;
  const span = /\/Span\s*(<<[\s\S]*?>>|\/[^\s/<>[\]()]+)\s*BDC/g;
  for (let found = span.exec(content); found; found = span.exec(content)) {
    const properties = found[1];
    const at = properties.indexOf('/ActualText');
    if (at < 0) { result.push(null); continue; }
    let i = found.index + found[0].indexOf(properties) + at + '/ActualText'.length;
    while (/\s/.test(content[i] ?? '')) i++;
    const bytes = pdfString(content, i);
    result.push(bytes ? decodeText(bytes) : null);
    // A cadeia pode conter ">>"; continua a busca depois dela.
    span.lastIndex = Math.max(span.lastIndex, i + 1);
  }
  return result;
}

/**
 * ActualText das marcações /Span, página por página e na ordem de cada página. Segue o catálogo,
 * a árvore de páginas e o /Contents de cada página, porque os fluxos podem estar gravados no
 * arquivo em outra ordem. Uma página que não dá para ler assim fica null; o arquivo inteiro fica
 * null quando a estrutura não é encontrada ou o limite de descompactação é ultrapassado.
 */
export async function readSpanActualTexts(data: Uint8Array): Promise<((string | null)[] | null)[] | null> {
  const file = latin1(data);
  // Objetos do arquivo; numa atualização incremental vale a última definição de cada número.
  const objects = new Map<number, string>();
  const marker = /(\d+)\s+\d+\s+obj\b/g;
  for (let match = marker.exec(file); match; match = marker.exec(file)) {
    const end = file.indexOf('endobj', marker.lastIndex);
    if (end < 0) break;
    objects.set(Number(match[1]), file.slice(marker.lastIndex, end));
    marker.lastIndex = end;
  }
  const dictionaryOf = (body: string): string => body.split(/\bstream\r?\n/)[0];
  const refsOf = (dictionary: string, name: string): number[] => {
    const value = dictionary.match(new RegExp(`/${name}\\s*(\\[[^\\]]*\\]|\\d+\\s+\\d+\\s+R)`))?.[1] ?? '';
    return [...value.matchAll(/(\d+)\s+\d+\s+R/g)].map(ref => Number(ref[1]));
  };
  const catalog = [...objects.values()].map(dictionaryOf).find(dictionary => /\/Type\s*\/Catalog\b/.test(dictionary));
  if (!catalog) return null;
  // Páginas na ordem da árvore (/Pages > /Kids), sem repetir nós nem descer demais.
  const pages: number[] = [];
  const visited = new Set<number>();
  const walk = (number: number, depth: number): void => {
    if (visited.has(number) || depth > 32 || pages.length > 10_000) return;
    visited.add(number);
    const dictionary = dictionaryOf(objects.get(number) ?? '');
    if (/\/Type\s*\/Pages\b/.test(dictionary)) refsOf(dictionary, 'Kids').forEach(kid => walk(kid, depth + 1));
    else if (/\/Type\s*\/Page\b/.test(dictionary)) pages.push(number);
  };
  refsOf(catalog, 'Pages').forEach(root => walk(root, 0));
  if (!pages.length) return null;

  let budget = CONTENT_LIMIT;
  const readStream = async (number: number): Promise<string | null> => {
    const body = objects.get(number) ?? '';
    const opening = body.match(/\bstream\r?\n/);
    if (!opening || opening.index === undefined) return null;
    const dictionary = body.slice(0, opening.index);
    let raw = body.slice(opening.index + opening[0].length, body.lastIndexOf('endstream'));
    // A quebra de linha antes de "endstream" não faz parte dos dados (e o DecompressionStream recusa bytes sobrando).
    raw = raw.replace(/\r?\n$/, '');
    // Sem filtro, o conteúdo vem direto; com filtro, só o FlateDecode sozinho é lido.
    const filters = dictionary.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/)?.[1].match(/\/\w+/g) ?? [];
    if (!filters.length) return raw;
    if (filters.length !== 1 || filters[0] !== '/FlateDecode') return null;
    const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
    const inflated = await inflate(bytes, budget, 'deflate');
    budget -= inflated.byteLength;
    return latin1(inflated);
  };
  const result: ((string | null)[] | null)[] = [];
  for (const page of pages) {
    const contents = refsOf(dictionaryOf(objects.get(page) ?? ''), 'Contents');
    let spans: (string | null)[] | null = [];
    for (const content of contents) {
      let text: string | null;
      try { text = await readStream(content); }
      catch (error) {
        // Passar do limite total encerra a leitura; um fluxo que não é zlib válido invalida só a página.
        if (error instanceof InflateLimitError) return null;
        text = null;
      }
      if (text === null) { spans = null; break; }
      spans.push(...spansOf(text));
    }
    result.push(spans);
  }
  return result;
}
