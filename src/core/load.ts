import { RUNES } from '../data/runes';
import { CALC } from '../data/rules';
import { getShapeRange, shapeName } from '../data/shapes';
import { getNodeShortLabel, isPrism, type Model } from './circles';
import { getChargeMult, getElementalNodeCost, HIGHER_STATE, isElemental, LOWER_STATE, STATE_NAMES } from './energy';
import type { FlowResult } from './flow';
import { fmt } from './format';
import type { Activation, MagicNode, ShapeId } from './types';

// Regra de carga (proposta): cada forma ligada ao fluxo suporta até o máximo da sua faixa.
// Carga = energia total do círculo. Capacidade = soma dos máximos das formas que recebem energia.

/** Sal △ (e Salor ○+△, que tem o triângulo) estabilizam o círculo */
export const STABILIZER_SHAPES: ShapeId[] = ['triangle', 'salor'];
/** Selo ○ e Col □ não seguram excesso */
export const FRAGILE_SHAPES: ShapeId[] = ['circle', 'square'];

export type LoadLevel = 'inativo' | 'vazio' | 'fraco' | 'estavel' | 'carregado' | 'sobrecarga' | 'explosao';

export interface LoadResult {
  load: number;
  capacity: number;
  minimum: number;
  ratio: number;
  level: LoadLevel;
  /** O que aconteceria (texto) */
  consequence: string;
  /** Sugestões (HTML simples com <b>) */
  tips: string[];
}

export function analyzeLoad(m: Model, load: number, flow: FlowResult, missingMat: boolean, primaryNode: MagicNode | null): LoadResult {
  const active = m.nodes.filter(n => flow.working.has(n.id));
  const capacity = active.reduce((acc, n) => acc + getShapeRange(n.shape).max, 0);
  const minimum = active.reduce((acc, n) => acc + getShapeRange(n.shape).min, 0);
  const ratio = capacity > 0 ? load / capacity : 0;

  // Selo ○ e Col □ não seguram excesso: sem um Sal △, passou de 100% eles estouram;
  // com Sal △, o círculo aguenta até 130%.
  const stabilizers = active.filter(n => STABILIZER_SHAPES.includes(n.shape));
  const fragile = active.filter(n => FRAGILE_SHAPES.includes(n.shape));
  const tolerance = stabilizers.length ? CALC.salTolerancia : 1;

  let level: LoadLevel;
  if (!flow.working.size) level = 'inativo';
  else if (load <= 0) level = 'vazio';
  else if (load < minimum) level = 'fraco';
  else if (ratio <= CALC.estavel) level = 'estavel';
  else if (ratio <= 1) level = 'carregado';
  else if (ratio <= tolerance) level = 'sobrecarga';
  else level = 'explosao';

  const label = (n: MagicNode): string => getNodeShortLabel(m, n.id);
  const pr = primaryNode ? RUNES[primaryNode.rune as string] : null;
  const effectName = pr ? (pr.passive ?? '').split(' (')[0] : '';
  const fragileList = fragile.map(n => `${shapeName(n.shape)} ${label(n)}`).join(', ');
  const consequences: Record<LoadLevel, string> = {
    inativo: 'Sem o Prisma em um ciclo fechado, nada funciona: a energia não circula e nenhuma runa é ativada.',
    vazio: 'Nenhuma runa gasta energia ainda. Coloque uma runa elemental (ex.: Fogo) no Prisma ou num nó.',
    fraco: `A energia (${fmt(load)}) não chega ao mínimo que as formas precisam para ativar (${fmt(minimum)}). A magia falha ou sai fraca, sem efeito.`,
    estavel: 'O círculo segura a energia com folga. A magia sai como planejado.',
    carregado: 'Funciona, mas está perto do limite: subir um estado, somar uma runa ou aumentar a carga de um Red pode sobrecarregar.' +
      (stabilizers.length
        ? ' O Sal △ segura até 30% de excesso.'
        : ' Sem um Sal △, se passar de 100% os Selos ○ e Cols □ não seguram e estouram.'),
    sobrecarga: `A energia passa ${fmt(load - capacity)} do que as formas aguentam, mas o Sal △ estabiliza o círculo: a magia funciona, instável, sem explodir. Acima de ${Math.round(CALC.salTolerancia * 100)}% nem o Sal △ segura.`,
    explosao: `O círculo EXPLODE${stabilizers.length ? ', nem o Sal △ segura tanta energia' : ': não há Sal △ para estabilizar'}. ` +
      (fragileList ? `${fragileList} recebem energia demais e estouram. ` : '') +
      `${fmt(load - capacity)} de energia ${pr ? `de ${pr.name}` : 'de mana pura'} é liberada de uma vez em volta do conjurador${effectName ? `, aplicando ${effectName} em tudo ao redor — inclusive no próprio conjurador` : ''}.`
  };

  // ---- Sugestões ("o que seria bom fazer") ----
  const tips: string[] = [];
  const elementals = m.nodes.filter(isElemental);
  // Formas que ajudam a segurar energia (Selo ○ não segura excesso, então fica de fora)
  const shapeChoices = (['triangle', 'hexagon', 'star', 'salor', 'redor'] as ShapeId[])
    .map(k => ({ k, name: shapeName(k), max: getShapeRange(k).max }))
    .sort((a, b) => a.max - b.max);
  const runeName = (n: MagicNode): string => RUNES[n.rune as string].name;

  if ((level === 'sobrecarga' || level === 'explosao') && !stabilizers.length) {
    tips.push(`Adicione um <b>Sal △</b> ligado ao fluxo: ele estabiliza o círculo (Selos ○ e Cols □ não seguram excesso) e aguenta até ${Math.round(CALC.salTolerancia * 100)}% de carga.`);
  }
  if (level === 'sobrecarga' || level === 'explosao') {
    const deficit = load - capacity;
    const one = shapeChoices.find(c => c.max >= deficit);
    if (one && one.k === 'triangle' && !stabilizers.length) {
      // já sugerido acima
    } else if (one) {
      tips.push(`Adicione 1 <b>${one.name}</b> ligado ao fluxo (+${fmt(one.max)} de capacidade).`);
    } else {
      const redor = shapeChoices[shapeChoices.length - 1];
      tips.push(`Adicione ${Math.ceil(deficit / redor.max)} <b>${redor.name}</b> ligados ao fluxo (+${fmt(redor.max)} cada).`);
    }
    const lowerings = elementals
      .filter(n => LOWER_STATE[n.activation])
      .map(n => ({ n, saving: getElementalNodeCost(n, n.activation, missingMat) - getElementalNodeCost(n, LOWER_STATE[n.activation] as Activation, missingMat) }))
      .filter(x => x.saving > 0)
      .sort((a, b) => b.saving - a.saving);
    if (lowerings.length) {
      const { n, saving } = lowerings[0];
      tips.push(`Baixe ${runeName(n)} (${label(n)}) de ${STATE_NAMES[n.activation]} para ${STATE_NAMES[LOWER_STATE[n.activation] as Activation]}: −${fmt(saving)} de energia.`);
    }
    const charged = elementals.filter(n => getChargeMult(n) > 1).sort((a, b) => b.charge - a.charge)[0];
    if (charged) {
      tips.push(`Reduza a carga extra de ${label(charged)} (está em ${charged.charge}x).`);
    }
    const upgradable = active.find(n => n.shape === 'circle' || n.shape === 'triangle');
    if (upgradable) {
      // Selo ○ / Sal △ viram Salor ○+△ (Sobrecarga), que aguenta muito mais
      tips.push(`Troque ${label(upgradable)} (${shapeName(upgradable.shape)}) por <b>${shapeName('salor')}</b>: +${fmt(getShapeRange('salor').max - getShapeRange(upgradable.shape).max)} de capacidade.`);
    }
  } else if (level === 'carregado') {
    tips.push(stabilizers.length
      ? `Para ter margem, adicione mais 1 <b>${shapeChoices[0].name}</b> (+${fmt(shapeChoices[0].max)}) ligado ao fluxo.`
      : `Adicione um <b>Sal △</b> ligado ao fluxo para estabilizar: Selos ○ e Cols □ não seguram excesso de energia.`);
  } else if (level === 'fraco') {
    const raise = elementals.find(n => HIGHER_STATE[n.activation]);
    if (raise) tips.push(`Suba ${runeName(raise)} (${label(raise)}) para ${STATE_NAMES[HIGHER_STATE[raise.activation] as Activation]}.`);
    const big = active.filter(n => !n.rune && !isPrism(n)).sort((a, b) => getShapeRange(b.shape).min - getShapeRange(a.shape).min)[0];
    if (big) tips.push(`Remova ou troque ${label(big)} (${shapeName(big.shape)}), que pede muita energia mínima e está sem runa.`);
  } else if (level === 'estavel') {
    const raise = elementals
      .filter(n => HIGHER_STATE[n.activation])
      .map(n => ({ n, extra: getElementalNodeCost(n, HIGHER_STATE[n.activation] as Activation, missingMat) - getElementalNodeCost(n, n.activation, missingMat) }))
      .find(x => x.extra <= capacity - load);
    if (raise) {
      const needsSal = HIGHER_STATE[raise.n.activation] === 'instavel' && !m.nodes.some(n => n.shape === 'triangle' || n.shape === 'salor');
      tips.push(`Há folga: dá para subir ${runeName(raise.n)} (${label(raise.n)}) para ${STATE_NAMES[HIGHER_STATE[raise.n.activation] as Activation]} (+${fmt(raise.extra)} de energia) sem sobrecarregar${needsSal ? ' — no Extremo, adicione um Sal △ para estabilizar' : ''}.`);
    } else if (capacity - load > 3) {
      tips.push(`Há folga de ${fmt(capacity - load)}: dá para adicionar uma runa auxiliar (ex.: Direção ou Esfera) sem sobrecarregar.`);
    }
  } else if (level === 'inativo') {
    tips.push('Ligue um cabo saindo do Prisma (○ na borda dele) e um caminho que volte ao Prisma.');
  } else if (level === 'vazio') {
    tips.push('Bons exemplos para começar: <b>Bola de Fogo</b> (simples) e <b>Lança-Chamas</b> (avançado), no menu ★ Exemplos.');
  }
  if (flow.unreached.length && (level === 'sobrecarga' || level === 'explosao')) {
    tips.push('Formas sem cabo vindo do Prisma não ajudam a segurar energia: ligue-as ao fluxo.');
  }

  return { load, capacity, minimum, ratio, level, consequence: consequences[level], tips };
}
