import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { checkEstados } from '../src/core/estado';
import { analyzeFlow } from '../src/core/flow';
import { checkArea, checkIntencao, checkLigacao, checkSer, checkToque } from '../src/core/structural';
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
  it('as 8 runas de propriedade são do tipo Estrutural; as de Direção continuam separadas', () => {
    ['mod_projetil', 'mod_toque', 'mod_ser', 'mod_estado', 'mod_orbita', 'mod_area', 'mod_ligacao', 'mod_intencao']
      .forEach(id => expect(getRuneType(RUNES[id])).toBe('estrutural'));
    ['dir_padrao', 'dir_contraria'].forEach(id => expect(getRuneType(RUNES[id])).toBe('direcao'));
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

  it('com runas de conceito (Tempo, Movimento, Pressão…) mostra a utilidade', () => {
    ['tempo', 'movimento', 'pressao', 'caos', 'infinito', 'vazio', 'morte'].forEach(r => {
      const m = chain([r, 'mod_toque', 'dir_padrao']);
      expect(checkToque(m, analyzeFlow(m))[0].nonPhysical).toEqual([r]);
    });
    const m = chain(['fogo', 'mod_toque', 'dir_padrao']);
    expect(checkToque(m, analyzeFlow(m))[0].nonPhysical).toEqual([]);
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

describe('Ser e Órbita', () => {
  it('sem Ser, todos os objetos orbitam juntos, como um só ser (aviso)', () => {
    const m = chain(['fogo', 'forma_esfera', 'terra', 'forma_cubo', 'mod_orbita']);
    const s = checkSer(m, analyzeFlow(m));
    expect(s.groups).toEqual([]);
    expect(s.orbits[0]).toMatchObject({ separated: false, beings: [['fogo', 'forma_esfera', 'terra', 'forma_cubo']], spacing: 360, crowded: true });
    const a = analyzeCircuit(m, opts);
    expect(a.logs.find(l => l.title === '◎ Órbita')?.text).toContain('todos juntos');
  });

  it('com Ser, cada conjunto é um ser na órbita, divididos igualmente', () => {
    const m = chain(['fogo', 'forma_esfera', 'mod_ser', 'terra', 'forma_cubo', 'mod_ser', 'agua', 'forma_esfera', 'mod_orbita']);
    const s = checkSer(m, analyzeFlow(m));
    expect(s.groups.map(g => g.runes)).toEqual([['fogo', 'forma_esfera'], ['terra', 'forma_cubo']]);
    expect(s.orbits[0].separated).toBe(true);
    expect(s.orbits[0].beings).toEqual([['fogo', 'forma_esfera'], ['terra', 'forma_cubo'], ['agua', 'forma_esfera']]);
    expect(s.orbits[0].spacing).toBe(120);
    const a = analyzeCircuit(m, opts);
    expect(a.logs.find(l => l.title === '◎ Órbita')?.text).toContain('3 seres orbitam a magia, um a cada <strong>120°</strong>');
  });

  it('um objeto só (Água em Esfera) é um ser só, sem aviso', () => {
    const m = chain(['agua', 'forma_esfera', 'mod_orbita']);
    expect(checkSer(m, analyzeFlow(m)).orbits[0]).toMatchObject({ crowded: false, spacing: 360 });
    const a = analyzeCircuit(m, opts);
    expect(a.logs.find(l => l.title === '◎ Órbita')?.text).toContain('um ser orbita a magia');
  });

  it('o Prisma com runa matriz entra no primeiro conjunto', () => {
    const m = chain(['forma_esfera', 'mod_ser', 'dir_padrao'], 'fogo');
    expect(checkSer(m, analyzeFlow(m)).groups[0].runes).toEqual(['fogo', 'forma_esfera']);
  });
});

describe('Área', () => {
  it('a parte anterior vai para a superfície mais distante; com Espaço cria âncoras', () => {
    const m = chain(['espaco', 'forma_esfera', 'mod_area', 'dir_padrao']);
    const [t] = checkArea(m, analyzeFlow(m));
    expect(t).toMatchObject({ part: ['espaco', 'forma_esfera'], whole: false, withSpace: true });
    const a = analyzeCircuit(m, opts);
    expect(a.logs.find(l => l.title === '◌ Área')?.text).toContain('âncoras de ativação');
  });

  it('sem Espaço, não fala em âncoras', () => {
    const m = chain(['fogo', 'mod_area']);
    const [t] = checkArea(m, analyzeFlow(m));
    expect(t).toMatchObject({ whole: true, withSpace: false });
  });
});

describe('Ligação', () => {
  it('cola objetos sem misturar; com o Projétil, formato fixo', () => {
    const m = chain(['fogo', 'forma_esfera', 'terra', 'mod_ligacao', 'mod_projetil']);
    const [l] = checkLigacao(m, analyzeFlow(m));
    expect(l).toMatchObject({ bound: ['fogo', 'forma_esfera', 'terra'], merged: [], withProjectile: true });
  });

  it('na lança, cola o que corre ao mesmo tempo na rota em paralelo', async () => {
    const { modelOf } = await import('./helpers');
    const m = modelOf('m_lanca_so');
    const [l] = checkLigacao(m, analyzeFlow(m));
    expect(l.bound).toEqual(expect.arrayContaining(['forma_cubo', 'forma_piramide']));
    expect(l.together.length).toBe(l.bound.length);
    expect(l.withProjectile).toBe(true);
  });

  it('elementos que derivam do mesmo (Raio e Luz, da Matéria) se mesclam', () => {
    const m = chain(['raio', 'forma_esfera', 'luz', 'forma_cubo', 'mod_ligacao']);
    expect(checkLigacao(m, analyzeFlow(m))[0].merged).toEqual([{ family: 'materia', elements: ['raio', 'luz'] }]);
    const a = analyzeCircuit(m, opts);
    expect(a.logs.find(l => l.title === '⛓ Ligação')?.text).toContain('derivam da Matéria');
  });

  it('o Fogo também é da Matéria: Fogo e Raio se mesclam', () => {
    const m = chain(['fogo', 'forma_esfera', 'raio', 'forma_cubo', 'mod_ligacao']);
    expect(checkLigacao(m, analyzeFlow(m))[0].merged).toEqual([{ family: 'materia', elements: ['fogo', 'raio'] }]);
  });

  it('elementos de famílias diferentes (Terra e Vento) não se mesclam', () => {
    const m = chain(['terra', 'forma_esfera', 'vento', 'forma_cubo', 'mod_ligacao']);
    expect(checkLigacao(m, analyzeFlow(m))[0].merged).toEqual([]);
  });

  it('o mesmo elemento sem dois objetos não se mescla', () => {
    const m = chain(['terra', 'forma_cubo', 'terra', 'mod_ligacao']);
    expect(checkLigacao(m, analyzeFlow(m))[0].merged).toEqual([]);
  });

  it('o mesmo elemento em objetos diferentes se mescla', () => {
    const m = chain(['fogo', 'forma_esfera', 'fogo', 'forma_cubo', 'mod_ligacao']);
    const [l] = checkLigacao(m, analyzeFlow(m));
    expect(l.merged).toEqual([{ family: 'materia', elements: ['fogo'] }]);
    expect(l.withProjectile).toBe(false);
    const a = analyzeCircuit(m, opts);
    expect(a.logs.find(l => l.title === '⛓ Ligação')?.text).toContain('se mesclam');
  });
});

describe('Intenção', () => {
  it('vai para a runa anterior e mostra a palavra de vínculo', () => {
    const m = chain(['fogo', 'mod_intencao']);
    m.nodes.find(n => n.rune === 'mod_intencao')!.bond = 'Fênix';
    const [t] = checkIntencao(m, analyzeFlow(m));
    expect(t).toMatchObject({ target: 'fogo', bond: 'Fênix' });
    const a = analyzeCircuit(m, opts);
    expect(a.logs.find(l => l.title === '✦ Intenção')?.text).toContain('«Fênix»');
  });

  it('sem palavra, avisa para escolher uma', () => {
    const m = chain(['mod_intencao', 'fogo']);
    const [t] = checkIntencao(m, analyzeFlow(m));
    expect(t.target).toBeNull();
    const a = analyzeCircuit(m, opts);
    expect(a.logs.find(l => l.title === '✦ Intenção')?.text).toContain('sem palavra de vínculo');
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
