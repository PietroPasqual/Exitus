import { AVATAR_LABELS, AVATAR_PALETTES, OUTFITS, avatarPixels, newAvatar, outfitForClass, type Avatar, type AvatarPart } from '../core/avatar';
import { escapeHtml } from '../core/format';

/** SVG do mini avatar; cada pixel vira um retângulo nítido em qualquer tamanho. */
export function renderAvatar(avatar: Avatar | undefined, className: string, size = 64, label = 'Avatar do personagem'): string {
  const outfit = outfitForClass(className);
  const rects = avatarPixels(avatar ?? newAvatar(), outfit).map(p => `<rect x="${p.x}" y="${p.y}" width="1" height="1" fill="${p.cor}"/>`).join('');
  return `<svg class="pixel-avatar" viewBox="0 0 16 16" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="${escapeHtml(`${label} · ${OUTFITS[outfit].nome}`)}">${rects}</svg>`;
}

const PART_NAMES: Record<AvatarPart, string> = { pele: 'Tom de pele', olhos: 'Cor dos olhos', cabelo: 'Cor do cabelo' };

/**
 * Prévia e paletas. Os botões levam `data-avatar-part`/`data-avatar-color`; quem usa
 * decide onde guardar a escolha. A roupa só muda com a classe.
 */
export function renderAvatarPicker(avatar: Avatar | undefined, className: string): string {
  const current = avatar ?? newAvatar();
  const outfit = OUTFITS[outfitForClass(className)];
  return `<div class="avatar-picker"><div class="avatar-preview">${renderAvatar(current, className, 112)}<small>Roupa: ${escapeHtml(outfit.nome)}${className.trim() ? ` · ${escapeHtml(className.trim())}` : ' · sem classe ainda'}</small></div>
    <div class="avatar-palettes">${(Object.keys(AVATAR_PALETTES) as AvatarPart[]).map(part => `<div class="avatar-palette" role="radiogroup" aria-label="${PART_NAMES[part]}"><span>${PART_NAMES[part]}</span><div>${AVATAR_PALETTES[part].map((color, index) => `<button type="button" class="avatar-swatch${color === current[part] ? ' is-active' : ''}" style="--swatch:${color}" data-avatar-part="${part}" data-avatar-color="${color}" role="radio" aria-checked="${color === current[part]}" aria-label="${AVATAR_LABELS[part][index]}" title="${AVATAR_LABELS[part][index]}"></button>`).join('')}</div></div>`).join('')}
    <p class="avatar-note">A roupa acompanha a classe da ficha; mude a classe para trocar a roupa.</p></div></div>`;
}
