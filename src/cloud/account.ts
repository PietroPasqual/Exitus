import type { SupabaseClient, User } from '@supabase/supabase-js';
import { escapeHtml } from '../core/format';
import { copyName, normalizeProject } from '../core/project';
import { circleContext } from '../core/editor-context';
import { byId, setHint } from '../ui/dom';
import { applyProject, getProjectData } from '../ui/editor';
import { render, store } from '../ui/store';
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
  failed: false,
  initialized: false,
  guest: false,
  revision: 0,
  /** A conta pode mudar as Regras do Sistema */
  admin: false
};

/** Cliente do Supabase já conectado (para o editor de regras) */
export const cloudClient = (): SupabaseClient | null => cloud.client;
export const isAdmin = (): boolean => cloud.admin;

function clearAuthSecrets(): void {
  byId<HTMLInputElement>('authPassword').value = '';
  byId<HTMLInputElement>('authPassword').type = 'password';
  byId<HTMLInputElement>('authConfirmPassword').value = '';
  const toggle = byId('toggleAuthPassword');
  toggle.textContent = 'Mostrar';
  toggle.setAttribute('aria-label', 'Mostrar senha');
  toggle.setAttribute('aria-pressed', 'false');
}

function showGateway(): void {
  clearAuthSecrets();
  byId('entryGate').hidden = false;
  byId('appShell').hidden = true;
  closeAccount();
}

function showApplication(): void {
  const entering = byId('appShell').hidden;
  clearAuthSecrets();
  byId('entryGate').hidden = true;
  byId('appShell').hidden = false;
  if (entering) {
    // Reenquadra ao sair da tela de acesso; não interrompe o editor num refresh do token.
    window.dispatchEvent(new Event('resize'));
    byId('characterPage').dispatchEvent(new Event('rpg:enter'));
    render();
    byId('btnCharacterLink').focus();
  }
}

async function checkAdmin(): Promise<void> {
  const client = cloud.client, user = cloud.user, revision = cloud.revision;
  let admin = false;
  try {
    if (client && user) {
      const { data, error } = await client.rpc('e_admin');
      admin = !error && data === true;
    }
  } catch { /* Permissões indisponíveis: falha fechada. */ }
  if (cloud.revision !== revision || cloud.user?.id !== user?.id) return;
  cloud.admin = admin;
  document.body.classList.toggle('is-admin', cloud.admin);
  renderAccount();
}

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
  if (m.includes('password') && (m.includes('weak') || m.includes('least'))) return 'Escolha uma senha mais forte, com pelo menos 8 caracteres.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
  if (m.includes('not authorized') || m.includes('sending') || m.includes('confirmation email')) return 'Não deu para enviar o e-mail de confirmação. Tente novamente mais tarde ou avise o responsável pelo site.';
  if (m.includes('fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique a internet.';
  return 'Não foi possível entrar agora. Confira os dados e tente novamente.';
}

/** Uma assinatura por cliente; a sessão inicial decide a tela de entrada. */
let subscription: { unsubscribe: () => void } | null = null;
let connectionAttempt = 0;
let sessionTimer: ReturnType<typeof setTimeout> | undefined;

export async function loadCloud(): Promise<void> {
  if (cloud.client || cloud.loading || cloud.failed) return;
  const attempt = ++connectionAttempt;
  cloud.loading = true;
  renderAccount();
  try {
    const { createClient } = await import('@supabase/supabase-js');
    if (attempt !== connectionAttempt) return;
    cloud.client = createClient(SUPABASE_URL, SUPABASE_KEY);
    sessionTimer = setTimeout(() => {
      if (attempt !== connectionAttempt || cloud.initialized) return;
      cloud.failed = true;
      renderAccount();
    }, 12000);
    const { data } = cloud.client.auth.onAuthStateChange((event, session) => {
      if (attempt !== connectionAttempt) return;
      clearTimeout(sessionTimer);
      cloud.initialized = true;
      cloud.failed = false;
      const user = session?.user ?? null;
      const changed = (user?.id ?? null) !== (cloud.user?.id ?? null);
      cloud.user = user;
      if (changed || event === 'SIGNED_OUT') {
        cloud.revision++;
        cloud.admin = false;
        document.body.classList.remove('is-admin');
        cloud.list = [];
        store.savedCircle = null;
        // A biblioteca recomenda não fazer chamadas assíncronas no callback.
        if (user) {
          setTimeout(() => { void loadSavedList(); }, 0);
          setTimeout(() => { void checkAdmin(); }, 0);
        }
      }
      if (user) { cloud.guest = false; showApplication(); }
      else if (event === 'SIGNED_OUT') { cloud.guest = false; showGateway(); }
      else if (!cloud.guest) showGateway();
      renderAccount();
    });
    subscription = data.subscription;
  } catch {
    if (attempt === connectionAttempt) cloud.failed = true;
  } finally {
    if (attempt === connectionAttempt) { cloud.loading = false; renderAccount(); }
  }
}

function retryCloud(): void {
  if (cloud.loading) return;
  connectionAttempt++;
  clearTimeout(sessionTimer);
  subscription?.unsubscribe();
  subscription = null;
  cloud.client = null;
  cloud.failed = false;
  cloud.initialized = false;
  void loadCloud();
}

/** Nome sugerido: o círculo salvo aberto, ou o nome da magia de exemplo */
const defaultSaveName = (): string => store.savedCircle?.nome ?? store.state.spellInfo?.name ?? '';

export function openAccount(): void {
  if (!cloud.user) {
    cloud.guest = false;
    showGateway();
    void loadCloud();
    renderAccount();
    if (cloud.initialized && !cloud.failed) byId('authEmail').focus();
    return;
  }
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
  const password = byId<HTMLInputElement>('authPassword');
  password.autocomplete = mode === 'criar' ? 'new-password' : 'current-password';
  password.minLength = mode === 'criar' ? 8 : 1;
  byId('authPasswordLabel').textContent = mode === 'criar' ? 'Senha (mínimo 8 caracteres)' : 'Senha';
  byId('authConfirmGroup').hidden = mode !== 'criar';
  byId<HTMLInputElement>('authConfirmPassword').required = mode === 'criar';
  document.querySelectorAll<HTMLElement>('#authForm [data-action="auth-mode"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.arg === mode)));
  setMsg('authMsg', '');
}

function renderAccount(): void {
  const logged = !!cloud.user;
  byId('accountLabel').textContent = logged ? 'Conta' : 'Entrar';
  byId('btnAccount').classList.toggle('active', logged);
  byId('accountUnavailable').hidden = !cloud.failed;
  byId('authLoading').hidden = cloud.initialized || cloud.failed;
  byId('retryAuth').hidden = !cloud.failed;
  byId('authForm').hidden = cloud.failed || !cloud.client || !cloud.initialized || logged;
  byId('accountPanel').hidden = !logged;
  if (!cloud.user) return;

  const editingCircle = document.querySelector<HTMLElement>('.workspace')?.hidden === false;
  for (const id of ['accountCircleTools', 'accountSavedCircles']) {
    const el = document.getElementById(id);
    if (el) el.hidden = !editingCircle;
  }
  const circleNote = document.getElementById('accountCircleNote');
  if (circleNote) circleNote.hidden = editingCircle;
  byId('accountEmail').textContent = cloud.user.email || '';
  byId('adminCard').hidden = !cloud.admin;
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
            <button class="btn" data-action="duplicate-saved" data-arg="${escapeHtml(c.id)}" title="Duplicar: cria uma cópia para testar variações">⧉</button>
            <button class="btn btn-danger" data-action="delete-saved" data-arg="${escapeHtml(c.id)}" title="Excluir">✕</button>
          </div>
        </div>`).join('');
}

async function submitAuth(evt: SubmitEvent): Promise<void> {
  evt.preventDefault();
  const client = cloud.client;
  if (!client || cloud.failed || !cloud.initialized) return;
  const email = byId<HTMLInputElement>('authEmail').value.trim();
  const password = byId<HTMLInputElement>('authPassword').value;
  const btn = byId<HTMLButtonElement>('authSubmit');
  if (btn.disabled) return;
  const mode = cloud.authMode;
  if (mode === 'criar' && (password.length < 8 || password !== byId<HTMLInputElement>('authConfirmPassword').value)) {
    setMsg('authMsg', password.length < 8 ? 'Use pelo menos 8 caracteres na senha.' : 'As senhas não coincidem.', 'erro');
    return;
  }
  btn.disabled = true;
  document.querySelectorAll<HTMLButtonElement>('#authForm [data-action="auth-mode"]').forEach(b => { b.disabled = true; });
  setMsg('authMsg', cloud.authMode === 'criar' ? 'Criando conta…' : 'Entrando…');
  try {
    if (mode === 'criar') {
      const { data, error } = await client.auth.signUp({
        email, password, options: { emailRedirectTo: location.origin + location.pathname }
      });
      if (error) throw error;
      if (!data.session) {
        clearAuthSecrets();
        setAuthMode('entrar');
        setMsg('authMsg', 'Conta criada! Abra o e-mail de confirmação que enviamos e depois entre aqui.', 'ok');
        return;
      }
    } else {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    clearAuthSecrets();
    setMsg('authMsg', '');
  } catch (err) {
    setMsg('authMsg', friendlyAuthError(err), 'erro');
  } finally {
    btn.disabled = false;
    document.querySelectorAll<HTMLButtonElement>('#authForm [data-action="auth-mode"]').forEach(b => { b.disabled = false; });
  }
}

export async function signOut(): Promise<void> {
  try {
    const result = await cloud.client?.auth.signOut();
    if (result?.error) setMsg('saveMsg', 'Não foi possível sair agora. Tente novamente.', 'erro');
  } catch { setMsg('saveMsg', 'Não foi possível sair. Verifique a conexão.', 'erro'); }
}

async function loadSavedList(): Promise<void> {
  const client = cloud.client, user = cloud.user, revision = cloud.revision;
  if (!client || !user) return;
  try {
    const { data, error } = await client.from('circulos')
      .select('id, nome, atualizado_em').order('atualizado_em', { ascending: false });
    if (cloud.revision !== revision || cloud.user?.id !== user.id) return;
    if (error) { setMsg('saveMsg', 'Não deu para carregar seus círculos. Tente novamente.', 'erro'); return; }
    cloud.list = (data as SavedItem[] | null) || [];
    if (store.savedCircle && !cloud.list.some(c => c.id === store.savedCircle?.id)) store.savedCircle = null;
    renderAccount();
  } catch {
    if (cloud.revision === revision) setMsg('saveMsg', 'Não deu para carregar seus círculos. Verifique a conexão.', 'erro');
  }
}

export async function saveCircle(update: boolean): Promise<void> {
  const revision = cloud.revision;
  const context = circleContext();
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
  if (revision !== cloud.revision || context !== circleContext()) return;
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
  const revision = cloud.revision;
  const context = circleContext();
  if (!cloud.client) return;
  setMsg('saveMsg', 'Abrindo…');
  const { data, error } = await cloud.client.from('circulos').select('id, nome, projeto').eq('id', id).single();
  if (revision !== cloud.revision || context !== circleContext()) return;
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

/** Cria uma cópia de um círculo salvo ("Nome (cópia)"), sem abrir nem mexer no original */
export async function duplicateSaved(id: string): Promise<void> {
  const revision = cloud.revision;
  const client = cloud.client;
  if (!client || !cloud.user) return;
  setMsg('saveMsg', 'Duplicando…');
  const { data, error } = await client.from('circulos').select('nome, projeto').eq('id', id).single();
  if (revision !== cloud.revision) return;
  if (error || !data) {
    setMsg('saveMsg', 'Não deu para duplicar esse círculo.', 'erro');
    return;
  }
  const row = data as { nome: string; projeto: unknown };
  const nome = copyName(row.nome, cloud.list.map(c => c.nome));
  const { error: insertError } = await client.from('circulos').insert({ nome, projeto: row.projeto });
  if (revision !== cloud.revision) return;
  if (insertError) {
    setMsg('saveMsg', 'Não deu para duplicar: ' + insertError.message, 'erro');
    return;
  }
  setMsg('saveMsg', `Cópia criada: “${nome}”.`, 'ok');
  await loadSavedList();
}

export async function deleteSaved(id: string): Promise<void> {
  const revision = cloud.revision;
  if (!cloud.client) return;
  const item = cloud.list.find(c => c.id === id);
  if (!confirm(`Excluir “${item ? item.nome : 'este círculo'}” da sua conta? Não dá para desfazer.`)) return;
  const { error } = await cloud.client.from('circulos').delete().eq('id', id);
  if (revision !== cloud.revision) return;
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
  byId('continueGuest').addEventListener('click', () => {
    cloud.guest = true;
    showApplication();
  });
  byId('retryAuth').addEventListener('click', retryCloud);
  byId('toggleAuthPassword').addEventListener('click', () => {
    const input = byId<HTMLInputElement>('authPassword');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    const button = byId('toggleAuthPassword');
    button.textContent = show ? 'Ocultar' : 'Mostrar';
    button.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    button.setAttribute('aria-pressed', String(show));
  });
  showGateway();
  setAuthMode('entrar');
  void loadCloud();
}
