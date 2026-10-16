import { cloudClient, isAdmin } from '../cloud/account';
import { rememberRules, rulesSavedAt } from '../cloud/rules';
import { escapeHtml } from '../core/format';
import type { Activation, ShapeId } from '../core/types';
import { applyOverrides, CALC_LABELS, currentOverrides, defaults, normalizeOverrides, type CalcKey, type Overrides, type RuneOverride } from '../data/rules';
import { RUNES } from '../data/runes';
import { SHAPE_META } from '../data/shapes';
import type { RuneSheet } from '../data/sheets';
import { byId } from './dom';

// Editor das Regras do Sistema (só admin): energia, poder, densidade, volume, textos do
// Grimório, formas e números de cálculo. As mudanças aparecem na hora (rascunho) e só valem
// para todo mundo ao salvar no banco.

type Tab = 'runas' | 'formas' | 'calculo' | 'historico';
const STATES: Activation[] = ['ativacao', 'perfeito', 'instavel'];
const STATE_LABEL: Record<Activation, string> = { ativacao: 'Mínimo', perfeito: 'Perfeito', instavel: 'Instável' };

let draft: Overrides = {};
let saved: Overrides = {};
let tab: Tab = 'runas';
let runeId = 'fogo';
let refresh: () => void = () => {};
let timer = 0;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? {})) as T;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const dirty = (): boolean => !same(normalizeOverrides(draft), normalizeOverrides(saved));
const br = (n: number | undefined): string => (n === undefined ? '' : String(Math.round(n * 1000) / 1000).replace('.', ','));
const parseNum = (v: string): number | null => {
  const n = Number(v.trim().replace(',', '.'));
  return v.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};

function msg(text: string, kind: '' | 'ok' | 'erro' = ''): void {
  const el = byId('rulesMsg');
  el.textContent = text;
  el.className = `account-msg${kind ? ' ' + kind : ''}`;
}

/** Aplica o rascunho no site (só neste aparelho) e redesenha, sem pressa */
function preview(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    applyOverrides(draft);
    refresh();
    msg(dirty() ? 'Alterações ainda não salvas.' : '');
  }, 200);
}

// ---------- rascunho de uma runa ----------

const runeDraft = (id: string): RuneOverride => {
  draft.runas ??= {};
  draft.runas[id] ??= {};
  return draft.runas[id];
};
function cleanRune(id: string): void {
  const r = draft.runas?.[id];
  if (r && !Object.keys(r).length) delete draft.runas?.[id];
}
const sheetDraft = (id: string): RuneSheet => clone(draft.runas?.[id]?.sheet ?? defaults.sheet(id));
function setSheet(id: string, s: RuneSheet): void {
  const r = runeDraft(id);
  if (same(s, defaults.sheet(id))) delete r.sheet;
  else r.sheet = s;
  cleanRune(id);
}

// ---------- telas de cada aba ----------

const field = (label: string, input: string, hint = ''): string =>
  `<label class="rules-field"><span>${label}${hint ? ` <small>${hint}</small>` : ''}</span>${input}</label>`;
const textInput = (attrs: string, value: string, placeholder = ''): string =>
  `<input type="text" ${attrs} value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"/>`;
const numInput = (attrs: string, value: number | undefined, placeholder: number | undefined): string =>
  `<input type="text" inputmode="decimal" ${attrs} value="${br(value)}" placeholder="${br(placeholder)}"/>`;
const area = (attrs: string, value: string, placeholder = ''): string =>
  `<textarea rows="2" ${attrs} placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`;

function runesPane(): string {
  const r = RUNES[runeId];
  const d = defaults.rune(runeId);
  const o = draft.runas?.[runeId] ?? {};
  const s = sheetDraft(runeId);
  const groups: [string, (cat: string) => boolean][] = [['Elementais e de conceito', c => c === 'elemental'], ['Formas', c => c === 'shape'], ['Estruturais e Direção', c => c === 'mod']];
  const options = groups.map(([label, test]) => `<optgroup label="${label}">${Object.values(RUNES).filter(x => test(x.category)).map(x =>
    `<option value="${x.id}"${x.id === runeId ? ' selected' : ''}>${escapeHtml(x.name)}${draft.runas?.[x.id] ? ' •' : ''}</option>`).join('')}</optgroup>`).join('');
  let html = `<div class="rules-row">${field('Runa', `<select id="rulesRune">${options}</select>`)}<button class="btn" data-action="rules-rune-reset" title="Volta esta runa aos valores do código">Voltar ao padrão</button></div>`;
  html += `<div class="rules-grid2">${field('Nome', textInput('data-f="name"', o.name ?? d.name, d.name))}${field('Sigilo', textInput('data-f="sigil"', o.sigil ?? d.sigil, d.sigil))}</div>`;

  if (d.stats) {
    html += `<div class="rules-section">Poder e Energia (usados nos cálculos)</div><table class="rules-table"><thead><tr><th>Estado</th><th>Poder</th><th>Energia (Custo)</th></tr></thead><tbody>`;
    STATES.forEach(st => {
      const ov = o.stats?.[st] ?? {};
      html += `<tr><td>${STATE_LABEL[st]}</td><td>${numInput(`data-stat="${st}.power"`, ov.power ?? d.stats?.[st].power, d.stats?.[st].power)}</td><td>${numInput(`data-stat="${st}.cost"`, ov.cost ?? d.stats?.[st].cost, d.stats?.[st].cost)}</td></tr>`;
    });
    html += '</tbody></table>';
    html += field('Matéria faltante', numInput('data-f="missingPct"', (o.missingPenalty ?? d.missingPenalty ?? 0) * 100, (d.missingPenalty ?? 0) * 100), '% a mais de energia quando a matéria não existe no ambiente');
  } else {
  }

  html += `<div class="rules-section">Ficha no Grimório</div>`;
  html += field('Efeito principal', area('data-s="effect"', s.effect, 'Tabela Geral (vazio = usa a passiva)'));
  html += field('2º estágio / limite', area('data-s="effect2"', s.effect2, 'Tabela Geral (vazio = usa o efeito perfeito)'));
  html += field('Citação', area('data-s="quote"', s.quote));
  html += field('Função principal', area('data-s="role"', s.role));
  if (d.stats) {
    html += `<div class="rules-section">Colunas extras da ficha <small>(ex.: Densidade, Volume, Temperatura)</small></div>`;
    html += `<div class="rules-grid3">${STATES.map(st => field(`Nome do ${STATE_LABEL[st]}`, textInput(`data-sn="${st}"`, s.stateNames[st], 'opcional (ex.: Brisa)'))).join('')}</div>`;
    s.columns.forEach((c, i) => {
      html += `<div class="rules-column"><div class="rules-grid2">${field('Coluna', textInput(`data-col="${i}.name"`, c.name, 'ex.: Densidade'))}${field('Unidade', textInput(`data-col="${i}.unit"`, c.unit, 'ex.: g/cm³'))}</div>
        <div class="rules-grid3">${STATES.map(st => field(STATE_LABEL[st], textInput(`data-col="${i}.${st}"`, c.values[st]))).join('')}</div>
        <button class="btn btn-small btn-danger" data-action="rules-col-del" data-arg="${i}">Tirar coluna</button></div>`;
    });
    if (s.columns.length < 4) html += `<button class="btn btn-small" data-action="rules-col-add">+ Coluna</button>`;
    html += field('Componentes faltantes', textInput('data-s="missing"', s.missing, 'ex.: Se não houver matéria, cria artificialmente'), 'o % vem da matéria faltante acima');
  }
  html += `<div class="rules-grid2">${field('Passiva (nome)', textInput('data-s="passiveTitle"', s.passiveTitle))}${field('Aplicação Perfeita (nome)', textInput('data-s="perfectTitle"', s.perfectTitle))}</div>`;
  html += field('Passiva (texto)', area('data-s="passiveText"', s.passiveText));
  html += field('Aplicação Perfeita (texto)', area('data-s="perfectText"', s.perfectText));
  html += field('Observações', area('data-s="notes"', s.notes));
  html += `<div class="rules-section">Resumos usados no site</div>`;
  html += field('Passiva na Leitura do Círculo', area('data-f="passive"', o.passive ?? d.passive ?? '', d.passive ?? ''));
  html += field('Efeito perfeito na Leitura do Círculo', area('data-f="perfectEffect"', o.perfectEffect ?? d.perfectEffect ?? '', d.perfectEffect ?? ''));
  html += field('Descrição na lista de runas', area('data-f="desc"', o.desc ?? d.desc ?? r.desc ?? '', d.desc ?? ''));
  return html;
}

function shapesPane(): string {
  let html = '<p class="account-note">Energia que cada selo gasta em cada estado (Mínimo, Perfeito e Instável). Somados aos das runas, dão os limites da magia: mínimo para ativação, ativação perfeita e autodestruição.</p><table class="rules-table"><thead><tr><th>Selo</th><th>Mínimo</th><th>Perfeito</th><th>Instável</th></tr></thead><tbody>';
  (Object.keys(SHAPE_META) as ShapeId[]).forEach(id => {
    const d = defaults.shape(id);
    const o = draft.formas?.[id]?.cost ?? {};
    html += `<tr><td>${escapeHtml(d.name.split(' (')[0])}${d.provisional ? ' <small>(provisório)</small>' : ''}</td>${STATES.map(st => `<td>${numInput(`data-shape="${id}" data-sf="${st}"`, o[st] ?? d.cost[st], d.cost[st])}</td>`).join('')}</tr>`;
  });
  html += '</tbody></table>';
  html += '<div class="rules-section">Função de cada forma (texto)</div>';
  (Object.keys(SHAPE_META) as ShapeId[]).forEach(id => {
    const d = defaults.shape(id);
    html += field(escapeHtml(d.name.split(' (')[0]), area(`data-shape="${id}" data-sf="role"`, draft.formas?.[id]?.role ?? d.role, ''));
  });
  return html;
}

function calcPane(): string {
  let html = '<p class="account-note">Números usados no Resultado: chance de falha, retorno da Estrela, locomoção da energia, bônus de Simultâneo (refino/densidade) e Sequencial (volume/área) e as medidas físicas por ponto de Poder.</p>';
  (Object.keys(CALC_LABELS) as CalcKey[]).forEach(k => {
    const [label, hint] = CALC_LABELS[k];
    html += field(label, numInput(`data-calc="${k}"`, draft.calculo?.[k] ?? defaults.calc(k), defaults.calc(k)), hint);
  });
  return html;
}

interface Version { dados: unknown; salvo_em: string }
let versions: Version[] = [];

function historyPane(): string {
  const when = (iso: string): string => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  let html = `<p class="account-note">Versão que está valendo: ${rulesSavedAt() ? when(rulesSavedAt()) : '—'}. Cada vez que você salva, a versão anterior fica guardada aqui. Carregar uma versão só muda o rascunho: salve para valer.</p>`;
  html += `<button class="btn" data-action="rules-defaults">Voltar tudo ao padrão do código</button>`;
  html += versions.length
    ? `<div class="saved-list">${versions.map((v, i) => `<div class="saved-item"><div><strong>Versão de ${when(v.salvo_em)}</strong><small>${Object.keys(normalizeOverrides(v.dados)).length ? 'com mudanças' : 'padrão do código'}</small></div><div class="btns"><button class="btn" data-action="rules-load-version" data-arg="${i}">Carregar</button></div></div>`).join('')}</div>`
    : '<p class="account-note">Nenhuma versão anterior ainda.</p>';
  return html;
}

function renderPane(): void {
  document.querySelectorAll<HTMLElement>('#rulesModal [data-action="rules-tab"]').forEach(b => b.classList.toggle('active', b.dataset.arg === tab));
  const pane = byId('rulesPane');
  pane.innerHTML = tab === 'runas' ? runesPane() : tab === 'formas' ? shapesPane() : tab === 'calculo' ? calcPane() : historyPane();
}

// ---------- edição ----------

function onInput(evt: Event): void {
  const el = evt.target as HTMLInputElement | HTMLTextAreaElement;
  const v = el.value;
  const bad = (b: boolean): void => { el.classList.toggle('invalid', b); };
  const ds = el.dataset;
  if (ds.f) {
    const r = runeDraft(runeId), d = defaults.rune(runeId);
    if (ds.f === 'missingPct') {
      const n = parseNum(v); bad(n === null); if (n === null) return;
      if (Math.abs(n / 100 - (d.missingPenalty ?? 0)) < 1e-9) delete r.missingPenalty; else r.missingPenalty = n / 100;
    } else if (ds.f === 'costMod') {
      const n = parseNum(v); bad(n === null); if (n === null) return;
      if (n === d.costMod) delete r.costMod; else r.costMod = n;
    } else {
      const key = ds.f as 'name' | 'sigil' | 'desc' | 'passive' | 'perfectEffect';
      if (v === (d[key] ?? '')) delete r[key]; else r[key] = v;
    }
    cleanRune(runeId);
  } else if (ds.stat) {
    const [st, k] = ds.stat.split('.') as [Activation, 'power' | 'cost'];
    const n = parseNum(v); bad(n === null); if (n === null) return;
    const r = runeDraft(runeId);
    r.stats ??= {};
    r.stats[st] ??= {};
    const def = defaults.rune(runeId).stats?.[st][k];
    if (n === def) delete r.stats[st]?.[k]; else (r.stats[st] as Record<string, number>)[k] = n;
    if (!Object.keys(r.stats[st] ?? {}).length) delete r.stats[st];
    if (!Object.keys(r.stats).length) delete r.stats;
    cleanRune(runeId);
  } else if (ds.s || ds.sn || ds.col) {
    const s = sheetDraft(runeId);
    if (ds.s) (s as unknown as Record<string, string>)[ds.s] = v;
    if (ds.sn) s.stateNames[ds.sn as Activation] = v;
    if (ds.col) {
      const [i, k] = ds.col.split('.');
      const c = s.columns[Number(i)];
      if (c) { if (k === 'name' || k === 'unit') c[k] = v; else c.values[k as Activation] = v; }
    }
    setSheet(runeId, s);
  } else if (ds.shape && ds.sf) {
    const id = ds.shape as ShapeId, d = defaults.shape(id);
    draft.formas ??= {};
    const f = (draft.formas[id] ??= {});
    if (ds.sf === 'role') { if (v === d.role) delete f.role; else f.role = v; } else {
      const n = parseNum(v); bad(n === null); if (n === null) return;
      const st = ds.sf as Activation;
      f.cost ??= {};
      if (n === d.cost[st]) delete f.cost[st]; else f.cost[st] = n;
      if (!Object.keys(f.cost).length) delete f.cost;
    }
    if (!Object.keys(f).length) delete draft.formas[id];
  } else if (ds.calc) {
    const k = ds.calc as CalcKey;
    const n = parseNum(v); bad(n === null); if (n === null) return;
    draft.calculo ??= {};
    if (n === defaults.calc(k)) delete draft.calculo[k]; else draft.calculo[k] = n;
  } else return;
  preview();
}

// ---------- abrir, salvar, descartar ----------

export function setupRulesEditor(onChange: () => void): void {
  refresh = onChange;
  const pane = byId('rulesPane');
  pane.addEventListener('input', onInput);
  pane.addEventListener('change', evt => {
    const el = evt.target as HTMLSelectElement;
    if (el.id === 'rulesRune') { runeId = el.value; renderPane(); }
  });
}

export function openRules(): void {
  if (!isAdmin()) return;
  saved = currentOverrides();
  draft = clone(saved);
  msg('');
  tab = 'runas';
  renderPane();
  byId('rulesModal').classList.add('open');
}

export function closeRules(): void {
  if (dirty() && !confirm('Fechar sem salvar? As alterações do rascunho serão descartadas.')) return;
  if (dirty()) { applyOverrides(saved); refresh(); }
  byId('rulesModal').classList.remove('open');
}

export function discardRules(): void {
  draft = clone(saved);
  applyOverrides(saved);
  refresh();
  renderPane();
  msg('Alterações descartadas.');
}

export async function saveRules(): Promise<void> {
  const client = cloudClient();
  if (!client || !isAdmin()) { msg('Entre com a conta admin para salvar.', 'erro'); return; }
  const dados = normalizeOverrides(draft);
  msg('Salvando…');
  const { data, error } = await client.from('regras').update({ dados }).eq('id', 'atual').select('atualizado_em').single();
  if (error || !data) { msg('Não deu para salvar: ' + (error?.message ?? 'sem resposta'), 'erro'); return; }
  saved = clone(dados);
  draft = clone(dados);
  rememberRules(dados, (data as { atualizado_em: string }).atualizado_em);
  versions = [];
  msg('Salvo! Já vale para todo mundo.', 'ok');
}

export async function rulesTab(t: string): Promise<void> {
  tab = t as Tab;
  if (tab === 'historico') {
    const client = cloudClient();
    if (client) {
      const { data } = await client.from('regras_historico').select('dados, salvo_em').order('salvo_em', { ascending: false }).limit(15);
      versions = (data as Version[] | null) ?? [];
    }
  }
  renderPane();
}

export function rulesColumn(add: boolean, index = 0): void {
  const s = sheetDraft(runeId);
  if (add) s.columns.push({ name: '', unit: '', values: { ativacao: '', perfeito: '', instavel: '' } });
  else s.columns.splice(index, 1);
  setSheet(runeId, s);
  renderPane();
  preview();
}

export function resetRune(): void {
  delete draft.runas?.[runeId];
  renderPane();
  preview();
}

export function resetAllRules(): void {
  if (!confirm('Voltar tudo aos valores do código? (vale para todo mundo só depois de salvar)')) return;
  draft = {};
  renderPane();
  preview();
}

export function loadVersion(i: number): void {
  const v = versions[i];
  if (!v) return;
  draft = normalizeOverrides(v.dados);
  preview();
  msg('Versão carregada no rascunho. Salve para valer para todo mundo.');
}
