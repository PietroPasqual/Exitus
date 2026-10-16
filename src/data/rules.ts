import type { Activation, RuneStats, ShapeId } from '../core/types';
import { RUNES } from './runes';
import { SHAPE_META } from './shapes';
import { emptySheet, SHEETS, type RuneSheet, type SheetColumn } from './sheets';

// Regras do Sistema: os números e textos que o admin pode mudar pelo site
// (energia, poder, densidade, faixas das formas, limites de carga…).
// Os valores padrão ficam no código; as mudanças salvas no banco vêm por cima deles.

/** Números usados nos cálculos (carga, especialização e medidas físicas) */
export const CALC = {
  /** Chance de falha logo acima da Ativação perfeita (%); sobe até 100% na Autodestruição */
  falhaInicial: 20,
  /** Estrela sozinha devolve à fonte esta vez a energia guardada nela */
  estrelaRetorno: 1.2,
  /** Locomoção média da energia (energia por segundo: 3 a cada 0,1 s) */
  velocidadeMedia: 30,
  /** Quanto do poder das runas auxiliares entra no total */
  fatorAuxiliar: 0.5,
  /** Simultâneo (refino/densidade): base + N × por runa */
  simultaneoBase: 0.9,
  simultaneoPorRuna: 0.1,
  /** Sequencial (volume/área): base + N × por runa */
  sequencialBase: 1.8,
  sequencialPorRuna: 0.2,
  /** Medidas físicas por ponto de Poder */
  fogoGraus: 20,
  fogoVolume: 0.3,
  ventoForca: 3.5,
  ventoAlcance: 1.5,
  terraDefesa: 2.5,
  terraVolume: 0.45,
  aguaDiluicao: 1.25,
  aguaVolume: 0.5,
  outrosVolume: 0.4
};
export type CalcKey = keyof typeof CALC;

/** Rótulos dos números de cálculo (para o editor) */
export const CALC_LABELS: Record<CalcKey, [string, string]> = {
  falhaInicial: ['Chance de falha ao passar da Ativação perfeita', '% (sobe até 100% na Autodestruição)'],
  estrelaRetorno: ['Estrela: devolve à fonte', 'vezes a energia guardada (1,2 = 20% a mais)'],
  velocidadeMedia: ['Locomoção média da energia', 'energia por segundo (3 a cada 0,1 s = 30)'],
  fatorAuxiliar: ['Poder das auxiliares que entra no total', '0,5 = 50%'],
  simultaneoBase: ['Simultâneo (refino/densidade): base', 'bônus = base + N × por runa'],
  simultaneoPorRuna: ['Simultâneo: por runa elemental', ''],
  sequencialBase: ['Sequencial (volume/área): base', 'bônus = base + N × por runa'],
  sequencialPorRuna: ['Sequencial: por runa elemental', ''],
  fogoGraus: ['Fogo: °C por Poder', 'temperatura'],
  fogoVolume: ['Fogo: cm³ por Poder', 'volume da chama'],
  ventoForca: ['Vento: força por Poder', ''],
  ventoAlcance: ['Vento: metros por Poder (sequencial)', 'alcance'],
  terraDefesa: ['Terra: defesa por Poder', 'densidade / rigidez'],
  terraVolume: ['Terra: m³ por Poder', 'volume de solo/rocha'],
  aguaDiluicao: ['Água: % de diluição por Poder', ''],
  aguaVolume: ['Água: litros por Poder', 'volume hídrico'],
  outrosVolume: ['Outros elementos: unidades por Poder', 'escala do efeito']
};

// ---------- o que o admin muda (guardado no banco como JSON) ----------

export interface RuneOverride {
  name?: string;
  sigil?: string;
  desc?: string;
  passive?: string;
  perfectEffect?: string;
  /** Penalidade de matéria faltante (0,33 = +33% de energia) */
  missingPenalty?: number;
  /** Poder e energia por estado */
  stats?: Partial<Record<Activation, { power?: number; cost?: number }>>;
  /** Modificador de energia (runas de forma e ação) */
  costMod?: number;
  /** Ficha do Grimório (inteira) */
  sheet?: RuneSheet;
}

export interface ShapeOverride { cost?: Partial<Record<Activation, number>>; role?: string }

export interface Overrides {
  runas?: Record<string, RuneOverride>;
  formas?: Partial<Record<ShapeId, ShapeOverride>>;
  calculo?: Partial<Record<CalcKey, number>>;
}

// ---------- padrões (cópia de como está no código) ----------

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const DEFAULT_RUNES = clone(Object.fromEntries(Object.entries(RUNES).map(([id, r]) => [id, {
  name: r.name, sigil: r.sigil, desc: r.desc, passive: r.passive, perfectEffect: r.perfectEffect,
  missingPenalty: r.missingPenalty, costMod: r.costMod, stats: r.stats
}])));
const DEFAULT_SHAPES = clone(SHAPE_META);
const DEFAULT_SHEETS = clone(SHEETS);
const DEFAULT_CALC = { ...CALC };

/** Valores padrão (para mostrar no editor e voltar ao padrão) */
export const defaults = {
  rune: (id: string) => DEFAULT_RUNES[id],
  shape: (id: ShapeId) => DEFAULT_SHAPES[id],
  sheet: (id: string): RuneSheet => clone(DEFAULT_SHEETS[id] ?? emptySheet()),
  calc: (k: CalcKey) => DEFAULT_CALC[k]
};

/** Ficha de uma runa (a atual, já com as mudanças) */
export const sheetOf = (id: string): RuneSheet => SHEETS[id] ?? emptySheet();

// ---------- validação do que vem do banco ----------

const STATES: Activation[] = ['ativacao', 'perfeito', 'instavel'];
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, max = 100000): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined;
const text = (v: unknown, max = 2000): string | undefined => (typeof v === 'string' ? v.slice(0, max) : undefined);
const drop = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function normalizeSheet(raw: unknown): RuneSheet | undefined {
  if (!isObj(raw)) return undefined;
  const s = emptySheet();
  (['quote', 'role', 'effect', 'effect2', 'missing', 'passiveTitle', 'passiveText', 'perfectTitle', 'perfectText', 'notes'] as const)
    .forEach(k => { s[k] = text(raw[k]) ?? ''; });
  const names = isObj(raw.stateNames) ? raw.stateNames : {};
  STATES.forEach(st => { s.stateNames[st] = text(names[st], 60) ?? ''; });
  s.columns = (Array.isArray(raw.columns) ? raw.columns : []).slice(0, 4).filter(isObj).map((c): SheetColumn => {
    const vals = isObj(c.values) ? c.values : {};
    return {
      name: text(c.name, 60) ?? '', unit: text(c.unit, 20) ?? '',
      values: { ativacao: text(vals.ativacao, 400) ?? '', perfeito: text(vals.perfeito, 400) ?? '', instavel: text(vals.instavel, 400) ?? '' }
    };
  });
  return s;
}

/** Só aceita o que existe e tem o tipo certo (os dados vêm da internet) */
export function normalizeOverrides(raw: unknown): Overrides {
  const out: Overrides = {};
  if (!isObj(raw)) return out;
  if (isObj(raw.runas)) {
    const runas: Record<string, RuneOverride> = {};
    Object.entries(raw.runas).forEach(([id, r]) => {
      if (!Object.prototype.hasOwnProperty.call(RUNES, id) || !isObj(r)) return;
      const stats: RuneOverride['stats'] = {};
      if (isObj(r.stats)) {
        STATES.forEach(st => {
          const v = (r.stats as Record<string, unknown>)[st];
          if (isObj(v)) {
            const e = drop({ power: num(v.power), cost: num(v.cost) });
            if (Object.keys(e).length) stats[st] = e;
          }
        });
      }
      const o = drop<RuneOverride>({
        name: text(r.name, 60), sigil: text(r.sigil, 40), desc: text(r.desc), passive: text(r.passive), perfectEffect: text(r.perfectEffect),
        missingPenalty: num(r.missingPenalty, 10), costMod: num(r.costMod, 100),
        stats: Object.keys(stats).length ? stats : undefined, sheet: normalizeSheet(r.sheet)
      });
      if (Object.keys(o).length) runas[id] = o;
    });
    if (Object.keys(runas).length) out.runas = runas;
  }
  if (isObj(raw.formas)) {
    const formas: Overrides['formas'] = {};
    Object.entries(raw.formas).forEach(([id, f]) => {
      if (!Object.prototype.hasOwnProperty.call(SHAPE_META, id) || !isObj(f)) return;
      const cost: ShapeOverride['cost'] = {};
      if (isObj(f.cost)) STATES.forEach(st => { const v = num((f.cost as Record<string, unknown>)[st]); if (v !== undefined) cost[st] = v; });
      const o = drop<ShapeOverride>({ cost: Object.keys(cost).length ? cost : undefined, role: text(f.role) });
      if (Object.keys(o).length) formas[id as ShapeId] = o;
    });
    if (Object.keys(formas).length) out.formas = formas;
  }
  if (isObj(raw.calculo)) {
    const calculo: Overrides['calculo'] = {};
    (Object.keys(CALC) as CalcKey[]).forEach(k => { const v = num((raw.calculo as Record<string, unknown>)[k], 1000); if (v !== undefined) calculo[k] = v; });
    if (Object.keys(calculo).length) out.calculo = calculo;
  }
  return out;
}

// ---------- aplicar ----------

let current: Overrides = {};
/** As mudanças que estão valendo agora */
export const currentOverrides = (): Overrides => clone(current);

/** Volta tudo ao padrão e aplica as mudanças por cima */
export function applyOverrides(raw: unknown): void {
  const o = normalizeOverrides(raw);
  current = o;
  // runas
  Object.entries(DEFAULT_RUNES).forEach(([id, d]) => {
    const r = RUNES[id];
    const x = o.runas?.[id] ?? {};
    r.name = x.name ?? d.name;
    r.sigil = x.sigil ?? d.sigil;
    r.desc = x.desc ?? d.desc;
    r.passive = x.passive ?? d.passive;
    r.perfectEffect = x.perfectEffect ?? d.perfectEffect;
    r.missingPenalty = x.missingPenalty ?? d.missingPenalty;
    r.costMod = x.costMod ?? d.costMod;
    if (d.stats) {
      const stats = clone(d.stats) as Record<Activation, RuneStats>;
      STATES.forEach(st => { Object.assign(stats[st], x.stats?.[st] ?? {}); });
      r.stats = stats;
    }
    // ficha do Grimório
    if (x.sheet) SHEETS[id] = clone(x.sheet);
    else if (DEFAULT_SHEETS[id]) SHEETS[id] = clone(DEFAULT_SHEETS[id]);
    else delete SHEETS[id];
  });
  // formas
  (Object.keys(DEFAULT_SHAPES) as ShapeId[]).forEach(id => {
    const d = DEFAULT_SHAPES[id], x = o.formas?.[id] ?? {}, m = SHAPE_META[id];
    m.cost = { ...d.cost, ...(x.cost ?? {}) };
    m.role = x.role ?? d.role;
  });
  // cálculo
  (Object.keys(DEFAULT_CALC) as CalcKey[]).forEach(k => { CALC[k] = o.calculo?.[k] ?? DEFAULT_CALC[k]; });
}
