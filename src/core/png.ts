/**
 * Codificador de PNG mínimo (RGBA 8 bits, sem compressão), para sprites pequenos.
 * Não usa canvas: funciona no navegador, nos testes e gera sempre os mesmos bytes.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function adler32(bytes: Uint8Array): number {
  let a = 1, b = 0;
  for (const byte of bytes) { a = (a + byte) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}
const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) body[i] = type.charCodeAt(i);
  body.set(data, 4);
  return Uint8Array.from([...u32(data.length), ...body, ...u32(crc32(body))]);
}

/** `rgba` tem width × height × 4 bytes, linha por linha. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 4096 || height > 4096 || rgba.length !== width * height * 4) {
    throw new RangeError('imagem fora das medidas');
  }
  // Cada linha começa com o byte de filtro 0 (sem filtro)
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (1 + width * 4) + 1);
  // zlib com blocos "stored" (sem compressão): cabeçalho 78 01, blocos de até 65535 bytes e Adler-32
  const blocks: number[] = [0x78, 0x01];
  for (let offset = 0; offset < raw.length || offset === 0; offset += 65535) {
    const part = raw.subarray(offset, Math.min(raw.length, offset + 65535));
    const last = offset + 65535 >= raw.length ? 1 : 0;
    blocks.push(last, part.length & 255, part.length >>> 8, ~part.length & 255, (~part.length >>> 8) & 255);
    for (const byte of part) blocks.push(byte);
    if (last) break;
  }
  blocks.push(...u32(adler32(raw)));
  const header = Uint8Array.from([...u32(width), ...u32(height), 8, 6, 0, 0, 0]);
  const parts = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', Uint8Array.from(blocks)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

export function base64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
/** Endereço `data:` pronto para `<image href>` ou `<img src>`. */
export const pngDataUri = (width: number, height: number, rgba: Uint8Array): string =>
  `data:image/png;base64,${base64(encodePng(width, height, rgba))}`;
