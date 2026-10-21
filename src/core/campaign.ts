/**
 * Campanhas online: o resumo do personagem que o jogador leva e o que o mestre publica.
 * Tudo que chega do banco passa por aqui antes de aparecer na tela.
 */
import type { Character } from './character';
import { normalizeAvatar, type Avatar } from './avatar';
import { normalizeScene, playerView, type DiceRoll, type TableScene, type TableState } from './game-table';

/** Campanha que a Mesa do mestre publica para os jogadores aprovados (guardada no navegador do mestre). */
export const LINKED_CAMPAIGN_KEY = 'existus-mesa-campanha';

export type MemberStatus = 'pendente' | 'aprovado' | 'recusado';
export interface CharacterSummary {
  nome: string; raca: string; classe: string; arquetipo: string; rank: string; conceito: string;
  vida: { atual: number; maximo: number } | null;
  avatar: Avatar | null;
}
export interface Membership { campanhaId: string; campanha: string; status: MemberStatus; personagem: CharacterSummary }
export interface CampaignMember { userId: string; jogador: string; status: MemberStatus; personagem: CharacterSummary }
export interface MasterCampaign { id: string; nome: string; codigo: string }
/** O que vai para o banco: a vista dos jogadores sem a imagem (que vai à parte). */
export interface PublishedTable { scene: TableScene | null; rolagens: DiceRoll[] }

const text = (v: unknown, max: number): string => typeof v === 'string' ? v.trim().slice(0, max) : '';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function summarizeCharacter(character: Character): CharacterSummary {
  const rpg = character.rpg;
  const vida = rpg?.recursos.vida;
  return {
    nome: text(character.identidade.nome, 60) || 'Personagem sem nome',
    raca: text(rpg?.descricao.raca, 60),
    classe: text(rpg?.progressao.classes.find(entry => entry.nome.trim())?.nome, 60),
    arquetipo: text(rpg?.arquetipo, 40),
    rank: text(rpg?.progressao.rank, 20),
    conceito: text(character.identidade.conceito, 160),
    vida: vida && finite(vida.atual) && finite(vida.maximo) ? { atual: Math.round(vida.atual), maximo: Math.round(vida.maximo) } : null,
    avatar: character.avatar ?? null
  };
}
export function normalizeSummary(raw: unknown): CharacterSummary {
  const value = object(raw) ? raw : {};
  const vida = object(value.vida) && finite(value.vida.atual) && finite(value.vida.maximo)
    ? { atual: Math.round(value.vida.atual), maximo: Math.round(value.vida.maximo) } : null;
  return {
    nome: text(value.nome, 60) || 'Personagem sem nome', raca: text(value.raca, 60), classe: text(value.classe, 60),
    arquetipo: text(value.arquetipo, 40), rank: text(value.rank, 20), conceito: text(value.conceito, 160),
    vida, avatar: value.avatar === null || value.avatar === undefined ? null : normalizeAvatar(value.avatar)
  };
}
export const memberStatus = (v: unknown): MemberStatus => v === 'aprovado' || v === 'recusado' ? v : 'pendente';
/** Códigos são 8 letras/números; espaços e traços digitados são ignorados. */
export const normalizeCode = (code: string): string => code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

/**
 * Vista dos jogadores para publicar. A vida dos tokens ligados a fichas é gravada no token
 * (os jogadores não têm as fichas do mestre); inimigos e objetos seguem sem vida, como em playerView.
 */
export function publishTable(state: TableState, sheets: { id: string; nome: string; vida: { atual: number; maximo: number } | null }[]): { mesa: PublishedTable; fundo: string } {
  const view = playerView(state);
  if (!view.scene) return { mesa: { scene: null, rolagens: view.rolagens }, fundo: '' };
  const byId = new Map(sheets.map(sheet => [sheet.id, sheet]));
  const tokens = view.scene.tokens.map(token => {
    const sheet = token.personagemId ? byId.get(token.personagemId) : undefined;
    const vida = token.tipo === 'inimigo' || token.tipo === 'objeto' ? null : sheet?.vida ?? token.vida;
    return { ...token, nome: sheet?.nome ?? token.nome, vida, personagemId: '' };
  });
  return { mesa: { scene: { ...view.scene, tokens, fundo: '' }, rolagens: view.rolagens }, fundo: view.scene.fundo };
}
export function readPublishedTable(raw: unknown, fundo: unknown): PublishedTable {
  const value = object(raw) ? raw : {};
  const scene = object(value.scene) ? normalizeScene({ ...value.scene, fundo: typeof fundo === 'string' ? fundo : '' }) : null;
  const rolagens: DiceRoll[] = Array.isArray(value.rolagens)
    ? value.rolagens.slice(-30).filter(object).filter(r => finite(r.total) && r.secreta !== true).map(r => ({
      id: text(r.id, 64) || String(Math.random()), quando: finite(r.quando) ? r.quando : 0, quem: text(r.quem, 60),
      expressao: text(r.expressao, 80), detalhe: text(r.detalhe, 400), total: r.total as number, secreta: false
    }))
    : [];
  return { scene, rolagens };
}
