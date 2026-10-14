import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { checkEstados } from '../src/core/estado';
import { analyzeFlow } from '../src/core/flow';
import { checkSer, checkToque } from '../src/core/structural';
import { getRuneType, RUNES } from '../src/data/runes';
import { cable, model, node, prism } from './helpers';

const opts = { specMode: 'simultaneous', missingMat: false } as const;

/** Prisma → a → b → … → Prisma, em linha */
function chain(runes: (string | null)[], matriz: string | null = null) {
  const nodes = [prism(matriz), ...runes.map((r, i) => node(`n${i}`, 'circle', Math.cos(i) * 170, Math.sin(i) * 170, r))];
  const ids = nodes.map(n => n.id);
  const conns = ids.map((id, i) => cable(id, ids[(i + 1) % ids.length]));
  return model(nodes, conns);
}

describe('Runas estruturais (Propriedade)', () => {
  it('Projétil, Toque, Ser e Estado são do tipo Estrutural', () => {
    ['mod_projetil', 'mod_toque', 'mod_ser', 'mod_estado'].forEach(id => expect(getRuneType(RUNES[id])).toBe('estrutural'));
    ['mod_orbita', 'mod_area', 'mod_ligacao', 'mod_intencao'].forEach(id => expect(getRuneType(RUNES[id])).toBe('acao'));
  });
});

describe('Toque', () => {
  it('no fim do ciclo: a magia inteira toca a superfície', () => {
    const m = chain(['fogo', 'forma_esfera', 'mod_toque']);
    const [t] = checkToque(m, analyzeFlow(m));
    expect(t.whole).toBe(true);
    expect(t.part).toEqual(['fogo', 'forma_esfera']);
    expect(t.nonPhysical).toEqual([]);
  });

  it('com a Vida mostra a utilidade (sem fator físico)', () => {
    const m = chain(['vida', 'mod_toque', 'dir_padrao']);
    const [t] = checkToque(m, analyzeFlow(m));
    expect(t.whole).toBe(false);
    expect(t.nonPhysical).toEqual(['vida']);
    const a = analyzeCircuit(m, opts);
    expect(a.logs.some(l => l.title === '☝ Toque' && l.text.includes('mostra a utilidade'))).toBe(true);
  });

  it('depois de um Ser, só a parte do novo conjunto toca', () => {
    const m = chain(['fogo', 'mod_ser', 'vida', 'mod_toque', 'dir_padrao']);
    const [t] = checkToque(m, analyzeFlow(m));
    expect(t.part).toEqual(['vida']);
  });
});

describe('Ser', () => {
  it('sem Ser, todos os objetos orbitam juntos (aviso)', () => {
    const m = chain(['fogo', 'forma_esfera', 'terra', 'forma_cubo', 'mod_orbita']);
    const s = checkSer(m, analyzeFlow(m));
    expect(s.groups).toEqual([]);
    expect(s.orbits[0]).toMatchObject({ separated: false, objects: ['fogo', 'forma_esfera', 'terra', 'forma_cubo'] });
    const a = analyzeCircuit(m, opts);
    expect(a.logs.some(l => l.title === '⧉ Ser' && l.text.includes('todos juntos'))).toBe(true);
  });

  it('com Ser, o conjunto anterior fica separado e a Órbita leva só o dela', () => {
    const m = chain(['fogo', 'forma_esfera', 'mod_ser', 'terra', 'forma_cubo', 'mod_orbita']);
    const s = checkSer(m, analyzeFlow(m));
    expect(s.groups).toEqual([{ ser: 'n2', runes: ['fogo', 'forma_esfera'] }]);
    expect(s.orbits[0]).toMatchObject({ separated: true, objects: ['terra', 'forma_cubo'] });
  });

  it('o Prisma com runa matriz entra no primeiro conjunto', () => {
    const m = chain(['forma_esfera', 'mod_ser', 'dir_padrao'], 'fogo');
    expect(checkSer(m, analyzeFlow(m)).groups[0].runes).toEqual(['fogo', 'forma_esfera']);
  });
});

describe('Estado: anteriores ou usadas ao mesmo tempo', () => {
  it('mantém também o que sai do mesmo ponto em paralelo', () => {
    // Prisma → Fogo → (Estado e Vento em paralelo) → Prisma
    const nodes = [prism(null), node('f', 'circle', 0, -170, 'fogo'), node('e', 'circle', 150, 80, 'mod_estado'), node('v', 'circle', -150, 80, 'vento')];
    const m = model(nodes, [cable('prism_center', 'f'), cable('f', 'e'), cable('f', 'v'), cable('e', 'prism_center'), cable('v', 'prism_center')]);
    const [u] = checkEstados(m, analyzeFlow(m));
    expect(u.kept).toEqual(['fogo']);
    expect(u.together).toEqual(['vento']);
    const a = analyzeCircuit(m, opts);
    expect(a.logs.find(l => l.title === '◈ Estado')?.text).toContain('ao mesmo tempo');
  });
});
