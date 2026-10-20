/**
 * Leitura mínima de ZIP para abrir um arquivo de dentro do .docx, sem bibliotecas: localiza o
 * diretório central, acha a entrada pelo nome e descompacta com o DecompressionStream nativo.
 */
export class ZipError extends Error {}

const CENTRAL_END = 0x06054b50, CENTRAL_ENTRY = 0x02014b50, LOCAL_ENTRY = 0x04034b50;

async function inflate(compressed: Uint8Array, limit: number): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(compressed); controller.close(); } });
  const reader = source.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      // Para no limite: um arquivo pequeno pode descompactar em gigabytes (zip bomb).
      if (total > limit) { void reader.cancel(); throw new ZipError('o conteúdo descompactado passa do limite.'); }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ZipError) throw error;
    throw new ZipError('o arquivo compactado está corrompido.');
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

/** Conteúdo da entrada `name`, ou null se ela não existir no ZIP. */
export async function readZipEntry(data: Uint8Array, name: string, limit: number): Promise<Uint8Array | null> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let end = -1;
  for (let i = data.byteLength - 22; i >= Math.max(0, data.byteLength - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === CENTRAL_END) { end = i; break; }
  }
  if (end < 0) throw new ZipError('não é um arquivo compactado.');
  const count = view.getUint16(end + 10, true);
  let entry = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (entry + 46 > data.byteLength || view.getUint32(entry, true) !== CENTRAL_ENTRY) throw new ZipError('o arquivo compactado está corrompido.');
    const flags = view.getUint16(entry + 8, true), method = view.getUint16(entry + 10, true);
    const compressedSize = view.getUint32(entry + 20, true), size = view.getUint32(entry + 24, true);
    const nameLength = view.getUint16(entry + 28, true);
    const extraLength = view.getUint16(entry + 30, true), commentLength = view.getUint16(entry + 32, true);
    const local = view.getUint32(entry + 42, true);
    const entryName = decoder.decode(data.subarray(entry + 46, entry + 46 + nameLength));
    entry += 46 + nameLength + extraLength + commentLength;
    if (entryName !== name) continue;
    if (flags & 1) throw new ZipError('o arquivo está protegido por senha.');
    if (local + 30 > data.byteLength || view.getUint32(local, true) !== LOCAL_ENTRY) throw new ZipError('o arquivo compactado está corrompido.');
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + compressedSize > data.byteLength) throw new ZipError('o arquivo compactado está incompleto.');
    const compressed = data.subarray(start, start + compressedSize);
    if (method === 0) {
      if (size > limit) throw new ZipError('o conteúdo descompactado passa do limite.');
      return compressed.slice();
    }
    if (method === 8) return inflate(compressed, limit);
    throw new ZipError('o arquivo usa uma compactação desconhecida.');
  }
  return null;
}
