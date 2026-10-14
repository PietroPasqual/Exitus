import type { SupabaseClient, User } from '@supabase/supabase-js';
import { escapeHtml } from '../core/format';
import { normalizeProject } from '../core/project';
import { byId, setHint } from '../ui/dom';
import { applyProject, getProjectData } from '../ui/editor';
import { store } from '../ui/store';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

// Contas (e-mail e senha) e "Meus Círculos" no Supabase.
// A biblioteca é carregada só quando precisa, sem atrasar o editor.

interface SavedItem {
  id: string;
  nome: string;
  atualizado_em: string;
}

type AuthMode = 'entrar' | 'criar';

const cloud = {
  client: null as SupabaseClient | null,
  user: null as User | null,
  list: [] as SavedItem[],
  authMode: 'entrar' as AuthMode,
  loading: false,
  failed: false
};

function setMsg(id: string, text: string, kind: '' | 'erro' | 'ok' = ''): void {
  const el = byId(id);
  el.textContent = text;
  el.className = 'account-msg' + (kind ? ' ' + kind : '');
}

function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? '');
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Esse e-mail já tem conta. Use a aba Entrar.';
  if (m.includes('email not confirmed')) return 'Confirme o seu e-mail (veja a caixa de entrada) antes de entrar.';
  if (m.includes('password') && m.includes('6')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
  if (m.includes('not authorized') || m.includes('sending') || m.includes('confirmation email')) return 'Não deu para enviar o e-mail de confirmação. O dono do site precisa desligar a confirmação de e-mail no Supabase.';
  if (m.includes('fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique a internet.';
  return 'Não deu certo: ' + (raw || 'erro desconhecido') + '.';
}

/** Carrega a biblioteca e liga a sessão (quem já entrou volta conectado) */
export async function loadCloud(): Promise<void> {
  if (cloud.client || cloud.loading || cloud.failed) return;
  cloud.loading = true;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    cloud.client = createClient(SUPABASE_URL, SUPABASE_KEY);
    // Dispara logo de cara (INITIAL_SESSION)
    cloud.client.auth.onAuthStateChange((_event, session) => {
      const user = session ? session.user : null;
      const changed = (user ? user.id : null) !== (cloud.user ? cloud.user.id : null);
      cloud.user = user;
      if (changed) {
        cloud.list = [];
        store.savedCircle = null;
        // Chamadas ao Supabase fora do callback (recomendação da biblioteca)
        if (user) setTimeout(loadSavedList, 0);
      }
      renderAccount();
    });
  } catch {
    cloud.failed = true;
  } finally {
    cloud.loading = false;
    renderAccount();
  }
}

/** Nome sugerido: o círculo salvo aberto, ou o nome da magia de exemplo */
const defaultSaveName = (): string => store.savedCircle?.nome ?? store.state.spellInfo?.name ?? '';

export function openAccount(): void {
  byId('accountModal').classList.add('open');
  void loadCloud();
  byId<HTMLInputElement>('saveName').value = defaultSaveName();
  if (cloud.user) void loadSavedList();
  renderAccount();
}

export const closeAccount = (): void => byId('accountModal').classList.remove('open');

export function setAuthMode(mode: AuthMode): void {
  cloud.authMode = mode;
  document.querySelectorAll<HTMLElement>('#authForm [data-action="auth-mode"]').forEach(b => b.classList.toggle('active', b.dataset.arg === mode));
  byId('authSubmit').textContent = mode === 'criar' ? 'Criar conta' : 'Entrar';
  byId<HTMLInputElement>('authPassword').autocomplete = mode === 'criar' ? 'new-password' : 'current-password';
  setMsg('authMsg', '');
}

function renderAccount(): void {
  const logged = !!cloud.user;
  byId('accountLabel').textContent = logged ? 'Conta' : 'Entrar';
  byId('btnAccount').classList.toggle('active', logged);
  byId('accountUnavailable').hidden = !cloud.failed;
  byId('authForm').hidden = cloud.failed || !cloud.client || logged;
  byId('accountPanel').hidden = !logged;
  if (!cloud.user) return;

  byId('accountEmail').textContent = cloud.user.email || '';
  const nameInput = byId<HTMLInputElement>('saveName');
  if (!nameInput.value) nameInput.value = defaultSaveName();
  const current = store.savedCircle;
  byId('btnSaveUpdate').hidden = !current;
  byId('currentSavedName').textContent = current ? current.nome : '';

  const listEl = byId('savedList');
  if (!cloud.list.length) {
    listEl.innerHTML = '<div class="account-note">Você ainda não salvou nenhum círculo.</div>';
    return;
  }
  listEl.innerHTML = cloud.list.map(c => `
        <div class="saved-item ${current && current.id === c.id ? 'current' : ''}">
          <div>
            <strong>${escapeHtml(c.nome)}</strong>
            <small>${new Date(c.atualizado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small>
          </div>
          <div class="btns">
            <button class="btn" data-action="open-saved" data-arg="${escapeHtml(c.id)}">Abrir ▸</button>
            <button class="btn btn-danger" data-action="delete-saved" data-arg="${escapeHtml(c.id)}" title="Excluir">✕</button>
          </div>
        </div>`).join('');
}

async function submitAuth(evt: SubmitEvent): Promise<void> {
  evt.preventDefault();
  const client = cloud.client;
  if (!client) return;
  const email = byId<HTMLInputElement>('authEmail').value.trim();
  const password = byId<HTMLInputElement>('authPassword').value;
  const btn = byId<HTMLButtonElement>('authSubmit');
  btn.disabled = true;
  setMsg('authMsg', cloud.authMode === 'criar' ? 'Criando conta…' : 'Entrando…');
  try {
    if (cloud.authMode === 'criar') {
      const { data, error } = await client.auth.signUp({
        email, password, options: { emailRedirectTo: location.origin + location.pathname }
      });
      if (error) throw error;
      if (!data.session) {
        setAuthMode('entrar');
        setMsg('authMsg', 'Conta criada! Abra o e-mail de confirmação que enviamos e depois entre aqui.', 'ok');
        return;
      }
    } else {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    byId<HTMLInputElement>('authPassword').value = '';
    setMsg('authMsg', '');
  } catch (err) {
    setMsg('authMsg', friendlyAuthError(err), 'erro');
  } finally {
    btn.disabled = false;
  }
}

export async function signOut(): Promise<void> {
  await cloud.client?.auth.signOut();
}

async function loadSavedList(): Promise<void> {
  if (!cloud.client || !cloud.user) return;
  const { data, error } = await cloud.client
    .from('circulos')
    .select('id, nome, atualizado_em')
    .order('atualizado_em', { ascending: false });
  if (error) {
    setMsg('saveMsg', 'Não deu para carregar seus círculos: ' + error.message, 'erro');
    return;
  }
  cloud.list = (data as SavedItem[] | null) || [];
  if (store.savedCircle && !cloud.list.some(c => c.id === store.savedCircle?.id)) store.savedCircle = null;
  renderAccount();
}

export async function saveCircle(update: boolean): Promise<void> {
  const client = cloud.client;
  if (!client || !cloud.user) return;
  const nome = byId<HTMLInputElement>('saveName').value.trim() || store.savedCircle?.nome || '';
  if (!nome) {
    setMsg('saveMsg', 'Dê um nome ao círculo.', 'erro');
    byId('saveName').focus();
    return;
  }
  const projeto = getProjectData();
  setMsg('saveMsg', 'Salvando…');
  const current = store.savedCircle;
  const query = update && current
    ? client.from('circulos').update({ nome, projeto }).eq('id', current.id).select('id, nome, atualizado_em').single()
    : client.from('circulos').insert({ nome, projeto }).select('id, nome, atualizado_em').single();
  const { data, error } = await query;
  if (error || !data) {
    setMsg('saveMsg', 'Não deu para salvar: ' + (error?.message ?? 'sem resposta'), 'erro');
    return;
  }
  const saved = data as SavedItem;
  store.savedCircle = { id: saved.id, nome: saved.nome };
  setMsg('saveMsg', update ? `“${saved.nome}” atualizado.` : `“${saved.nome}” salvo na sua conta.`, 'ok');
  await loadSavedList();
}

export async function openSaved(id: string): Promise<void> {
  if (!cloud.client) return;
  setMsg('saveMsg', 'Abrindo…');
  const { data, error } = await cloud.client.from('circulos').select('id, nome, projeto').eq('id', id).single();
  const project = data ? normalizeProject((data as { projeto: unknown }).projeto) : null;
  if (error || !data || !project) {
    setMsg('saveMsg', 'Não deu para abrir esse círculo.', 'erro');
    return;
  }
  const row = data as { id: string; nome: string };
  applyProject(project);
  store.savedCircle = { id: row.id, nome: row.nome };
  byId<HTMLInputElement>('saveName').value = row.nome;
  setMsg('saveMsg', '');
  renderAccount();
  closeAccount();
  setHint(`Aberto: ${row.nome}`);
}

export async function deleteSaved(id: string): Promise<void> {
  if (!cloud.client) return;
  const item = cloud.list.find(c => c.id === id);
  if (!confirm(`Excluir “${item ? item.nome : 'este círculo'}” da sua conta? Não dá para desfazer.`)) return;
  const { error } = await cloud.client.from('circulos').delete().eq('id', id);
  if (error) {
    setMsg('saveMsg', 'Não deu para excluir: ' + error.message, 'erro');
    return;
  }
  if (store.savedCircle?.id === id) store.savedCircle = null;
  setMsg('saveMsg', 'Círculo excluído.', 'ok');
  await loadSavedList();
}

export function setupAccount(): void {
  byId<HTMLFormElement>('authForm').addEventListener('submit', evt => { void submitAuth(evt); });
  // Carrega o serviço sem atrasar o editor (quem já entrou volta conectado)
  const later = (fn: () => void): void => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(fn);
    else setTimeout(fn, 300);
  };
  later(() => { void loadCloud(); });
}
