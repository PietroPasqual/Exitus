/**
 * Jogador ou mestre. No celular o site é sempre de jogador; a parte do mestre (Mesa do
 * mestre e as campanhas que ele conduz) só aparece no computador, com o modo mestre ligado.
 */
export const MODE_KEY = 'existus-modo';
export type PlayMode = 'jogador' | 'mestre';

const PHONE_QUERY = '(max-width: 699px), (hover: none) and (pointer: coarse) and (max-width: 1024px)';

export function isPhone(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
}
/** Escolha desta sessão, para quando o navegador não deixa guardar. */
let remembered: PlayMode | null = null;
export function chosenMode(): PlayMode {
  if (remembered) return remembered;
  try { return localStorage.getItem(MODE_KEY) === 'mestre' ? 'mestre' : 'jogador'; } catch { return 'jogador'; }
}
/** O modo que vale agora: o celular nunca é mestre. */
export const playMode = (): PlayMode => isPhone() ? 'jogador' : chosenMode();
export const canMaster = (): boolean => playMode() === 'mestre';

export function setMode(mode: PlayMode): void {
  remembered = mode;
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* fica só nesta sessão */ }
  window.dispatchEvent(new Event('existus:modo'));
}
/** Avisa quando o modo muda (botão ou a tela virar celular/computador). */
export function onModeChange(listener: () => void): void {
  window.addEventListener('existus:modo', listener);
  if (typeof window.matchMedia === 'function') window.matchMedia(PHONE_QUERY).addEventListener?.('change', listener);
}
