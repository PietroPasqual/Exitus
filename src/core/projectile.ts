import { type Model } from './circles';
import type { FlowResult } from './flow';

// Projétil: une os formatos escolhidos num único objeto aerodinâmico.
// Recomendado: ser o último passo antes de voltar ao Prisma, ou vir logo depois dos formatos.

export interface ProjectileCheck {
  /** Projéteis que estão numa rota */
  used: string[];
  /** Projéteis fora da posição recomendada em todas as rotas em que aparecem */
  misplaced: string[];
}

export function checkProjectiles(m: Model, flow: FlowResult): ProjectileCheck {
  const byId = new Map(m.nodes.map(n => [n.id, n]));
  const projectiles = m.nodes.filter(n => n.rune === 'mod_projetil').map(n => n.id);
  const used: string[] = [];
  const misplaced: string[] = [];
  projectiles.forEach(id => {
    const spots: boolean[] = [];
    flow.perPrism.forEach(p => p.routes.forEach(route => {
      const i = route.indexOf(id);
      if (i <= 0) return;
      const next = byId.get(route[i + 1]);
      const prev = byId.get(route[i - 1]);
      const last = !!next && flow.perPrism.some(pp => pp.prism.id === next.id);
      const afterShape = !!prev && [prev.rune, ...(prev.inner ?? [])].some(r => r?.startsWith('forma_'));
      spots.push(last || afterShape);
    }));
    if (!spots.length) return;
    used.push(id);
    if (!spots.some(Boolean)) misplaced.push(id);
  });
  return { used, misplaced };
}
