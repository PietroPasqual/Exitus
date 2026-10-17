import { RUNES } from '../data/runes';
import type { Being } from './appearance';

const list = (items: readonly string[]): string => items.join(', ').replace(/, ([^,]*)$/, ' e $1');
const name = (id: string): string => RUNES[id]?.name.split(' (')[0].split(' /')[0] ?? id;

/** Presentation only: a maintained, unshaped forward fire emission. */
export function isMaintainedFireJet(b: Being): boolean {
  return b.elements[0] === 'fogo' && b.estado && b.direction === 'forward'
    && b.placement === 'front' && !b.projectile && !b.orbit
    && !b.shapes.length && !b.intentForm && !b.intentGlyph;
}

/** Never infer exact fusion membership from the legacy merged flag. */
export function materialRelation(b: Being): string[] {
  if (!b.linked) return [];
  const groups = (b.materialFusion ?? []).filter(group => group.elements.length > 0);
  if (!groups.length) return [b.merged
    ? 'A Ligação une as partes; os materiais fundidos não estão detalhados'
    : 'A Ligação mantém as partes unidas, sem misturar os materiais'];
  const sentences = groups.map(group => group.elements.length === 1
    ? `As partes de ${name(group.elements[0])} se fundem pela Ligação`
    : `${list(group.elements.map(name))} se fundem pela Ligação`);
  const fused = new Set(groups.flatMap(group => [...group.elements]));
  const separate = b.elements.filter(element => !fused.has(element));
  if (separate.length) sentences.push(`${list(separate.map(name))} permanece${separate.length > 1 ? 'm' : ''} na composição, sem se fundir a esses grupos`);
  return sentences;
}
