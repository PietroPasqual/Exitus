import { RUNES } from '../data/runes';
import type { Activation, MagicNode } from './types';

export const STATE_NAMES: Record<Activation, string> = { ativacao: 'Mínimo', perfeito: 'Perfeito', instavel: 'Extremo' };
export const LOWER_STATE: Partial<Record<Activation, Activation>> = { instavel: 'perfeito', perfeito: 'ativacao' };
export const HIGHER_STATE: Partial<Record<Activation, Activation>> = { ativacao: 'perfeito', perfeito: 'instavel' };

/** Red ☆ e Rad ⬠ multiplicam a carga da runa */
export function getChargeMult(n: MagicNode): number {
  return (n.shape === 'star' || n.shape === 'hexagon') ? (n.charge || 1) : 1;
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
