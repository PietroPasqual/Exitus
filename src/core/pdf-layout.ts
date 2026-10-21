/**
 * Um PDF guarda pedaços de texto soltos com posição, sem linhas nem tabelas. Esta montagem
 * refaz as linhas pela altura de cada pedaço e as colunas pelos espaços largos, devolvendo o
 * texto no mesmo formato da ficha em texto (tabelas viram "| a | b |").
 */
export interface PdfTextPiece {
  str: string;
  /** Canto inferior esquerdo, em pontos; no PDF o eixo y cresce para cima. */
  x: number; y: number;
  width: number;
  /** Tamanho aproximado da fonte. */
  size: number;
}

interface Column { x: number; end: number; text: string }

/** Junta os pedaços de uma linha, abrindo uma coluna nova quando o espaço é largo. */
function columns(pieces: PdfTextPiece[]): Column[] {
  const result: Column[] = [];
  for (const piece of [...pieces].sort((a, b) => a.x - b.x)) {
    const last = result[result.length - 1];
    const size = piece.size || 10;
    const gap = last ? piece.x - last.end : 0;
    if (!last || gap > size) {
      result.push({ x: piece.x, end: piece.x + piece.width, text: piece.str });
      continue;
    }
    const spaced = gap > size * 0.12 && !/\s$/.test(last.text) && !/^\s/.test(piece.str);
    last.text += (spaced ? ' ' : '') + piece.str;
    last.end = Math.max(last.end, piece.x + piece.width);
  }
  for (const column of result) column.text = column.text.replace(/\s+/g, ' ').trim();
  return result.filter(column => column.text);
}

interface Row { y: number; size: number; pieces: PdfTextPiece[] }

/** Agrupa os pedaços em linhas pela altura, de cima para baixo. */
function pageRows(pieces: PdfTextPiece[]): Row[] {
  const sorted = pieces.filter(piece => piece.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Row[] = [];
  for (const piece of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row.y - piece.y) <= Math.max(2, Math.min(row.size, piece.size || 10) * 0.45)) row.pieces.push(piece);
    else rows.push({ y: piece.y, size: piece.size || 10, pieces: [piece] });
  }
  // Sobrescritos (o "¹" de "Passiva¹") ficam um pouco acima da linha, em fonte menor: voltam para ela.
  for (let i = rows.length - 2; i >= 0; i--) {
    const small = rows[i], line = rows[i + 1];
    if (small.size < line.size * 0.8 && small.y - line.y > 0 && small.y - line.y <= line.size * 0.8) {
      line.pieces.push(...small.pieces);
      rows.splice(i, 1);
    }
  }
  return rows;
}

const tableLine = (cells: string[]): string => `| ${cells.join(' | ')} |`;
/** Um espaço de recuo a cada 3 pontos: o Notion recua os blocos internos de 3 a 24 pontos. */
const INDENT_STEP = 3;
const rowText = (row: Row): string => columns(row.pieces).map(cell => cell.text).join(' ');
const rowStart = (row: Row): number => Math.min(...row.pieces.map(piece => piece.x));
const rowEnd = (row: Row): number => Math.max(...row.pieces.map(piece => piece.x + piece.width));

/** Retira cabeçalhos e rodapés que se repetem nas páginas (como "Nome do personagem   3"). */
function withoutRunningLines(pages: Row[][]): Row[][] {
  if (pages.length < 2) return pages;
  const keyOf = (row: Row): string => `${rowText(row).replace(/\d+/g, '#').replace(/\s+/g, ' ')}@${Math.round(row.y)}`;
  const counts = new Map<string, number>();
  for (const rows of pages) {
    for (const key of new Set([rows[0], rows[rows.length - 1]].filter(Boolean).map(keyOf))) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const running = (row: Row | undefined): boolean => !!row && (counts.get(keyOf(row)) ?? 0) >= 2;
  return pages.map(rows => rows.filter((row, i) => !((i === 0 || i === rows.length - 1) && running(row))));
}

/** Texto do documento inteiro; uma tabela que atravessa a quebra de página continua inteira. */
export function layoutPdfPages(pages: PdfTextPiece[][]): string[] {
  const pageRowList = withoutRunningLines(pages.map(pageRows));
  const allRows = pageRowList.flat();
  // Tamanho do texto corrido: o mais comum, pesado pela quantidade de letras.
  const weights = new Map<number, number>();
  for (const piece of allRows.flatMap(row => row.pieces)) {
    const size = Math.round(piece.size || 10);
    weights.set(size, (weights.get(size) ?? 0) + piece.str.length);
  }
  const body = [...weights].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
  const margin = allRows.length ? Math.min(...allRows.map(rowStart)) : 0;
  const rightEdge = allRows.length ? Math.max(...allRows.map(rowEnd)) : 0;
  const indent = (x: number): string => ' '.repeat(Math.max(0, Math.round((x - margin) / INDENT_STEP)));

  const lines: string[] = [];
  let header: Column[] | null = null;
  // Linha lógica da tabela em montagem: uma célula pode ocupar várias linhas do PDF.
  let current: { cells: string[]; index: number; isHeader: boolean; prefix: string } | null = null;
  // Última linha de texto corrido, para juntar a continuação de um parágrafo quebrado pela largura.
  type Paragraph = { index: number; x: number; end: number; y: number; size: number };
  let paragraph: Paragraph | null = null;
  const closeTable = (): void => {
    // Uma "linha" só com a primeira coluna não era da tabela: volta a ser texto comum.
    if (current && !current.isHeader && current.cells.slice(1).every(cell => !cell)) {
      lines[current.index] = current.prefix + current.cells[0];
    }
    header = null; current = null;
  };
  for (const rows of pageRowList) {
    let previous: Row | null = null;
    for (const row of rows) {
      const cells = columns(row.pieces);
      if (!cells.length) continue;
      const gap = previous ? previous.y - row.y : Infinity;
      previous = row;
      const tolerance = row.size * 0.8;
      if (header && current) {
        const columnsOf: Column[] = header;
        if (rowStart(row) < columnsOf[0].x - tolerance) closeTable();
        else {
          // Cada pedaço vai para a coluna do cabeçalho em que começa; células vazias ficam vazias.
          const groups: PdfTextPiece[][] = columnsOf.map(() => []);
          for (const piece of row.pieces) {
            let index = 0;
            for (let i = 0; i < columnsOf.length; i++) if (columnsOf[i].x <= piece.x + tolerance) index = i;
            groups[index].push(piece);
          }
          const texts = groups.map(group => columns(group).map(cell => cell.text).join(' '));
          // Mesma linha da tabela: deslocamento de meia linha (células centralizadas) ou quebra dentro da célula.
          const sameRow = gap < row.size * 0.9 || gap <= row.size * 1.6 && (!texts[0] || current.isHeader && texts.filter(Boolean).length === 1);
          if (sameRow) {
            const open = current;
            texts.forEach((text, i) => { if (text) open.cells[i] = open.cells[i] ? `${open.cells[i]} ${text}` : text; });
            lines[open.index] = open.prefix + tableLine(open.cells);
            continue;
          }
          const ended = !current.isHeader && current.cells.slice(1).every(cell => !cell);
          if (!ended) {
            lines.push(current.prefix + tableLine(texts));
            current = { cells: texts, index: lines.length - 1, isHeader: false, prefix: current.prefix };
            continue;
          }
          closeTable();
        }
      }
      if (cells.length >= 3) {
        header = cells;
        const prefix = indent(cells[0].x);
        lines.push(prefix + tableLine(cells.map(cell => cell.text)), prefix + tableLine(cells.map(() => '---')));
        current = { cells: cells.map(cell => cell.text), index: lines.length - 2, isHeader: true, prefix };
        paragraph = null;
        continue;
      }
      const text = cells.map(cell => cell.text).join('    ');
      const x = rowStart(row), end = rowEnd(row);
      // Continuação de parágrafo: linha anterior cheia até a margem direita, mesmo recuo e espaçamento justo.
      if (paragraph && gap <= row.size * 1.6 && Math.abs(paragraph.x - x) <= 1.5 && paragraph.end >= rightEdge - row.size * 6
        && cells.length === 1 && !/^[^\s:]{1,30}( [^\s:]+){0,3}:(\s|$)/.test(text)) {
        const open: Paragraph = paragraph;
        const before = lines[open.index];
        lines[open.index] = /-$/.test(before) && /^[a-zà-ú]/.test(text) ? before + text : `${before} ${text}`;
        paragraph = { index: open.index, x: open.x, end, y: row.y, size: open.size };
        continue;
      }
      // Um espaço vertical grande separa parágrafos, como a linha em branco do texto.
      if (gap !== Infinity && gap > row.size * 2.1 && lines.length && lines[lines.length - 1] !== '') lines.push('');
      // Fonte bem maior que a do corpo é título, como o nome do personagem no topo da página.
      const heading = cells.length === 1 && row.size >= body * 1.45 ? '# ' : '';
      // Duas colunas fora de tabela, como "Vida: 42/65    Energia: 18/30", continuam na mesma linha.
      lines.push(indent(x) + heading + text);
      paragraph = heading ? null : { index: lines.length - 1, x, end, y: row.y, size: row.size };
    }
  }
  closeTable();
  return lines;
}

/** Texto de uma página, linha por linha, de cima para baixo. */
export const layoutPdfPage = (pieces: PdfTextPiece[]): string[] => layoutPdfPages([pieces]);
