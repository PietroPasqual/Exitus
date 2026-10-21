import { describe, expect, it } from 'vitest';
import {
  calculateRpgSheet, newRpgSheet, normalizeRpgSheet, rpgCapacities, RPG_STATS, RPG_NUMBER_LIMIT, RPG_NOTES_LIMIT,
  type RpgSheet
} from '../src/core/rpg-sheet';

const row = () => ({ nome: 'Aprendizado', valor: 'F', notas: 'Conforme o mestre' });
const clone = (): RpgSheet => JSON.parse(JSON.stringify(newRpgSheet()));

describe('Modelo de ficha fornecido pelo mestre', () => {
  it('usa os valores iniciais da referência sem inventar resultados das rolagens', () => {
    const sheet = newRpgSheet();
    expect(sheet.version).toBe(1);
    expect(sheet.descricao.idade).toBeNull();
    expect(sheet.descricao.aparencia).toBeNull();
    expect(sheet.elementos.almaDado).toBeNull();
    expect(sheet.arquetipo).toBe('');
    expect(sheet.estado).toBe('Natural');
    expect(sheet.recursos).toEqual({
      vida: { atual: 50, maximo: 50 }, fadiga: { atual: 20, maximo: 20 },
      psicologico: { atual: 10, maximo: 10 }, energia: { atual: 10, maximo: 10 }
    });
    expect(Object.values(sheet.acoes).every(value => value.atual === 1 && value.maximo === 1 && value.mvs === 0 && value.dr === 0)).toBe(true);
    for (const [key, value] of Object.entries(sheet.estatisticas)) {
      expect(value).toEqual({
        valor: 0, modificador: -20, alteracao: '', dr: 0, talento: null, limite: '',
        desbloqueada: key !== 'poder' && key !== 'energia', critico: 0, rank: ''
      });
    }
    expect(normalizeRpgSheet(JSON.parse(JSON.stringify(sheet)))).toEqual(sheet);
  });

  it('mantém fichas, estatísticas, recursos, ações e listas independentes', () => {
    const first = newRpgSheet();
    const second = newRpgSheet();
    first.estatisticas.forca.valor = 99;
    first.recursos.vida.atual = 1;
    first.acoes.fisica.atual = 0;
    first.progressao.classes.push(row());
    expect(first.estatisticas.constituicao.valor).toBe(0);
    expect(first.recursos.fadiga.atual).toBe(20);
    expect(first.acoes.mental.atual).toBe(1);
    expect(second).toEqual(newRpgSheet());
  });

  it('preserva e copia todas as seções em uma exportação e importação', () => {
    const sheet = newRpgSheet();
    sheet.descricao = { idade: 24.5, sexo: 'Outro', raca: 'Árvore', altura: '1,80 m', peso: 'Variável', extra: 'Fotossíntese', aparencia: 16, estetica: 'Exótico' };
    sheet.arquetipo = 'amago';
    sheet.progressao = { rank: 'F+', avancos: 3, ascensoes: 1, existencia: 50.5, pontosEvolutivos: 12, nivel: '31 (D)', statusTotal: '251', classes: [row()], subclasses: [row()], estilos: [row()], pilar: 'Floresta', talentos: [row()] };
    sheet.elementos = { alma: 'Terra', almaDado: 4, proficiencias: [row()], elementario: 'Raiz', pilar: 'Vida', extus: 'Extus', runas: [row()], etereos: [{ nome: 'Água', valor: '0,1%', notas: 'Elemento comum adicional' }] };
    sheet.estado = 'Fragmentado';
    sheet.estatisticas.poder = { valor: 17.5, modificador: -10, alteracao: '+2 temporário', dr: 3, talento: 2, limite: 'Mestre', desbloqueada: true, critico: 2, rank: 'E' };
    sheet.recursosExtras = [{ nome: 'Energia Celestial', atual: 89.4, maximo: 110 }];
    sheet.defesas = { fisica: '3 + 2', mental: '1', energetica: '1/8', geral: '0,3' };
    sheet.efeitos = { primeiro: 'Primeiro', resumo: 'Resumo' };
    sheet.pericias = [{ nome: 'Domar', etapa: '1', grau: 'F', execucao: 'Consenso', tipo: 'Aprendizado', efeito: 'Acalmar', condicao: 'Floresta', complementar: 'Água', fundamentos: 'Ecossistema' }];
    sheet.inventario = [{ nome: 'Sementes', quantidade: 'um punhado', rank: 'F', local: 'Acesso rápido', notas: 'Nativas' }];
    sheet.caracteristicas = [row()]; sheet.feitos = [row()]; sheet.titulos = [row()];
    sheet.historia = { jornada: 'Transcendeu para um corpo humanoide', aprendizado: 'Entender sua evolução' };
    sheet.calculo.elemento = 0.1;
    const restored = normalizeRpgSheet(JSON.parse(JSON.stringify(sheet)))!;
    expect(restored).toEqual(sheet);
    restored.progressao.classes[0].notas = 'Outra';
    restored.estatisticas.poder.valor = 22;
    expect(sheet.progressao.classes[0].notas).toBe('Conforme o mestre');
    expect(sheet.estatisticas.poder.valor).toBe(17.5);
  });

  it('calcula apenas as equações explícitas sem mudar máximos, valores ou desbloqueios', () => {
    const sheet = newRpgSheet();
    sheet.estatisticas.constituicao.modificador = 2;
    sheet.estatisticas.vontade.modificador = 3;
    sheet.estatisticas.energia.modificador = 4;
    sheet.estatisticas.poder.modificador = 5;
    sheet.estatisticas.forca.talento = 8;
    sheet.descricao.idade = 20;
    sheet.progressao.existencia = 50;
    sheet.calculo.elemento = 6;
    const before = JSON.stringify(sheet);
    const result = calculateRpgSheet(sheet);
    expect(result.recursos).toEqual({ vida: 145, fadiga: 145, psicologico: 33, energia: 58 });
    expect(result.estatisticas.forca.valorDiario).toBeCloseTo(0.54);
    expect(result.estatisticas.forca.limiteDeGanho).toBeCloseTo(5.4);
    expect(result.estatisticas.forca.valorPorIdade).toBeCloseTo(3942);
    expect(result.consenso).toBe(50);
    expect(result.cadeiaDeSubstancia).toBe(4.5);
    expect(result.energias).toEqual({ demoniaca: 156, celeste: 44, pilar: 59 });
    expect(JSON.stringify(sheet)).toBe(before);
    expect(sheet.estatisticas.forca.valor).toBe(0);
    expect(sheet.estatisticas.energia.desbloqueada).toBe(false);
  });

  it('não confunde os recursos iniciais com os máximos sugeridos pelas fórmulas', () => {
    const sheet = newRpgSheet();
    const result = calculateRpgSheet(sheet);
    expect(result.recursos).toEqual({ vida: 35, fadiga: 10, psicologico: 10, energia: 10 });
    expect(sheet.recursos.vida.maximo).toBe(50);
    expect(sheet.recursos.fadiga.maximo).toBe(20);
    expect(result.estatisticas.forca).toEqual({ valorDiario: null, limiteDeGanho: null, valorPorIdade: null });
    expect(result.consenso).toBeNull();
    expect(result.cadeiaDeSubstancia).toBeNull();
    expect(result.energias).toEqual({ demoniaca: null, celeste: null, pilar: null });
  });

  it('distingue valor zero de dados ausentes e mantém resultados negativos', () => {
    const sheet = newRpgSheet();
    sheet.estatisticas.forca.talento = 0;
    sheet.descricao.idade = 0;
    sheet.progressao.existencia = 0;
    sheet.calculo.elemento = 0;
    sheet.estatisticas.constituicao.modificador = -30;
    expect(calculateRpgSheet(sheet).estatisticas.forca).toEqual({ valorDiario: 0.04, limiteDeGanho: 0.4, valorPorIdade: 0 });
    expect(calculateRpgSheet(sheet).recursos.vida).toBe(-15);
    expect(calculateRpgSheet(sheet).consenso).toBe(0);
    expect(calculateRpgSheet(sheet).cadeiaDeSubstancia).toBe(-0);
    expect(calculateRpgSheet(sheet).energias.celeste).toBe(-10);
    sheet.descricao.idade = null;
    expect(calculateRpgSheet(sheet).estatisticas.forca.valorPorIdade).toBeNull();
    expect(calculateRpgSheet(sheet).estatisticas.forca.valorDiario).toBe(0.04);
  });

  it('apresenta as capacidades de Ramo, Justo e Tales sem apagar escolhas salvas', () => {
    const sheet = newRpgSheet();
    expect(rpgCapacities(sheet)).toEqual({ classes: 1, subclasses: 1, estilos: 2, talentos: 1, pericias: 3, runas: 10, proficiencias: 3 });
    sheet.arquetipo = 'ramo';
    expect(rpgCapacities(sheet).subclasses).toBe(2);
    sheet.progressao.avancos = 3;
    sheet.progressao.ascensoes = 2;
    sheet.arquetipo = 'justo';
    expect(rpgCapacities(sheet).pericias).toBe(7);
    sheet.arquetipo = 'tales';
    expect(rpgCapacities(sheet).talentos).toBe(10);
    sheet.progressao.talentos = Array.from({ length: 10 }, row);
    sheet.arquetipo = 'ente';
    expect(rpgCapacities(sheet).talentos).toBe(1);
    expect(normalizeRpgSheet(sheet)?.progressao.talentos).toHaveLength(10);
    expect(sheet.progressao.talentos).toHaveLength(10);
  });

  it.each([
    null, [], '', 1, {}, { ...newRpgSheet(), version: 2 }, { ...newRpgSheet(), version: '1' },
    { ...newRpgSheet(), descricao: [] }, { ...newRpgSheet(), estatisticas: null },
    { ...newRpgSheet(), recursos: { vida: { atual: 50, maximo: 50 } } },
    { ...newRpgSheet(), acoes: [] }, { ...newRpgSheet(), historia: '' },
    { ...newRpgSheet(), pericias: {} }, { ...newRpgSheet(), inventario: [null] }
  ])('rejeita estrutura ou versão inválida: %#', raw => {
    expect(normalizeRpgSheet(raw)).toBeNull();
  });

  it('aceita arquétipo e estado escritos pelo mestre e abre fichas salvas antes dos campos novos', () => {
    const sheet = clone();
    sheet.arquetipo = 'Pilarasdaar'; sheet.estado = 'Pilar';
    expect(normalizeRpgSheet(sheet)).toEqual(sheet);
    const old = JSON.parse(JSON.stringify(newRpgSheet()));
    delete old.recursosExtras; delete old.progressao.nivel; delete old.progressao.statusTotal;
    for (const stat of Object.values(old.estatisticas) as Record<string, unknown>[]) { delete stat.critico; delete stat.rank; }
    expect(normalizeRpgSheet(old)).toEqual(newRpgSheet());
  });

  it('rejeita enums desconhecidos, números não finitos e contadores incompatíveis sem coerção', () => {
    const changes: ((sheet: RpgSheet) => void)[] = [
      sheet => { sheet.arquetipo = 'x'.repeat(121); },
      sheet => { sheet.estado = 3 as unknown as string; },
      sheet => { sheet.estatisticas.forca.critico = NaN; },
      sheet => { sheet.estatisticas.forca.rank = 'x'.repeat(121); },
      sheet => { sheet.recursosExtras = Array.from({ length: 7 }, () => ({ nome: 'Extra', atual: 1, maximo: 1 })); },
      sheet => { sheet.recursosExtras = [{ nome: 'Extra', atual: Infinity, maximo: 1 }]; },
      sheet => { sheet.estatisticas.forca.valor = NaN; },
      sheet => { sheet.estatisticas.forca.modificador = Infinity; },
      sheet => { sheet.estatisticas.forca.talento = -Infinity; },
      sheet => { sheet.estatisticas.forca.dr = -1; },
      sheet => { sheet.estatisticas.forca.dr = 0.5; },
      sheet => { sheet.estatisticas.forca.desbloqueada = 1 as unknown as boolean; },
      sheet => { sheet.descricao.idade = -1; },
      sheet => { sheet.descricao.idade = '20' as unknown as number; },
      sheet => { sheet.progressao.avancos = 1.5; },
      sheet => { sheet.progressao.ascensoes = -1; },
      sheet => { sheet.progressao.pontosEvolutivos = -1; },
      sheet => { sheet.acoes.mental.mvs = 0.5; },
      sheet => { sheet.elementos.almaDado = 5; },
      sheet => { sheet.elementos.almaDado = 1.5; },
      sheet => { sheet.recursos.vida.atual = RPG_NUMBER_LIMIT + 1; },
      sheet => { sheet.calculo.elemento = '2' as unknown as number; }
    ];
    for (const change of changes) {
      const sheet = clone(); change(sheet);
      expect(normalizeRpgSheet(sheet)).toBeNull();
    }
    const sheet = clone();
    sheet.pericias.push({ nome: '', etapa: '', grau: '', execucao: 'Livre' as 'Ação', tipo: '', efeito: '', condicao: '', complementar: '', fundamentos: '' });
    expect(normalizeRpgSheet(sheet)).toBeNull();
    sheet.pericias[0].execucao = '';
    sheet.pericias[0].tipo = 'Outro' as 'Talento';
    expect(normalizeRpgSheet(sheet)).toBeNull();
    sheet.pericias = [];
    sheet.inventario.push({ nome: '', quantidade: '', rank: '', local: 'Bolso' as 'Base', notas: '' });
    expect(normalizeRpgSheet(sheet)).toBeNull();
  });

  it('limita o armazenamento sem truncar texto ou linhas de uma importação', () => {
    const sheet = newRpgSheet();
    sheet.historia.jornada = 'x'.repeat(6000);
    sheet.progressao.classes = Array.from({ length: 50 }, row);
    sheet.inventario = Array.from({ length: 100 }, () => ({ nome: 'Item', quantidade: '1', rank: '', local: 'Base' as const, notas: 'x'.repeat(RPG_NOTES_LIMIT) }));
    expect(normalizeRpgSheet(sheet)).toEqual(sheet);
    sheet.historia.jornada += 'x';
    expect(normalizeRpgSheet(sheet)).toBeNull();
    sheet.historia.jornada = '';
    sheet.progressao.classes.push(row());
    expect(normalizeRpgSheet(sheet)).toBeNull();
    sheet.progressao.classes = [];
    sheet.inventario.push({ nome: '', quantidade: '', rank: '', local: 'Base', notas: '' });
    expect(normalizeRpgSheet(sheet)).toBeNull();
    sheet.inventario = [];
    sheet.descricao.raca = 'x'.repeat(121);
    expect(normalizeRpgSheet(sheet)).toBeNull();
    sheet.descricao.raca = '';
    sheet.caracteristicas.push({ nome: '', valor: '', notas: 'x'.repeat(RPG_NOTES_LIMIT + 1) });
    expect(normalizeRpgSheet(sheet)).toBeNull();
  });

  it('remove propriedades e protótipos externos e não aceita campos herdados ou getters', () => {
    const raw = clone() as RpgSheet & { admin?: boolean };
    raw.admin = true;
    raw.descricao = Object.assign(Object.create({ admin: true }), raw.descricao);
    raw.progressao.classes = [JSON.parse('{"nome":"Estudioso","valor":"F","notas":"","__proto__":{"admin":true}}')];
    const restored = normalizeRpgSheet(raw)!;
    expect(restored).not.toHaveProperty('admin');
    expect(restored.descricao).not.toHaveProperty('admin');
    expect(restored.progressao.classes[0]).not.toHaveProperty('__proto__.admin');
    expect(Object.getPrototypeOf(restored.descricao)).toBe(Object.prototype);
    expect(Object.prototype).not.toHaveProperty('admin');
    expect(normalizeRpgSheet(Object.create(newRpgSheet()))).toBeNull();
    let executed = false;
    Object.defineProperty(raw, 'arquetipo', { get: () => { executed = true; return 'ramo'; } });
    expect(normalizeRpgSheet(raw)).toBeNull();
    expect(executed).toBe(false);
  });

  it('rejeita campos necessários ausentes e listas esparsas em vez de substituí-los', () => {
    const raw = clone();
    delete (raw.descricao as Partial<RpgSheet['descricao']>).sexo;
    expect(normalizeRpgSheet(raw)).toBeNull();
    const second = clone();
    second.titulos = new Array(1);
    expect(normalizeRpgSheet(second)).toBeNull();
    for (const stat of Object.keys(RPG_STATS)) {
      const missing = clone();
      delete (missing.estatisticas as Record<string, unknown>)[stat];
      expect(normalizeRpgSheet(missing)).toBeNull();
    }
  });

  it('guarda elementos etérios e suas porcentagens separadamente da alma e rejeita listas inválidas', () => {
    const sheet = newRpgSheet();
    expect(sheet.elementos.etereos).toEqual([]);
    sheet.arquetipo = 'ente';
    sheet.elementos.alma = 'Luz';
    sheet.elementos.etereos = [{ nome: 'Fogo', valor: '0,1%', notas: 'Roleta Elemental' }, { nome: 'Água', valor: '1d4+1d6+1d8', notas: 'Comum adicional' }];
    const restored = normalizeRpgSheet(JSON.parse(JSON.stringify(sheet)))!;
    expect(restored.elementos.etereos).toEqual(sheet.elementos.etereos);
    expect(restored.elementos.alma).toBe('Luz');
    expect(restored.elementos.proficiencias).toEqual([]);
    sheet.elementos.etereos = Array.from({ length: 50 }, row);
    expect(normalizeRpgSheet(sheet)?.elementos.etereos).toHaveLength(50);
    sheet.elementos.etereos.push(row());
    expect(normalizeRpgSheet(sheet)).toBeNull();
    sheet.elementos.etereos = [null as unknown as RpgSheet['elementos']['etereos'][number]];
    expect(normalizeRpgSheet(sheet)).toBeNull();
    sheet.elementos.etereos = {} as RpgSheet['elementos']['etereos'];
    expect(normalizeRpgSheet(sheet)).toBeNull();
  });
});
