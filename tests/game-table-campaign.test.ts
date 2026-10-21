// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { LINKED_CAMPAIGN_KEY, type CampaignMember } from '../src/core/campaign';
import { setSession } from '../src/cloud/session';
import * as cloud from '../src/cloud/campaigns';
import { setupGameTable } from '../src/ui/game-table';

vi.mock('../src/cloud/campaigns', () => ({
  masterCampaigns: vi.fn(), campaignMembers: vi.fn(), publishCampaignTable: vi.fn()
}));
const api = vi.mocked(cloud);
const member = (atual: number): CampaignMember => ({
  userId: 'u-ana', jogador: 'Ana', status: 'aprovado',
  personagem: { nome: 'Lira', raca: '', classe: '', arquetipo: '', rank: '', conceito: '', vida: { atual, maximo: 10 }, avatar: null }
});
const flush = async (): Promise<void> => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

afterEach(() => { vi.useRealTimers(); setSession(null, null); localStorage.clear(); });

describe('Mesa ligada a uma campanha online', () => {
  it('acompanha a vida que o jogador manda enquanto a mesa fica aberta e republica', async () => {
    vi.useFakeTimers();
    localStorage.setItem(LINKED_CAMPAIGN_KEY, 'c1');
    setSession({} as SupabaseClient, { id: 'u-mestre' } as User);
    api.masterCampaigns.mockResolvedValue({ ok: true, data: [{ id: 'c1', nome: 'Ruínas', codigo: '7F3A9C21' }] });
    api.campaignMembers.mockResolvedValue({ ok: true, data: [member(10)] });
    api.publishCampaignTable.mockResolvedValue({ ok: true, data: null });
    document.body.innerHTML = '<div id="characterPage"></div><main id="tablePage"></main>';
    setupGameTable();
    const page = document.getElementById('tablePage')!;
    page.dispatchEvent(new Event('mesa:open'));
    await flush();
    page.querySelector<HTMLButtonElement>('[data-table-action="add-member"]')!.click();
    const bar = (): number => Number(page.querySelector('[data-token] .table-token-life')!.getAttribute('width'));
    expect(bar()).toBeCloseTo(0.76);
    await vi.advanceTimersByTimeAsync(1300);
    expect(api.publishCampaignTable).toHaveBeenLastCalledWith('c1', expect.objectContaining({ scene: expect.objectContaining({ tokens: [expect.objectContaining({ nome: 'Lira', vida: { atual: 10, maximo: 10 } })] }) }), '');

    // O jogador perde vida e manda o personagem atualizado: a mesa aberta acompanha.
    api.campaignMembers.mockResolvedValue({ ok: true, data: [member(4)] });
    await vi.advanceTimersByTimeAsync(15000);
    await flush();
    expect(bar()).toBeCloseTo(0.76 * 0.4);
    await vi.advanceTimersByTimeAsync(1300);
    expect(api.publishCampaignTable).toHaveBeenLastCalledWith('c1', expect.objectContaining({ scene: expect.objectContaining({ tokens: [expect.objectContaining({ vida: { atual: 4, maximo: 10 } })] }) }), undefined);
  });
});
