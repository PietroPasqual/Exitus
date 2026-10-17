import { escapeHtml } from '../core/format';
import {
  calculateRpgSheet, normalizeRpgSheet, rpgCapacities,
  RPG_STATS, RPG_RESOURCES, RPG_ACTIONS, RPG_STATES, INVENTORY_LOCATIONS,
  type RpgSheet, type RpgEntry, type StatId, type ResourceId, type ActionId
} from '../core/rpg-sheet';
import { ARCHETYPES } from '../data/rpg-archetypes';
import {
  ACTION_REFERENCE, REST_REFERENCE, RANKS, SPECIAL_RANKS, ROLL_CATEGORIES,
  ADVANTAGE_REFERENCE, FORMULA_REFERENCE
} from '../data/rpg-reference';

type InputElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type FieldKind = 'text' | 'number' | 'nullable' | 'checkbox';
interface FieldSpec { kind: FieldKind; max?: number; redraw?: boolean }
export interface RpgInputResult { sheet: RpgSheet; redraw: boolean }
export interface RpgActionResult { sheet: RpgSheet; message?: string }
type EntryCollection = 'classes' | 'subclasses' | 'estilos' | 'talentos' | 'etereos' | 'proficiencias' | 'runas' | 'caracteristicas' | 'feitos' | 'titulos';
type ListCollection = EntryCollection | 'pericias' | 'inventario';

const statEntries = Object.entries(RPG_STATS) as [StatId, string][];
const resourceEntries = Object.entries(RPG_RESOURCES) as [ResourceId, string][];
const actionEntries = Object.entries(RPG_ACTIONS) as [ActionId, string][];
const formationCollections = ['classes', 'subclasses', 'estilos', 'talentos'] as const;
const elementalCollections = ['etereos', 'proficiencias', 'runas'] as const;
const standaloneCollections = ['caracteristicas', 'feitos', 'titulos'] as const;
const entryFields = ['nome', 'valor', 'notas'] as const;
const collectionLabels: Record<ListCollection, string> = {
  classes: 'Classes', subclasses: 'Subclasses', estilos: 'Estilos de combate', talentos: 'Talentos',
  etereos: 'Elementos Etérios', proficiencias: 'Proficiências elementais', runas: 'Runas', caracteristicas: 'Características',
  feitos: 'Feitos', titulos: 'Títulos', pericias: 'Perícias', inventario: 'Inventário'
};
const sections = [
  ['descricao', 'Descrição'], ['arquetipo', 'Arquétipo'], ['formacao', 'Formação'],
  ['elementos', 'Elementos'], ['estado', 'Estado e recursos'], ['estatisticas', 'Estatísticas'],
  ['acoes', 'Ações'], ['pericias', 'Perícias'], ['inventario', 'Inventário'],
  ['conquistas', 'Conquistas'], ['historia', 'História'], ['referencia', 'Regras de consulta']
] as const;

function entryRows(sheet: RpgSheet, key: EntryCollection): RpgEntry[] {
  if ((formationCollections as readonly string[]).includes(key)) return sheet.progressao[key as typeof formationCollections[number]];
  if ((elementalCollections as readonly string[]).includes(key)) return sheet.elementos[key as typeof elementalCollections[number]];
  return sheet[key as typeof standaloneCollections[number]];
}
function entryPath(key: EntryCollection): string {
  if ((formationCollections as readonly string[]).includes(key)) return `progressao.${key}`;
  if ((elementalCollections as readonly string[]).includes(key)) return `elementos.${key}`;
  return key;
}
function capacity(sheet: RpgSheet, key: ListCollection): number {
  if (key === 'inventario') return 100;
  const capacities = rpgCapacities(sheet);
  return key in capacities ? Math.min(50, capacities[key as keyof typeof capacities]) : 50;
}
function id(path: string): string { return `rpg-${path.replace(/\./g, '-')}`; }
function format(value: number | null): string {
  return value === null || !Number.isFinite(value) ? 'A definir' : value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}
function field(label: string, path: string, value: string | number | null, options: { number?: boolean; nullable?: boolean; long?: boolean; max?: number; wide?: boolean; help?: string } = {}): string {
  const fieldId = id(path), help = options.help ? `<small>${escapeHtml(options.help)}</small>` : '';
  const shared = `id="${fieldId}" data-rpg-field="${path}"`;
  let input: string;
  if (options.long) input = `<textarea ${shared} maxlength="${options.max ?? 1000}" rows="3">${escapeHtml(String(value ?? ''))}</textarea>`;
  else if (options.number || options.nullable) input = `<input ${shared} type="number" step="any" value="${value ?? ''}"${options.nullable ? ' placeholder="A definir"' : ''}>`;
  else input = `<input ${shared} value="${escapeHtml(String(value ?? ''))}" maxlength="${options.max ?? 120}" autocomplete="off">`;
  return `<label class="rpg-field${options.wide ? ' rpg-wide' : ''}" for="${fieldId}"><span>${escapeHtml(label)}</span>${input}${help}</label>`;
}
function select(label: string, path: string, value: string, options: readonly { id: string; nome: string }[], empty: string | null = 'Escolher'): string {
  const preserved = value && !options.some(option => option.id === value)
    ? `<option value="${escapeHtml(value)}" selected>${escapeHtml(value)} · registrado</option>` : '';
  return `<label class="rpg-field" for="${id(path)}"><span>${escapeHtml(label)}</span><select id="${id(path)}" data-rpg-field="${path}">${empty === null ? '' : `<option value="">${escapeHtml(empty)}</option>`}${preserved}${options.map(option => `<option value="${escapeHtml(option.id)}"${value === option.id ? ' selected' : ''}>${escapeHtml(option.nome)}</option>`).join('')}</select></label>`;
}
function check(label: string, path: string, value: boolean): string {
  return `<label class="rpg-check" for="${id(path)}"><input id="${id(path)}" data-rpg-field="${path}" type="checkbox"${value ? ' checked' : ''}><span>${escapeHtml(label)}</span></label>`;
}
function header(title: string, chapter: string, help?: string): string {
  return `<div class="rpg-section-heading"><p class="character-eyebrow">${escapeHtml(chapter)}</p><h3>${escapeHtml(title)}</h3>${help ? `<p class="rpg-help">${escapeHtml(help)}</p>` : ''}</div>`;
}
function section(key: typeof sections[number][0], body: string, wide = false): string {
  return `<section class="character-card rpg-section${wide ? ' rpg-wide' : ''}" id="rpg-section-${key}">${body}</section>`;
}
function addButton(sheet: RpgSheet, key: ListCollection, count: number): string {
  return `<button type="button" class="btn" data-rpg-action="add-${key}"${count >= capacity(sheet, key) ? ' disabled' : ''}>+ Adicionar</button>`;
}
function removeButton(key: ListCollection, index: number): string {
  return `<button type="button" class="btn btn-danger" data-rpg-action="remove-${key}" data-rpg-index="${index}" aria-label="Remover registro de ${collectionLabels[key]}">Remover</button>`;
}
function counter(sheet: RpgSheet, key: ListCollection, count: number): string {
  const limit = capacity(sheet, key);
  if (!(key in rpgCapacities(sheet))) return `<span class="rpg-counter" title="Limite técnico de ${limit} registros">${count} registro(s)</span>`;
  return `<span class="rpg-counter${count > limit ? ' rpg-over-limit' : ''}">${count}/${limit}</span>${count > limit ? '<p class="rpg-help rpg-over-limit">Acima dos espaços deste arquétipo. Os registros foram preservados; revise com o mestre.</p>' : ''}`;
}
function genericList(sheet: RpgSheet, key: EntryCollection, help?: string): string {
  const rows = entryRows(sheet, key), path = entryPath(key);
  return `<div class="rpg-list"><div class="rpg-list-heading"><h4>${collectionLabels[key]}</h4>${counter(sheet, key, rows.length)}${addButton(sheet, key, rows.length)}</div>${help ? `<p class="rpg-help">${escapeHtml(help)}</p>` : ''}${rows.length ? rows.map((row, index) => `<div class="rpg-entry"><div class="rpg-fields">${field('Nome', `${path}.${index}.nome`, row.nome)}${field(key === 'etereos' ? 'Porcentagem / valor' : 'Valor / rank', `${path}.${index}.valor`, row.valor)}${field('Detalhes', `${path}.${index}.notas`, row.notas, { long: true, wide: true })}</div>${removeButton(key, index)}</div>`).join('') : '<p class="rpg-empty">Nenhum registro. Adicione quando fizer parte da sua história.</p>'}</div>`;
}
function referenceTable(headings: string[], rows: string[][], caption: string): string {
  return `<div class="rpg-table-scroll" tabindex="0" role="region" aria-label="${escapeHtml(caption)}"><table class="rpg-reference-table"><caption>${escapeHtml(caption)}</caption><thead><tr>${headings.map(heading => `<th scope="col">${escapeHtml(heading)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/** Renderização sem listeners: o controlador da ficha mantém a persistência e os círculos. */
export function renderRpgSheet(sheet: RpgSheet): string {
  const calculated = calculateRpgSheet(sheet);
  const selected = ARCHETYPES.find(archetype => archetype.id === sheet.arquetipo);
  const stats = statEntries.map(([key, label]) => {
    const stat = sheet.estatisticas[key], calc = calculated.estatisticas[key], path = `estatisticas.${key}`;
    return `<article class="rpg-stat${!stat.desbloqueada ? ' rpg-stat-locked' : ''}"><div class="rpg-stat-heading"><h4>${label}</h4>${check('Desbloqueada', `${path}.desbloqueada`, stat.desbloqueada)}</div><div class="rpg-stat-fields">${field('Valor', `${path}.valor`, stat.valor, { number: true })}${field('MOD', `${path}.modificador`, stat.modificador, { number: true })}${field('ALT', `${path}.alteracao`, stat.alteracao)}${field('DR', `${path}.dr`, stat.dr, { number: true })}${field('Talentos na fórmula', `${path}.talento`, stat.talento, { nullable: true })}${field('Limite', `${path}.limite`, stat.limite)}</div><dl class="rpg-calculation"><div><dt>Valor diário</dt><dd>${format(calc.valorDiario)}</dd></div><div><dt>Limite de ganho</dt><dd>${format(calc.limiteDeGanho)}</dd></div><div><dt>Valor por idade</dt><dd>${format(calc.valorPorIdade)}</dd></div></dl></article>`;
  }).join('');
  const archetypeRules = ARCHETYPES.map(archetype => `<details class="rpg-rule${archetype.id === sheet.arquetipo ? ' rpg-rule-selected' : ''}"${archetype.id === sheet.arquetipo ? ' open' : ''}><summary>${escapeHtml(archetype.nome)}${archetype.id === sheet.arquetipo ? ' · selecionado' : ''}</summary><div class="rpg-rule-columns"><div><h4>Vantagens</h4><ul>${archetype.vantagens.map(rule => `<li>${escapeHtml(rule)}</li>`).join('')}</ul></div><div><h4>Desvantagens</h4><ul>${archetype.desvantagens.map(rule => `<li>${escapeHtml(rule)}</li>`).join('')}</ul></div></div></details>`).join('');
  const formation = `<div class="rpg-fields">${select('Rank', 'progressao.rank', sheet.progressao.rank, [...RANKS, ...SPECIAL_RANKS], 'A definir')}${field('Avanços', 'progressao.avancos', sheet.progressao.avancos, { number: true })}${field('Ascensões', 'progressao.ascensoes', sheet.progressao.ascensoes, { number: true })}${field('Existência', 'progressao.existencia', sheet.progressao.existencia, { nullable: true })}${field('Pontos evolutivos', 'progressao.pontosEvolutivos', sheet.progressao.pontosEvolutivos, { number: true })}${field('Pilar', 'progressao.pilar', sheet.progressao.pilar)}</div><dl class="rpg-calculation"><div><dt>Consenso</dt><dd>${format(calculated.consenso)}</dd></div><div><dt>Cadeia de substância</dt><dd>${format(calculated.cadeiaDeSubstancia)}</dd></div></dl>${formationCollections.map(key => genericList(sheet, key)).join('')}`;
  const resources = resourceEntries.map(([key, label]) => `<article class="rpg-resource"><h4>${label}</h4><div class="rpg-fields">${field('Atual', `recursos.${key}.atual`, sheet.recursos[key].atual, { number: true })}${field('Máximo registrado', `recursos.${key}.maximo`, sheet.recursos[key].maximo, { number: true })}</div><p class="rpg-resource-formula">Máximo pela fórmula: <strong>${format(calculated.recursos[key])}</strong></p>${sheet.recursos[key].atual > sheet.recursos[key].maximo ? '<p class="rpg-help rpg-over-limit">O atual está acima do máximo registrado. Revise com o mestre.</p>' : ''}</article>`).join('');
  const actionRows = actionEntries.map(([key, label], index) => `<article class="rpg-action"><div><h4>${label}</h4><p class="rpg-help">Tempo: ${ACTION_REFERENCE.rows[index].tempo} · ${escapeHtml(ACTION_REFERENCE.rows[index].explicacao)}</p></div><div class="rpg-action-fields">${field('Usos atuais', `acoes.${key}.atual`, sheet.acoes[key].atual, { number: true })}${field('Usos máximos', `acoes.${key}.maximo`, sheet.acoes[key].maximo, { number: true })}${field('MVs', `acoes.${key}.mvs`, sheet.acoes[key].mvs, { number: true })}${field('DRs', `acoes.${key}.dr`, sheet.acoes[key].dr, { number: true })}</div></article>`).join('');
  const skills = sheet.pericias.map((skill, index) => `<div class="rpg-entry"><div class="rpg-fields">${field('Perícia', `pericias.${index}.nome`, skill.nome)}${field('Etapa', `pericias.${index}.etapa`, skill.etapa)}${field('Grau', `pericias.${index}.grau`, skill.grau)}${select('Execução', `pericias.${index}.execucao`, skill.execucao, ['Consequência', 'Ação', 'Consenso'].map(value => ({ id: value, nome: value })))}${select('Tipo', `pericias.${index}.tipo`, skill.tipo, ['Talento', 'Aprendizado', 'Dádiva'].map(value => ({ id: value, nome: value })))}${field('Efeito', `pericias.${index}.efeito`, skill.efeito, { long: true, wide: true })}${field('Condição', `pericias.${index}.condicao`, skill.condicao, { long: true, wide: true })}${field('Complementar', `pericias.${index}.complementar`, skill.complementar, { long: true, wide: true })}${field('Fundamentos', `pericias.${index}.fundamentos`, skill.fundamentos, { long: true, wide: true })}</div>${removeButton('pericias', index)}</div>`).join('');
  const inventory = sheet.inventario.map((item, index) => `<div class="rpg-entry"><div class="rpg-fields">${field('Item', `inventario.${index}.nome`, item.nome)}${field('Quantidade', `inventario.${index}.quantidade`, item.quantidade)}${field('Classificação / rank', `inventario.${index}.rank`, item.rank)}${select('Local', `inventario.${index}.local`, item.local, INVENTORY_LOCATIONS.map(value => ({ id: value, nome: value })), null)}${field('Detalhes', `inventario.${index}.notas`, item.notas, { long: true, wide: true })}</div>${removeButton('inventario', index)}</div>`).join('');
  const formulaGroups = [...new Set(FORMULA_REFERENCE.map(formula => formula.grupo))];
  const formulas = formulaGroups.map(group => `<details class="rpg-rule"><summary>${escapeHtml(group)}</summary><dl class="rpg-formula-list">${FORMULA_REFERENCE.filter(formula => formula.grupo === group).map(formula => `<div><dt>${escapeHtml(formula.nome)}</dt><dd><code>${escapeHtml(formula.formula)}</code>${formula.nota ? `<p>${escapeHtml(formula.nota)}</p>` : ''}</dd></div>`).join('')}</dl></details>`).join('');
  return `<div class="rpg-sheet"><nav class="rpg-steps" aria-label="Etapas da ficha">${sections.map(([key, label], index) => `<button type="button" class="btn" data-rpg-action="jump" data-rpg-target="rpg-section-${key}"><span aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>${label}</button>`).join('')}</nav><div class="rpg-sheet-grid">
    ${section('descricao', `${header('Descrição do personagem', 'I · Identidade física', 'Registre as rolagens e escolhas feitas com o mestre.')}<div class="rpg-fields">${field('Idade em anos', 'descricao.idade', sheet.descricao.idade, { nullable: true })}${field('Sexo', 'descricao.sexo', sheet.descricao.sexo)}${field('Raça', 'descricao.raca', sheet.descricao.raca)}${field('Altura', 'descricao.altura', sheet.descricao.altura)}${field('Peso', 'descricao.peso', sheet.descricao.peso)}${field('Aparência · resultado', 'descricao.aparencia', sheet.descricao.aparencia, { nullable: true, help: sheet.arquetipo === 'amago' ? 'Referência: 2d6 (+?) e +1d12 de Âmago.' : 'Referência: 2d6 (+?). O complemento é definido com o mestre.' })}${field('Fator estético', 'descricao.estetica', sheet.descricao.estetica, { long: true, wide: true, help: 'Exótico, acolhedor, elegante…' })}${field('Extra', 'descricao.extra', sheet.descricao.extra, { long: true, wide: true })}</div>`)}
    ${section('arquetipo', `${header('Arquétipo', 'II · A origem do potencial', 'Consulte as vantagens e desvantagens antes de escolher. A troca preserva todos os registros e recursos.')}<div class="rpg-fields">${select('Seu arquétipo', 'arquetipo', sheet.arquetipo, ARCHETYPES, 'Escolha um arquétipo')}</div><p class="rpg-selected-archetype">${selected ? `Caminho escolhido: <strong>${escapeHtml(selected.nome)}</strong>` : 'Seu caminho ainda não foi escolhido.'}</p><p class="rpg-help">As regras abaixo são consulta. Evoluções, roletas, vínculos e usos limitados são registrados com o mestre.</p>${archetypeRules}`)}
    ${section('formacao', `${header('Classes e progressão', 'III · Formação', 'Os espaços acompanham o arquétipo e os avanços informados.')}${formation}`)}
    ${section('elementos', `${header('Elementos e runas', 'IV · Afinidades', 'A roleta elemental é registrada manualmente. As runas desta ficha não limitam o desenho de círculos.')}<div class="rpg-fields">${field('Alma · resultado de 1d4', 'elementos.almaDado', sheet.elementos.almaDado, { nullable: true })}${field('Alma · elemento da roleta', 'elementos.alma', sheet.elementos.alma, { help: '0/1 elemento de alma.' })}${field('Elementário', 'elementos.elementario', sheet.elementos.elementario)}${field('Pilar elemental', 'elementos.pilar', sheet.elementos.pilar)}${field('Extus', 'elementos.extus', sheet.elementos.extus, { long: true, wide: true })}${field('Elemento nas fórmulas', 'calculo.elemento', sheet.calculo.elemento, { nullable: true, help: 'Valor numérico confirmado pelo mestre.' })}</div><dl class="rpg-calculation"><div><dt>Energia demoníaca</dt><dd>${format(calculated.energias.demoniaca)}</dd></div><div><dt>Energia celeste</dt><dd>${format(calculated.energias.celeste)}</dd></div><div><dt>Estoque de Pilar</dt><dd>${format(calculated.energias.pilar)}</dd></div></dl>${genericList(sheet, 'etereos', 'A referência define 0,1% inicial fora de Ente; Ente pode registrar a rolagem 1d4+1d6+1d8 por porcentagem. Ente e Justo podem adicionar um elemento comum (Fogo, Água, Vento ou Terra). Confirme os elementos e espaços com o mestre.')}${genericList(sheet, 'proficiencias', 'A disponibilidade desta mecânica depende das regras do arquétipo.')}${genericList(sheet, 'runas')}`)}
    ${section('estado', `${header('Estado, recursos e defesas', 'V · Condição atual', 'Os valores atuais e máximos são manuais. Os cálculos são uma referência e não substituem seus registros.')}<div class="rpg-fields">${select('Estado atual', 'estado', sheet.estado, RPG_STATES.map(value => ({ id: value, nome: value })), null)}</div><div class="rpg-resources">${resources}</div><div class="rpg-fields">${field('Defesa física · natural + alterada', 'defesas.fisica', sheet.defesas.fisica, { long: true })}${field('Defesa mental · natural + alterada', 'defesas.mental', sheet.defesas.mental, { long: true })}${field('Defesa energética · natural + alterada', 'defesas.energetica', sheet.defesas.energetica, { long: true })}${field('Defesa geral', 'defesas.geral', sheet.defesas.geral, { long: true })}${field('Efeito (1º)', 'efeitos.primeiro', sheet.efeitos.primeiro, { long: true, wide: true })}${field('Efeito · resumo', 'efeitos.resumo', sheet.efeitos.resumo, { long: true, wide: true })}</div>`, true)}
    ${section('estatisticas', `${header('Estatísticas', 'VI · Potencial', 'MOD é preenchido manualmente: a referência não define sua conversão a partir do valor. “Talentos na fórmula” é o número usado em cada estatística.')}<div class="rpg-stat-grid">${stats}</div>`, true)}
    ${section('acoes', `${header('Ações', 'VII · Ritmo do combate', `Uma rodada tem ${ACTION_REFERENCE.roundSeconds}s; uma rotação tem ${ACTION_REFERENCE.rotationSeconds}s. Tempos e explicações seguem a referência.`)}${actionRows}`, true)}
    ${section('pericias', `${header('Perícias', 'VIII · Saber e prática')}<div class="rpg-list-heading">${counter(sheet, 'pericias', sheet.pericias.length)}${addButton(sheet, 'pericias', sheet.pericias.length)}</div>${skills || '<p class="rpg-empty">Adicione uma perícia para registrar etapa, grau e fundamentos.</p>'}`)}
    ${section('inventario', `${header('Inventário', 'IX · Pertences', 'A classificação e a quantidade de itens por história são definidas pelo mestre.')}<div class="rpg-list-heading">${counter(sheet, 'inventario', sheet.inventario.length)}${addButton(sheet, 'inventario', sheet.inventario.length)}</div><p class="rpg-help">Locais: ${INVENTORY_LOCATIONS.map(escapeHtml).join(' · ')}.</p>${inventory || '<p class="rpg-empty">Registre itens de acesso rápido, mochila, base e outros locais.</p>'}`)}
    ${section('conquistas', `${header('Conquistas e características', 'X · Marcas da jornada')}${genericList(sheet, 'feitos')}${genericList(sheet, 'titulos')}${genericList(sheet, 'caracteristicas')}`, true)}
    ${section('historia', `${header('História', 'XI · Memória do personagem')}<div class="rpg-fields">${field('Jornada', 'historia.jornada', sheet.historia.jornada, { long: true, wide: true, max: 6000 })}${field('Aprendizado', 'historia.aprendizado', sheet.historia.aprendizado, { long: true, wide: true, max: 6000 })}</div>`, true)}
    ${section('referencia', `${header('Regras de consulta', 'XII · Margens do grimório', 'Fórmulas e regras do documento de criação. Dados não informados permanecem a definir.')}<details class="rpg-rule"><summary>Descansos</summary><p class="rpg-help">${escapeHtml(REST_REFERENCE.interruption)}</p>${referenceTable(['Descanso', 'Usos', 'Condição', 'Tempo', 'Fadiga', 'Energia', 'Vida'], REST_REFERENCE.rows.map(row => [row.descanso, row.usos, row.condicao, row.tempo, row.fadiga, row.energia, row.vida]), 'Recuperação por descanso')}</details><details class="rpg-rule"><summary>Categorias de rolagem e vantagens</summary><div class="rpg-rank-list">${ROLL_CATEGORIES.map(category => `<span><strong>${escapeHtml(category.nome)}</strong> ${category.min === category.max ? category.min : `${category.min}–${category.max}`}</span>`).join('')}</div><p class="rpg-help">${escapeHtml(ADVANTAGE_REFERENCE.cancellation)}</p>${referenceTable(['Vantagem', 'Explicação'], ADVANTAGE_REFERENCE.rows.map(row => [row.nome, row.explicacao]), 'Tipos de vantagem')}</details><details class="rpg-rule"><summary>Classificações de rank</summary><div class="rpg-rank-list">${[...RANKS, ...SPECIAL_RANKS].map(rank => `<span><strong>${rank.id}</strong> ${escapeHtml(rank.nome)}</span>`).join('')}</div></details>${formulas}`, true)}
  </div></div>`;
}

/** Uma lista explícita de caminhos impede escrita em campos ou protótipos arbitrários. */
function fieldSpecs(sheet: RpgSheet): Map<string, FieldSpec> {
  const specs = new Map<string, FieldSpec>();
  const add = (paths: string[], kind: FieldKind, max?: number, redraw = false): void => {
    for (const path of paths) specs.set(path, { kind, max, redraw });
  };
  add(['descricao.idade', 'descricao.aparencia', 'progressao.existencia', 'calculo.elemento'], 'nullable', undefined, true);
  add(['descricao.sexo', 'descricao.raca', 'descricao.altura', 'descricao.peso', 'progressao.pilar', 'elementos.alma', 'elementos.elementario', 'elementos.pilar'], 'text', 120);
  add(['descricao.extra', 'descricao.estetica', 'elementos.extus', 'defesas.fisica', 'defesas.mental', 'defesas.energetica', 'defesas.geral', 'efeitos.primeiro', 'efeitos.resumo'], 'text', 1000);
  add(['arquetipo', 'progressao.rank', 'estado'], 'text', 120, true);
  add(['progressao.avancos', 'progressao.ascensoes', 'progressao.pontosEvolutivos'], 'number', undefined, true);
  add(['elementos.almaDado'], 'nullable');
  add(['historia.jornada', 'historia.aprendizado'], 'text', 6000);
  for (const [key] of statEntries) {
    add([`estatisticas.${key}.valor`, `estatisticas.${key}.dr`], 'number');
    add([`estatisticas.${key}.modificador`], 'number', undefined, true);
    add([`estatisticas.${key}.talento`], 'nullable', undefined, true);
    add([`estatisticas.${key}.alteracao`, `estatisticas.${key}.limite`], 'text', 120);
    add([`estatisticas.${key}.desbloqueada`], 'checkbox', undefined, true);
  }
  for (const [key] of resourceEntries) add([`recursos.${key}.atual`, `recursos.${key}.maximo`], 'number', undefined, true);
  for (const [key] of actionEntries) for (const value of ['atual', 'maximo', 'mvs', 'dr']) add([`acoes.${key}.${value}`], 'number');
  for (const key of [...formationCollections, ...elementalCollections, ...standaloneCollections]) {
    entryRows(sheet, key).forEach((_, index) => {
      for (const value of entryFields) add([`${entryPath(key)}.${index}.${value}`], 'text', value === 'notas' ? 1000 : 120);
    });
  }
  sheet.pericias.forEach((_, index) => {
    add(['nome', 'etapa', 'grau', 'execucao', 'tipo'].map(key => `pericias.${index}.${key}`), 'text', 120);
    add(['efeito', 'condicao', 'complementar', 'fundamentos'].map(key => `pericias.${index}.${key}`), 'text', 1000);
  });
  sheet.inventario.forEach((_, index) => {
    add(['nome', 'quantidade', 'rank', 'local'].map(key => `inventario.${index}.${key}`), 'text', 120);
    add([`inventario.${index}.notas`], 'text', 1000);
  });
  return specs;
}

export function updateRpgInput(sheet: RpgSheet, element: InputElement): RpgInputResult | null {
  const path = element.dataset.rpgField;
  if (!path) return null;
  const spec = fieldSpecs(sheet).get(path);
  if (!spec) return null;
  let value: string | number | null | boolean;
  if (spec.kind === 'checkbox') {
    if (!(element instanceof HTMLInputElement) || element.type !== 'checkbox') return null;
    value = element.checked;
  } else if (spec.kind === 'number' || spec.kind === 'nullable') {
    if (element instanceof HTMLInputElement && element.validity.badInput) return null;
    if (element.value.trim() === '') {
      if (spec.kind !== 'nullable') return null;
      value = null;
    } else {
      value = Number(element.value);
      if (!Number.isFinite(value)) return null;
    }
  } else {
    if (element.value.length > (spec.max ?? 120)) return null;
    value = element.value;
  }
  const next = JSON.parse(JSON.stringify(sheet)) as RpgSheet;
  const parts = path.split('.');
  let target: Record<string, unknown> = next as unknown as Record<string, unknown>;
  for (const key of parts.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[parts[parts.length - 1]] = value;
  const normalized = normalizeRpgSheet(next);
  return normalized ? { sheet: normalized, redraw: !!spec.redraw } : null;
}

export function handleRpgAction(sheet: RpgSheet, button: HTMLButtonElement): RpgActionResult | null {
  const match = /^(add|remove)-(classes|subclasses|estilos|talentos|etereos|proficiencias|runas|caracteristicas|feitos|titulos|pericias|inventario)$/.exec(button.dataset.rpgAction ?? '');
  if (!match) return null;
  const operation = match[1], key = match[2] as ListCollection;
  const next = JSON.parse(JSON.stringify(sheet)) as RpgSheet;
  let rows: unknown[];
  if (key === 'pericias') rows = next.pericias;
  else if (key === 'inventario') rows = next.inventario;
  else rows = entryRows(next, key);
  if (operation === 'add') {
    if (rows.length >= capacity(sheet, key)) return null;
    if (key === 'pericias') rows.push({ nome: '', etapa: '', grau: '', execucao: '', tipo: '', efeito: '', condicao: '', complementar: '', fundamentos: '' });
    else if (key === 'inventario') rows.push({ nome: '', quantidade: '', rank: '', local: 'Mochila', notas: '' });
    else rows.push({ nome: '', valor: '', notas: '' });
  } else {
    const indexText = button.dataset.rpgIndex;
    if (!indexText || !/^(0|[1-9]\d*)$/.test(indexText)) return null;
    const index = Number(indexText);
    if (!Number.isSafeInteger(index) || index >= rows.length) return null;
    rows.splice(index, 1);
  }
  const normalized = normalizeRpgSheet(next);
  return normalized ? { sheet: normalized, message: operation === 'add' ? 'Registro adicionado.' : 'Registro removido.' } : null;
}
