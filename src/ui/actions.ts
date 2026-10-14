import { closeAccount, deleteSaved, duplicateSaved, openAccount, openSaved, saveCircle, setAuthMode, signOut } from '../cloud/account';
import type { InteractionMode, RuneFilter, ShapeId } from '../core/types';
import {
  addCircle, addNode, bindWord, assignRuneToSelected, autoArrangeNodes, createConnectionFromForm, deleteSelectedNode,
  loadPreset, removeConnection, resetCircle, reverseConnection, selectCentralPrism, setInteractionMode, swapConnectionEnds, toggleFlow, toggleInnerMode, removeInnerRune, toggleDoubleStar, addLinkedCircle, toggleEnvelope, addInnerCircle, evolveSelectedShape
} from './editor';
import { redo, undo } from './history';
import { setZoom, view } from './canvas';
import { playTrace } from './trace';
import { closeGrimoire, openGrimoire } from './grimoire';
import { goToRunes, showLoadDetails, toggleSnap, toggleTheme } from './layout';
import { setRuneCat } from './panels';

// Todos os botões da página usam data-action="nome" (e data-arg="valor" quando precisa).
// Um único ouvinte de clique encaminha para a função certa.

type Handler = (arg: string) => void;

const ACTIONS: Record<string, Handler> = {
  // Formas e runas
  'select-prism': () => selectCentralPrism(),
  'add-node': arg => addNode(arg as ShapeId),
  'add-circle': () => addCircle(),
  'assign-rune': arg => assignRuneToSelected(arg),
  'clear-rune': () => assignRuneToSelected(null),
  'toggle-inner': () => toggleInnerMode(),
  'toggle-double': () => toggleDoubleStar(),
  'add-linked-circle': () => addLinkedCircle(),
  'add-inner-circle': () => addInnerCircle(),
  'toggle-envelope': () => toggleEnvelope(),
  'undo': () => undo(),
  'redo': () => redo(),
  'toggle-snap': () => toggleSnap(),
  'evolve-shape': () => evolveSelectedShape(),
  'trace': () => playTrace(),
  'zoom-in': () => setZoom(view.zoom * 1.4),
  'zoom-out': () => setZoom(view.zoom / 1.4),
  'zoom-reset': () => setZoom(1),
  'remove-inner': arg => removeInnerRune(Number(arg)),
  'rune-cat': arg => setRuneCat(arg as RuneFilter),
  'delete-node': () => deleteSelectedNode(),
  'go-runes': () => goToRunes(),
  // Ferramentas do desenho
  'mode': arg => setInteractionMode(arg as InteractionMode),
  'toggle-flow': () => toggleFlow(),
  'auto-arrange': () => autoArrangeNodes(),
  'reset': () => resetCircle(),
  'load-details': () => showLoadDetails(),
  // Cabos
  'create-connection': () => createConnectionFromForm(),
  'swap-conn-ends': () => swapConnectionEnds(),
  'reverse-conn': arg => { reverseConnection(arg); },
  'remove-conn': arg => removeConnection(arg),
  // Janelas
  'open-grimoire': () => openGrimoire(),
  'close-grimoire': () => closeGrimoire(),
  'open-spell': arg => { loadPreset(arg); closeGrimoire(); },
  'toggle-theme': () => toggleTheme(),
  // Conta
  'open-account': () => openAccount(),
  'close-account': () => closeAccount(),
  'auth-mode': arg => setAuthMode(arg as 'entrar' | 'criar'),
  'sign-out': () => { void signOut(); },
  'save-new': () => { void saveCircle(false); },
  'save-update': () => { void saveCircle(true); },
  'open-saved': arg => { void openSaved(arg); },
  'delete-saved': arg => { void deleteSaved(arg); },
  'duplicate-saved': arg => { void duplicateSaved(arg); },
  'bind-word': () => bindWord()
};

export function setupActions(): void {
  document.addEventListener('click', evt => {
    const target = evt.target as Element;

    // Clique no fundo escurecido fecha a janela
    const backdrop = target.closest<HTMLElement>('[data-backdrop]');
    if (backdrop && target === backdrop) {
      ACTIONS[backdrop.dataset.backdrop as string]?.('');
      return;
    }

    const el = target.closest<HTMLElement>('[data-action]');
    if (!el) return;
    const handler = ACTIONS[el.dataset.action as string];
    if (!handler) return;
    evt.preventDefault();
    handler(el.dataset.arg ?? '');
  });
}
