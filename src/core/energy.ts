import { RUNES } from '../data/runes';
import type { Activation, MagicNode } from './types';

export const STATE_NAMES: Record<Activation, string> = { ativacao: 'Mínimo', perfeito: 'Perfeito', instavel: 'Instável' };
export const LOWER_STATE: Partial<Record<Activation, Activation>> = { instavel: 'perfeito', perfeito: 'ativacao' };
export const HIGHER_STATE: Partial<Record<Activation, Activation>> = { ativacao: 'perfeito', perfeito: 'instavel' };

/**
 * Cargas extras: a Estrela e o Pentágono não multiplicam mais a runa (a Estrela guarda e devolve
 * energia; o Pentágono compara e divide). O campo antigo das magias salvas é ignorado.
 */
export function getChargeMult(_n: MagicNode): number {
  return 1;
}

/** Energia (custo de mana) de um nó com runa elemental num estado */
export function getElementalNodeCost(n: MagicNode, activation: Activation, missingMat: boolean): number {
  const r = RUNES[n.rune as string];
  const stats = r.stats as NonNullable<typeof r.stats>;
  const st = stats[activation] || stats.ativacao;
  // Vida/Morte: a Energia é uma escala sobre o Poder (2x ~ 3,2x ~ 5x)
  let cost = (r.costPerPower ? st.power * (r.costPerPower[activation] ?? r.costPerPower.ativacao) : st.cost) * getChargeMult(n);
  if (missingMat && r.missingPenalty) cost *= (1 + r.missingPenalty);
  return cost;
}

export const isElemental = (n: MagicNode): boolean => !!n.rune && RUNES[n.rune]?.category === 'elemental';
