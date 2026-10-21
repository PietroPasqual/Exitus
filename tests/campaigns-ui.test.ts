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
  it('é a primeira tela ao entrar; sem conta, os personagens ficam em "sem campanha"', async () => {
    storeCharacter();
    setupCampaigns(); setupCharacter();
    $('#characterPage').dispatchEvent(new Event('rpg:enter'));
    await flush();
    expect($('#appShell').dataset.rpgView).toBe('campanhas');
    expect($('#campaignPage').hidden).toBe(false);
    expect($('[data-campaign-action="login"]')).toBeTruthy();
    expect(api.myMemberships).not.toHaveBeenCalled();
    expect($('.campaign-tile.is-loose').textContent).toContain('1 personagem');
    $('[data-campaign-action="select"][data-id="sem-campanha"]').click();
    expect($('#campaignTitle').textContent).toBe('Personagens sem campanha');
    expect(document.querySelectorAll('.campaign-pc')).toHaveLength(1);
    $('[data-campaign-action="open-character"]').click();
    expect($('#appShell').dataset.rpgView).toBe('ficha');
  });

  it('o jogador entra na campanha, cria o personagem dela e só vê a mesa depois de autorizado', async () => {
    storeCharacter();
    setSession({} as SupabaseClient, { id: 'u-ana', email: 'ana@exemplo.com' } as User);
    const pending: Membership = { campanhaId: 'c1', campanha: 'Ruínas', status: 'pendente', personagem: { ...lira, nome: '' } };
    api.joinCampaign.mockResolvedValue({ ok: true, data: pending });
    api.updateMyCharacter.mockResolvedValue({ ok: true, data: null });
    setupCampaigns(); setupCharacter();
    $('#characterPage').dispatchEvent(new Event('rpg:enter'));
    await flush();
    $<HTMLInputElement>('#campaignCode').value = '7f3a9c21';
    api.myMemberships.mockResolvedValue({ ok: true, data: [pending] });
    $('#campaignJoin').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    expect(api.joinCampaign).toHaveBeenCalledWith('7f3a9c21', 'ana', expect.objectContaining({ nome: '' }));
    // Abre direto a campanha: ainda sem personagens dela e sem mesa.
    expect($('#campaignTitle').textContent).toBe('Ruínas');
    expect($('#campaignPage').textContent).toContain('Aguardando o mestre');
    expect(document.querySelector('[data-campaign-action="open-table"]')).toBeNull();
    expect(document.querySelectorAll('.campaign-pc')).toHaveLength(0);
    expect(document.getElementById('campaignMasterTitle')).toBeNull();

    // Cria o personagem dentro da campanha: ele já nasce ligado a ela e vai para a mesa.
    $('[data-campaign-action="create-character"]').click();
    expect((document.querySelector<HTMLInputElement>('[data-creation-field="campanha"]'))!.value).toBe('Ruínas');
    const input = document.querySelector<HTMLInputElement>('[data-creation-field="nome"]')!;
    input.value = 'Kael'; input.dispatchEvent(new Event('input', { bubbles: true }));
    for (let step = 0; step < 6; step++) document.getElementById('creationForm')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
    const library = JSON.parse(localStorage.getItem(CHARACTER_LIBRARY_KEY)!);
    const kael = library.characters.find((c: { data: { identidade: { nome: string } } }) => c.data.identidade.nome === 'Kael');
    expect(kael.data.campanhaId).toBe('c1');
    expect(api.updateMyCharacter).toHaveBeenCalledWith('c1', expect.objectContaining({ nome: 'Kael' }));
    $('[data-character-action="campaign"]').click();
    await flush();
    expect($('#campaignTitle').textContent).toBe('Ruínas');
    expect([...document.querySelectorAll('.campaign-pc strong')].map(el => el.textContent)).toEqual(['Kael']);
    expect($('.campaign-pc').textContent).toContain('Na mesa');

    // Traz a Lira, que estava sem campanha, e depois tira de novo.
    $('[data-campaign-action="bring"]').click();
    expect(document.querySelectorAll('.campaign-pc')).toHaveLength(2);
    $('.campaign-pc:last-child [data-campaign-action="unlink"]').click();
    expect(document.querySelectorAll('.campaign-pc')).toHaveLength(1);

    api.myMemberships.mockResolvedValue({ ok: true, data: [{ ...pending, status: 'aprovado' }] });
    $('[data-campaign-action="home"]').click();
    expect($('.campaign-tile.is-pendente').textContent).toContain('Ruínas');
    $('[data-campaign-action="select"][data-id="c1"]').click();
    $('[data-campaign-action="home"]').click();
    $('#campaignPage').dispatchEvent(new CustomEvent('campanhas:open', { detail: { campanhaId: 'c1' } }));
    await flush();
    api.campaignStamp.mockResolvedValue({ ok: true, data: { nome: 'Ruínas', atualizado: 't1', fundo: 'f1' } });
    api.campaignTable.mockResolvedValue({ ok: true, data: { mesa: { scene: { nome: 'Cripta', colunas: 6, linhas: 4, tokens: [{ id: 'a', nome: 'Kael', tipo: 'jogador', x: 1, y: 1 }] }, rolagens: [{ total: 15, expressao: '1d20', quem: 'Mestre' }] }, fundo: '' } });
    $('[data-campaign-action="open-table"]').click();
    await flush();
    expect($('#campaignTableTitle').textContent).toBe('Cripta');
    expect(document.querySelectorAll('#campaignPage [data-token]')).toHaveLength(1);
    expect($('.campaign-rolls').textContent).toContain('15');
    expect(api.campaignTable).toHaveBeenCalledWith('c1', true);
  });

  it('o mestre (no computador) entra na campanha e autoriza os pedidos', async () => {
    setSession({} as SupabaseClient, { id: 'u-mestre' } as User);
    setMode('mestre');
    api.masterCampaigns.mockResolvedValue({ ok: true, data: [{ id: 'c1', nome: 'Ruínas', codigo: '7F3A9C21' }] });
    api.campaignMembers.mockResolvedValue({ ok: true, data: [{ userId: 'u-ana', jogador: 'Ana', status: 'pendente', personagem: lira }] });
    api.answerRequest.mockResolvedValue({ ok: true, data: null });
    setupCampaigns(); setupCharacter();
    $('[data-rpg-page="campanhas"]').click();
    await flush();
    expect($('.campaign-tile.is-master').textContent).toContain('1 pedido');
    expect($('#campaignCreateTitle')).toBeTruthy();
    $('[data-campaign-action="select"][data-id="c1"]').click();
    expect($('.campaign-code code').textContent).toBe('7F3A9C21');
    expect($('.campaign-members').textContent).toContain('Lira');
    $('[data-campaign-action="approve"]').click();
    await flush();
    expect(api.answerRequest).toHaveBeenCalledWith('c1', 'u-ana', true);

    // No celular a parte do mestre some, mesmo com o modo guardado.
    phone = true;
    window.dispatchEvent(new Event('existus:modo'));
    await flush();
    expect(document.querySelector('.campaign-tile.is-master')).toBeNull();
    expect($('#campaignPage').textContent).toContain('No celular você joga como jogador');
  });
});
