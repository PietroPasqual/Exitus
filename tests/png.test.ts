import { describe, expect, it } from 'vitest';
import { base64, crc32, encodePng, pngDataUri } from '../src/core/png';
import { inflate } from '../src/core/zip';

const view = (bytes: Uint8Array): DataView => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
/** Lê os pedaços do PNG conferindo o CRC de cada um. */
function chunks(png: Uint8Array): { type: string; data: Uint8Array }[] {
  const out: { type: string; data: Uint8Array }[] = [];
  let at = 8;
  while (at < png.length) {
    const length = view(png).getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    const data = png.subarray(at + 8, at + 8 + length);
    expect(view(png).getUint32(at + 8 + length), `CRC de ${type}`).toBe(crc32(png.subarray(at + 4, at + 8 + length)));
    out.push({ type, data }); at += 12 + length;
  }
  return out;
}
async function decode(png: Uint8Array): Promise<{ width: number; height: number; rgba: Uint8Array }> {
  const parts = chunks(png);
  const header = view(parts[0].data);
  const width = header.getUint32(0), height = header.getUint32(4);
  const raw = await inflate(parts.find(p => p.type === 'IDAT')!.data, 50_000_000, 'deflate');
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    expect(raw[y * (1 + width * 4)], 'filtro da linha').toBe(0);
    rgba.set(raw.subarray(y * (1 + width * 4) + 1, (y + 1) * (1 + width * 4)), y * width * 4);
  }
  return { width, height, rgba };
}

describe('Codificador de PNG', () => {
  it('calcula o CRC-32 padrão', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
  it('gera um PNG válido: assinatura, cabeçalho RGBA 8 bits, CRCs e os mesmos pixels ao decodificar', async () => {
    const rgba = Uint8Array.from({ length: 3 * 2 * 4 }, (_, i) => (i * 37) % 256);
    const png = encodePng(3, 2, rgba);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const parts = chunks(png);
    expect(parts.map(p => p.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    expect([...parts[0].data.subarray(8)]).toEqual([8, 6, 0, 0, 0]);
    const decoded = await decode(png);
    expect([decoded.width, decoded.height]).toEqual([3, 2]);
    expect([...decoded.rgba]).toEqual([...rgba]);
  });
  it('divide imagens grandes em vários blocos sem perder pixels', async () => {
    const width = 200, height = 120;
    const rgba = Uint8Array.from({ length: width * height * 4 }, (_, i) => (i * 7 + (i >> 8)) % 256);
    const png = encodePng(width, height, rgba);
    expect(width * height * 4).toBeGreaterThan(65535 * 1);
    const decoded = await decode(png);
    expect(decoded.rgba).toEqual(rgba);
  });
  it('é determinístico e entrega o endereço data: em base64', () => {
    const rgba = new Uint8Array(16 * 16 * 4).fill(200);
    expect(encodePng(16, 16, rgba)).toEqual(encodePng(16, 16, rgba));
    const uri = pngDataUri(16, 16, rgba);
    expect(uri).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/);
    expect(atob(uri.slice('data:image/png;base64,'.length)).charCodeAt(1)).toBe(80);
    expect(base64(Uint8Array.from([255, 254, 253]))).toBe('//79');
  });
  it('recusa medidas inválidas e dados que não batem', () => {
    expect(() => encodePng(0, 4, new Uint8Array(0))).toThrow(RangeError);
    expect(() => encodePng(2, 2, new Uint8Array(15))).toThrow(RangeError);
    expect(() => encodePng(1.5, 2, new Uint8Array(12))).toThrow(RangeError);
    expect(() => encodePng(5000, 1, new Uint8Array(20000))).toThrow(RangeError);
  });
});
