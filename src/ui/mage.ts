import { thresholds, type Charge } from '../core/charge';
import { byId, setHint } from './dom';
import { render, store } from './store';

// Aba Mago & Pergaminho: quem faz a magia (energia infundida, refino e velocidade)
// e como ver o círculo (energia nos fios).

const br = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',');
const parse = (v: string): number | null => {
  const n = Number(v.replace(',', '.'));
  return v.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};

/** Último cálculo de energia (para os botões Mínimo / Perfeita) */
let last: Charge | null = null;

function setMage(patch: Partial<NonNullable<typeof store.state.mage>>): void {
  store.state.mage = { refino: 1, energia: null, velocidade: 30, ...store.state.mage, ...patch };
  render();
}

export function setupMage(): void {
  const energy = byId<HTMLInputElement>('mageEnergy');
  const range = byId<HTMLInputElement>('mageEnergyRange');
  energy.addEventListener('change', () => setMage({ energia: parse(energy.value) }));
  range.addEventListener('input', () => setMage({ energia: Number(range.value) }));
  byId<HTMLInputElement>('mageRefino').addEventListener('change', e => {
    const n = parse((e.target as HTMLInputElement).value);
    setMage({ refino: n && n > 0 ? n : 1 });
  });
  byId<HTMLInputElement>('mageSpeed').addEventListener('change', e => {
    const n = parse((e.target as HTMLInputElement).value);
    setMage({ velocidade: n && n > 0 ? n : 30 });
  });
}

/** Botões prontos: Mínimo, Perfeita ou Automática (acompanha a Ativação perfeita) */
export function setMageEnergy(which: string): void {
  if (which === 'auto' || !last) { setMage({ energia: null }); return; }
  setMage({ energia: which === 'minimo' ? last.minimum : last.perfect });
  setHint(which === 'minimo' ? 'Energia no mínimo para ativação.' : 'Energia da Ativação perfeita: a magia não pode falhar.');
}

/** Liga/desliga a energia nos fios */
export function toggleEnergyView(): void {
  store.state.showEnergy = !store.state.showEnergy;
  try { localStorage.setItem('circulos-energia-fios', store.state.showEnergy ? '1' : '0'); } catch { /* sem armazenamento */ }
  render();
}

export function restoreEnergyView(): void {
  try { store.state.showEnergy = localStorage.getItem('circulos-energia-fios') === '1'; } catch { /* sem armazenamento */ }
}

/** Mostra os valores da aba (chamado a cada análise) */
export function renderMage(c: Charge): void {
  last = c;
  const mage = c.mage;
  const energy = byId<HTMLInputElement>('mageEnergy');
  const range = byId<HTMLInputElement>('mageEnergyRange');
  const max = Math.max(1, Math.ceil(c.destruction * 1.05));
  range.max = String(max);
  range.value = String(Math.min(max, c.energy));
  if (document.activeElement !== energy) energy.value = c.level === 'inativo' ? '' : String(Math.round(c.energy * 10) / 10);
  energy.placeholder = 'Automática';
  byId('mageEnergyMode').textContent = c.auto ? 'automática (Ativação perfeita)' : 'escolhida';
  document.querySelectorAll<HTMLElement>('.mage-quick [data-action="mage-energy"]').forEach(b => {
    const k = b.dataset.arg;
    b.classList.toggle('active', k === 'auto' ? c.auto : !c.auto && Math.abs(c.energy - (k === 'minimo' ? c.minimum : c.perfect)) < 0.05);
  });
  const refino = byId<HTMLInputElement>('mageRefino');
  const speed = byId<HTMLInputElement>('mageSpeed');
  if (document.activeElement !== refino) refino.value = String(mage.refino);
  if (document.activeElement !== speed) speed.value = String(mage.velocidade);
  byId('mageBands').innerHTML = c.level === 'inativo'
    ? '<li>Feche o ciclo na Matriz para ver os limites da magia.</li>'
    : thresholds(c).map(([lvl, name, value]) => `<li class="band band-${lvl}${lvl === c.level ? ' current' : ''}"><span>${name}</span><b>${value}</b></li>`).join('');
  byId('mageTime').textContent = c.level === 'inativo' ? ''
    : `A energia corre a ${br(mage.velocidade * mage.refino)} por segundo (${br(mage.velocidade * mage.refino / 10)} a cada 0,1 s): ${br(c.energy)} de energia levam ${br(c.seconds)} s.${c.failure > 0 ? ` Chance de falha: ${br(c.failure)}%.` : ''}`;
  const btn = byId('btnShowEnergy');
  btn.setAttribute('aria-pressed', String(store.state.showEnergy));
  btn.classList.toggle('active', store.state.showEnergy);
}
