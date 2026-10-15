import { getRuneType, RUNES } from '../data/runes';
import { CALC } from '../data/rules';
import { SHAPE_META, shapeName } from '../data/shapes';
import { analyzeCircles, circleHasInnerSource, endpointNode, fedThroughRing, contains, hasNestedCircles, circleNumber, getNodeCircles, hasPrismShape, getNodeShortLabel, isPrism, releasesEnergy, type CirclePair, type Model } from './circles';
import { getChargeMult, getElementalNodeCost } from './energy';
import { analyzeFlow, type FlowResult, type PrismFlow } from './flow';
import { escapeHtml, fmt, uniq } from './format';
import { checkEstados } from './estado';
import { checkProjectiles } from './projectile';
import { checkArea, checkIntencao, checkLigacao, checkSer, checkToque, type SurfaceUse } from './structural';
import { analyzeLoad, type LoadLevel, type LoadResult } from './load';
import type { ConnectionMode, Connection, MagicNode, SpellInfo } from './types';

export interface AnalysisOptions {
  /** Simultâneo (refino) ou Sequencial (expansão) */
  specMode: ConnectionMode;
  /** Matéria faltante no ambiente (a runa cria artificialmente, custo maior) */
  missingMat: boolean;
  spellInfo?: SpellInfo | null;
}

export type BadgeKind = 'ok' | 'warn' | 'danger';

export interface LogEntry {
  title: string;
  /** HTML (já escapado onde vem de fora) */
  text: string;
}

export interface CircuitAnalysis {
  flow: FlowResult;
  load: LoadResult;
  circles: { pairs: CirclePair[]; crossing: Connection[] };
  metrics: {
    power: string; powerSub: string;
    cost: string; costSub: string;
    intensity: string; intensitySub: string;
    volume: string; volumeSub: string;
  };
  badge: { kind: BadgeKind; text: string };
  /** 1º círculo; 2º quando há magia dentro de um Selo/Col */
  tier: Tier;
  /** Lista de níveis alcançados (como um check-list): 2º, 2,5º, 3º */
  tiers: Tier[];
  loadView: { value: string; sub: string; chip: string; chipLevel: BadgeKind; color: string; fill: number };
  logs: LogEntry[];
}

const LEVEL_VIEW: Record<LoadLevel, { text: string; color: string; chip: BadgeKind }> = {
  inativo: { text: 'Não funciona', color: 'var(--danger)', chip: 'danger' },
  vazio: { text: 'Sem energia', color: 'var(--text-muted)', chip: 'ok' },
  fraco: { text: 'Fraco', color: 'var(--warning)', chip: 'warn' },
  estavel: { text: 'Estável', color: 'var(--success)', chip: 'ok' },
  carregado: { text: 'Perto do limite', color: 'var(--warning)', chip: 'warn' },
  sobrecarga: { text: 'Sobrecarregado (Sal △ segura)', color: 'var(--warning)', chip: 'warn' },
  explosao: { text: '💥 Explode', color: 'var(--danger)', chip: 'danger' }
};

/** Analisa o círculo inteiro: fluxo, energia, carga, selo de estado e a leitura em texto */
export function analyzeCircuit(m: Model, opts: AnalysisOptions): CircuitAnalysis {
  const { specMode, missingMat } = opts;
  const label = (id: string): string => getNodeShortLabel(m, id);

  // Sem o Prisma nada funciona: só contam as runas que recebem energia de um Prisma com ciclo fechado
  const flow = analyzeFlow(m);
  const workingNodes = m.nodes.filter(n => flow.working.has(n.id));
  const runeOf = (n: MagicNode) => RUNES[n.rune as string];
  const elementalNodes = workingNodes.filter(n => n.rune && RUNES[n.rune]?.category === 'elemental');
  const shapeRunes = workingNodes.filter(n => n.rune && RUNES[n.rune]?.category === 'shape');
  const modRunes = workingNodes.filter(n => n.rune && RUNES[n.rune]?.category === 'mod');

  const hasCircleRelease = m.nodes.some(n => n.shape === 'circle' || n.shape === 'salor' || n.shape === 'corp');
  const hasTriangleStabilizer = workingNodes.some(n => n.shape === 'triangle' || n.shape === 'salor');
  const starNodes = m.nodes.filter(n => n.shape === 'star');
  const unstableNodes = workingNodes.filter(n => n.activation === 'instavel' && n.rune);

  // Runa principal: a do Prisma central se for elemental; senão a primeira elemental ativa
  const prismNode = m.nodes[0];
  const primaryNode: MagicNode | null = (flow.working.has(prismNode.id) && prismNode.rune && RUNES[prismNode.rune]?.category === 'elemental')
    ? prismNode
    : (elementalNodes[0] || null);

  let totalCost = 0;
  let basePower = 0;
  let auxPowerSum = 0;
  let nElemental = 0;

  elementalNodes.forEach(n => {
    const stats = runeOf(n).stats as NonNullable<ReturnType<typeof runeOf>['stats']>;
    const st = stats[n.activation] || stats.ativacao;
    const chargeMult = getChargeMult(n);
    const nodePower = st.power * chargeMult;
    totalCost += getElementalNodeCost(n, n.activation, missingMat);
    nElemental += chargeMult;
    if (primaryNode && n.id === primaryNode.id) basePower += nodePower;
    else auxPowerSum += nodePower;
  });

  // Runas de forma e de ação também gastam um pouco
  [...shapeRunes, ...modRunes].forEach(n => {
    totalCost += CALC.custoRunaApoio * (runeOf(n).costMod || 1.0);
  });

  // Poder total = Principal + (50% das auxiliares; Terra 0% a menos que haja uma Estrela sobrepositora)
  let auxFactor = primaryNode ? (runeOf(primaryNode).auxFactor ?? CALC.fatorAuxiliar) : CALC.fatorAuxiliar;
  if (starNodes.length > 0 && auxFactor === 0) auxFactor = CALC.fatorAuxiliar;
  const combinedPower = basePower + (auxPowerSum * auxFactor);

  // Bônus de especialização (card do Fogo): Simultâneo 0,9 + N×0,1; Sequencial 1,8 + N×0,2
  const effectivePower = nElemental <= 1
    ? combinedPower
    : (specMode === 'simultaneous'
        ? combinedPower * (CALC.simultaneoBase + nElemental * CALC.simultaneoPorRuna)
        : combinedPower * (CALC.sequencialBase + nElemental * CALC.sequencialPorRuna));

  // Métricas físicas
  let intensity = '—';
  let intensitySub = 'Temp. / Força / Densidade';
  let volume = '—';
  let volumeSub = 'Escala de manifestação';

  if (primaryNode) {
    const pRune = runeOf(primaryNode);
    const pPower = specMode === 'simultaneous' ? effectivePower : basePower;
    const vPower = specMode === 'sequential' ? effectivePower : combinedPower;

    if (pRune.id === 'fogo') {
      // 1 Poder = 20°C e 0,3 cm³
      intensity = `${Math.round(pPower * CALC.fogoGraus)} °C`;
      intensitySub = specMode === 'simultaneous' ? 'Foco: Refino Térmico' : 'Temperatura Base';
      volume = vPower > 50 ? `${(vPower * CALC.fogoVolume).toFixed(1)} dm³` : `${(vPower * CALC.fogoVolume).toFixed(1)} cm³`;
      volumeSub = specMode === 'sequential' ? 'Foco: Expansão Volumétrica' : 'Volume de Chama';
    } else if (pRune.id === 'vento') {
      const reach = specMode === 'sequential' ? (vPower * CALC.ventoAlcance).toFixed(1) : (primaryNode.activation === 'perfeito' ? 15 : 10);
      intensity = `Força ${Math.round(pPower * CALC.ventoForca)}`;
      intensitySub = `Dano base +${Math.round(effectivePower)}`;
      volume = `${reach} m`;
      volumeSub = 'Alcance da corrente de ar';
    } else if (pRune.id === 'terra') {
      intensity = `+${Math.round(pPower * CALC.terraDefesa)} Def`;
      intensitySub = 'Densidade / Rigidez';
      volume = `${(vPower * CALC.terraVolume).toFixed(1)} m³`;
      volumeSub = 'Volume de Solo/Rocha';
    } else if (pRune.id === 'agua') {
      intensity = `${Math.min(80, pPower * CALC.aguaDiluicao).toFixed(1)}% Diluição`;
      intensitySub = 'Potência de Fluido';
      volume = `${(vPower * CALC.aguaVolume).toFixed(1)} L`;
      volumeSub = 'Volume Hídrico';
    } else {
      intensity = `${effectivePower.toFixed(1)} Pwr`;
      intensitySub = `Elemento: ${pRune.name}`;
      volume = `${(vPower * CALC.outrosVolume).toFixed(1)} un.`;
      volumeSub = 'Escala de Efeito';
    }
  }

  let powerSub = nElemental > 1 ? `Comb.: ${combinedPower.toFixed(1)} (${nElemental} cargas)` : 'Poder Base da Runa';
  let costSub = missingMat ? 'Inclui taxa de Matéria Faltante' : 'Consumo padrão de Mana';
  if (!flow.working.size) {
    powerSub = 'Não funciona: o Prisma não fecha o ciclo';
    costSub = 'Sem o Prisma, nada funciona';
  }

  // ---------- Selo de estado ----------
  const lo = analyzeLoad(m, totalCost, flow, missingMat, primaryNode);
  const circ = analyzeCircles(m);
  const squareOut = m.connections.filter(c => !releasesEnergy(m, c.from));
  const multi = m.circles.length > 1;
  const prismNames = (list: PrismFlow[]): string => list.map(x => label(x.prism.id)).join(', ');
  const notStarting = flow.perPrism.filter(x => !x.starts);
  const notClosing = flow.perPrism.filter(x => x.starts && !x.closes);

  // Regra: todo Col □ e Selo ○ sempre tem uma fonte (mesmo que o cabo só vá e volte)
  const noSource = flow.unreached.filter(n => n.shape === 'square' || n.shape === 'circle');
  // Cada círculo precisa de uma fonte: o Prisma do centro ou o Prisma de uma magia dentro de um Selo
  const circlesNoSource = m.circles.filter(c => {
    const center = m.nodes.find(n => isPrism(n) && n.circleId === c.id);
    return !(center && hasPrismShape(center)) && !circleHasInnerSource(m, c.id) && !fedThroughRing(m, c.id);
  });
  const needsEnvelope = circ.links.length > 0 && !m.envelope;
  let badge: CircuitAnalysis['badge'];
  if (circlesNoSource.length) badge = { kind: 'danger', text: `✕ Círculo sem Fonte (${circlesNoSource.map(c => circleNumber(m, c.id)).join(', ')})` };
  else if (notStarting.length) badge = { kind: 'danger', text: multi ? `✕ Não Inicia: ${prismNames(notStarting)}` : '✕ Não Inicia no Prisma' };
  else if (notClosing.length) badge = { kind: 'danger', text: multi ? `✕ Fluxo Aberto: ${prismNames(notClosing)}` : '✕ Fluxo Aberto (Não Volta ao Prisma)' };
  else if (squareOut.length) badge = { kind: 'danger', text: '✕ Quadrado □ Não Solta Energia' };
  else if (circ.crossing.length) badge = { kind: 'danger', text: '✕ Cabo Cruza Círculos sem Estrela' };
  else if (lo.level === 'explosao') badge = { kind: 'danger', text: '💥 Explode (Sobrecarga)' };
  else if (lo.level === 'sobrecarga') badge = { kind: 'warn', text: '⚠ Sobrecarregado (Sal △ segura)' };
  else if (unstableNodes.length > 0 && !hasTriangleStabilizer) badge = { kind: 'danger', text: '⚠ Instável (Adicione Triângulo △)' };
  else if (noSource.length) badge = { kind: 'danger', text: '✕ Forma sem Fonte (□/○ precisa do Prisma)' };
  else if (!hasCircleRelease && m.nodes.length > 1) badge = { kind: 'warn', text: 'Sem Saída (Adicione Círculo ○)' };
  else if (flow.unreached.length > 0 || flow.stuck.length > 0) badge = { kind: 'warn', text: '⚠ Fluxo Fechado c/ Nós Soltos' };
  else if (circ.pairs.some(pr => !pr.star)) badge = { kind: 'warn', text: '⚠ Círculos Sobrepostos sem Estrela' };
  else if (circ.pairs.some(pr => !pr.complete)) badge = { kind: 'warn', text: '⚠ Falta a 2ª Estrela (uma para cada círculo)' };
  else if (needsEnvelope) badge = { kind: 'warn', text: '⚠ Falta o Círculo em Volta de Tudo' };
  else if (lo.level === 'fraco') badge = { kind: 'warn', text: '⚠ Energia Insuficiente' };
  else badge = { kind: 'ok', text: '✓ Circuito Estável' };

  // ---------- Medidor de carga ----------
  const view = LEVEL_VIEW[lo.level];
  const pct = Math.round(lo.ratio * 100);
  const loadView: CircuitAnalysis['loadView'] = {
    value: lo.load > 0 ? `${pct}% · ${view.text}` : view.text,
    sub: `Energia ${fmt(lo.load)} de ${fmt(lo.capacity)} que as formas ligadas aguentam (mínimo para ativar: ${fmt(lo.minimum)}).`,
    chip: lo.load > 0 ? `Carga ${pct}% · ${view.text}` : `Carga · ${view.text}`,
    chipLevel: view.chip,
    color: view.color,
    fill: Math.min(lo.ratio / 1.5, 1) * 100
  };

  // ---------- Leitura do círculo ----------
  const logs: LogEntry[] = [];
  if (opts.spellInfo) {
    logs.push({ title: `📜 ${escapeHtml(opts.spellInfo.name)}`, text: escapeHtml(opts.spellInfo.desc) });
    // Magias Falhas: a versão antiga, guardada como estava, com o que estava errado
    if (opts.spellInfo.errors?.length) {
      logs.push({
        title: '✕ Magia Falha',
        text: 'Esta é a versão antiga, guardada como estava. O que estava errado:<br/>'
          + opts.spellInfo.errors.map(e => `• <span style="color:var(--danger);">${escapeHtml(e)}</span>`).join('<br/>')
          + '<br/><em>A versão corrigida está no Livro de Magias.</em>'
      });
    }
  }

  logs.push({
    title: '⚡ Carga e Sobrecarga — o que aconteceria',
    text: (lo.level === 'explosao' || lo.level === 'sobrecarga'
      ? `<span style="color:var(--danger);">${lo.consequence}</span>`
      : lo.consequence) +
      (lo.tips.length ? `<br/><strong>💡 Sugestões:</strong>• ${lo.tips.join('<br/>• ')}` : '')
  });

  // Fluxo de energia: Prisma ➔ … ➔ Prisma
  const nodeList = (arr: MagicNode[]): string => arr.map(n => label(n.id)).join(', ');
  const flowLines: string[] = [];
  const which = (list: PrismFlow[]): string => multi ? ` (${prismNames(list)})` : '';
  if (notStarting.length) {
    flowLines.push(`<span style="color:var(--danger);"><strong>✕ A magia não inicia no Prisma${which(notStarting)}.</strong> Crie um cabo saindo do Prisma (o ○ fica na borda do Prisma).</span>`);
  }
  if (notClosing.length) {
    flowLines.push(`<span style="color:var(--danger);"><strong>✕ A magia não finaliza no Prisma${which(notClosing)}.</strong> Nenhum caminho leva a energia de volta. Ligue o último nó ao Prisma (○ no nó, ponta sem ○ no Prisma).</span>`);
  }
  if (!notStarting.length && !notClosing.length) {
    flowLines.push(multi
      ? '<strong>✓ Ciclos fechados:</strong> em cada círculo a energia sai do seu Prisma e retorna a ele.'
      : '<strong>✓ Ciclo fechado no Prisma:</strong> a energia sai do Prisma, percorre o círculo e retorna a ele.');
  }
  // Rota exata da energia (até 3 por Prisma)
  const stepName = (id: string): string => {
    const n = m.nodes.find(x => x.id === id);
    if (!n) return `◯ ${label(id)}`;
    if (isPrism(n)) return `${label(id)}${hasPrismShape(n) ? ' ◇' : ''}`;
    const what = n.rune ? RUNES[n.rune].name.split(' (')[0] : shapeName(n.shape);
    return `${label(id)} (${what})`;
  };
  flow.perPrism.filter(x => x.routes.length).forEach(x => {
    const shown = x.routes.slice(0, 3).map(r => r.map(stepName).join(' ○──► '));
    const extra = x.routes.length > 3 ? ` <small>(+${x.routes.length - 3} rotas)</small>` : '';
    flowLines.push(`<b>Rota${shown.length > 1 ? 's' : ''}${multi ? ' do ' + label(x.prism.id) : ''}:</b><br/>${shown.join('<br/>')}${extra}`);
  });
  if (squareOut.length) {
    flowLines.push(`<span style="color:var(--danger);"><strong>✕ O Quadrado □ só pega:</strong> ${squareOut.map(c => `${label(c.from)} ➔ ${label(c.to)}`).join(', ')} sai de um Quadrado e não leva energia. Troque a forma por um Selo ○ (pega e solta) ou apague o cabo.</span>`);
  }
  if (unstableNodes.length) {
    flowLines.push(hasTriangleStabilizer
      ? `<strong>△ Equilíbrio:</strong> o Sal △ neutraliza o risco de colapso de ${nodeList(unstableNodes)} no Extremo.`
      : `<span style="color:var(--danger);"><strong>⚠ Risco de colapso:</strong> ${nodeList(unstableNodes)} no Extremo (Instável) sem Sal △. Ligue um Sal △ ao fluxo para neutralizar.</span>`);
  }
  if (flow.unreached.length) {
    flowLines.push(`<strong>Sem energia:</strong> ${nodeList(flow.unreached)} — nenhum cabo vindo do Prisma chega a este(s) nó(s).`);
  }
  if (flow.stuck.length) {
    flowLines.push(`<strong>Energia presa:</strong> ${nodeList(flow.stuck)} — recebe(m) energia mas não tem(têm) caminho de volta ao Prisma.`);
  }
  if (flow.retained.length) {
    flowLines.push(`<strong>Retenção (Col/Corp):</strong> ${nodeList(flow.retained)} — pega(m) a energia e sustenta(m) o efeito ou a condição ativa continuamente.`);
  }
  logs.push({ title: '⟳ Fluxo de Energia (Prisma ➔ … ➔ Prisma)', text: flowLines.join('<br/>') });

  if (noSource.length) {
    logs.push({
      title: '✕ Forma sem Fonte',
      text: `${nodeList(noSource)} — todo Col □ e Selo ○ precisa receber energia de um Prisma (fonte), nem que seja só indo e voltando (Prisma ➔ forma ➔ Prisma).`
    });
  }

  // Magia dentro da magia
  const nested = m.nodes.filter(n => n.inner?.length);
  if (nested.length) {
    const runeName = (id: string): string => escapeHtml(RUNES[id]?.name ?? id);
    logs.push({
      title: '◉ Magia de 2º Círculo — magias dentro de Selos',
      text: 'Tem magia dentro de magia, por isso é uma <strong>magia de 2º círculo</strong>. O Selo só delimita a função colocada lá dentro, e a magia de dentro também tem a sua fonte: um pequeno Prisma ◇.<br/>' + nested.map(n =>
        `<strong>${escapeHtml(getNodeShortLabel(m, n.id))}:</strong> ${[n.rune, ...(n.inner ?? [])].filter((r): r is string => !!r).map(runeName).join(' ＋ ')}`).join('<br/>')
    });
  }

  const estados = checkEstados(m, flow);
  if (estados.length) {
    const runeName = (id: string): string => escapeHtml(RUNES[id]?.name.split(' (')[0] ?? id);
    logs.push({
      title: '◈ Estado',
      text: 'Mantém o estado das runas anteriores a ele, ou usadas ao mesmo tempo, o mais perto de estável ou funcional (ex.: o Fogo não é apagado pelo vento nem pela umidade).<br/>'
        + estados.map(e => `<strong>${escapeHtml(label(e.id))}:</strong> ${e.kept.length || e.together.length
          ? [e.kept.length ? 'mantém ' + [...new Set(e.kept)].map(runeName).join(', ') : '', e.together.length ? `${e.kept.length ? 'e, ao mesmo tempo, ' : 'mantém, ao mesmo tempo, '}${e.together.map(runeName).join(', ')}` : ''].filter(Boolean).join(' ')
          : 'não há objeto nem elemento antes dele, nem ao mesmo tempo, para manter'}`
          + (e.wellPlaced ? '' : ' — <span style="color:var(--warning);">o recomendado é usar o Estado logo depois de um conjunto de objetos (formatos) ou de elementos.</span>')).join('<br/>')
    });
  }

  const FAMILY_NAMES: Record<string, string> = { materia: 'da Matéria', gravidade: 'da Gravidade', tempo: 'do Tempo', espaco: 'do Espaço' };
  const runeList = (ids: string[]): string => ids.map(id => escapeHtml(RUNES[id]?.name.split(' (')[0] ?? id)).join(', ');

  const nodeLabel = (id: string): string => escapeHtml(getNodeShortLabel(m, id));
  /** verb: "toca a superfície"; empty: o que dizer quando não há nada antes */
  const surfaceLine = (t: SurfaceUse, verb: string, empty: string): string => `<strong>${nodeLabel(t.node)}:</strong> `
    + (t.whole ? `é o último passo: <strong>a magia inteira</strong> ${verb}` : t.part.length ? `${verb}: ${runeList(t.part)}` : empty);

  const toques = checkToque(m, flow);
  if (toques.length) {
    logs.push({
      title: '☝ Toque',
      text: 'A magia, ou a parte anterior ao Toque, interage direto com a <strong>superfície mais próxima</strong> (quase como se tocasse).<br/>'
        + toques.map(t => surfaceLine(t, 'toca a superfície', 'não há nada antes dele (desde o último Ser) para tocar a superfície')
          + (t.nonPhysical.length ? ` — <span style="color:var(--success);">✓ aqui ele mostra a utilidade: ${runeList(t.nonPhysical)} ${t.nonPhysical.length > 1 ? 'são runas' : 'é runa'} de conceito, sem forma física — o Toque leva os efeitos sobrenaturais à superfície.</span>` : '')).join('<br/>')
    });
  }

  const areas = checkArea(m, flow);
  if (areas.length) {
    logs.push({
      title: '◌ Área',
      text: 'A magia, ou a parte anterior à Área, interage direto com a <strong>superfície mais distante</strong> (quase como se reprojetada).<br/>'
        + areas.map(t => surfaceLine(t, 'vai para a superfície mais distante', 'não há nada antes dela (desde o último Ser) para reprojetar')
          + (t.withSpace ? ' — <span style="color:var(--success);">✓ com o Espaço, cria <strong>âncoras de ativação</strong>.</span>' : '')).join('<br/>')
    });
  }

  const ligacoes = checkLigacao(m, flow);
  if (ligacoes.length) {
    logs.push({
      title: '⛓ Ligação',
      text: 'Liga objetos ou elementos entre si, <strong>sem misturar</strong>, como uma cola: eles não se separam.<br/>'
        + ligacoes.map(l => `<strong>${nodeLabel(l.node)}:</strong> `
          + (l.bound.length > 1 ? `cola ${runeList(l.bound)}${l.together.length ? ` (${l.together.length === l.bound.length ? 'todos' : runeList(l.together)} ao mesmo tempo, na rota em paralelo)` : ''}` : l.bound.length ? `só há ${runeList(l.bound)} para ligar — a Ligação junta dois ou mais objetos ou elementos` : 'não há objeto nem elemento antes dela (desde o último Ser), nem ao mesmo tempo, para ligar')
          + l.merged.map(g => `; ${g.elements.length > 1 ? `${runeList(g.elements)} derivam ${FAMILY_NAMES[g.family] ?? 'do mesmo elemento'}` : `${runeList(g.elements)} está em mais de um objeto`}: <strong>esses objetos se mesclam</strong>`).join('')
          + (l.withProjectile ? ' — <span style="color:var(--success);">✓ com o Projétil: o formato fica fixo como um único objeto.</span>' : ' — <span style="color:var(--text-muted);">recomendado usar com o Projétil, para manter o formato fixo como um único objeto.</span>')).join('<br/>')
    });
  }

  const ser = checkSer(m, flow);
  if (ser.groups.length || ser.orbits.length) {
    const lines = ser.groups.map((g, i) => `<strong>Conjunto ${i + 1}</strong> (fechado pelo Ser em ${nodeLabel(g.ser)}): ${g.runes.length ? runeList(g.runes) : '<em>vazio — não há runas antes dele</em>'}`);
    const orbitLines = ser.orbits.map(o => {
      const deg = Number.isInteger(o.spacing) ? `${o.spacing}°` : `${o.spacing.toFixed(1).replace('.', ',')}°`;
      if (!o.beings.length) return `<strong>${nodeLabel(o.node)}:</strong> nada ligado à linha da Órbita ainda (ponha objetos ou elementos no caminho dela).`;
      if (o.beings.length === 1) {
        return `<strong>${nodeLabel(o.node)}:</strong> ${o.crowded
          ? `${runeList(o.beings[0])} orbitam a magia <strong>todos juntos, como um só ser</strong> — <span style="color:var(--warning);">são objetos diferentes: use o Ser para separá-los em seres diferentes.</span>`
          : `um ser orbita a magia (${runeList(o.beings[0])}).`}`;
      }
      return `<strong>${nodeLabel(o.node)}:</strong> ${o.beings.length} seres orbitam a magia, um a cada <strong>${deg}</strong> da circunferência: `
        + o.beings.map(b => `(${runeList(b)})`).join(', ') + '.';
    });
    if (ser.groups.length) {
      logs.push({
        title: '⧉ Ser',
        text: 'As runas anteriores ao Ser viram um conjunto (um ser): separa objetos ou elementos para que sejam, ou não, afetados por outra runa.<br/>' + lines.join('<br/>')
      });
    }
    if (orbitLines.length) {
      logs.push({
        title: '◎ Órbita',
        text: 'Uma linha invisível, sempre paralela ao círculo mágico: tudo ligado a ela orbita a magia, com os seres divididos igualmente pela circunferência.<br/>' + orbitLines.join('<br/>')
      });
    }
  }

  const intents = checkIntencao(m, flow);
  if (intents.length) {
    logs.push({
      title: '✦ Intenção',
      text: 'Adiciona a intenção de quem usa à runa anterior ou ao círculo anterior, alterando levemente suas propriedades. A palavra ou os números de vínculo não podem ser desvinculados.<br/>'
        + intents.map(t => `<strong>${nodeLabel(t.node)}:</strong> `
          + (t.target ? `intenção em ${runeList([t.target])}` : t.circle ? `intenção no círculo anterior (${escapeHtml(t.circle)})` : 'intenção no círculo mágico')
          + (t.bond ? ` — vínculo: <strong>«${escapeHtml(t.bond)}»</strong> 🔒` : ' — <span style="color:var(--warning);">sem palavra de vínculo: escolha uma no painel do Nó.</span>')).join('<br/>')
    });
  }

  const proj = checkProjectiles(m, flow);
  if (proj.used.length) {
    const names = (ids: string[]): string => ids.map(id => getNodeShortLabel(m, id)).join(', ');
    logs.push({
      title: '➶ Projétil',
      text: 'Une os formatos escolhidos num único objeto aerodinâmico; com um contexto, tenta recriá-lo com os formatos disponíveis.<br/>'
        + (proj.misplaced.length
          ? `<strong>Posição:</strong> ${names(proj.misplaced)} não está no lugar recomendado — o Projétil deve ser o último passo antes de voltar ao Prisma ou vir logo depois dos formatos (Esfera, Cubo, Paralelepípedo, Pirâmide).`
          : '<strong>✓ Posição recomendada:</strong> último passo do ciclo ou logo depois dos formatos.')
    });
  }

  if (multi) {
    const circLines: string[] = [];
    circ.pairs.forEach(pr => {
      const names = `${circleNumber(m, pr.a.id)} e ${circleNumber(m, pr.b.id)}`;
      circLines.push(pr.star && !pr.complete
        ? `<b>⚠ Círculos ${names} unidos só pela metade:</b> para sobrepor certinho são <b>duas Estrelas uma em cima da outra, uma para cada círculo</b>. Marque "Estrela dupla" no painel da forma ${label(pr.star.id)}.`
        : pr.star
        ? `<b>✓ Círculos ${names} unidos</b> pela Estrela dupla ${label(pr.star.id)} (uma Estrela para cada círculo): a energia pode passar de um para o outro por ela.`
        : `<span style="color:var(--warning);"><b>⚠ Círculos ${names} se sobrepõem sem Estrela:</b> não estão unidos. Coloque uma Estrela ☆ na área de sobreposição.</span>`);
    });
    const cname = (id: string): string => {
      const c = m.circles.find(x => x.id === id);
      return `${circleNumber(m, id)}${c?.name ? ` (${escapeHtml(c.name)})` : ''}`;
    };
    if (circ.links.length) {
      const owner = (nodeId: string): string => {
        const n = endpointNode(m, nodeId);
        return n ? (getNodeCircles(m, n)[0] ?? '') : '';
      };
      circLines.push(`<b>✓ Círculos separados ligados por cabo (3º círculo):</b><br/>${circ.links.map(c => `${label(c.from)} do círculo ${cname(owner(c.from))} ➔ ${label(c.to)} do círculo ${cname(owner(c.to))}`).join('<br/>')}`);
      circLines.push(m.envelope
        ? '<b>✓ Círculo em volta de tudo:</b> envolve a magia principal e os círculos ligados a ela.'
        : `<span style="color:var(--warning);"><b>⚠ Falta o círculo em volta de tudo:</b> quando há círculos separados ligados, um círculo envolve todos eles. Ligue "Círculo em volta de tudo" em Ligações &amp; Anel.</span>`);
    } else if (!circ.pairs.length && !hasNestedCircles(m)) {
      circLines.push('Os círculos não se sobrepõem nem estão ligados por cabo: cada um é uma magia separada. Ligue uma forma de um círculo a uma forma de outro, ou arraste o Prisma para sobrepor.');
    }
    m.circles.forEach(outer => {
      const inside = m.circles.filter(c => contains(outer, c) && !m.circles.some(mid => contains(outer, mid) && contains(mid, c)));
      if (inside.length) circLines.push(`<b>◎ Círculo ${cname(outer.id)} com ${inside.length} círculo(s) dentro</b> (${inside.map(c => cname(c.id)).join(', ')}): magia dentro da magia (2º círculo), cada um com a sua fonte.`);
    });
    if (circ.nestedLinks.length) {
      circLines.push(`<b>✓ Cabos entre círculos de dentro e de fora:</b> ${circ.nestedLinks.map(c => `${label(c.from)} ➔ ${label(c.to)}`).join(', ')}.`);
    }
    m.circles.filter(c => c.frame === 'square').forEach(c => {
      circLines.push(`<b>□ Círculo ${cname(c.id)} dentro de um quadrado:</b> efeito sustentado e <b>não inerente</b> — fica preso à magia, mas não faz parte dela.`);
    });
    if (circlesNoSource.length) {
      circLines.push(`<span style="color:var(--danger);"><b>✕ Sem fonte:</b> círculo ${circlesNoSource.map(c => cname(c.id)).join(', ')} — o centro não é um Prisma, não há magia dentro de Selo (com seu pequeno Prisma) e nenhum cabo chega ao anel dele.</span>`);
    }
    if (circ.crossing.length) {
      circLines.push(`<span style="color:var(--danger);"><b>✕ Cabo cruzando círculos:</b> ${circ.crossing.map(c => `${label(c.from)} ➔ ${label(c.to)}`).join(', ')} — a energia só passa de um círculo para outro através da Estrela na sobreposição.</span>`);
    }
    logs.push({ title: circ.links.length || hasNestedCircles(m) ? '◎ Círculos da Magia' : '◎ Círculos Sobrepostos', text: circLines.join('<br/>') });
  }

  // Prisma central
  if (prismNode.rune) {
    const pr = runeOf(prismNode);
    logs.push({
      title: `◇ Prisma Central (Fonte): ${pr.name}`,
      text: `O Prisma irradia diretamente a matriz de ${pr.name} em estado de ${prismNode.activation.toUpperCase()} para ${m.connections.filter(c => c.from === 'prism_center' || c.to === 'prism_center').length} conexão(ões).`
    });
  } else {
    logs.push({
      title: `◇ Prisma Central (Fonte de Mana Pura)`,
      text: `O Prisma atua como fonte neutra no centro, alimentando as runas posicionadas nos nós periféricos.`
    });
  }

  // Formas e índices compostos
  const totalShapeFactor = m.nodes.reduce((acc, n) => acc + (SHAPE_META[n.shape]?.factor || 1.0), 0);
  const shapeBreakdown = m.nodes.map(n => SHAPE_META[n.shape]?.short || n.shape).join(' + ');
  const compositeNodes = m.nodes.filter(n => ['corp', 'salor', 'redor'].includes(n.shape));
  let structText = `<strong>Índice Geométrico Acumulado: ${totalShapeFactor.toFixed(1)}</strong> (${shapeBreakdown}). `;
  if (compositeNodes.length > 0) {
    const compDesc = compositeNodes.map(n => {
      if (n.shape === 'corp') return '<strong>Corp (◇+□ = 2,4)</strong>: Restrição (Entrada/Bloqueio + Saída/Liberação)';
      if (n.shape === 'salor') return '<strong>Salor (○+△ = 15,5)</strong>: Sobrecarga (Estabilizador/Medidor + Fortificador/Triplicador)';
      if (n.shape === 'redor') return '<strong>Redor (⬠+☆ = 33,3)</strong>: Absorvedor (Comparador/Capacitor + Sobrepositor/Carregador)';
      return '';
    }).join('; ');
    structText += `<br/>• Formas Compostas Ativas: ${compDesc}.`;
  }
  logs.push({ title: `Arquitetura de Formas (Core / Selo / Sal / Rad / Red)`, text: structText });

  // Forma, ação e direção
  const shapeNames = uniq(shapeRunes.map(n => runeOf(n).name));
  const structNames = uniq(modRunes.filter(n => getRuneType(runeOf(n)) === 'estrutural').map(n => runeOf(n).name));
  const directions = uniq(modRunes.filter(n => getRuneType(runeOf(n)) === 'direcao').map(n => n.rune as string));
  if (shapeNames.length || structNames.length || directions.length) {
    const parts: string[] = [];
    if (shapeNames.length) parts.push(`<b>Forma:</b> ${shapeNames.join(', ')}.`);
    if (structNames.length) parts.push(`<b>Estruturais (Propriedade):</b> ${structNames.join(', ')}.`);
    directions.forEach(id => parts.push(`<b>${RUNES[id].name}:</b> ${RUNES[id].desc}`));
    logs.push({ title: 'Forma, Propriedade e Direção', text: parts.join('<br/>') });
  }

  // Efeito elemental (passiva e aplicação perfeita / 2º estágio)
  if (primaryNode) {
    const pr = runeOf(primaryNode);
    const hasPerfect = elementalNodes.some(n => n.activation === 'perfeito');
    // Tornado: Brisa + Ventania + Tempestade, ou Estrela sobrepositora com Vento Perfeito
    const windStates = new Set(elementalNodes.filter(n => n.rune === 'vento').map(n => n.activation));
    const isTornado = pr.id === 'vento' && ((windStates.size >= 3) || (starNodes.length > 0 && hasPerfect));
    const perfect = pr.perfectEffect ?? '';
    logs.push({
      title: `Efeito Elemental (${pr.name})`,
      text: (pr.provisional ? `<span style="color:var(--warning);">⚠ ${
        pr.costPerPower ? 'Poder provisório (não definido na tabela). Energia = 2x ~ 3,2x ~ 5x o Poder.'
          : pr.variable ? 'Energia e Poder variáveis na tabela — valores usados aqui são provisórios.'
            : 'Valores de Poder/Custo provisórios — não constam no caderno.'}</span><br/>` : '') +
        `<strong>Passiva:</strong> ${pr.passive}<br/>` +
        (isTornado || hasPerfect
          ? (perfect.startsWith('2º Estágio — ')
            ? `<strong>★ 2º Estágio Ativo:</strong> ${perfect.slice('2º Estágio — '.length)}`
            : `<strong>★ Aplicação Perfeita Ativa:</strong> ${perfect}`)
          : `<span style="color:var(--text-muted);">Dica: Mude o estado para <em>Perfeito</em> (ou use Quadrado/Estrela) para habilitar a Aplicação Perfeita.</span>`)
    });
  }

  return {
    tier: spellTier(m),
    tiers: spellTiers(m),
    flow,
    load: lo,
    circles: circ,
    metrics: {
      power: effectivePower.toFixed(1), powerSub,
      cost: totalCost.toFixed(1), costSub,
      intensity, intensitySub, volume, volumeSub
    },
    badge,
    loadView,
    logs
  };
}

/**
 * Níveis da magia, como um check-list (uma magia pode ser de 2º e de 3º ao mesmo tempo):
 * 2º quando alguma forma guarda uma magia dentro; 2,5º quando há círculos sobrepostos
 * unidos pela Estrela (acima do 2º, abaixo do 3º); 3º quando há círculos separados ligados por cabo.
 */
export function spellTiers(m: Pick<Model, 'nodes'> & { circles?: Model['circles']; connections?: Model['connections'] }): Tier[] {
  const tiers: Tier[] = [];
  const full = { nodes: m.nodes, circles: m.circles ?? [], connections: m.connections ?? [], envelope: (m as { envelope?: boolean }).envelope };
  // Magia dentro da magia: runas dentro de um Selo ou um círculo dentro de outro
  if (m.nodes.some(n => n.inner?.length) || hasNestedCircles(full)) tiers.push(2);
  if (full.circles.length > 1) {
    const c = analyzeCircles(full);
    if (c.pairs.some(p => p.star)) tiers.push(2.5);
    if (c.links.length) tiers.push(3);
  }
  return tiers.length ? tiers : [1];
}

/** O maior nível alcançado */
export function spellTier(m: Parameters<typeof spellTiers>[0]): Tier {
  return Math.max(...spellTiers(m)) as Tier;
}

export type Tier = 1 | 2 | 2.5 | 3;

/** "2,5º Círculo" */
export const tierLabel = (t: Tier): string => `${String(t).replace('.', ',')}º Círculo`;
