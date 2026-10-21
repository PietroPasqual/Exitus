/**
 * Caminhos de poder: os quatro pilares de destaque do Livro de Regras. O jogador escolhe
 * quais o personagem usa; o círculo mágico é a ferramenta do caminho da Mana, não o centro do site.
 */
export const POWER_PATHS = {
  mana: {
    nome: 'Mana', pilar: 'Pilar da Magia', capitulo: 'pilares-mana',
    resumo: 'Runas, estrutura e expressão. As magias são desenhadas como círculos mágicos no ateliê de runas.',
    estado: 'Ferramenta pronta: ateliê de círculos mágicos', guia: ''
  },
  aura: {
    nome: 'Aura', pilar: 'Pilar do Aprimoramento', capitulo: 'pilares-aura',
    resumo: 'Conquistas reconhecidas pela “Natureza e Aura” e as perguntas sobre Corpo, Ser e Ambiente, respondidas pelos sósias com aprimoramentos.',
    estado: 'Ferramenta própria em construção', guia: 'Conquistas, perguntas feitas, sósia que respondeu, aprimoramentos e aspecto…'
  },
  espada: {
    nome: 'Espada', pilar: 'Pilar do Armamento', capitulo: 'pilares-espada',
    resumo: 'O armamento original nasce de um ritual e evolui por Molde, Forja e Ascensão; os derivados vêm de outros portadores.',
    estado: 'Ferramenta própria em construção', guia: 'Armamento (original ou derivado), estágio (Molde, Forja, Ascensão), ritual e sacrifício, habilidades…'
  },
  reliquias: {
    nome: 'Relíquias', pilar: 'Pilar do Espírito', capitulo: 'pilares-reliquias',
    resumo: 'Um dos quatro pilares de destaque. As regras ainda não foram publicadas no livro.',
    estado: 'Regras a publicar', guia: 'Relíquias obtidas, vínculos e efeitos combinados com o mestre…'
  }
} as const;
export type PowerPathId = keyof typeof POWER_PATHS;
export const POWER_PATH_IDS = Object.keys(POWER_PATHS) as PowerPathId[];
export const POWER_NOTES_LIMIT = 4000;

export interface Powers { caminhos: PowerPathId[]; notas: Partial<Record<PowerPathId, string>> }

export const newPowers = (): Powers => ({ caminhos: [], notas: {} });
/** Só caminhos conhecidos, sem repetir e na ordem do livro; notas de até 4000 letras. */
export function normalizePowers(raw: unknown): Powers | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as { caminhos?: unknown; notas?: unknown };
  const chosen = new Set(Array.isArray(value.caminhos) ? value.caminhos.filter((id): id is PowerPathId => typeof id === 'string' && id in POWER_PATHS) : []);
  const notas: Partial<Record<PowerPathId, string>> = {};
  if (value.notas && typeof value.notas === 'object' && !Array.isArray(value.notas)) {
    for (const id of POWER_PATH_IDS) {
      const note = (value.notas as Record<string, unknown>)[id];
      if (typeof note === 'string' && note) notas[id] = note.slice(0, POWER_NOTES_LIMIT);
    }
  }
  return { caminhos: POWER_PATH_IDS.filter(id => chosen.has(id)), notas };
}
export function togglePower(powers: Powers | undefined, id: PowerPathId, on: boolean): Powers {
  const current = powers ?? newPowers();
  const chosen = new Set(current.caminhos);
  if (on) chosen.add(id); else chosen.delete(id);
  return { ...current, caminhos: POWER_PATH_IDS.filter(path => chosen.has(path)) };
}
