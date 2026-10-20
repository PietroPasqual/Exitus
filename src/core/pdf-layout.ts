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

/** Texto de uma página, linha por linha, de cima para baixo. */
export function layoutPdfPage(pieces: PdfTextPiece[]): string[] {
  const visible = pieces.filter(piece => piece.str.trim());
  const sorted = [...visible].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: { y: number; size: number; pieces: PdfTextPiece[] }[] = [];
  for (const piece of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row.y - piece.y) <= Math.max(2, Math.min(row.size, piece.size || 10) * 0.45)) row.pieces.push(piece);
    else rows.push({ y: piece.y, size: piece.size || 10, pieces: [piece] });
  }
  // Tamanho do texto corrido: o mais comum, pesado pela quantidade de letras.
  const weights = new Map<number, number>();
  for (const piece of visible) {
    const size = Math.round(piece.size || 10);
    weights.set(size, (weights.get(size) ?? 0) + piece.str.length);
  }
  const body = [...weights].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
  const lines: string[] = [];
  let header: Column[] | null = null;
  let previous: { y: number; size: number } | null = null;
  for (const row of rows) {
    const cells = columns(row.pieces);
    if (!cells.length) continue;
    // Um espaço vertical grande separa parágrafos, como a linha em branco do texto.
    if (!header && previous && previous.y - row.y > Math.max(previous.size, row.size) * 2.1 && lines[lines.length - 1] !== '') lines.push('');
    previous = row;
    const tolerance = row.size * 0.8;
    if (header) {
      // Cada pedaço vai para a coluna do cabeçalho em que começa; células vazias ficam vazias.
      const groups: PdfTextPiece[][] = header.map(() => []);
      for (const piece of row.pieces) {
        let index = 0;
        for (let i = 0; i < header.length; i++) if (header[i].x <= piece.x + tolerance) index = i;
        groups[index].push(piece);
      }
      const used = groups.filter(group => group.length).length;
      if (used >= 2) {
        lines.push(`| ${groups.map(group => columns(group).map(cell => cell.text).join(' ')).join(' | ')} |`);
        continue;
      }
      // Texto quebrado dentro de uma célula fica à direita da primeira coluna: continua a tabela.
      if (!groups[0].length) continue;
      header = null;
    }
    if (cells.length >= 3) {
      header = cells;
      lines.push(`| ${cells.map(cell => cell.text).join(' | ')} |`, `| ${cells.map(() => '---').join(' | ')} |`);
      continue;
    }
    // Fonte bem maior que a do corpo é título, como o nome do personagem no topo da página.
    const heading = cells.length === 1 && row.size >= body * 1.45 ? '# ' : '';
    // Duas colunas fora de tabela, como "Vida: 42/65    Energia: 18/30", continuam na mesma linha.
    lines.push(heading + cells.map(cell => cell.text).join('    '));
  }
  return lines;
}
