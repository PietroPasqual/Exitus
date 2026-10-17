// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type TestUser = { id: string; email: string };
type TestSession = { user: TestUser } | null;
type AuthListener = (event: string, session: TestSession) => void;

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
  order: vi.fn(),
  single: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  store: { savedCircle: null as null | { id: string; nome: string }, state: { spellInfo: { name: 'Teste' } } }
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('../src/ui/editor', () => ({ applyProject: vi.fn(), getProjectData: vi.fn() }));
vi.mock('../src/ui/store', () => ({ store: mocks.store, render: vi.fn() }));

const userA: TestUser = { id: 'user-a', email: 'a@example.test' };
const userB: TestUser = { id: 'user-b', email: 'b@example.test' };
let listener: AuthListener | undefined;
let initialSession: TestSession;
let emitInitialSession: boolean;

function emit(user: TestUser | null, event = user ? 'SIGNED_IN' : 'SIGNED_OUT'): void {
  if (!listener) throw new Error('O observador de autenticação não foi registrado.');
  listener(event, user ? { user } : null);
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

async function settle(): Promise<void> {
  await vi.dynamicImportSettled();
  await vi.advanceTimersByTimeAsync(0);
  await Promise.resolve();
}

async function start(): Promise<typeof import('../src/cloud/account')> {
  const account = await import('../src/cloud/account');
  account.setupAccount();
  await settle();
  return account;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  vi.clearAllMocks();
  listener = undefined;
  initialSession = null;
  emitInitialSession = true;
  mocks.store.savedCircle = null;
  document.body.className = '';
  document.body.innerHTML = `
    <section id="entryGate">
      <div id="authLoading" hidden></div>
      <div id="accountUnavailable" hidden><button id="retryAuth" type="button">Tentar novamente</button></div>
      <form id="authForm" hidden>
        <button type="button" data-action="auth-mode" data-arg="entrar">Entrar</button>
        <button type="button" data-action="auth-mode" data-arg="criar">Criar conta</button>
        <input id="authEmail" type="email" required />
        <label id="authPasswordLabel" for="authPassword">Senha</label>
        <input id="authPassword" type="password" required minlength="6" />
        <div id="authConfirmGroup" hidden><input id="authConfirmPassword" type="password" /></div>
        <button id="toggleAuthPassword" type="button" aria-pressed="false">Mostrar senha</button>
        <button id="authSubmit" type="submit">Entrar</button>
        <div id="authMsg" role="status"></div>
      </form>
      <button id="continueGuest" type="button">Continuar como visitante</button>
    </section>
    <main id="appShell" hidden>
      <button id="btnCharacterLink">Personagens</button><main id="characterPage"></main>
      <button id="btnAccount"><span id="accountLabel">Entrar</span></button>
      <div id="accountModal"><div id="accountPanel" hidden>
        <span id="accountEmail"></span><div id="adminCard" hidden></div>
        <input id="saveName" /><button id="btnSaveUpdate" hidden></button>
        <span id="currentSavedName"></span><div id="savedList"></div><div id="saveMsg"></div>
      </div></div>
    </main>`;
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  mocks.order.mockResolvedValue({ data: [], error: null });
  mocks.single.mockResolvedValue({ data: null, error: null });
  mocks.signIn.mockResolvedValue({ data: { session: null }, error: null });
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mocks.signOut.mockImplementation(async () => {
    emit(null);
    return { error: null };
  });
  mocks.createClient.mockImplementation(() => ({
    auth: {
      onAuthStateChange: (callback: AuthListener) => {
        listener = callback;
        if (emitInitialSession) void Promise.resolve().then(() => callback('INITIAL_SESSION', initialSession));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signInWithPassword: mocks.signIn,
      signUp: mocks.signUp,
      signOut: mocks.signOut
    },
    rpc: mocks.rpc,
    from: () => {
      const query = {
        select: () => query,
        insert: () => query,
        update: () => query,
        eq: () => query,
        order: mocks.order,
        single: mocks.single
      };
      return query;
    }
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Entrada da conta e modo visitante', () => {
  it('abre a seleção no acesso sem reiniciar a navegação ao renovar o token', async () => {
    initialSession = { user: userA };
    const enter = vi.fn();
    el('characterPage').addEventListener('rpg:enter', enter);
    await start();
    expect(enter).toHaveBeenCalledTimes(1);
    emit(userA, 'TOKEN_REFRESHED');
    await settle();
    expect(enter).toHaveBeenCalledTimes(1);
  });

  it('abre a entrada antes do editor e resolve a sessão inicial sem conta', async () => {
    emitInitialSession = false;
    await start();
    expect(el('entryGate').hidden).toBe(false);
    expect(el('appShell').hidden).toBe(true);
    expect(el('authLoading').hidden).toBe(false);
    expect(el('accountUnavailable').hidden).toBe(true);

    emit(null, 'INITIAL_SESSION');
    await settle();
    expect(el('authLoading').hidden).toBe(true);
    expect(el('authForm').hidden).toBe(false);
    expect(el('appShell').hidden).toBe(true);
  });

  it('permite criar localmente como visitante e reabrir a entrada pela conta', async () => {
    const account = await start();
    el<HTMLButtonElement>('continueGuest').click();
    expect(el('entryGate').hidden).toBe(true);
    expect(el('appShell').hidden).toBe(false);
    expect(account.isAdmin()).toBe(false);
    expect(mocks.signIn).not.toHaveBeenCalled();

    account.openAccount();
    expect(el('entryGate').hidden).toBe(false);
    expect(el('appShell').hidden).toBe(true);
    expect(el('authForm').hidden).toBe(false);
  });

  it('mantém o visitante no editor quando a sessão inicial sem conta chega atrasada', async () => {
    emitInitialSession = false;
    await start();
    el<HTMLButtonElement>('continueGuest').click();
    emit(null, 'INITIAL_SESSION');
    await settle();
    expect(el('entryGate').hidden).toBe(true);
    expect(el('appShell').hidden).toBe(false);
  });

  it('oferece recuperação se o serviço não entregar uma sessão inicial', async () => {
    emitInitialSession = false;
    await start();
    await vi.advanceTimersByTimeAsync(12000);
    expect(el('authLoading').hidden).toBe(true);
    expect(el('accountUnavailable').hidden).toBe(false);
    expect(el('retryAuth').hidden).toBe(false);

    const oldListener = listener!;
    emitInitialSession = true;
    el<HTMLButtonElement>('retryAuth').click();
    await settle();
    oldListener('SIGNED_IN', { user: userA });
    await settle();
    expect(el('accountUnavailable').hidden).toBe(true);
    expect(el('authForm').hidden).toBe(false);
    expect(el('appShell').hidden).toBe(true);
  });

  it('mostra falha de conexão, oferece nova tentativa e mantém a saída de visitante', async () => {
    mocks.createClient.mockImplementationOnce(() => { throw new Error('network unavailable'); });
    const account = await start();
    expect(el('accountUnavailable').hidden).toBe(false);
    expect(el('authLoading').hidden).toBe(true);
    expect(el('authForm').hidden).toBe(true);
    el<HTMLButtonElement>('continueGuest').click();
    expect(el('appShell').hidden).toBe(false);
    expect(account.isAdmin()).toBe(false);
    account.openAccount();

    el<HTMLButtonElement>('retryAuth').click();
    await settle();
    expect(mocks.createClient).toHaveBeenCalledTimes(2);
    expect(el('accountUnavailable').hidden).toBe(true);
    expect(el('authForm').hidden).toBe(false);
    el<HTMLButtonElement>('continueGuest').click();
    expect(el('appShell').hidden).toBe(false);
  });

  it('restaura uma sessão existente e mantém o editor aberto ao atualizar o token', async () => {
    initialSession = { user: userA };
    await start();
    expect(el('entryGate').hidden).toBe(true);
    expect(el('appShell').hidden).toBe(false);
    expect(el('accountEmail').textContent).toBe(userA.email);

    emit(userA, 'TOKEN_REFRESHED');
    await settle();
    expect(el('entryGate').hidden).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('volta à entrada ao sair e retira os privilégios da conta anterior', async () => {
    initialSession = { user: userA };
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const account = await start();
    expect(account.isAdmin()).toBe(true);
    mocks.store.savedCircle = { id: 'saved-a', nome: 'Privado' };

    await account.signOut();
    expect(account.isAdmin()).toBe(false);
    expect(document.body.classList.contains('is-admin')).toBe(false);
    expect(mocks.store.savedCircle).toBeNull();
    expect(el('entryGate').hidden).toBe(false);
    expect(el('appShell').hidden).toBe(true);
  });

  it('alterna a visibilidade da senha sem enviar o formulário', async () => {
    await start();
    const password = el<HTMLInputElement>('authPassword');
    password.value = 'uma senha de teste';
    el<HTMLButtonElement>('toggleAuthPassword').click();
    expect(password.type).toBe('text');
    expect(password.value).toBe('uma senha de teste');
    el<HTMLButtonElement>('toggleAuthPassword').click();
    expect(password.type).toBe('password');
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('apaga e oculta a senha ao continuar como visitante e reabrir a entrada', async () => {
    const account = await start();
    const password = el<HTMLInputElement>('authPassword');
    const toggle = el<HTMLButtonElement>('toggleAuthPassword');
    password.value = 'uma senha de teste';
    toggle.click();
    expect(password.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    el<HTMLButtonElement>('continueGuest').click();
    account.openAccount();
    expect(el('entryGate').hidden).toBe(false);
    expect(password.value).toBe('');
    expect(password.type).toBe('password');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('espera a sessão autenticada antes de liberar o editor após o envio do login', async () => {
    await start();
    el<HTMLInputElement>('authEmail').value = userA.email;
    el<HTMLInputElement>('authPassword').value = 'uma senha de teste';
    el<HTMLFormElement>('authForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(mocks.signIn).toHaveBeenCalledWith({ email: userA.email, password: 'uma senha de teste' });
    expect(el('appShell').hidden).toBe(true);

    emit(userA);
    await settle();
    expect(el('entryGate').hidden).toBe(true);
    expect(el('appShell').hidden).toBe(false);
  });

  it('valida a confirmação da senha antes de solicitar o cadastro', async () => {
    const account = await start();
    account.setAuthMode('criar');
    el<HTMLInputElement>('authEmail').value = userA.email;
    el<HTMLInputElement>('authPassword').value = 'uma senha de teste';
    el<HTMLInputElement>('authConfirmPassword').value = 'outra senha de teste';
    el<HTMLFormElement>('authForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(el('authMsg').textContent).toContain('não coincidem');
    expect(el('appShell').hidden).toBe(true);
  });

  it('aguarda confirmação por e-mail ao criar uma conta sem sessão autenticada', async () => {
    const account = await start();
    account.setAuthMode('criar');
    el<HTMLInputElement>('authEmail').value = userA.email;
    el<HTMLInputElement>('authPassword').value = 'uma senha de teste';
    el<HTMLInputElement>('authConfirmPassword').value = 'uma senha de teste';
    el<HTMLFormElement>('authForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(mocks.signUp).toHaveBeenCalledTimes(1);
    expect(el('authMsg').textContent).toContain('e-mail de confirmação');
    expect(el('authConfirmGroup').hidden).toBe(true);
    expect(el('appShell').hidden).toBe(true);
    expect(el('authSubmit').textContent).toBe('Entrar');
  });

  it('ignora uma resposta administrativa atrasada depois de trocar de usuário', async () => {
    const oldAdmin = deferred<{ data: boolean; error: null }>();
    mocks.rpc.mockImplementationOnce(() => oldAdmin.promise);
    const account = await start();
    emit(userA);
    await settle();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);

    emit(userB);
    expect(account.isAdmin()).toBe(false);
    expect(document.body.classList.contains('is-admin')).toBe(false);
    await settle();
    oldAdmin.resolve({ data: true, error: null });
    await settle();
    expect(account.isAdmin()).toBe(false);
    expect(document.body.classList.contains('is-admin')).toBe(false);
    expect(el('accountEmail').textContent).toBe(userB.email);
  });

  it('remove privilégios imediatamente ao trocar uma conta administrativa por outra', async () => {
    initialSession = { user: userA };
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    const account = await start();
    expect(account.isAdmin()).toBe(true);
    expect(document.body.classList.contains('is-admin')).toBe(true);

    const pendingAdmin = deferred<{ data: boolean; error: null }>();
    mocks.rpc.mockImplementationOnce(() => pendingAdmin.promise);
    emit(userB);
    expect(account.isAdmin()).toBe(false);
    expect(document.body.classList.contains('is-admin')).toBe(false);
    await settle();
    pendingAdmin.resolve({ data: false, error: null });
    await settle();
    expect(account.isAdmin()).toBe(false);
  });

  it('não exibe círculos da conta anterior quando uma consulta termina após a troca', async () => {
    const oldList = deferred<{ data: { id: string; nome: string; atualizado_em: string }[]; error: null }>();
    mocks.order.mockImplementationOnce(() => oldList.promise);
    await start();
    emit(userA);
    await settle();
    emit(userB);
    await settle();
    oldList.resolve({ data: [{ id: 'circle-a', nome: 'Círculo privado de A', atualizado_em: '2026-10-17T00:00:00Z' }], error: null });
    await settle();
    expect(el('accountEmail').textContent).toBe(userB.email);
    expect(el('savedList').textContent).not.toContain('Círculo privado de A');
  });

  it('não associa a resposta de salvamento ao personagem aberto depois na mesma conta', async () => {
    initialSession = { user: userA };
    const account = await start();
    const { changeCircleContext } = await import('../src/core/editor-context');
    const pendingSave = deferred<{ data: { id: string; nome: string; atualizado_em: string }; error: null }>();
    mocks.single.mockImplementationOnce(() => pendingSave.promise);
    el<HTMLInputElement>('saveName').value = 'Círculo do primeiro personagem';
    const saving = account.saveCircle(false);

    changeCircleContext();
    const currentCircle = { id: 'circle-b', nome: 'Círculo do segundo personagem' };
    mocks.store.savedCircle = currentCircle;
    pendingSave.resolve({ data: { id: 'circle-a', nome: 'Círculo do primeiro personagem', atualizado_em: '2026-10-17T00:00:00Z' }, error: null });
    await saving;

    expect(el('accountEmail').textContent).toBe(userA.email);
    expect(mocks.store.savedCircle).toBe(currentCircle);
  });

  it('não abre um círculo cuja resposta chegou depois de mudar o personagem na mesma conta', async () => {
    initialSession = { user: userA };
    const account = await start();
    const { changeCircleContext } = await import('../src/core/editor-context');
    const { applyProject } = await import('../src/ui/editor');
    const pendingOpen = deferred<{ data: { id: string; nome: string; projeto: unknown }; error: null }>();
    mocks.single.mockImplementationOnce(() => pendingOpen.promise);
    const opening = account.openSaved('circle-a');

    changeCircleContext();
    const currentCircle = { id: 'circle-b', nome: 'Círculo do segundo personagem' };
    mocks.store.savedCircle = currentCircle;
    pendingOpen.resolve({ data: { id: 'circle-a', nome: 'Círculo do primeiro personagem', projeto: {
      nodes: [{ id: 'prism_center', shape: 'prism', lockedCenter: true }]
    } }, error: null });
    await opening;

    expect(el('accountEmail').textContent).toBe(userA.email);
    expect(applyProject).not.toHaveBeenCalled();
    expect(mocks.store.savedCircle).toBe(currentCircle);
  });
});
