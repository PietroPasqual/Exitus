import { sessionClient, sessionUser } from './session';
import {
  memberStatus, normalizeCode, normalizeSummary,
  type CampaignMember, type CharacterSummary, type MasterCampaign, type Membership, type PublishedTable
} from '../core/campaign';

/** Chamadas ao banco das campanhas. Cada uma devolve os dados ou uma mensagem para a tela. */
export type Result<T> = { ok: true; data: T } | { ok: false; problem: string };
const fail = <T>(problem: string): Result<T> => ({ ok: false, problem });

function friendly(error: { message?: string; code?: string } | null): string {
  const m = (error?.message ?? '').toLowerCase();
  if (m.includes('codigo invalido')) return 'Não existe campanha com esse código. Confira com o mestre.';
  if (m.includes('mestre da campanha')) return 'Você é o mestre desta campanha; abra-a pela Mesa do mestre.';
  if (m.includes('campanha cheia')) return 'Esta campanha já tem o máximo de 40 jogadores.';
  if (m.includes('limite de pedidos')) return 'Você chegou ao limite de 30 campanhas. Saia de alguma para entrar em outra.';
  if (m.includes('limite de campanhas')) return 'Cada conta pode mestrar até 10 campanhas.';
  if (m.includes('fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique a internet.';
  if (m.includes('does not exist') || m.includes('schema cache') || ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error?.code ?? '')) return 'As campanhas online ainda não foram ativadas no servidor (falta aplicar database/campanhas_supabase.sql no Supabase).';
  return 'Não foi possível falar com o servidor agora. Tente de novo.';
}
function ready(): { client: NonNullable<ReturnType<typeof sessionClient>>; userId: string } | null {
  const client = sessionClient(), user = sessionUser();
  return client && user ? { client, userId: user.id } : null;
}
const NO_ACCOUNT = 'Entre na sua conta para usar as campanhas online.';

export async function myMemberships(): Promise<Result<Membership[]>> {
  const s = ready(); if (!s) return fail(NO_ACCOUNT);
  const { data, error } = await s.client.from('campanha_membros').select('campanha_id, campanha_nome, status, personagem')
    .eq('user_id', s.userId).order('criado_em', { ascending: false });
  if (error) return fail(friendly(error));
  return { ok: true, data: (data ?? []).map(row => ({ campanhaId: String(row.campanha_id), campanha: String(row.campanha_nome ?? '') || 'Campanha', status: memberStatus(row.status), personagem: normalizeSummary(row.personagem) })) };
}
export async function joinCampaign(code: string, jogador: string, personagem: CharacterSummary): Promise<Result<Membership>> {
  const s = ready(); if (!s) return fail(NO_ACCOUNT);
  const codigo = normalizeCode(code);
  if (codigo.length < 4) return fail('Digite o código que o mestre passou.');
  const { data, error } = await s.client.rpc('entrar_campanha', { p_codigo: codigo, p_jogador: jogador.slice(0, 60), p_personagem: personagem });
  if (error) return fail(friendly(error));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return fail('Não foi possível entrar agora. Tente de novo.');
  return { ok: true, data: { campanhaId: String(row.campanha_id), campanha: String(row.campanha_nome ?? 'Campanha'), status: memberStatus(row.status), personagem } };
}
export async function updateMyCharacter(campanhaId: string, personagem: CharacterSummary): Promise<Result<null>> {
  const s = ready(); if (!s) return fail(NO_ACCOUNT);
  const { error } = await s.client.rpc('atualizar_personagem_campanha', { p_campanha: campanhaId, p_personagem: personagem });
  return error ? fail(friendly(error)) : { ok: true, data: null };
}
export async function leaveCampaign(campanhaId: string): Promise<Result<null>> {
  const s = ready(); if (!s) return fail(NO_ACCOUNT);
  const { error } = await s.client.from('campanha_membros').delete().eq('campanha_id', campanhaId).eq('user_id', s.userId);
  return error ? fail(friendly(error)) : { ok: true, data: null };
}

export async function masterCampaigns(): Promise<Result<MasterCampaign[]>> {
  const s = ready(); if (!s) return fail(NO_ACCOUNT);
  const { data, error } = await s.client.from('campanhas').select('id, nome, codigo').eq('mestre_id', s.userId).order('criado_em');
  if (error) return fail(friendly(error));
  return { ok: true, data: (data ?? []).map(row => ({ id: String(row.id), nome: String(row.nome), codigo: String(row.codigo) })) };
}
export async function createCampaign(nome: string): Promise<Result<MasterCampaign>> {
  const s = ready(); if (!s) return fail(NO_ACCOUNT);
  const clean = nome.trim().slice(0, 60);
  if (!clean) return fail('Dê um nome à campanha.');
  const { data, error } = await s.client.from('campanhas').insert({ nome: clean }).select('id, nome, codigo').single();
  if (error || !data) return fail(friendly(error));
  return { ok: true, data: { id: String(data.id), nome: String(data.nome), codigo: String(data.codigo) } };
}
export async function deleteCampaign(id: string): Promise<Result<null>> {
  const s = ready(); if (!s) return fail(NO_ACCOUNT);
  const { error } = await s.client.from('campanhas').delete().eq('id', id);
  return error ? fail(friendly(error)) : { ok: true, data: null };
}
export async function campaignMembers(id: string): Promise<Result<CampaignMember[]>> {
  const s = ready(); if (!s) return fail(NO_ACCOUNT);
  const { data, error } = await s.client.from('campanha_membros').select('user_id, jogador, status, personagem').eq('campanha_id', id).order('criado_em');
  if (error) return fail(friendly(error));
  return { ok: true, data: (data ?? []).map(row => ({ userId: String(row.user_id), jogador: String(row.jogador ?? ''), status: memberStatus(row.status), personagem: normalizeSummary(row.personagem) })) };
}
export async function answerRequest(id: string, userId: string, approve: boolean): Promise<Result<null>> {
  const s = ready(); if (!s) return fail(NO_ACCOUNT);
  const { error } = await s.client.rpc('responder_pedido_campanha', { p_campanha: id, p_jogador: userId, p_aprovar: approve });
  return error ? fail(friendly(error)) : { ok: true, data: null };
}
export async function removeMember(id: string, userId: string): Promise<Result<null>> {
  const s = ready(); if (!s) return fail(NO_ACCOUNT);
  const { error } = await s.client.from('campanha_membros').delete().eq('campanha_id', id).eq('user_id', userId);
  return error ? fail(friendly(error)) : { ok: true, data: null };
}
/** O fundo só vai quando mudou (é a parte pesada). */
export async function publishCampaignTable(id: string, mesa: PublishedTable, fundo?: string): Promise<Result<null>> {
  const s = ready(); if (!s) return fail(NO_ACCOUNT);
  const { error } = await s.client.from('campanhas').update(fundo === undefined ? { mesa } : { mesa, fundo }).eq('id', id);
  return error ? fail(friendly(error)) : { ok: true, data: null };
}
export async function campaignStamp(id: string): Promise<Result<{ nome: string; atualizado: string; fundo: string }>> {
  const s = ready(); if (!s) return fail(NO_ACCOUNT);
  const { data, error } = await s.client.from('campanhas').select('nome, atualizado_em, fundo_em').eq('id', id).maybeSingle();
  if (error) return fail(friendly(error));
  if (!data) return fail('O mestre ainda não liberou a mesa para você, ou a campanha foi encerrada.');
  return { ok: true, data: { nome: String(data.nome), atualizado: String(data.atualizado_em), fundo: String(data.fundo_em) } };
}
export async function campaignTable(id: string, withBackground: boolean): Promise<Result<{ mesa: unknown; fundo?: string }>> {
  const s = ready(); if (!s) return fail(NO_ACCOUNT);
  const { data, error } = await s.client.from('campanhas').select(withBackground ? 'mesa, fundo' : 'mesa').eq('id', id).maybeSingle();
  if (error) return fail(friendly(error));
  if (!data) return fail('O mestre ainda não liberou a mesa para você.');
  const row = data as unknown as { mesa: unknown; fundo?: unknown };
  return { ok: true, data: withBackground ? { mesa: row.mesa, fundo: typeof row.fundo === 'string' ? row.fundo : '' } : { mesa: row.mesa } };
}
