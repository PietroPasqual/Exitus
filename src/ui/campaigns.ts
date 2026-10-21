import { CHARACTER_LIBRARY_KEY } from '../core/character-library';
import { normalizeCharacter, type Character } from '../core/character';
import { LINKED_CAMPAIGN_KEY, readPublishedTable, summarizeCharacter, type CampaignMember, type CharacterSummary, type MasterCampaign, type Membership, type PublishedTable } from '../core/campaign';
import { escapeHtml } from '../core/format';
import { sessionUser } from '../cloud/session';
import {
  answerRequest, campaignMembers, campaignStamp, campaignTable, createCampaign, deleteCampaign, joinCampaign,
  leaveCampaign, masterCampaigns, myMemberships, removeMember, updateMyCharacter
} from '../cloud/campaigns';
import { renderAvatar } from './avatar';
import { renderBoard } from './game-table';
import { canMaster, isPhone } from './play-mode';

/** Qual ficha deste aparelho está na mesa de cada campanha (o resumo que o mestre recebe). */
const CAMPAIGN_CHARACTERS_KEY = 'existus-campanha-personagens';
function campaignCharacters(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(CAMPAIGN_CHARACTERS_KEY) ?? '{}') as unknown;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, string> : {};
  } catch { return {}; }
}
function rememberCampaignCharacter(campaignId: string, characterId: string): void {
  try { localStorage.setItem(CAMPAIGN_CHARACTERS_KEY, JSON.stringify({ ...campaignCharacters(), [campaignId]: characterId })); } catch { /* sem armazenamento */ }
}
const STATUS_LABEL = { pendente: 'Aguardando o mestre', aprovado: 'Autorizado', recusado: 'Recusado' } as const;
/** Grupo dos personagens que não pertencem a nenhuma campanha. */
export const NO_CAMPAIGN = 'sem-campanha';

/** Última leitura das fichas: validar todas é caro e a página consulta várias vezes por desenho. */
let characterCache: { raw: string | null; list: { id: string; data: Character }[] } | null = null;
/** Fichas guardadas neste navegador (id e ficha validada). Não altere os objetos devolvidos. */
export function localCharacters(): { id: string; data: Character }[] {
  let raw: string | null;
  try { raw = localStorage.getItem(CHARACTER_LIBRARY_KEY); } catch { return []; }
  if (characterCache && characterCache.raw === raw) return characterCache.list;
  let list: { id: string; data: Character }[] = [];
  try {
    const parsed = JSON.parse(raw ?? 'null') as { characters?: unknown } | null;
    if (parsed && Array.isArray(parsed.characters)) {
      list = parsed.characters.flatMap(entry => {
        const record = entry as { id?: unknown; data?: unknown } | null;
        const data = record && typeof record.id === 'string' ? normalizeCharacter(record.data) : null;
        return data ? [{ id: record!.id as string, data }] : [];
      });
    }
  } catch { list = []; }
  characterCache = { raw, list };
  return list;
}

export function summaryCard(summary: CharacterSummary, extra = ''): string {
  const details = [summary.raca, summary.classe, summary.rank && `Rank ${summary.rank}`].filter(Boolean).join(' · ');
  const nome = summary.nome || 'Ainda sem personagem';
  return `<div class="campaign-character">${renderAvatar(summary.avatar ?? undefined, summary.classe, 48, nome)}<div><strong>${escapeHtml(nome)}</strong>${details ? `<small>${escapeHtml(details)}</small>` : ''}${summary.vida ? `<small>Vida ${summary.vida.atual}/${summary.vida.maximo}</small>` : ''}${extra}</div></div>`;
}

/**
 * Campanhas: a tela inicial do site. Lista as campanhas da pessoa e, ao entrar numa,
 * mostra os personagens dela. Abre quando a navegação dispara `campanhas:open` em
 * #campaignPage (com `detail.campanhaId` para abrir direto numa campanha).
 */
export function setupCampaigns(): void {
  const root = document.getElementById('campaignPage');
  if (!root) return;
  const page = root;
  let memberships: Membership[] = [];
  let mastered: MasterCampaign[] = [];
  const members = new Map<string, CampaignMember[]>();
  let loaded = false;
  let selected = '';
  let message = '';
  let loading = false;
  let watching: { id: string; nome: string; stamp: string; fundoStamp: string; fundo: string; table: PublishedTable | null } | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  const characterPage = (): HTMLElement | null => document.getElementById('characterPage');
  const campaignName = (id: string): string => memberships.find(m => m.campanhaId === id)?.campanha ?? mastered.find(c => c.id === id)?.nome ?? 'Campanha';
  /** Campanhas conhecidas; sem conta (ou antes de carregar), todo personagem fica "sem campanha". */
  const knownCampaigns = (): Set<string> => new Set(loaded ? [...memberships.map(m => m.campanhaId), ...mastered.map(c => c.id)] : []);
  function charactersOf(group: string): { id: string; data: Character }[] {
    const known = knownCampaigns();
    return localCharacters().filter(c => group === NO_CAMPAIGN
      ? !c.data.campanhaId || !known.has(c.data.campanhaId)
      : c.data.campanhaId === group);
  }
  function say(text: string): void {
    message = text;
    const el = page.querySelector('#campaignStatus');
    if (el) el.textContent = text;
  }
  function localStorageGet(key: string): string {
    try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
  }

  function characterCard(c: { id: string; data: Character }, campaignId: string, member: Membership | undefined): string {
    const summary = summarizeCharacter(c.data);
    const onTable = member && campaignCharacters()[campaignId] === c.id;
    const details = [summary.raca, summary.classe, summary.rank && `Rank ${summary.rank}`].filter(Boolean).join(' · ');
    return `<li class="campaign-pc${onTable ? ' is-on-table' : ''}">${renderAvatar(c.data.avatar, summary.classe, 64, summary.nome)}
      <div class="campaign-pc-body"><strong>${escapeHtml(summary.nome)}</strong>${details ? `<small>${escapeHtml(details)}</small>` : ''}${summary.vida ? `<small>Vida ${summary.vida.atual}/${summary.vida.maximo}</small>` : ''}${onTable ? '<span class="campaign-badge is-ok">Na mesa</span>' : ''}</div>
      <div class="campaign-actions"><button type="button" class="btn btn-primary" data-campaign-action="open-character" data-character="${escapeHtml(c.id)}">Abrir ficha</button>
      ${member ? `<button type="button" class="btn" data-campaign-action="send-character" data-id="${escapeHtml(campaignId)}" data-character="${escapeHtml(c.id)}">${onTable ? 'Atualizar na mesa' : 'Levar à mesa'}</button>` : ''}
      ${campaignId !== NO_CAMPAIGN ? `<button type="button" class="btn" data-campaign-action="unlink" data-character="${escapeHtml(c.id)}">Tirar da campanha</button>` : ''}</div></li>`;
  }
  function charactersSection(campaignId: string, member: Membership | undefined, title: string): string {
    const list = charactersOf(campaignId);
    const loose = campaignId === NO_CAMPAIGN ? [] : charactersOf(NO_CAMPAIGN);
    return `<section class="character-card campaign-card" aria-labelledby="campaignCharactersTitle"><div class="character-section-heading"><h3 id="campaignCharactersTitle">${title} <span class="table-count">${list.length}</span></h3><button type="button" class="btn btn-primary" data-campaign-action="create-character" data-id="${escapeHtml(campaignId)}">+ Criar personagem</button></div>
      ${list.length ? `<ul class="campaign-pcs">${list.map(c => characterCard(c, campaignId, member)).join('')}</ul>` : `<p class="character-help">${campaignId === NO_CAMPAIGN ? 'Nenhum personagem solto neste aparelho.' : 'Nenhum personagem nesta campanha ainda. Crie um ou traga um que você já tem.'}</p>`}
      ${loose.length ? `<div class="campaign-join"><label class="character-field"><span>Trazer personagem que você já tem</span><select id="campaignBring">${loose.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.data.identidade.nome.trim() || 'Personagem sem nome')}</option>`).join('')}</select></label><button type="button" class="btn" data-campaign-action="bring" data-id="${escapeHtml(campaignId)}">Trazer para a campanha</button></div>` : ''}
      ${member && list.length ? '<p class="character-help">“Levar à mesa” manda ao mestre o resumo do personagem (nome, raça, classe, vida e avatar). A ficha completa fica só com você.</p>' : ''}
    </section>`;
  }

  function drawWatching(): string {
    if (!watching) return '';
    const view = watching.table;
    return `<section class="campaign-table" aria-labelledby="campaignTableTitle"><div class="campaign-table-heading"><div><p class="character-eyebrow">Mesa · ${escapeHtml(watching.nome)}</p><h2 id="campaignTableTitle" tabindex="-1">${escapeHtml(view?.scene?.nome ?? watching.nome)}</h2></div><button type="button" class="btn" data-campaign-action="close-table">← Voltar à campanha</button></div>
      ${view?.scene ? `<div class="campaign-table-layout"><div class="table-board">${renderBoard(view.scene, { mode: 'jogadores', zoom: Math.max(18, Math.min(48, Math.floor((page.clientWidth || 360) / view.scene.colunas))) })}</div>
        <aside class="campaign-rolls"><h3>Rolagens do mestre</h3>${view.rolagens.length ? `<ol class="table-roll-log">${view.rolagens.slice(-12).reverse().map(r => `<li><div><strong>${escapeHtml(r.quem)}</strong> rolou <code>${escapeHtml(r.expressao)}</code></div><span class="table-roll-total">${r.total}</span><small>${escapeHtml(r.detalhe)}</small></li>`).join('')}</ol>` : '<p class="table-empty">Nenhuma rolagem ainda.</p>'}</aside></div>`
        : '<div class="character-empty">O mestre ainda não mostrou nenhuma cena. Esta tela atualiza sozinha.</div>'}
      <p class="table-status" id="campaignStatus" role="status">${escapeHtml(message)}</p></section>`;
  }
  function drawHome(): string {
    const user = sessionUser(), master = canMaster();
    const loose = charactersOf(NO_CAMPAIGN).length;
    const cards = [
      ...(master ? mastered.map(c => {
        const pending = (members.get(c.id) ?? []).filter(m => m.status === 'pendente').length;
        return `<li class="campaign-tile is-master"><span class="campaign-role">Mestre</span><strong>${escapeHtml(c.nome)}</strong><small>Código ${escapeHtml(c.codigo)} · ${(members.get(c.id) ?? []).filter(m => m.status === 'aprovado').length} jogadores</small>${pending ? `<span class="campaign-badge is-alert">${pending} ${pending === 1 ? 'pedido' : 'pedidos'}</span>` : ''}<button type="button" class="btn btn-primary" data-campaign-action="select" data-id="${escapeHtml(c.id)}">Entrar na campanha</button></li>`;
      }) : []),
      ...memberships.map(m => {
        const pc = localCharacters().find(c => c.id === campaignCharacters()[m.campanhaId]);
        const count = charactersOf(m.campanhaId).length;
        return `<li class="campaign-tile is-${m.status}"><span class="campaign-role">Jogador</span>${pc ? renderAvatar(pc.data.avatar, summarizeCharacter(pc.data).classe, 48, pc.data.identidade.nome) : ''}<strong>${escapeHtml(m.campanha)}</strong><small>${count} ${count === 1 ? 'personagem' : 'personagens'}</small><span class="campaign-badge">${STATUS_LABEL[m.status]}</span><button type="button" class="btn btn-primary" data-campaign-action="select" data-id="${escapeHtml(m.campanhaId)}">Entrar na campanha</button></li>`;
      }),
      `<li class="campaign-tile is-loose"><span class="campaign-role">Neste aparelho</span><strong>Personagens sem campanha</strong><small>${loose} ${loose === 1 ? 'personagem' : 'personagens'}</small><button type="button" class="btn" data-campaign-action="select" data-id="${NO_CAMPAIGN}">Abrir</button></li>`
    ];
    return `<div class="character-heading"><div><p class="character-eyebrow">${master ? 'Modo mestre' : 'Modo jogador'}</p><h2 id="campaignTitle" tabindex="-1">Suas campanhas</h2>
        <p>${master ? 'Entre numa campanha para ver os jogadores, autorizar pedidos e os personagens dela.' : 'Entre numa campanha para ver e criar os personagens dela. A mesa abre depois que o mestre autorizar.'}</p></div></div>
      ${isPhone() ? '<div class="character-notice"><strong>No celular você joga como jogador.</strong> Para mestrar (mapa, tokens e autorizações), abra o site no computador e ligue o modo mestre.</div>' : ''}
      <p class="character-status" id="campaignStatus" role="status">${escapeHtml(message)}</p>
      ${user ? '' : `<section class="character-card campaign-card"><h3>Entre na sua conta para jogar em campanha</h3><p class="character-help">As campanhas ligam a sua conta à do mestre. Sem conta, seus personagens continuam neste aparelho, em “Personagens sem campanha”.</p><button type="button" class="btn btn-primary" data-campaign-action="login">Entrar ou criar conta</button></section>`}
      <ul class="campaign-tiles">${cards.join('')}</ul>
      ${user && loaded && !memberships.length && !(master && mastered.length) ? '<p class="character-help">Você ainda não participa de nenhuma campanha. Peça o código ao mestre.</p>' : ''}
      ${user ? `<section class="character-card campaign-card" aria-labelledby="campaignJoinTitle"><h3 id="campaignJoinTitle">Participar de uma campanha</h3>
        <form class="campaign-join" id="campaignJoin"><label class="character-field"><span>Código que o mestre passou</span><input id="campaignCode" maxlength="16" autocomplete="off" autocapitalize="characters" placeholder="Ex.: 7F3A9C21" required></label><button type="submit" class="btn btn-primary"${loading ? ' disabled' : ''}>Pedir para entrar</button></form>
        <p class="character-help">Depois do pedido, entre na campanha para criar ou escolher o personagem. O mestre decide se autoriza.</p></section>` : ''}
      ${user && master ? `<section class="character-card campaign-card" aria-labelledby="campaignCreateTitle"><h3 id="campaignCreateTitle">Mestrar uma nova campanha</h3>
        <form class="campaign-join" id="campaignCreate"><label class="character-field"><span>Nome da campanha</span><input id="campaignName" maxlength="60" placeholder="Ex.: As Ruínas de Pagma" required></label><button type="submit" class="btn btn-primary"${loading ? ' disabled' : ''}>Criar campanha</button></form></section>` : ''}`;
  }
  function drawDetail(): string {
    const back = '<div class="character-breadcrumb"><button type="button" class="btn" data-campaign-action="home">← Campanhas</button><span>Campanha</span></div>';
    if (selected === NO_CAMPAIGN) {
      return `${back}<div class="character-heading"><div><p class="character-eyebrow">Neste aparelho</p><h2 id="campaignTitle" tabindex="-1">Personagens sem campanha</h2><p>Personagens que ainda não estão em nenhuma campanha. Para levá-los a uma, entre na campanha e use “Trazer personagem”.</p></div>
        <div class="character-actions"><button type="button" class="btn" data-campaign-action="all-characters">Ver todos os personagens</button></div></div>
        <p class="character-status" id="campaignStatus" role="status">${escapeHtml(message)}</p>${charactersSection(NO_CAMPAIGN, undefined, 'Personagens')}`;
    }
    const own = mastered.find(c => c.id === selected);
    const member = memberships.find(m => m.campanhaId === selected);
    if (own) {
      const list = members.get(own.id) ?? [];
      const linked = localStorageGet(LINKED_CAMPAIGN_KEY) === own.id;
      return `${back}<div class="character-heading"><div><p class="character-eyebrow">Você é o mestre</p><h2 id="campaignTitle" tabindex="-1">${escapeHtml(own.nome)}</h2>
          <p class="campaign-code">Código para os jogadores: <code>${escapeHtml(own.codigo)}</code> <button type="button" class="btn btn-small" data-campaign-action="copy-code" data-code="${escapeHtml(own.codigo)}">Copiar</button></p></div>
        <div class="character-actions"><button type="button" class="btn${linked ? '' : ' btn-primary'}" data-campaign-action="link" data-id="${escapeHtml(own.id)}"${linked ? ' aria-pressed="true"' : ''}>${linked ? 'Ligada à Mesa do mestre' : 'Usar na Mesa do mestre'}</button></div></div>
        <p class="character-status" id="campaignStatus" role="status">${escapeHtml(message)}</p>
        <section class="character-card campaign-card" aria-labelledby="campaignPlayersTitle"><h3 id="campaignPlayersTitle">Jogadores e pedidos</h3>
          ${list.length ? `<ul class="campaign-members">${list.map(m => `<li class="is-${m.status}">${summaryCard(m.personagem, `<small>Jogador: ${escapeHtml(m.jogador || 'sem nome')} · ${STATUS_LABEL[m.status]}</small>`)}<div class="campaign-actions">
            ${m.status !== 'aprovado' ? `<button type="button" class="btn btn-primary" data-campaign-action="approve" data-id="${escapeHtml(own.id)}" data-user="${escapeHtml(m.userId)}">Autorizar</button>` : ''}
            ${m.status === 'pendente' ? `<button type="button" class="btn" data-campaign-action="refuse" data-id="${escapeHtml(own.id)}" data-user="${escapeHtml(m.userId)}">Recusar</button>` : ''}
            ${m.status !== 'pendente' ? `<button type="button" class="btn btn-danger" data-campaign-action="remove" data-id="${escapeHtml(own.id)}" data-user="${escapeHtml(m.userId)}">Remover</button>` : ''}</div></li>`).join('')}</ul>` : '<p class="character-help">Ninguém pediu para entrar ainda. Passe o código aos jogadores.</p>'}
        </section>
        ${charactersSection(own.id, undefined, 'Personagens do mestre (NPCs e fichas)')}
        <div class="campaign-actions"><button type="button" class="btn btn-danger" data-campaign-action="delete-campaign" data-id="${escapeHtml(own.id)}">Encerrar campanha</button></div>`;
    }
    if (!member) return drawHome();
    return `${back}<div class="character-heading"><div><p class="character-eyebrow">Jogador · ${STATUS_LABEL[member.status]}</p><h2 id="campaignTitle" tabindex="-1">${escapeHtml(member.campanha)}</h2>
        <p>${member.status === 'aprovado' ? 'O mestre autorizou: você já pode entrar na mesa.' : member.status === 'pendente' ? 'O mestre ainda não autorizou. Enquanto isso, prepare o seu personagem. Esta tela atualiza sozinha.' : 'O mestre recusou o pedido. Fale com ele e peça de novo com o código.'}</p></div>
        <div class="character-actions">${member.status === 'aprovado' ? `<button type="button" class="btn btn-primary" data-campaign-action="open-table" data-id="${escapeHtml(member.campanhaId)}">Entrar na mesa</button>` : ''}</div></div>
      <p class="character-status" id="campaignStatus" role="status">${escapeHtml(message)}</p>
      ${charactersSection(member.campanhaId, member, 'Seus personagens nesta campanha')}
      <div class="campaign-actions"><button type="button" class="btn btn-danger" data-campaign-action="leave" data-id="${escapeHtml(member.campanhaId)}">Sair da campanha</button></div>`;
  }
  function draw(): void {
    const body = watching ? drawWatching() : selected ? drawDetail() : drawHome();
    page.innerHTML = `<div class="character-shell campaign-shell">${body}</div>`;
  }
  function focusTitle(): void {
    page.querySelector<HTMLElement>('#campaignTableTitle, #campaignTitle')?.focus({ preventScroll: true });
  }

  async function refresh(): Promise<void> {
    if (!sessionUser()) { memberships = []; mastered = []; members.clear(); loaded = false; if (!page.hidden && !watching) draw(); return; }
    loading = true;
    const mine = await myMemberships();
    if (mine.ok) memberships = mine.data; else say(mine.problem);
    if (canMaster()) {
      const own = await masterCampaigns();
      if (own.ok) {
        mastered = own.data;
        const lists = await Promise.all(mastered.map(c => campaignMembers(c.id)));
        members.clear();
        lists.forEach((list, index) => { if (list.ok) members.set(mastered[index].id, list.data); });
      } else say(own.problem);
    } else { mastered = []; members.clear(); }
    loaded = mine.ok;
    loading = false;
    // A campanha aberta sumiu (saiu, foi removido ou encerrada): volta à lista.
    if (selected && selected !== NO_CAMPAIGN && loaded && !memberships.some(m => m.campanhaId === selected) && !mastered.some(c => c.id === selected)) selected = '';
    if (!page.hidden && !watching) draw();
  }
  async function pollTable(): Promise<void> {
    if (!watching) return;
    const current = watching;
    const stamp = await campaignStamp(current.id);
    if (watching !== current) return;
    if (!stamp.ok) { say(stamp.problem); return; }
    if (stamp.data.atualizado === current.stamp && current.table) return;
    const needBackground = stamp.data.fundo !== current.fundoStamp;
    const table = await campaignTable(current.id, needBackground);
    if (watching !== current) return;
    if (!table.ok) { say(table.problem); return; }
    const fundo = needBackground ? table.data.fundo ?? '' : current.fundo;
    watching = { ...current, nome: stamp.data.nome, stamp: stamp.data.atualizado, fundoStamp: stamp.data.fundo, fundo, table: readPublishedTable(table.data.mesa, fundo) };
    const board = page.querySelector<HTMLElement>('.table-board');
    const pos = board ? [board.scrollLeft, board.scrollTop] : [0, 0];
    draw();
    const fresh = page.querySelector<HTMLElement>('.table-board');
    if (fresh) { fresh.scrollLeft = pos[0]; fresh.scrollTop = pos[1]; }
  }
  /** Enquanto a página está aberta: a mesa a cada 4 s, os pedidos a cada 16 s. */
  function startTimer(): void {
    stopTimer();
    let ticks = 0;
    timer = setInterval(() => {
      if (page.hidden || document.hidden) return;
      ticks++;
      if (watching) void pollTable();
      else if (ticks % 4 === 0) void refresh();
    }, 4000);
  }
  function stopTimer(): void { if (timer !== undefined) clearInterval(timer); timer = undefined; }

  async function sendCharacter(campaignId: string, characterId: string): Promise<void> {
    const pick = localCharacters().find(c => c.id === characterId);
    if (!pick) return;
    const result = await updateMyCharacter(campaignId, summarizeCharacter(pick.data));
    if (!result.ok) { say(result.problem); return; }
    rememberCampaignCharacter(campaignId, characterId);
    say(`“${pick.data.identidade.nome || 'Personagem'}” está na mesa: o mestre já vê o resumo dele.`);
    void refresh();
  }
  /** Pede à ficha que ligue (ou desligue) o personagem à campanha. */
  function linkCharacter(characterId: string, campaignId: string | null): void {
    characterPage()?.dispatchEvent(new CustomEvent('rpg:link-campaign', { detail: { characterId, campanhaId: campaignId, campanhaNome: campaignId ? campaignName(campaignId) : '' } }));
  }

  page.addEventListener('submit', evt => {
    const form = evt.target as HTMLFormElement;
    evt.preventDefault();
    if (form.id === 'campaignJoin') {
      const code = page.querySelector<HTMLInputElement>('#campaignCode')?.value ?? '';
      loading = true; say('Enviando o pedido…');
      const jogador = sessionUser()?.email?.split('@')[0] ?? '';
      void joinCampaign(code, jogador, { nome: '', raca: '', classe: '', arquetipo: '', rank: '', conceito: '', vida: null, avatar: null }).then(result => {
        loading = false;
        if (!result.ok) { say(result.problem); draw(); return; }
        selected = result.data.campanhaId;
        say(result.data.status === 'aprovado' ? `Você já está em “${result.data.campanha}”.` : `Pedido enviado para “${result.data.campanha}”. Prepare seu personagem enquanto o mestre decide.`);
        void refresh().then(focusTitle);
      });
    } else if (form.id === 'campaignCreate') {
      const nome = page.querySelector<HTMLInputElement>('#campaignName')?.value ?? '';
      loading = true;
      void createCampaign(nome).then(result => {
        loading = false;
        if (!result.ok) { say(result.problem); draw(); return; }
        selected = result.data.id;
        say(`Campanha “${result.data.nome}” criada. Passe o código ${result.data.codigo} aos jogadores.`);
        void refresh().then(focusTitle);
      });
    }
  });
  page.addEventListener('click', evt => {
    const button = (evt.target as Element).closest<HTMLButtonElement>('[data-campaign-action]');
    if (!button) return;
    const id = button.dataset.id ?? '', user = button.dataset.user ?? '', characterId = button.dataset.character ?? '';
    const after = (result: { ok: true } | { ok: false; problem: string }, done: string): void => {
      say(result.ok ? done : result.problem);
      void refresh();
    };
    switch (button.dataset.campaignAction) {
      case 'login': document.getElementById('btnAccount')?.click(); break;
      case 'select': selected = id; message = ''; draw(); focusTitle(); break;
      case 'home': selected = ''; message = ''; draw(); focusTitle(); break;
      case 'all-characters': document.querySelector<HTMLButtonElement>('.rpg-navigation [data-rpg-page="personagens"]')?.click(); break;
      case 'create-character':
        characterPage()?.dispatchEvent(new CustomEvent('rpg:create', { detail: id && id !== NO_CAMPAIGN ? { campanhaId: id, campanhaNome: campaignName(id) } : null }));
        break;
      case 'open-character': characterPage()?.dispatchEvent(new CustomEvent('rpg:open-character', { detail: characterId })); break;
      case 'bring': {
        const pick = page.querySelector<HTMLSelectElement>('#campaignBring')?.value;
        if (!pick) return;
        linkCharacter(pick, id);
        say('Personagem trazido para a campanha.');
        draw();
        break;
      }
      case 'unlink':
        linkCharacter(characterId, null);
        say('O personagem saiu desta campanha e ficou em “Personagens sem campanha”.');
        draw();
        break;
      case 'send-character': void sendCharacter(id, characterId); break;
      case 'open-table':
        watching = { id, nome: campaignName(id), stamp: '', fundoStamp: '', fundo: '', table: null };
        message = 'Conectando à mesa…'; draw(); void pollTable(); focusTitle();
        break;
      case 'close-table': watching = null; message = ''; draw(); void refresh(); break;
      case 'leave':
        if (!confirm('Sair desta campanha? Seus personagens ficam neste aparelho, sem campanha. Para voltar, será preciso pedir de novo ao mestre.')) return;
        void leaveCampaign(id).then(result => {
          if (result.ok) localCharacters().filter(c => c.data.campanhaId === id).forEach(c => linkCharacter(c.id, null));
          after(result, 'Você saiu da campanha.');
        });
        break;
      case 'copy-code':
        void navigator.clipboard?.writeText(button.dataset.code ?? '').then(() => say('Código copiado.'), () => say(`Código: ${button.dataset.code}`));
        break;
      case 'link':
        try { localStorage.setItem(LINKED_CAMPAIGN_KEY, id); } catch { /* sem armazenamento */ }
        window.dispatchEvent(new Event('existus:campanha-mesa'));
        say('A Mesa do mestre agora publica a cena mostrada para os jogadores autorizados desta campanha.');
        draw();
        break;
      case 'delete-campaign':
        if (!confirm('Encerrar esta campanha? Os jogadores perdem o acesso à mesa.')) return;
        if (localStorageGet(LINKED_CAMPAIGN_KEY) === id) { try { localStorage.removeItem(LINKED_CAMPAIGN_KEY); } catch { /* sem armazenamento */ } }
        void deleteCampaign(id).then(result => {
          if (result.ok) { selected = ''; localCharacters().filter(c => c.data.campanhaId === id).forEach(c => linkCharacter(c.id, null)); }
          after(result, 'Campanha encerrada.');
        });
        break;
      case 'approve': void answerRequest(id, user, true).then(result => after(result, 'Jogador autorizado: ele já pode entrar na mesa.')); break;
      case 'refuse': void answerRequest(id, user, false).then(result => after(result, 'Pedido recusado.')); break;
      case 'remove':
        if (!confirm('Remover este jogador da campanha?')) return;
        void removeMember(id, user).then(result => after(result, 'Jogador removido.'));
        break;
    }
  });
  page.addEventListener('campanhas:open', evt => {
    const detail = (evt as CustomEvent<{ campanhaId?: unknown } | null>).detail;
    if (detail && typeof detail.campanhaId === 'string') { selected = detail.campanhaId; watching = null; }
    draw(); startTimer(); void refresh();
    focusTitle();
  });
  page.addEventListener('campanhas:close', () => { stopTimer(); watching = null; });
  window.addEventListener('existus:sessao', () => { void refresh(); });
  // Personagem criado dentro de uma campanha: se o jogador ainda não tem ninguém na mesa, ele vai.
  window.addEventListener('existus:personagem-criado', evt => {
    const detail = (evt as CustomEvent<{ characterId?: unknown; campanhaId?: unknown }>).detail;
    if (!detail || typeof detail.characterId !== 'string' || typeof detail.campanhaId !== 'string') return;
    if (memberships.some(m => m.campanhaId === detail.campanhaId) && !campaignCharacters()[detail.campanhaId]) void sendCharacter(detail.campanhaId, detail.characterId);
  });
}
