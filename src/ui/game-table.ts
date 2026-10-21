import {
  TABLE_KEY, TABLE_SCENE_LIMIT, TABLE_TOKEN_LIMIT, TABLE_ROLL_LIMIT, TABLE_SIZE_MIN, TABLE_SIZE_MAX, TERRAINS, TOKEN_KINDS, TOKEN_COLORS,
  newTable, newScene, normalizeTable, encodeTable, resizeScene, setCell, gridDistance, cellRuns, playerView, hiddenByFog, rollDice, tableId,
  type TableState, type TableScene, type TableToken, type TerrainId, type TokenKind, type DiceRoll
} from '../core/game-table';
import { CHARACTER_LIBRARY_KEY } from '../core/character-library';
import { LINKED_CAMPAIGN_KEY, publishTable, type CampaignMember, type MasterCampaign } from '../core/campaign';
import { escapeHtml } from '../core/format';
import { sessionUser } from '../cloud/session';
import { campaignMembers, masterCampaigns, publishCampaignTable } from '../cloud/campaigns';

/** Personagem das fichas, só com o que a mesa mostra. */
interface SheetSummary { id: string; nome: string; vida: { atual: number; maximo: number } | null }
type Tool = 'mover' | 'terreno' | 'nevoa' | 'regua';
interface Point { x: number; y: number }

const TOOLS: Record<Tool, { nome: string; dica: string }> = {
  mover: { nome: 'Mover', dica: 'Arraste os tokens pelo mapa. Toque num token para editá-lo; Delete remove o selecionado.' },
  terreno: { nome: 'Terreno', dica: 'Pinte paredes, água e outros terrenos arrastando sobre a grade.' },
  nevoa: { nome: 'Névoa', dica: 'Arraste para revelar ou cobrir partes do mapa para os jogadores.' },
  regua: { nome: 'Régua', dica: 'Arraste para medir a distância em quadrados e metros (diagonal conta 1).' }
};
const DICE = [4, 6, 8, 10, 12, 20, 100];

/** Lê as fichas guardadas sem validar a ficha inteira: a mesa só usa nome e vida. */
export function readSheetSummaries(): SheetSummary[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CHARACTER_LIBRARY_KEY) ?? 'null') as unknown;
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { characters?: unknown }).characters)) return [];
    return ((raw as { characters: unknown[] }).characters).flatMap(entry => {
      if (!entry || typeof entry !== 'object') return [];
      const { id, data } = entry as { id?: unknown; data?: { identidade?: { nome?: unknown }; rpg?: { recursos?: { vida?: { atual?: unknown; maximo?: unknown } } } } };
      if (typeof id !== 'string') return [];
      const nome = typeof data?.identidade?.nome === 'string' && data.identidade.nome.trim() ? data.identidade.nome.trim().slice(0, 60) : 'Personagem sem nome';
      const vida = data?.rpg?.recursos?.vida;
      return [{ id, nome, vida: vida && typeof vida.atual === 'number' && typeof vida.maximo === 'number' ? { atual: vida.atual, maximo: vida.maximo } : null }];
    });
  } catch { return []; }
}

function loadTable(): { state: TableState; problem: string } {
  try {
    const raw = localStorage.getItem(TABLE_KEY);
    if (raw === null) return { state: newTable(), problem: '' };
    const state = normalizeTable(JSON.parse(raw));
    return state ? { state, problem: '' } : { state: newTable(), problem: 'A mesa guardada não pôde ser lida; começamos uma nova sem apagar a antiga até você salvar.' };
  } catch { return { state: newTable(), problem: 'A mesa guardada não pôde ser lida; começamos uma nova sem apagar a antiga até você salvar.' }; }
}

const initials = (nome: string): string => {
  const words = nome.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]].map(w => Array.from(w)[0]) : Array.from(words[0] ?? '?').slice(0, 2);
  return letters.join('').toLocaleUpperCase();
};
const decimal = (n: number): string => String(n).replace('.', ',');

/** SVG do mapa: o mesmo desenho serve ao mestre e à janela dos jogadores. */
export function renderBoard(scene: TableScene, options: {
  mode: 'mestre' | 'jogadores'; zoom: number; selected?: string; sheets?: SheetSummary[];
  ruler?: { from: Point; to: Point } | null; drag?: { id: string; x: number; y: number } | null;
}): string {
  const { colunas: w, linhas: h } = scene;
  const sheets = new Map((options.sheets ?? []).map(sheet => [sheet.id, sheet]));
  const terrain = cellRuns(scene.terreno, w, c => c !== '.')
    .map(run => `<rect x="${run.x}" y="${run.y}" width="${run.w}" height="1" fill="${TERRAINS[run.c as TerrainId].cor}"${run.c === 'p' ? '' : ' fill-opacity=".72"'}/>`).join('');
  const fog = scene.nevoa
    ? cellRuns(scene.coberto, w, c => c === '1').map(run => `<rect x="${run.x}" y="${run.y}" width="${run.w}" height="1"/>`).join('')
    : '';
  const tokens = scene.tokens.map(token => {
    const sheet = token.personagemId ? sheets.get(token.personagemId) : undefined;
    const vida = sheet?.vida ?? token.vida;
    const pos = options.drag?.id === token.id ? options.drag : token;
    const s = token.tamanho, r = s / 2;
    const ratio = vida && vida.maximo > 0 ? Math.max(0, Math.min(1, vida.atual / vida.maximo)) : null;
    const nome = sheet?.nome ?? token.nome;
    return `<g class="table-token${token.id === options.selected ? ' is-selected' : ''}${token.oculto ? ' is-hidden' : ''}" data-token="${escapeHtml(token.id)}" transform="translate(${pos.x} ${pos.y})">
      <title>${escapeHtml(nome)}${token.oculto ? ' (oculto)' : ''}</title>
      <circle cx="${r}" cy="${r}" r="${r - 0.08}" fill="${token.cor}" class="table-token-body"/>
      <circle cx="${r}" cy="${r}" r="${r - 0.18}" fill="none" class="table-token-ring"/>
      <text x="${r}" y="${r}" font-size="${0.38 * Math.min(s, 2)}" class="table-token-initials">${escapeHtml(initials(nome))}</text>
      ${ratio !== null ? `<rect x="${0.12 * s}" y="${s - 0.2}" width="${0.76 * s}" height=".12" class="table-token-life-bg"/><rect x="${0.12 * s}" y="${s - 0.2}" width="${0.76 * s * ratio}" height=".12" class="table-token-life"/>` : ''}
      <text x="${r}" y="${s + 0.32}" font-size=".3" class="table-token-name">${escapeHtml(nome.length > 18 ? `${nome.slice(0, 17)}…` : nome)}</text>
    </g>`;
  }).join('');
  let ruler = '';
  if (options.ruler) {
    const { from, to } = options.ruler;
    const distance = gridDistance(from, to, scene.metros);
    ruler = `<g class="table-ruler"><line x1="${from.x + 0.5}" y1="${from.y + 0.5}" x2="${to.x + 0.5}" y2="${to.y + 0.5}"/><circle cx="${from.x + 0.5}" cy="${from.y + 0.5}" r=".12"/><circle cx="${to.x + 0.5}" cy="${to.y + 0.5}" r=".12"/>
      <text x="${to.x + 0.5}" y="${to.y - 0.15}" font-size=".42">${distance.quadrados} ${distance.quadrados === 1 ? 'quadrado' : 'quadrados'} · ${decimal(distance.metros)} m</text></g>`;
  }
  return `<svg class="table-svg table-svg-${options.mode}" viewBox="0 0 ${w} ${h}" width="${w * options.zoom}" height="${h * options.zoom}" role="img" aria-label="Mapa ${escapeHtml(scene.nome)}, ${w} por ${h} quadrados">
    <defs><pattern id="table-grid-${options.mode}" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" class="table-grid-line"/></pattern></defs>
    <rect width="${w}" height="${h}" class="table-floor"/>
    ${scene.fundo ? `<image href="${scene.fundo}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"/>` : ''}
    <g class="table-terrain">${terrain}</g>
    ${scene.grade ? `<rect width="${w}" height="${h}" fill="url(#table-grid-${options.mode})" pointer-events="none"/>` : ''}
    <g class="table-tokens">${tokens}</g>
    ${fog ? `<g class="table-fog">${fog}</g>` : ''}
    ${ruler}
  </svg>`;
}

function rollLog(rolagens: DiceRoll[], mode: 'mestre' | 'jogadores'): string {
  if (!rolagens.length) return '<p class="table-empty">Nenhuma rolagem ainda.</p>';
  return `<ol class="table-roll-log">${rolagens.slice().reverse().map(roll => `<li class="${roll.secreta ? 'is-secret' : ''}"><div><strong>${escapeHtml(roll.quem)}</strong> rolou <code>${escapeHtml(roll.expressao)}</code>${roll.secreta && mode === 'mestre' ? ' <span class="table-tag">secreta</span>' : ''}</div><span class="table-roll-total">${roll.total}</span><small>${escapeHtml(roll.detalhe)}</small></li>`).join('')}</ol>`;
}

/** Reduz a imagem do mapa para caber na mesa guardada no navegador. */
async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('imagem')); image.src = url; });
    for (const [side, quality] of [[2048, 0.82], [1600, 0.75], [1200, 0.7], [900, 0.65]] as const) {
      const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= 1_700_000) return data;
    }
    throw new Error('grande');
  } finally { URL.revokeObjectURL(url); }
}

/** Mesa do Mestre dentro do site: abre quando a navegação dispara `mesa:open` em #tablePage. */
export function setupGameTable(): void {
  const root = document.getElementById('tablePage');
  if (!root) return;
  const page = root;
  let { state, problem } = loadTable();
  let sheets: SheetSummary[] = [];
  let tool: Tool = 'mover';
  let brush: TerrainId | '.' = 'p';
  let fogMode: '0' | '1' = '0';
  let zoom = 40;
  /** Enquanto o mestre não mexe no zoom, o mapa se ajusta ao espaço da tela. */
  let zoomTouched = false;
  let selected = '';
  let ruler: { from: Point; to: Point } | null = null;
  let drag: { id: string; x: number; y: number; dx: number; dy: number } | null = null;
  let painting = false;
  let drawn = false;
  // Campanha online ligada: os jogadores autorizados recebem a cena mostrada.
  let linked = readLinked();
  let mastered: MasterCampaign[] = [];
  let members: CampaignMember[] = [];
  let publishTimer: ReturnType<typeof setTimeout> | undefined;
  let lastPublished = '';
  const sentBackground = new Map<string, string>();
  function readLinked(): string {
    try { return localStorage.getItem(LINKED_CAMPAIGN_KEY) ?? ''; } catch { return ''; }
  }
  /** Fichas deste navegador e personagens dos jogadores autorizados (id "jogador:<conta>"). */
  const allSheets = (): SheetSummary[] => [
    ...sheets,
    ...members.filter(m => m.status === 'aprovado').map(m => ({ id: `jogador:${m.userId}`, nome: m.personagem.nome || m.jogador || 'Jogador sem personagem', vida: m.personagem.vida }))
  ];
  function schedulePublish(): void {
    if (!linked || !sessionUser()) return;
    clearTimeout(publishTimer);
    publishTimer = setTimeout(() => { void publish(); }, 1200);
  }
  async function publish(): Promise<void> {
    const id = linked;
    if (!id || !sessionUser()) return;
    const { mesa, fundo } = publishTable(state, allSheets());
    const json = JSON.stringify(mesa);
    const sendBackground = sentBackground.get(id) !== fundo;
    if (json === lastPublished && !sendBackground) return;
    const result = await publishCampaignTable(id, mesa, sendBackground ? fundo : undefined);
    if (!result.ok) { status(`Campanha online: ${result.problem}`); return; }
    lastPublished = json;
    sentBackground.set(id, fundo);
  }
  async function loadCampaign(): Promise<void> {
    linked = readLinked();
    if (!sessionUser()) { mastered = []; members = []; return; }
    const own = await masterCampaigns();
    mastered = own.ok ? own.data : [];
    if (linked && !mastered.some(c => c.id === linked)) linked = '';
    const list = linked ? await campaignMembers(linked) : null;
    members = list?.ok ? list.data : [];
    lastPublished = '';
    if (drawn && !page.hidden) draw();
    schedulePublish();
  }
  function campaignCard(): string {
    if (!sessionUser()) return `<section class="character-card table-card" aria-labelledby="tableCampaignTitle"><h3 id="tableCampaignTitle">Campanha online</h3><p class="table-help">Entre na sua conta para os jogadores autorizados verem a mesa no próprio celular. Sem conta, use a janela dos jogadores neste computador.</p></section>`;
    const approved = members.filter(m => m.status === 'aprovado').length, pending = members.filter(m => m.status === 'pendente').length;
    return `<section class="character-card table-card" aria-labelledby="tableCampaignTitle"><h3 id="tableCampaignTitle">Campanha online</h3>
      ${mastered.length ? `<label class="table-field"><span>Publicar para</span><select data-table-input="campaign"><option value="">Ninguém (só neste computador)</option>${mastered.map(c => `<option value="${escapeHtml(c.id)}"${c.id === linked ? ' selected' : ''}>${escapeHtml(c.nome)} · ${escapeHtml(c.codigo)}</option>`).join('')}</select></label>
        ${linked ? `<p class="table-help">${approved} ${approved === 1 ? 'jogador autorizado vê' : 'jogadores autorizados veem'} a cena mostrada aos jogadores.${pending ? ` <strong>${pending} ${pending === 1 ? 'pedido aguarda' : 'pedidos aguardam'} sua autorização.</strong>` : ''}</p>` : ''}`
        : '<p class="table-help">Crie uma campanha para os jogadores entrarem com um código.</p>'}
      <button type="button" class="btn" data-table-action="manage-campaigns">${pending ? 'Ver pedidos' : 'Campanhas e pedidos'}</button></section>`;
  }

  const scene = (): TableScene => state.cenas.find(s => s.id === state.ativa) ?? state.cenas[0];
  const token = (): TableToken | undefined => scene().tokens.find(t => t.id === selected);
  function status(message: string): void {
    const el = page.querySelector('#tableStatus');
    if (el) el.textContent = message;
  }
  function save(message = ''): boolean {
    const json = encodeTable(state);
    if (json === null) { status('A mesa passou do limite de armazenamento (as imagens de fundo ocupam mais). Remova uma imagem ou uma cena.'); return false; }
    try { localStorage.setItem(TABLE_KEY, json); problem = ''; }
    catch { status('Não foi possível salvar a mesa neste navegador (espaço cheio?). Remova uma imagem de fundo ou uma cena.'); return false; }
    if (message) status(message);
    schedulePublish();
    return true;
  }
  function updateScene(next: TableScene, redraw: 'board' | 'all' = 'board', message = ''): void {
    state = { ...state, cenas: state.cenas.map(s => s.id === next.id ? next : s) };
    save(message);
    if (redraw === 'all') draw(); else drawBoard();
  }

  let boardFrame: number | undefined;
  function drawBoard(): void {
    if (boardFrame !== undefined) { cancelAnimationFrame(boardFrame); boardFrame = undefined; }
    const board = page.querySelector<HTMLElement>('#tableBoard');
    if (!board) return;
    board.innerHTML = renderBoard(scene(), { mode: 'mestre', zoom, selected, sheets: allSheets(), ruler, drag });
  }
  /** Arrastar e pintar mudam o mapa a cada movimento: desenha no máximo uma vez por quadro. */
  function scheduleBoard(): void {
    if (typeof requestAnimationFrame !== 'function') { drawBoard(); return; }
    if (boardFrame === undefined) boardFrame = requestAnimationFrame(() => { boardFrame = undefined; drawBoard(); });
  }
  function sceneOptions(): string {
    return state.cenas.map(s => `<option value="${escapeHtml(s.id)}"${s.id === state.ativa ? ' selected' : ''}>${escapeHtml(s.nome)}${s.id === state.exibida ? ' · jogadores' : ''}</option>`).join('');
  }
  function tokenEditor(t: TableToken): string {
    const sheet = t.personagemId ? allSheets().find(s => s.id === t.personagemId) : undefined;
    const remote = t.personagemId.startsWith('jogador:');
    return `<div class="table-token-editor" aria-label="Token selecionado">
      <div class="table-row"><label class="table-field table-grow"><span>Nome</span><input data-table-token="nome" maxlength="60" value="${escapeHtml(sheet?.nome ?? t.nome)}"${sheet ? ' disabled title="O nome vem da ficha"' : ''}></label>
      <label class="table-field"><span>Tamanho</span><select data-table-token="tamanho">${[1, 2, 3, 4].map(n => `<option value="${n}"${n === t.tamanho ? ' selected' : ''}>${n}×${n}</option>`).join('')}</select></label></div>
      <div class="table-row"><label class="table-field"><span>Tipo</span><select data-table-token="tipo">${Object.entries(TOKEN_KINDS).map(([id, nome]) => `<option value="${id}"${id === t.tipo ? ' selected' : ''}>${nome}</option>`).join('')}</select></label>
      <label class="table-check"><input type="checkbox" data-table-token="oculto"${t.oculto ? ' checked' : ''}> Oculto dos jogadores</label></div>
      <div class="table-swatches" role="group" aria-label="Cor do token">${TOKEN_COLORS.map(cor => `<button type="button" class="table-swatch${cor === t.cor ? ' is-active' : ''}" style="--swatch:${cor}" data-table-action="token-color" data-color="${cor}" aria-label="Cor ${cor}" aria-pressed="${cor === t.cor}"></button>`).join('')}</div>
      ${sheet && remote ? `<p class="table-help">Vida informada pelo jogador: <strong>${sheet.vida ? `${sheet.vida.atual}/${sheet.vida.maximo}` : '—'}</strong>. Ela muda quando o jogador manda o personagem atualizado.</p>`
        : sheet ? `<p class="table-help">Vida da ficha: <strong>${sheet.vida ? `${sheet.vida.atual}/${sheet.vida.maximo}` : '—'}</strong>. Mude a vida na ficha do personagem.</p><button type="button" class="btn" data-table-action="open-sheet" data-id="${escapeHtml(sheet.id)}">Abrir ficha</button>`
        : `<div class="table-row"><label class="table-field"><span>Vida atual</span><input type="number" data-table-token="vida-atual" value="${t.vida?.atual ?? ''}"></label><label class="table-field"><span>Vida máxima</span><input type="number" min="0" data-table-token="vida-maximo" value="${t.vida?.maximo ?? ''}"></label></div>`}
      <label class="table-field"><span>Notas do mestre</span><textarea data-table-token="notas" maxlength="1000" rows="2">${escapeHtml(t.notas)}</textarea></label>
      <button type="button" class="btn btn-danger" data-table-action="remove-token">Remover do mapa</button>
    </div>`;
  }
  function draw(): void {
    drawn = true;
    const s = scene();
    const t = token();
    if (!t) selected = '';
    const shown = state.cenas.find(c => c.id === state.exibida);
    const scroll = page.querySelector<HTMLElement>('.table-sidebar')?.scrollTop ?? 0;
    const boardScroll = page.querySelector<HTMLElement>('#tableBoard');
    const boardPos = boardScroll ? [boardScroll.scrollLeft, boardScroll.scrollTop] : [0, 0];
    page.innerHTML = `<div class="table-layout">
      <section class="table-stage" aria-labelledby="tableTitle">
        <header class="table-heading"><div><p class="character-eyebrow">Mesa do Mestre</p><h2 id="tableTitle" tabindex="-1">${escapeHtml(s.nome)}</h2></div>
          <div class="table-players-actions"><button type="button" class="btn${state.exibida === s.id ? '' : ' btn-primary'}" data-table-action="show-players"${state.exibida === s.id ? ' aria-pressed="true"' : ''}>${state.exibida === s.id ? 'Jogadores veem esta cena' : 'Mostrar aos jogadores'}</button><button type="button" class="btn" data-table-action="player-window">Abrir janela dos jogadores ↗</button></div></header>
        <div class="table-toolbar" role="toolbar" aria-label="Ferramentas do mapa">
          <div class="table-tools">${(Object.keys(TOOLS) as Tool[]).map(id => `<button type="button" class="btn${tool === id ? ' is-active' : ''}" data-table-tool="${id}" aria-pressed="${tool === id}">${TOOLS[id].nome}</button>`).join('')}</div>
          ${tool === 'terreno' ? `<div class="table-tools" role="group" aria-label="Terreno">${(Object.entries(TERRAINS) as [TerrainId, { nome: string; cor: string }][]).map(([id, info]) => `<button type="button" class="btn table-brush${brush === id ? ' is-active' : ''}" style="--swatch:${info.cor}" data-table-brush="${id}" aria-pressed="${brush === id}">${info.nome}</button>`).join('')}<button type="button" class="btn${brush === '.' ? ' is-active' : ''}" data-table-brush="." aria-pressed="${brush === '.'}">Borracha</button></div>` : ''}
          ${tool === 'nevoa' ? `<div class="table-tools" role="group" aria-label="Névoa"><button type="button" class="btn${fogMode === '0' ? ' is-active' : ''}" data-table-fog="0" aria-pressed="${fogMode === '0'}">Revelar</button><button type="button" class="btn${fogMode === '1' ? ' is-active' : ''}" data-table-fog="1" aria-pressed="${fogMode === '1'}">Cobrir</button>${s.nevoa ? '' : '<span class="table-help">Ligue a névoa na cena para os jogadores verem o efeito.</span>'}</div>` : ''}
          <div class="table-tools table-zoom" role="group" aria-label="Zoom"><button type="button" class="btn" data-table-action="zoom-out" aria-label="Diminuir zoom">−</button><span>${Math.round(zoom / 40 * 100)}%</span><button type="button" class="btn" data-table-action="zoom-in" aria-label="Aumentar zoom">+</button><button type="button" class="btn" data-table-action="zoom-fit">Ajustar</button></div>
        </div>
        <p class="table-hint">${TOOLS[tool].dica}</p>
        <div class="table-board table-tool-${tool}" id="tableBoard"></div>
        <p class="table-status" id="tableStatus" role="status">${escapeHtml(problem || (shown ? `Os jogadores veem: ${shown.nome}.` : 'Nenhuma cena está sendo mostrada aos jogadores.'))}</p>
      </section>
      <aside class="table-sidebar" aria-label="Painel do mestre">
        <section class="character-card table-card" aria-labelledby="tableSceneTitle"><h3 id="tableSceneTitle">Cena</h3>
          <div class="table-row"><label class="table-field table-grow"><span>Cena aberta</span><select data-table-input="scene">${sceneOptions()}</select></label></div>
          <div class="table-buttons"><button type="button" class="btn" data-table-action="new-scene"${state.cenas.length >= TABLE_SCENE_LIMIT ? ' disabled' : ''}>+ Nova cena</button><button type="button" class="btn" data-table-action="duplicate-scene"${state.cenas.length >= TABLE_SCENE_LIMIT ? ' disabled' : ''}>Duplicar</button><button type="button" class="btn btn-danger" data-table-action="delete-scene"${state.cenas.length <= 1 ? ' disabled' : ''}>Excluir</button></div>
          <label class="table-field"><span>Nome da cena</span><input data-table-input="nome" maxlength="60" value="${escapeHtml(s.nome)}"></label>
          <div class="table-row"><label class="table-field"><span>Colunas</span><input type="number" min="${TABLE_SIZE_MIN}" max="${TABLE_SIZE_MAX}" data-table-input="colunas" value="${s.colunas}"></label><label class="table-field"><span>Linhas</span><input type="number" min="${TABLE_SIZE_MIN}" max="${TABLE_SIZE_MAX}" data-table-input="linhas" value="${s.linhas}"></label><label class="table-field" title="Metros por quadrado"><span>Metros (□)</span><input type="number" min="0.1" max="100" step="0.5" data-table-input="metros" value="${s.metros}"></label></div>
          <label class="table-check"><input type="checkbox" data-table-input="grade"${s.grade ? ' checked' : ''}> Mostrar grade</label>
          <div class="table-buttons"><button type="button" class="btn" data-table-action="background">${s.fundo ? 'Trocar imagem do mapa' : 'Imagem do mapa'}</button>${s.fundo ? '<button type="button" class="btn" data-table-action="remove-background">Tirar imagem</button>' : ''}</div>
          <p class="table-help">A imagem estica sobre a grade: ajuste colunas e linhas para casar com os quadrados do mapa.</p>
          <label class="table-check"><input type="checkbox" data-table-input="nevoa"${s.nevoa ? ' checked' : ''}> Névoa de guerra</label>
          ${s.nevoa ? '<div class="table-buttons"><button type="button" class="btn" data-table-action="fog-all">Cobrir tudo</button><button type="button" class="btn" data-table-action="fog-none">Revelar tudo</button></div>' : ''}
          <input type="file" id="tableBackground" accept="image/png,image/jpeg,image/webp" hidden>
        </section>
        ${campaignCard()}
        <section class="character-card table-card" aria-labelledby="tableTokensTitle"><h3 id="tableTokensTitle">Tokens <span class="table-count">${s.tokens.length}/${TABLE_TOKEN_LIMIT}</span></h3>
          ${members.some(m => m.status === 'aprovado') ? `<div class="table-row"><label class="table-field table-grow"><span>Personagem de jogador da campanha</span><select id="tableMemberPick">${members.filter(m => m.status === 'aprovado').map(m => `<option value="jogador:${escapeHtml(m.userId)}">${escapeHtml(m.personagem.nome || 'Ainda sem personagem')}${m.jogador ? ` (${escapeHtml(m.jogador)})` : ''}</option>`).join('')}</select></label><button type="button" class="btn" data-table-action="add-member">Pôr no mapa</button></div>` : ''}
          ${sheets.length ? `<div class="table-row"><label class="table-field table-grow"><span>Personagem das fichas</span><select id="tableSheetPick">${sheets.map(sheet => `<option value="${escapeHtml(sheet.id)}">${escapeHtml(sheet.nome)}</option>`).join('')}</select></label><button type="button" class="btn" data-table-action="add-sheet">Pôr no mapa</button></div>` : '<p class="table-help">Crie personagens nas fichas para colocá-los no mapa.</p>'}
          <div class="table-row"><label class="table-field table-grow"><span>Novo token (NPC, criatura, objeto)</span><input id="tableTokenName" maxlength="60" placeholder="Ex.: Lobo sombrio"></label>
          <label class="table-field"><span>Tipo</span><select id="tableTokenKind">${Object.entries(TOKEN_KINDS).filter(([id]) => id !== 'jogador').map(([id, nome]) => `<option value="${id}"${id === 'inimigo' ? ' selected' : ''}>${nome}</option>`).join('')}</select></label></div>
          <button type="button" class="btn" data-table-action="add-token">+ Adicionar token</button>
          ${s.tokens.length ? `<ul class="table-token-list">${s.tokens.map(item => {
            const sheet = item.personagemId ? allSheets().find(x => x.id === item.personagemId) : undefined;
            return `<li><button type="button" class="table-token-item${item.id === selected ? ' is-active' : ''}" data-table-action="select-token" data-id="${escapeHtml(item.id)}" aria-pressed="${item.id === selected}"><span class="table-token-dot" style="--swatch:${item.cor}"></span>${escapeHtml(sheet?.nome ?? item.nome)}<small>${TOKEN_KINDS[item.tipo]}${item.oculto ? ' · oculto' : ''}${s.nevoa && hiddenByFog(s, item) ? ' · na névoa' : ''}</small></button></li>`;
          }).join('')}</ul>` : ''}
          ${t ? tokenEditor(t) : ''}
        </section>
        <section class="character-card table-card" aria-labelledby="tableDiceTitle"><h3 id="tableDiceTitle">Dados</h3>
          <div class="table-dice">${DICE.map(faces => `<button type="button" class="btn" data-table-roll="1d${faces}">d${faces}</button>`).join('')}</div>
          <form class="table-row" id="tableRollForm"><label class="table-field table-grow"><span>Rolagem</span><input id="tableRollInput" maxlength="80" placeholder="Ex.: 2d6+3" autocomplete="off"></label><button type="submit" class="btn btn-primary">Rolar</button></form>
          <label class="table-check"><input type="checkbox" id="tableRollSecret"> Rolagem secreta (só o mestre vê)</label>
          ${rollLog(state.rolagens, 'mestre')}
          ${state.rolagens.length ? '<button type="button" class="btn" data-table-action="clear-rolls">Limpar histórico</button>' : ''}
        </section>
      </aside>
    </div>`;
    drawBoard();
    const sidebar = page.querySelector<HTMLElement>('.table-sidebar');
    if (sidebar) sidebar.scrollTop = scroll;
    const board = page.querySelector<HTMLElement>('#tableBoard');
    if (board) { board.scrollLeft = boardPos[0]; board.scrollTop = boardPos[1]; }
  }

  /** Maior zoom em que a cena inteira cabe no quadro do mapa. */
  function fitZoom(force = false): void {
    if (zoomTouched && !force) return;
    const board = page.querySelector<HTMLElement>('#tableBoard');
    if (!board || !board.clientWidth || !board.clientHeight) return;
    const s = scene();
    const fit = Math.max(16, Math.min(96, Math.floor(Math.min((board.clientWidth - 4) / s.colunas, (board.clientHeight - 4) / s.linhas))));
    if (fit !== zoom) { zoom = fit; draw(); }
  }
  function cellAt(evt: PointerEvent): Point | null {
    const svg = page.querySelector<SVGSVGElement>('#tableBoard svg');
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const s = scene();
    return { x: (evt.clientX - rect.left) / rect.width * s.colunas, y: (evt.clientY - rect.top) / rect.height * s.linhas };
  }
  const clampCell = (p: Point): Point => {
    const s = scene();
    return { x: Math.min(s.colunas - 1, Math.max(0, Math.floor(p.x))), y: Math.min(s.linhas - 1, Math.max(0, Math.floor(p.y))) };
  };
  function paint(p: Point): void {
    const s = scene(), cell = clampCell(p);
    if (tool === 'terreno') {
      const terreno = setCell(s.terreno, s.colunas, cell.x, cell.y, brush);
      if (terreno !== s.terreno) { state = { ...state, cenas: state.cenas.map(c => c.id === s.id ? { ...s, terreno } : c) }; scheduleBoard(); }
    } else if (tool === 'nevoa') {
      const coberto = setCell(s.coberto, s.colunas, cell.x, cell.y, fogMode);
      if (coberto !== s.coberto) { state = { ...state, cenas: state.cenas.map(c => c.id === s.id ? { ...s, coberto } : c) }; scheduleBoard(); }
    }
  }
  function freeCell(size: number): Point {
    const s = scene();
    const taken = (x: number, y: number): boolean => s.tokens.some(t => x < t.x + t.tamanho && x + size > t.x && y < t.y + t.tamanho && y + size > t.y)
      || Array.from({ length: size * size }, (_, i) => s.terreno[(y + Math.floor(i / size)) * s.colunas + x + (i % size)]).includes('p');
    for (let y = 1; y <= s.linhas - size; y++) for (let x = 1; x <= s.colunas - size; x++) if (!taken(x, y)) return { x, y };
    return { x: 0, y: 0 };
  }
  function addToken(base: Omit<TableToken, 'id' | 'x' | 'y'>): void {
    const s = scene();
    if (s.tokens.length >= TABLE_TOKEN_LIMIT) { status(`Cada cena aceita até ${TABLE_TOKEN_LIMIT} tokens.`); return; }
    const next: TableToken = { ...base, id: tableId('k'), ...freeCell(base.tamanho) };
    selected = next.id;
    tool = 'mover';
    updateScene({ ...s, tokens: [...s.tokens, next] }, 'all', `${base.nome} entrou no mapa.`);
  }
  function editToken(change: Partial<TableToken>, redraw: 'board' | 'all' = 'board'): void {
    const s = scene(), t = token();
    if (!t) return;
    updateScene({ ...s, tokens: s.tokens.map(item => item.id === t.id ? { ...item, ...change } : item) }, redraw);
  }
  function roll(expression: string): void {
    const reading = rollDice(expression);
    if (!reading.ok) { status(reading.problem); return; }
    const secret = page.querySelector<HTMLInputElement>('#tableRollSecret')?.checked ?? false;
    const entry: DiceRoll = { id: tableId('r'), quando: Date.now(), quem: 'Mestre', expressao: reading.expressao, detalhe: reading.detalhe, total: reading.total, secreta: secret };
    state = { ...state, rolagens: [...state.rolagens, entry].slice(-TABLE_ROLL_LIMIT) };
    save(`${reading.expressao}: ${reading.total} (${reading.detalhe})`);
    draw();
    const secretBox = page.querySelector<HTMLInputElement>('#tableRollSecret');
    if (secretBox) secretBox.checked = secret;
  }

  page.addEventListener('pointerdown', evt => {
    const svg = (evt.target as Element).closest?.('#tableBoard svg');
    if (!svg || evt.button !== 0) return;
    const p = cellAt(evt);
    if (!p) return;
    (svg as SVGSVGElement).setPointerCapture?.(evt.pointerId);
    if (tool === 'mover') {
      const g = (evt.target as Element).closest<SVGGElement>('[data-token]');
      const t = g ? scene().tokens.find(item => item.id === g.dataset.token) : undefined;
      if (!t) { if (selected) { selected = ''; draw(); } return; }
      const changed = selected !== t.id;
      selected = t.id;
      drag = { id: t.id, x: t.x, y: t.y, dx: p.x - t.x, dy: p.y - t.y };
      if (changed) draw(); else drawBoard();
      evt.preventDefault();
    } else if (tool === 'regua') {
      const cell = clampCell(p);
      ruler = { from: cell, to: cell }; drawBoard();
    } else { painting = true; paint(p); evt.preventDefault(); }
  });
  page.addEventListener('pointermove', evt => {
    if (!drag && !painting && !(tool === 'regua' && ruler && evt.buttons & 1)) return;
    const p = cellAt(evt);
    if (!p) return;
    if (drag) {
      const s = scene(), t = s.tokens.find(item => item.id === drag!.id);
      if (!t) return;
      drag = { ...drag, x: Math.min(s.colunas - t.tamanho, Math.max(0, p.x - drag.dx)), y: Math.min(s.linhas - t.tamanho, Math.max(0, p.y - drag.dy)) };
      scheduleBoard();
    } else if (painting) paint(p);
    else if (ruler) { const to = clampCell(p); if (to.x !== ruler.to.x || to.y !== ruler.to.y) { ruler = { ...ruler, to }; scheduleBoard(); } }
  });
  const finish = (): void => {
    if (drag) {
      const s = scene(), current = drag;
      drag = null;
      const x = Math.round(current.x), y = Math.round(current.y);
      updateScene({ ...s, tokens: s.tokens.map(t => t.id === current.id ? { ...t, x, y } : t) }, 'board');
    } else if (painting) { painting = false; save(); }
  };
  page.addEventListener('pointerup', finish);
  page.addEventListener('pointercancel', finish);

  page.addEventListener('click', evt => {
    const target = evt.target as Element;
    const toolButton = target.closest<HTMLButtonElement>('[data-table-tool]');
    if (toolButton) { tool = toolButton.dataset.tableTool as Tool; if (tool !== 'regua') ruler = null; draw(); return; }
    const brushButton = target.closest<HTMLButtonElement>('[data-table-brush]');
    if (brushButton) { brush = brushButton.dataset.tableBrush as TerrainId | '.'; draw(); return; }
    const fogButton = target.closest<HTMLButtonElement>('[data-table-fog]');
    if (fogButton) { fogMode = fogButton.dataset.tableFog as '0' | '1'; draw(); return; }
    const rollButton = target.closest<HTMLButtonElement>('[data-table-roll]');
    if (rollButton) { roll(rollButton.dataset.tableRoll!); return; }
    const button = target.closest<HTMLButtonElement>('[data-table-action]');
    if (!button) return;
    const s = scene();
    switch (button.dataset.tableAction) {
      case 'zoom-in': zoomTouched = true; zoom = Math.min(96, zoom + 8); draw(); break;
      case 'zoom-out': zoomTouched = true; zoom = Math.max(16, zoom - 8); draw(); break;
      case 'zoom-fit': zoomTouched = false; fitZoom(true); break;
      case 'new-scene': {
        if (state.cenas.length >= TABLE_SCENE_LIMIT) return;
        const next = newScene(`Cena ${state.cenas.length + 1}`);
        state = { ...state, cenas: [...state.cenas, next], ativa: next.id };
        selected = ''; ruler = null; save('Nova cena criada.'); draw();
        page.querySelector<HTMLInputElement>('[data-table-input="nome"]')?.select();
        break;
      }
      case 'duplicate-scene': {
        if (state.cenas.length >= TABLE_SCENE_LIMIT) return;
        const copy: TableScene = { ...structuredClone(s), id: tableId('c'), nome: `${s.nome} (cópia)`.slice(0, 60) };
        copy.tokens = copy.tokens.map(t => ({ ...t, id: tableId('k') }));
        state = { ...state, cenas: [...state.cenas, copy], ativa: copy.id };
        selected = ''; if (save('Cena duplicada.')) draw(); else { state = { ...state, cenas: state.cenas.filter(c => c.id !== copy.id), ativa: s.id }; }
        break;
      }
      case 'delete-scene':
        if (state.cenas.length <= 1 || !confirm(`Excluir a cena “${s.nome}”, com seus tokens e terreno?`)) return;
        state = { ...state, cenas: state.cenas.filter(c => c.id !== s.id), exibida: state.exibida === s.id ? '' : state.exibida };
        state.ativa = state.cenas[0].id; selected = ''; save('Cena excluída.'); draw();
        break;
      case 'show-players':
        state = { ...state, exibida: s.id }; save(`Os jogadores veem: ${s.nome}.`); draw();
        break;
      case 'player-window': {
        if (state.exibida !== s.id) { state = { ...state, exibida: s.id }; save(); draw(); }
        const url = new URL(window.location.href);
        url.search = '?mesa=jogadores'; url.hash = '';
        const opened = window.open(url.toString(), 'existus-mesa-jogadores', 'popup,width=1280,height=800');
        status(opened ? 'Janela dos jogadores aberta: arraste-a para a segunda tela ou compartilhe essa janela na chamada.' : 'O navegador bloqueou a janela. Permita pop-ups para este site.');
        break;
      }
      case 'background': page.querySelector<HTMLInputElement>('#tableBackground')?.click(); break;
      case 'remove-background': updateScene({ ...s, fundo: '' }, 'all', 'Imagem do mapa removida.'); break;
      case 'fog-all': updateScene({ ...s, coberto: '1'.repeat(s.colunas * s.linhas) }, 'all', 'Mapa todo coberto pela névoa.'); break;
      case 'fog-none': updateScene({ ...s, coberto: '0'.repeat(s.colunas * s.linhas) }, 'all', 'Mapa todo revelado.'); break;
      case 'add-sheet': {
        const pick = page.querySelector<HTMLSelectElement>('#tableSheetPick');
        const sheet = sheets.find(item => item.id === pick?.value);
        if (!sheet) return;
        const color = TOKEN_COLORS[s.tokens.filter(t => t.tipo === 'jogador').length % TOKEN_COLORS.length];
        addToken({ nome: sheet.nome, cor: color, tipo: 'jogador', tamanho: 1, oculto: false, personagemId: sheet.id, vida: null, notas: '' });
        break;
      }
      case 'add-member': {
        const pick = page.querySelector<HTMLSelectElement>('#tableMemberPick');
        const sheet = allSheets().find(item => item.id === pick?.value);
        if (!sheet) return;
        const color = TOKEN_COLORS[s.tokens.filter(t => t.tipo === 'jogador').length % TOKEN_COLORS.length];
        addToken({ nome: sheet.nome, cor: color, tipo: 'jogador', tamanho: 1, oculto: false, personagemId: sheet.id, vida: null, notas: '' });
        break;
      }
      case 'manage-campaigns': document.querySelector<HTMLButtonElement>('[data-rpg-page="campanhas"]')?.click(); break;
      case 'add-token': {
        const nameInput = page.querySelector<HTMLInputElement>('#tableTokenName');
        const kind = (page.querySelector<HTMLSelectElement>('#tableTokenKind')?.value ?? 'inimigo') as TokenKind;
        const nome = nameInput?.value.trim() || TOKEN_KINDS[kind];
        addToken({ nome: nome.slice(0, 60), cor: kind === 'inimigo' ? '#f2655c' : kind === 'objeto' ? '#5a6478' : '#4cc06a', tipo: kind, tamanho: 1, oculto: false, personagemId: '', vida: null, notas: '' });
        break;
      }
      case 'select-token': selected = button.dataset.id ?? ''; tool = 'mover'; draw(); break;
      case 'token-color': editToken({ cor: button.dataset.color! }, 'all'); break;
      case 'remove-token': {
        const t = token();
        if (!t) return;
        selected = '';
        updateScene({ ...s, tokens: s.tokens.filter(item => item.id !== t.id) }, 'all', `${t.nome} saiu do mapa.`);
        break;
      }
      case 'open-sheet':
        document.getElementById('characterPage')?.dispatchEvent(new CustomEvent('rpg:open-character', { detail: button.dataset.id }));
        break;
      case 'clear-rolls':
        if (!confirm('Limpar o histórico de rolagens?')) return;
        state = { ...state, rolagens: [] }; save('Histórico de rolagens limpo.'); draw();
        break;
    }
  });
  page.addEventListener('submit', evt => {
    if ((evt.target as Element).id !== 'tableRollForm') return;
    evt.preventDefault();
    const input = page.querySelector<HTMLInputElement>('#tableRollInput');
    if (!input) return;
    const value = input.value;
    roll(value);
    const fresh = page.querySelector<HTMLInputElement>('#tableRollInput');
    if (fresh) { fresh.value = rollDice(value).ok ? '' : value; fresh.focus(); }
  });
  page.addEventListener('change', evt => {
    const el = evt.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const s = scene();
    if (el.id === 'tableBackground') {
      const file = (el as HTMLInputElement).files?.[0];
      (el as HTMLInputElement).value = '';
      if (!file) return;
      status('Preparando a imagem do mapa…');
      shrinkImage(file).then(fundo => updateScene({ ...scene(), fundo }, 'all', 'Imagem do mapa aplicada.'))
        .catch(() => status('Não foi possível usar essa imagem. Tente um PNG ou JPG menor.'));
      return;
    }
    const field = el.dataset.tableInput;
    if (field === 'campaign') {
      try { if (el.value) localStorage.setItem(LINKED_CAMPAIGN_KEY, el.value); else localStorage.removeItem(LINKED_CAMPAIGN_KEY); } catch { /* sem armazenamento */ }
      status(el.value ? 'Publicando a cena mostrada para os jogadores autorizados.' : 'A mesa não é mais publicada online.');
      void loadCampaign();
      return;
    }
    if (field === 'scene') { state = { ...state, ativa: el.value }; selected = ''; ruler = null; save(); draw(); fitZoom(); return; }
    if (field === 'nome') { updateScene({ ...s, nome: el.value.trim().slice(0, 60) || 'Cena' }, 'all'); return; }
    if (field === 'colunas' || field === 'linhas') {
      const value = Number(el.value);
      if (!Number.isFinite(value)) { draw(); return; }
      updateScene(resizeScene(s, field === 'colunas' ? value : s.colunas, field === 'linhas' ? value : s.linhas), 'all');
      fitZoom();
      return;
    }
    if (field === 'metros') {
      const value = Number(el.value);
      updateScene({ ...s, metros: Number.isFinite(value) && value > 0 ? Math.min(100, Math.round(value * 10) / 10) : s.metros }, 'all');
      return;
    }
    if (field === 'grade' || field === 'nevoa') { updateScene({ ...s, [field]: (el as HTMLInputElement).checked }, 'all'); return; }
    const tokenField = el.dataset.tableToken;
    const t = token();
    if (!tokenField || !t) return;
    if (tokenField === 'nome') editToken({ nome: el.value.trim().slice(0, 60) || t.nome }, 'all');
    else if (tokenField === 'tamanho') {
      const tamanho = Math.min(4, Math.max(1, Number(el.value) || 1));
      editToken({ tamanho, x: Math.min(t.x, s.colunas - tamanho), y: Math.min(t.y, s.linhas - tamanho) }, 'all');
    } else if (tokenField === 'tipo' && el.value in TOKEN_KINDS) editToken({ tipo: el.value as TokenKind }, 'all');
    else if (tokenField === 'oculto') editToken({ oculto: (el as HTMLInputElement).checked }, 'all');
    else if (tokenField === 'notas') editToken({ notas: el.value.slice(0, 1000) });
    else if (tokenField === 'vida-atual' || tokenField === 'vida-maximo') {
      const raw = el.value.trim();
      const value = Math.round(Number(raw));
      const vida = t.vida ?? { atual: 0, maximo: 0 };
      if (!raw && tokenField === 'vida-maximo') { editToken({ vida: null }, 'all'); return; }
      if (!Number.isFinite(value)) return;
      editToken({ vida: tokenField === 'vida-atual' ? { ...vida, atual: Math.max(-9999, Math.min(99999, value)) } : { ...vida, maximo: Math.max(0, Math.min(99999, value)) } }, 'all');
    }
  });
  document.addEventListener('keydown', evt => {
    if (page.hidden || !selected || evt.key !== 'Delete') return;
    const active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
    const s = scene(), t = token();
    if (!t) return;
    evt.preventDefault();
    selected = '';
    updateScene({ ...s, tokens: s.tokens.filter(item => item.id !== t.id) }, 'all', `${t.nome} saiu do mapa.`);
  });
  page.addEventListener('mesa:open', () => {
    sheets = readSheetSummaries();
    draw();
    fitZoom();
    void loadCampaign();
    page.querySelector<HTMLElement>('#tableTitle')?.focus({ preventScroll: true });
  });
  window.addEventListener('storage', evt => {
    if (evt.key === CHARACTER_LIBRARY_KEY) { sheets = readSheetSummaries(); if (drawn && !page.hidden) draw(); schedulePublish(); }
  });
  window.addEventListener('existus:campanha-mesa', () => { void loadCampaign(); });
  window.addEventListener('existus:sessao', () => { if (drawn) void loadCampaign(); });
}

/** Página aberta com ?mesa=jogadores: só a cena exibida, sem névoa revelada nem tokens ocultos. */
export function startPlayerTable(): void {
  document.getElementById('entryGate')?.setAttribute('hidden', '');
  document.getElementById('appShell')?.setAttribute('hidden', '');
  document.title = 'Mesa · Existus RPG';
  const root = document.createElement('main');
  root.className = 'table-player';
  root.setAttribute('aria-label', 'Mesa dos jogadores');
  document.body.appendChild(root);
  let zoom = 0;
  function draw(): void {
    const { state } = loadTable();
    const view = playerView(state);
    const sheets = readSheetSummaries();
    const board = root.querySelector<HTMLElement>('.table-board');
    const pos = board ? [board.scrollLeft, board.scrollTop] : [0, 0];
    if (!view.scene) {
      root.innerHTML = '<div class="table-player-empty"><p class="character-eyebrow">Mesa dos jogadores</p><h1>Aguardando o mestre…</h1><p>Quando o mestre mostrar uma cena, ela aparece aqui.</p></div>';
      return;
    }
    const s = view.scene;
    const fit = Math.max(16, Math.floor(Math.min((window.innerWidth - 360) / s.colunas, (window.innerHeight - 40) / s.linhas)));
    root.innerHTML = `<div class="table-player-layout"><div class="table-board" aria-live="polite">${renderBoard(s, { mode: 'jogadores', zoom: zoom || fit, sheets })}</div>
      <aside class="table-player-side"><p class="character-eyebrow">Mesa dos jogadores</p><h1>${escapeHtml(s.nome)}</h1>
      <div class="table-tools table-zoom" role="group" aria-label="Zoom"><button type="button" class="btn" data-zoom="-1" aria-label="Diminuir zoom">−</button><button type="button" class="btn" data-zoom="0">Ajustar</button><button type="button" class="btn" data-zoom="1" aria-label="Aumentar zoom">+</button></div>
      <h2>Rolagens</h2>${rollLog(view.rolagens.slice(-15), 'jogadores')}</aside></div>`;
    const fresh = root.querySelector<HTMLElement>('.table-board');
    if (fresh) { fresh.scrollLeft = pos[0]; fresh.scrollTop = pos[1]; }
  }
  root.addEventListener('click', evt => {
    const button = (evt.target as Element).closest<HTMLButtonElement>('[data-zoom]');
    if (!button) return;
    const step = Number(button.dataset.zoom);
    const current = root.querySelector('svg')?.getAttribute('width');
    const s = playerView(loadTable().state).scene;
    const now = current && s ? Number(current) / s.colunas : 40;
    zoom = step === 0 ? 0 : Math.min(120, Math.max(12, now + step * 8));
    draw();
  });
  window.addEventListener('storage', evt => { if (evt.key === TABLE_KEY || evt.key === CHARACTER_LIBRARY_KEY) draw(); });
  window.addEventListener('resize', () => { if (!zoom) draw(); });
  draw();
}
