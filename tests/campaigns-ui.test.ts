// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { CHARACTER_LIBRARY_KEY } from '../src/core/character-library';
import { newCharacter } from '../src/core/character';
import type { CharacterSummary, Membership } from '../src/core/campaign';
import { setSession } from '../src/cloud/session';
import * as cloud from '../src/cloud/campaigns';
import { setupCharacter } from '../src/ui/character';
import { setupCampaigns } from '../src/ui/campaigns';
import { setMode } from '../src/ui/play-mode';

vi.mock('../src/ui/editor', () => ({ applyProject: vi.fn(), getProjectData: vi.fn(() => null), resetCircle: vi.fn() }));
vi.mock('../src/ui/history', () => ({ resetHistory: vi.fn() }));
vi.mock('../src/ui/store', () => ({ render: vi.fn(), store: { savedCircle: null } }));
vi.mock('../src/cloud/campaigns', () => ({
  myMemberships: vi.fn(), joinCampaign: vi.fn(), updateMyCharacter: vi.fn(), leaveCampaign: vi.fn(),
  masterCampaigns: vi.fn(), createCampaign: vi.fn(), deleteCampaign: vi.fn(), campaignMembers: vi.fn(),
  answerRequest: vi.fn(), removeMember: vi.fn(), publishCampaignTable: vi.fn(), campaignStamp: vi.fn(), campaignTable: vi.fn()
}));
const api = vi.mocked(cloud);

let phone = false;
function mount(): void {
  document.body.innerHTML = `<div id="appShell"><nav class="rpg-navigation"><button data-rpg-page="personagens"></button><button data-rpg-page="ficha"></button><button data-rpg-page="campanhas"></button><button data-rpg-page="mesa" hidden></button><button data-rpg-page="circulos"></button><button id="btnPlayMode"></button></nav>
    <div class="workspace"></div><div id="characterPage" hidden></div><main id="campaignPage" hidden></main><main id="tablePage" hidden></main>
    <select id="presetSelect"></select><div id="fileMenu"></div><button id="btnOpenGrimoire"></button><button id="btnAccount"></button>
    <div id="characterEditorContext" hidden><span id="circleOwnerLabel"></span><span id="circleStatus"></span><button id="btnReturnCharacter"></button><button id="btnSaveCharacterCircle"></button></div></div>`;
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  expect(el, `Ausente: ${selector}`).not.toBeNull();
  return el!;
};
const flush = async (): Promise<void> => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const lira: CharacterSummary = { nome: 'Lira', raca: 'Dríade', classe: 'Xamã', arquetipo: '', rank: '', conceito: '', vida: { atual: 7, maximo: 10 }, avatar: null };
function storeCharacter(): void {
  const c = newCharacter(); c.identidade.nome = 'Lira'; c.identidade.jogador = 'Ana';
  localStorage.setItem(CHARACTER_LIBRARY_KEY, JSON.stringify({ kind: 'circulos-rpg-library', version: 1, characters: [{ id: 'lira', data: c }] }));
}

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); phone = false;
  window.matchMedia = vi.fn(() => ({ matches: phone, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
  setMode('jogador');
  setSession(null, null);
  api.myMemberships.mockResolvedValue({ ok: true, data: [] });
  api.masterCampaigns.mockResolvedValue({ ok: true, data: [] });
  api.campaignMembers.mockResolvedValue({ ok: true, data: [] });
  mount();
});
afterEach(() => { vi.useRealTimers(); });

describe('Jogador e mestre', () => {
  it('a Mesa do mestre só aparece no computador com o modo mestre ligado', () => {
    setupCharacter();
    const mesa = $<HTMLButtonElement>('[data-rpg-page="mesa"]');
    expect(mesa.hidden).toBe(true);
    expect($('#btnPlayMode').hidden).toBe(false);
    $('#btnPlayMode').click();
    expect(mesa.hidden).toBe(false);
    expect($('#btnPlayMode').getAttribute('aria-pressed')).toBe('true');
    mesa.click();
    expect($('#tablePage').hidden).toBe(false);
    // A tela vira celular: volta a ser só jogador.
    phone = true;
    window.dispatchEvent(new Event('existus:modo'));
    expect(mesa.hidden).toBe(true);
    expect($('#btnPlayMode').hidden).toBe(true);
    expect($('#tablePage').hidden).toBe(true);
    expect($('#appShell').dataset.rpgView).toBe('personagens');
  });
});

describe('Campanhas', () => {
  it('sem conta, pede para entrar', async () => {
    setupCampaigns(); setupCharacter();
    $('[data-rpg-page="campanhas"]').click();
    await flush();
    expect($('#campaignPage').hidden).toBe(false);
    expect($('[data-campaign-action="login"]')).toBeTruthy();
    expect(api.myMemberships).not.toHaveBeenCalled();
  });

  it('o jogador pede com o código e só entra na mesa depois de autorizado', async () => {
    storeCharacter();
    setSession({} as SupabaseClient, { id: 'u-ana', email: 'ana@exemplo.com' } as User);
    const pending: Membership = { campanhaId: 'c1', campanha: 'Ruínas', status: 'pendente', personagem: lira };
    api.joinCampaign.mockResolvedValue({ ok: true, data: pending });
    setupCampaigns(); setupCharacter();
    $('[data-rpg-page="campanhas"]').click();
    await flush();
    $<HTMLInputElement>('#campaignCode').value = '7f3a9c21';
    api.myMemberships.mockResolvedValue({ ok: true, data: [pending] });
    $('#campaignJoin').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    expect(api.joinCampaign).toHaveBeenCalledWith('7f3a9c21', 'Ana', expect.objectContaining({ nome: 'Lira' }));
    expect($('.campaign-item').textContent).toContain('Aguardando o mestre');
    expect(document.querySelector('[data-campaign-action="open-table"]')).toBeNull();
    // Sem modo mestre, a parte de mestrar não aparece.
    expect(document.getElementById('campaignMasterTitle')).toBeNull();

    api.myMemberships.mockResolvedValue({ ok: true, data: [{ ...pending, status: 'aprovado' }] });
    $('[data-campaign-action="refresh"]').click();
    await flush();
    api.campaignStamp.mockResolvedValue({ ok: true, data: { nome: 'Ruínas', atualizado: 't1', fundo: 'f1' } });
    api.campaignTable.mockResolvedValue({ ok: true, data: { mesa: { scene: { nome: 'Cripta', colunas: 6, linhas: 4, tokens: [{ id: 'a', nome: 'Lira', tipo: 'jogador', x: 1, y: 1 }] }, rolagens: [{ total: 15, expressao: '1d20', quem: 'Mestre' }] }, fundo: '' } });
    $('[data-campaign-action="open-table"]').click();
    await flush();
    expect($('#campaignTableTitle').textContent).toBe('Cripta');
    expect(document.querySelectorAll('#campaignPage [data-token]')).toHaveLength(1);
    expect($('.campaign-rolls').textContent).toContain('15');
    expect(api.campaignTable).toHaveBeenCalledWith('c1', true);
  });

  it('o mestre (no computador) autoriza os pedidos', async () => {
    setSession({} as SupabaseClient, { id: 'u-mestre' } as User);
    setMode('mestre');
    api.masterCampaigns.mockResolvedValue({ ok: true, data: [{ id: 'c1', nome: 'Ruínas', codigo: '7F3A9C21' }] });
    api.campaignMembers.mockResolvedValue({ ok: true, data: [{ userId: 'u-ana', jogador: 'Ana', status: 'pendente', personagem: lira }] });
    api.answerRequest.mockResolvedValue({ ok: true, data: null });
    setupCampaigns(); setupCharacter();
    $('[data-rpg-page="campanhas"]').click();
    await flush();
    expect($('.campaign-code code').textContent).toBe('7F3A9C21');
    expect($('.campaign-badge.is-alert').textContent).toContain('1 pedido');
    $('[data-campaign-action="approve"]').click();
    await flush();
    expect(api.answerRequest).toHaveBeenCalledWith('c1', 'u-ana', true);

    // No celular a parte do mestre some, mesmo com o modo guardado.
    phone = true;
    window.dispatchEvent(new Event('existus:modo'));
    await flush();
    expect(document.getElementById('campaignMasterTitle')).toBeNull();
    expect($('#campaignPage').textContent).toContain('No celular você joga como jogador');
  });
});
