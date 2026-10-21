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

/**
 * ActualText de cada marcação /Span, na ordem em que aparecem nos fluxos de conteúdo (null para
 * /Span sem ActualText). Devolve null se o arquivo não puder ser lido assim.
 */
export async function readSpanActualTexts(data: Uint8Array): Promise<(string | null)[] | null> {
  const file = latin1(data);
  const result: (string | null)[] = [];
  let budget = CONTENT_LIMIT;
  // "stream" que não seja o fim de "endstream".
  const marker = /(?<!end)stream\r?\n/g;
  for (let match = marker.exec(file); match; match = marker.exec(file)) {
    const start = match.index + match[0].length;
    let end = file.indexOf('endstream', start);
    if (end < 0) break;
    marker.lastIndex = end + 'endstream'.length;
    // A quebra de linha antes de "endstream" não faz parte dos dados (e o DecompressionStream recusa bytes sobrando).
    if (file[end - 1] === '\n') end--;
    if (file[end - 1] === '\r') end--;
    const head = file.slice(Math.max(0, match.index - 600), match.index);
    const dictionary = head.slice(head.lastIndexOf('obj'));
    if (!/\/FlateDecode/.test(dictionary) || /\/(Subtype|Type)\s*\/(Image|XRef|ObjStm|Metadata)/.test(dictionary)) continue;
    let content: string;
    try {
      const bytes = await inflate(data.subarray(start, end), budget, 'deflate');
      budget -= bytes.byteLength;
      content = latin1(bytes);
    } catch (error) {
      // Passar do limite total encerra a leitura; fluxos que não são zlib válido são ignorados.
      if (error instanceof InflateLimitError) return null;
      continue;
    }
    if (!content.includes('BDC')) continue;
    const span = /\/Span\s*(<<[\s\S]*?>>|\/[^\s/<>[\]()]+)\s*BDC/g;
    for (let found = span.exec(content); found; found = span.exec(content)) {
      const properties = found[1];
      const at = properties.indexOf('/ActualText');
      if (at < 0) { result.push(null); continue; }
      const valueStart = found.index + found[0].indexOf(properties) + at + '/ActualText'.length;
      let i = valueStart;
      while (/\s/.test(content[i] ?? '')) i++;
      const bytes = pdfString(content, i);
      result.push(bytes ? decodeText(bytes) : null);
      // A cadeia pode conter ">>"; continua a busca depois dela.
      span.lastIndex = Math.max(span.lastIndex, i + 1);
    }
  }
  return result;
}
