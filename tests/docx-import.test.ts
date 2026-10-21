// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readCharacterText } from '../src/core/character-text';
import { readZipEntry, ZipError } from '../src/core/zip';
import { DocxReadError, docxToText, extractDocxText } from '../src/ui/docx-import';
import { expectKael } from './fixtures/kael-expectations';

// Gerado por scripts/compose-ficha-docx.py a partir de fixtures/ficha-texto.md.
async function fixture(): Promise<Uint8Array> {
  const fs = await import(/* @vite-ignore */ 'node:fs/promises' as string) as { readFile: (path: string) => Promise<Uint8Array> };
  return new Uint8Array(await fs.readFile('tests/fixtures/ficha-texto.docx'));
}
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const doc = (body: string): string => `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`;

describe('Ficha importada de um documento do Word (.docx)', () => {
  it('lê a ficha inteira, inclusive o riscado que bloqueia a Energia', async () => {
    const text = await extractDocxText(await fixture());
    expectKael(readCharacterText(text, 'Kael.docx'));
  });
  it('junta runs quebrados, marca o riscado e ignora revisões apagadas e códigos de campo', () => {
    expect(docxToText(doc(`
      <w:p><w:r><w:t>Ida</w:t></w:r><w:r><w:t xml:space="preserve">de: </w:t></w:r><w:ins><w:r><w:t>24</w:t></w:r></w:ins><w:del><w:r><w:delText>99</w:delText></w:r></w:del></w:p>
      <w:p><w:r><w:rPr><w:strike/></w:rPr><w:t>Proficiência:</w:t></w:r><w:r><w:rPr><w:strike w:val="1"/></w:rPr><w:t xml:space="preserve"> - - -</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:strike w:val="0"/></w:rPr><w:t>Alma: Fogo</w:t></w:r></w:p>
      <w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGE</w:instrText></w:r><w:r><w:t>Rank: D</w:t></w:r><w:r><w:tab/><w:t>X</w:t><w:br/><w:t>Y</w:t></w:r></w:p>
      <w:p><w:hyperlink><w:r><w:t>Origem: Ermo</w:t></w:r></w:hyperlink></w:p>`))).toBe(
      'Idade: 24\n~~Proficiência: - - -~~\nAlma: Fogo\nRank: D    X\nY\nOrigem: Ermo');
  });
  it('reconhece marcadores diretos e por estilo, títulos, tabelas e controles de conteúdo', () => {
    const styles = `<w:styles ${W}>
      <w:style w:type="paragraph" w:styleId="Ttulo"><w:name w:val="Title"/></w:style>
      <w:style w:type="paragraph" w:styleId="Lista"><w:name w:val="List Bullet"/><w:pPr><w:numPr><w:numId w:val="3"/></w:numPr></w:pPr></w:style>
      <w:style w:type="paragraph" w:styleId="Lista2"><w:name w:val="Minha lista"/><w:basedOn w:val="Lista"/></w:style>
    </w:styles>`;
    expect(docxToText(doc(`
      <w:p><w:pPr><w:pStyle w:val="Ttulo"/></w:pPr><w:r><w:t>Kael</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="Lista2"/></w:pPr><w:r><w:t>Inventário</w:t></w:r></w:p>
      <w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="5"/></w:numPr></w:pPr><w:r><w:t>Corda</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="Lista"/><w:numPr><w:numId w:val="0"/></w:numPr></w:pPr><w:r><w:t>Sem marcador</w:t></w:r></w:p>
      <w:sdt><w:sdtContent><w:p><w:r><w:t>Raça: Anão</w:t></w:r></w:p></w:sdtContent></w:sdt>
      <w:tbl><w:tr><w:tc><w:p><w:r><w:t>STATUS</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>MOD</w:t></w:r></w:p></w:tc></w:tr>
        <w:tr><w:tc><w:p><w:r><w:rPr><w:dstrike/></w:rPr><w:t>Poder (4)</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>-16 | ??</w:t></w:r></w:p><w:p><w:r><w:t>nota</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`), styles)).toBe(
      '# Kael\n- Inventário\n    - Corda\nSem marcador\nRaça: Anão\n| STATUS | MOD |\n| ~~Poder (4)~~ | -16 / ?? nota |');
  });
  it('explica arquivos que não são .docx legíveis e protege contra conteúdo gigante', async () => {
    await expect(extractDocxText(new TextEncoder().encode('texto qualquer'))).rejects.toThrow(/não foi possível abrir o documento do Word/);
    await expect(extractDocxText(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]))).rejects.toThrow(/\.doc antigo ou um documento protegido/);
    await expect(extractDocxText(new Uint8Array(0))).rejects.toBeInstanceOf(DocxReadError);
    const data = await fixture();
    expect(await readZipEntry(data, 'nao/existe.xml', 1_000_000)).toBeNull();
    await expect(readZipEntry(data, 'word/document.xml', 1000)).rejects.toBeInstanceOf(ZipError);
  });
  it('soma texto e estilos no mesmo limite de XML descompactado', async () => {
    const data = await fixture();
    const documentSize = (await readZipEntry(data, 'word/document.xml', 10_000_000))!.byteLength;
    await expect(extractDocxText(data, documentSize - 1)).rejects.toThrow(/passa do limite/);
    // Sem orçamento para os estilos, o texto é lido mesmo assim, só sem os marcadores que vêm deles.
    const withoutStyles = await extractDocxText(data, documentSize + 10);
    expect(withoutStyles).toContain('\nIdade: 24 anos');
    expect(withoutStyles).not.toContain('- Descrição');
    expect(await extractDocxText(data)).toContain('- Descrição');
  });
  it('lê tabelas de campos e valores do Word', () => {
    const cell = (text: string) => `<w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
    const text = docxToText(doc(`<w:tbl><w:tr>${cell('Idade')}${cell('31')}</w:tr><w:tr>${cell('Vida: 40/60')}${cell('Energia: 5/9')}${cell('Fadiga: 7/8')}</w:tr></w:tbl>`));
    const reading = readCharacterText(text);
    if (!reading.ok) throw new Error(reading.problem);
    expect(reading.character.rpg!.descricao.idade).toBe(31);
    expect(reading.character.rpg!.recursos).toMatchObject({ vida: { atual: 40, maximo: 60 }, energia: { atual: 5, maximo: 9 }, fadiga: { atual: 7, maximo: 8 } });
  });
});
