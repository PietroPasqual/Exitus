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

/** Qual ficha deste aparelho foi levada a cada campanha (para mandar a versão nova). */
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

/** Fichas guardadas neste navegador (id e ficha validada). */
export function localCharacters(): { id: string; data: Character }[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CHARACTER_LIBRARY_KEY) ?? 'null') as { characters?: unknown } | null;
    if (!raw || !Array.isArray(raw.characters)) return [];
    return raw.characters.flatMap(entry => {
      const record = entry as { id?: unknown; data?: unknown } | null;
      const data = record && typeof record.id === 'string' ? normalizeCharacter(record.data) : null;
      return data ? [{ id: record!.id as string, data }] : [];
    });
  } catch { return []; }
}

export function summaryCard(summary: CharacterSummary, extra = ''): string {
  const details = [summary.raca, summary.classe, summary.rank && `Rank ${summary.rank}`].filter(Boolean).join(' · ');
  return `<div class="campaign-character">${renderAvatar(summary.avatar ?? undefined, summary.classe, 48, summary.nome)}<div><strong>${escapeHtml(summary.nome)}</strong>${details ? `<small>${escapeHtml(details)}</small>` : ''}${summary.vida ? `<small>Vida ${summary.vida.atual}/${summary.vida.maximo}</small>` : ''}${extra}</div></div>`;
}

/** Página Campanhas: abre quando a navegação dispara `campanhas:open` em #campaignPage. */
export function setupCampaigns(): void {
  const root = document.getElementById('campaignPage');
  if (!root) return;
  const page = root;
  let memberships: Membership[] = [];
  let mastered: MasterCampaign[] = [];
  const members = new Map<string, CampaignMember[]>();
  let message = '';
  let loading = false;
  let watching: { id: string; nome: string; stamp: string; fundoStamp: string; fundo: string; table: PublishedTable | null } | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  const characterOptions = (): string => {
    const list = localCharacters();
    return list.length
      ? list.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.data.identidade.nome.trim() || 'Personagem sem nome')}</option>`).join('')
      : '';
  };
  function say(text: string): void {
    message = text;
    const el = page.querySelector('#campaignStatus');
    if (el) el.textContent = text;
  }

  function drawWatching(): string {
    if (!watching) return '';
    const view = watching.table;
    return `<section class="campaign-table" aria-labelledby="campaignTableTitle"><div class="campaign-table-heading"><div><p class="character-eyebrow">Mesa da campanha</p><h2 id="campaignTableTitle" tabindex="-1">${escapeHtml(view?.scene?.nome ?? watching.nome)}</h2></div><button type="button" class="btn" data-campaign-action="close-table">← Campanhas</button></div>
      ${view?.scene ? `<div class="campaign-table-layout"><div class="table-board">${renderBoard(view.scene, { mode: 'jogadores', zoom: Math.max(18, Math.min(48, Math.floor((page.clientWidth || 360) / view.scene.colunas))) })}</div>
        <aside class="campaign-rolls"><h3>Rolagens do mestre</h3>${view.rolagens.length ? `<ol class="table-roll-log">${view.rolagens.slice(-12).reverse().map(r => `<li><div><strong>${escapeHtml(r.quem)}</strong> rolou <code>${escapeHtml(r.expressao)}</code></div><span class="table-roll-total">${r.total}</span><small>${escapeHtml(r.detalhe)}</small></li>`).join('')}</ol>` : '<p class="table-empty">Nenhuma rolagem ainda.</p>'}</aside></div>`
        : '<div class="character-empty">O mestre ainda não mostrou nenhuma cena. Esta tela atualiza sozinha.</div>'}
      <p class="table-status" id="campaignStatus" role="status">${escapeHtml(message)}</p></section>`;
  }
  function draw(): void {
    const user = sessionUser();
    const phone = isPhone(), master = canMaster();
    if (watching) { page.innerHTML = `<div class="character-shell campaign-shell">${drawWatching()}</div>`; return; }
    const options = characterOptions();
    page.innerHTML = `<div class="character-shell campaign-shell">
      <div class="character-heading"><div><p class="character-eyebrow">${master ? 'Modo mestre' : 'Modo jogador'}</p><h2 id="campaignTitle" tabindex="-1">Campanhas</h2>
        <p>${master ? 'Crie a campanha, passe o código aos jogadores e autorize quem pode entrar na mesa.' : 'Peça para entrar na campanha com o código do mestre. Você participa da mesa depois que o mestre autorizar.'}</p></div></div>
      ${phone ? '<div class="character-notice"><strong>No celular você joga como jogador.</strong> Para mestrar (mapa, tokens e autorizações), abra o site no computador e ligue o modo mestre.</div>' : ''}
      <p class="character-status" id="campaignStatus" role="status">${escapeHtml(message)}</p>
      ${!user ? `<section class="character-card campaign-card"><h3>Entre na sua conta</h3><p class="character-help">As campanhas online ligam a sua conta à do mestre. As fichas continuam neste aparelho; só o resumo do personagem (nome, raça, classe, vida e avatar) vai para a campanha.</p><button type="button" class="btn btn-primary" data-campaign-action="login">Entrar ou criar conta</button></section>` : `
      <section class="character-card campaign-card" aria-labelledby="campaignJoinTitle"><h3 id="campaignJoinTitle">Participar de uma campanha</h3>
        ${options ? `<form class="campaign-join" id="campaignJoin"><label class="character-field"><span>Código da campanha</span><input id="campaignCode" maxlength="16" autocomplete="off" autocapitalize="characters" placeholder="Ex.: 7F3A9C21" required></label>
          <label class="character-field"><span>Personagem</span><select id="campaignCharacter">${options}</select></label>
          <button type="submit" class="btn btn-primary"${loading ? ' disabled' : ''}>Pedir para entrar</button></form>
          <p class="character-help">O mestre recebe seu pedido com o resumo do personagem e decide se autoriza.</p>`
        : `<p class="character-help">Primeiro crie seu personagem; depois volte aqui para entrar na campanha.</p><button type="button" class="btn btn-primary" data-campaign-action="create-character">Criar personagem</button>`}
      </section>
      <section class="character-card campaign-card" aria-labelledby="campaignMineTitle"><div class="character-section-heading"><h3 id="campaignMineTitle">Minhas campanhas</h3><button type="button" class="btn btn-small" data-campaign-action="refresh">Atualizar</button></div>
        ${memberships.length ? `<ul class="campaign-list">${memberships.map(m => `<li class="campaign-item is-${m.status}"><div class="campaign-item-head"><strong>${escapeHtml(m.campanha)}</strong><span class="campaign-badge">${STATUS_LABEL[m.status]}</span></div>
          ${summaryCard(m.personagem)}
          <div class="campaign-actions">${m.status === 'aprovado' ? `<button type="button" class="btn btn-primary" data-campaign-action="open-table" data-id="${escapeHtml(m.campanhaId)}">Entrar na mesa</button>` : ''}
          ${options ? `<button type="button" class="btn" data-campaign-action="update-character" data-id="${escapeHtml(m.campanhaId)}">Mandar personagem atualizado</button>` : ''}
          <button type="button" class="btn btn-danger" data-campaign-action="leave" data-id="${escapeHtml(m.campanhaId)}">Sair</button></div>
          ${m.status === 'pendente' ? '<p class="character-help">O mestre ainda não autorizou. Esta lista atualiza sozinha.</p>' : m.status === 'recusado' ? '<p class="character-help">O mestre recusou o pedido. Fale com ele e peça de novo com o código.</p>' : ''}</li>`).join('')}</ul>`
          : `<p class="character-help">${loading ? 'Carregando…' : 'Você ainda não participa de nenhuma campanha.'}</p>`}
      </section>
      ${master ? `<section class="character-card campaign-card" aria-labelledby="campaignMasterTitle"><h3 id="campaignMasterTitle">Campanhas que você mestra</h3>
        <form class="campaign-join" id="campaignCreate"><label class="character-field"><span>Nome da nova campanha</span><input id="campaignName" maxlength="60" placeholder="Ex.: As Ruínas de Pagma" required></label><button type="submit" class="btn btn-primary"${loading ? ' disabled' : ''}>Criar campanha</button></form>
        ${mastered.length ? `<ul class="campaign-list">${mastered.map(c => {
          const list = members.get(c.id) ?? [];
          const pending = list.filter(m => m.status === 'pendente').length;
          const linked = localStorageGet(LINKED_CAMPAIGN_KEY) === c.id;
          return `<li class="campaign-item"><div class="campaign-item-head"><strong>${escapeHtml(c.nome)}</strong>${pending ? `<span class="campaign-badge is-alert">${pending} ${pending === 1 ? 'pedido' : 'pedidos'}</span>` : ''}</div>
            <p class="campaign-code">Código: <code>${escapeHtml(c.codigo)}</code> <button type="button" class="btn btn-small" data-campaign-action="copy-code" data-code="${escapeHtml(c.codigo)}">Copiar</button></p>
            <div class="campaign-actions"><button type="button" class="btn${linked ? '' : ' btn-primary'}" data-campaign-action="link" data-id="${escapeHtml(c.id)}"${linked ? ' aria-pressed="true"' : ''}>${linked ? 'Ligada à Mesa do mestre' : 'Usar na Mesa do mestre'}</button><button type="button" class="btn btn-danger" data-campaign-action="delete-campaign" data-id="${escapeHtml(c.id)}">Encerrar campanha</button></div>
            ${list.length ? `<ul class="campaign-members">${list.map(m => `<li class="is-${m.status}">${summaryCard(m.personagem, `<small>Jogador: ${escapeHtml(m.jogador || 'sem nome')} · ${STATUS_LABEL[m.status]}</small>`)}<div class="campaign-actions">
              ${m.status !== 'aprovado' ? `<button type="button" class="btn btn-primary" data-campaign-action="approve" data-id="${escapeHtml(c.id)}" data-user="${escapeHtml(m.userId)}">Autorizar</button>` : ''}
              ${m.status === 'pendente' ? `<button type="button" class="btn" data-campaign-action="refuse" data-id="${escapeHtml(c.id)}" data-user="${escapeHtml(m.userId)}">Recusar</button>` : ''}
              ${m.status !== 'pendente' ? `<button type="button" class="btn btn-danger" data-campaign-action="remove" data-id="${escapeHtml(c.id)}" data-user="${escapeHtml(m.userId)}">Remover</button>` : ''}</div></li>`).join('')}</ul>` : '<p class="character-help">Ninguém pediu para entrar ainda. Passe o código aos jogadores.</p>'}</li>`;
        }).join('')}</ul>` : ''}
      </section>` : ''}`}
    </div>`;
  }
  function localStorageGet(key: string): string {
    try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
  }

  async function refresh(): Promise<void> {
    if (!sessionUser()) { memberships = []; mastered = []; members.clear(); draw(); return; }
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
    }
    loading = false;
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
  /** Enquanto a página está aberta: a mesa a cada 4 s, os pedidos a cada 15 s. */
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

  const selectedCharacter = (): { id: string; data: Character } | undefined => {
    const id = page.querySelector<HTMLSelectElement>('#campaignCharacter')?.value;
    const list = localCharacters();
    return list.find(c => c.id === id) ?? list[0];
  };

  page.addEventListener('submit', evt => {
    const form = evt.target as HTMLFormElement;
    evt.preventDefault();
    if (form.id === 'campaignJoin') {
      const code = page.querySelector<HTMLInputElement>('#campaignCode')?.value ?? '';
      const chosen = selectedCharacter();
      if (!chosen) { say('Crie um personagem antes de entrar numa campanha.'); return; }
      loading = true; say('Enviando o pedido…');
      void joinCampaign(code, chosen.data.identidade.jogador || sessionUser()?.email?.split('@')[0] || '', summarizeCharacter(chosen.data)).then(result => {
        loading = false;
        if (!result.ok) { say(result.problem); draw(); return; }
        rememberCampaignCharacter(result.data.campanhaId, chosen.id);
        say(result.data.status === 'aprovado' ? `Personagem atualizado em “${result.data.campanha}”.` : `Pedido enviado para “${result.data.campanha}”. Aguarde o mestre autorizar.`);
        void refresh();
      });
    } else if (form.id === 'campaignCreate') {
      const nome = page.querySelector<HTMLInputElement>('#campaignName')?.value ?? '';
      loading = true;
      void createCampaign(nome).then(result => {
        loading = false;
        if (!result.ok) { say(result.problem); draw(); return; }
        say(`Campanha “${result.data.nome}” criada. Passe o código ${result.data.codigo} aos jogadores.`);
        void refresh();
      });
    }
  });
  page.addEventListener('click', evt => {
    const button = (evt.target as Element).closest<HTMLButtonElement>('[data-campaign-action]');
    if (!button) return;
    const id = button.dataset.id ?? '', user = button.dataset.user ?? '';
    const after = (result: { ok: true } | { ok: false; problem: string }, done: string): void => {
      say(result.ok ? done : result.problem);
      void refresh();
    };
    switch (button.dataset.campaignAction) {
      case 'login': document.getElementById('btnAccount')?.click(); break;
      case 'create-character': document.getElementById('characterPage')?.dispatchEvent(new Event('rpg:create')); break;
      case 'refresh': say('Atualizando…'); void refresh().then(() => say('Lista atualizada.')); break;
      case 'open-table': {
        const m = memberships.find(item => item.campanhaId === id);
        watching = { id, nome: m?.campanha ?? 'Campanha', stamp: '', fundoStamp: '', fundo: '', table: null };
        message = 'Conectando à mesa…'; draw(); void pollTable();
        page.querySelector<HTMLElement>('#campaignTableTitle')?.focus({ preventScroll: true });
        break;
      }
      case 'close-table': watching = null; message = ''; draw(); void refresh(); break;
      case 'update-character': {
        const linkedId = campaignCharacters()[id];
        const pick = localCharacters().find(c => c.id === linkedId) ?? selectedCharacter();
        if (!pick) return;
        rememberCampaignCharacter(id, pick.id);
        void updateMyCharacter(id, summarizeCharacter(pick.data)).then(result => after(result, `Personagem “${pick.data.identidade.nome || 'sem nome'}” atualizado na campanha.`));
        break;
      }
      case 'leave':
        if (!confirm('Sair desta campanha? Para voltar, será preciso pedir de novo ao mestre.')) return;
        void leaveCampaign(id).then(result => after(result, 'Você saiu da campanha.'));
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
        void deleteCampaign(id).then(result => after(result, 'Campanha encerrada.'));
        break;
      case 'approve': void answerRequest(id, user, true).then(result => after(result, 'Jogador autorizado: ele já pode entrar na mesa.')); break;
      case 'refuse': void answerRequest(id, user, false).then(result => after(result, 'Pedido recusado.')); break;
      case 'remove':
        if (!confirm('Remover este jogador da campanha?')) return;
        void removeMember(id, user).then(result => after(result, 'Jogador removido.'));
        break;
    }
  });
  page.addEventListener('campanhas:open', () => {
    draw(); startTimer(); void refresh();
    page.querySelector<HTMLElement>('#campaignTitle')?.focus({ preventScroll: true });
  });
  page.addEventListener('campanhas:close', () => { stopTimer(); watching = null; });
  window.addEventListener('existus:sessao', () => { if (!page.hidden) void refresh(); });
}
