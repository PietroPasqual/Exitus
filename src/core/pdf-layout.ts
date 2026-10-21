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
  return rows;
}

const tableLine = (cells: string[]): string => `| ${cells.join(' | ')} |`;

/** Texto do documento inteiro; uma tabela que atravessa a quebra de página continua inteira. */
export function layoutPdfPages(pages: PdfTextPiece[][]): string[] {
  // Tamanho do texto corrido: o mais comum, pesado pela quantidade de letras.
  const weights = new Map<number, number>();
  for (const piece of pages.flat()) {
    if (!piece.str.trim()) continue;
    const size = Math.round(piece.size || 10);
    weights.set(size, (weights.get(size) ?? 0) + piece.str.length);
  }
  const body = [...weights].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
  const lines: string[] = [];
  let header: Column[] | null = null;
  // Última linha da tabela já escrita, para receber o texto que quebrou dentro das células.
  let last: { cells: string[]; index: number; isHeader: boolean } | null = null;
  for (const pieces of pages) {
    let previous: Row | null = null;
    for (const row of pageRows(pieces)) {
      const cells = columns(row.pieces);
      if (!cells.length) continue;
      const gap = previous ? previous.y - row.y : Infinity;
      // Um espaço vertical grande separa parágrafos, como a linha em branco do texto.
      if (!header && previous && gap > Math.max(previous.size, row.size) * 2.1 && lines[lines.length - 1] !== '') lines.push('');
      previous = row;
      const tolerance = row.size * 0.8;
      if (header && last) {
        // Cada pedaço vai para a coluna do cabeçalho em que começa; células vazias ficam vazias.
        const groups: PdfTextPiece[][] = header.map(() => []);
        for (const piece of row.pieces) {
          let index = 0;
          for (let i = 0; i < header.length; i++) if (header[i].x <= piece.x + tolerance) index = i;
          groups[index].push(piece);
        }
        const texts = groups.map(group => columns(group).map(cell => cell.text).join(' '));
        const used = texts.filter(Boolean).length;
        const tight = gap <= row.size * 1.6;
        // Texto quebrado: só nas colunas da direita, ou só na primeira logo abaixo do cabeçalho.
        if (used === 1 && tight && (!texts[0] || last.isHeader)) {
          const current = last;
          texts.forEach((text, i) => { if (text) current.cells[i] = current.cells[i] ? `${current.cells[i]} ${text}` : text; });
          lines[current.index] = tableLine(current.cells);
          continue;
        }
        if (used >= 2) {
          lines.push(tableLine(texts));
          last = { cells: texts, index: lines.length - 1, isHeader: false };
          continue;
        }
        // Texto solto à direita longe da tabela (como o número da página) é ignorado.
        if (!texts[0]) continue;
        header = null; last = null;
      }
      if (cells.length >= 3) {
        header = cells;
        lines.push(tableLine(cells.map(cell => cell.text)), tableLine(cells.map(() => '---')));
        last = { cells: cells.map(cell => cell.text), index: lines.length - 2, isHeader: true };
        continue;
      }
      // Fonte bem maior que a do corpo é título, como o nome do personagem no topo da página.
      const heading = cells.length === 1 && row.size >= body * 1.45 ? '# ' : '';
      // Duas colunas fora de tabela, como "Vida: 42/65    Energia: 18/30", continuam na mesma linha.
      lines.push(heading + cells.map(cell => cell.text).join('    '));
    }
  }
  return lines;
}

/** Texto de uma página, linha por linha, de cima para baixo. */
export const layoutPdfPage = (pieces: PdfTextPiece[]): string[] => layoutPdfPages([pieces]);
