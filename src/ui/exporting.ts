import { getViewBox } from '../core/circles';
import { normalizeProject, skeletonOf } from '../core/project';
import { byId } from './dom';
import { applyProject, getProjectData } from './editor';
import { store } from './store';

// Exportar o desenho (PNG, SVG) e salvar/abrir o projeto (JSON)

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Cor final de uma variável do tema (ex.: --stroke-circle) */
function themeColor(name: string): string {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

/** Opções da imagem exportada (ficam guardadas neste aparelho) */
export interface ExportOptions {
  /** Sem fundo: só os traços, para pôr por cima de outra arte */
  transparent: boolean;
  /** Limpo: sem as setas do meio dos cabos e sem a grade de guia */
  clean: boolean;
}

const OPT_KEY = 'circulos-export';

export function exportOptions(): ExportOptions {
  let saved: Partial<ExportOptions> = {};
  try {
    saved = JSON.parse(localStorage.getItem(OPT_KEY) || '{}') as Partial<ExportOptions>;
  } catch {
    saved = {};
  }
  return { transparent: !!saved.transparent, clean: !!saved.clean };
}

function saveExportOptions(opts: ExportOptions): void {
  try {
    localStorage.setItem(OPT_KEY, JSON.stringify(opts));
  } catch {
    // Sem armazenamento: vale só até fechar a página
  }
}

/** SVG independente, com as cores do tema atual "congeladas" */
export function getStandaloneSvgString(opts: ExportOptions = readExportToggles()): string {
  // Papel de pergaminho só no tema Pergaminho (o Caderno sai com fundo liso)
  const isSketch = document.body.classList.contains('theme-sketch') && !document.body.classList.contains('theme-pauta');
  const bg = themeColor('--bg-canvas');

  const clone = byId('magicCircleSvg').cloneNode(true) as Element;
  // Sem seleção, sem a animação do fluxo e sem as áreas de toque invisíveis
  clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  clone.querySelectorAll('.flow-pulse, .flow-core, .mana-glow, .conn-hit, .curve-hit, .temp-cable').forEach(el => el.remove());
  if (opts.clean) clone.querySelectorAll('.conn-arrow, .guide-grid').forEach(el => el.remove());

  const raw = clone.innerHTML.replace(/var\((--[\w-]+)\)/g, (_, name: string) => themeColor(name));

  const vb = getViewBox(store.state.circles, !!store.state.envelope);
  const scale = 1024 / 700;
  const rect = `x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}"`;
  // No Pergaminho a imagem leva o papel junto: fibras, manchas e bordas queimadas
  const paper = isSketch
    ? `<filter id="paperFibers" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3"/><feColorMatrix values="0 0 0 0 .40 0 0 0 0 .27 0 0 0 0 .11 0 0 0 .16 0"/></filter>
        <filter id="paperStains" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".006" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .45 0 0 0 0 .30 0 0 0 0 .12 0 0 0 .55 -.22"/></filter>
        <radialGradient id="paperEdge" cx="50%" cy="50%" r="72%"><stop offset="0.62" stop-color="#693e12" stop-opacity="0"/><stop offset="1" stop-color="#693e12" stop-opacity="0.26"/></radialGradient>
        <rect ${rect} filter="url(#paperStains)"/>
        <rect ${rect} filter="url(#paperFibers)"/>
        <rect ${rect} fill="url(#paperEdge)"/>`
    : '';
  const background = opts.transparent ? '' : `<rect ${rect} fill="${bg}"/>
        ${paper}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${Math.round(vb.w * scale)}" height="${Math.round(vb.h * scale)}">
        ${background}
        ${raw}
      </svg>`;
}

export function exportSvg(): void {
  downloadBlob(new Blob([getStandaloneSvgString()], { type: 'image/svg+xml;charset=utf-8' }), 'circulo-magico-rpg.svg');
}

export function exportPng(): void {
  const url = URL.createObjectURL(new Blob([getStandaloneSvgString()], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  img.onload = () => {
    const vb = getViewBox(store.state.circles, !!store.state.envelope);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vb.w * 1200 / 700);
    canvas.height = Math.round(vb.h * 1200 / 700);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(png => { if (png) downloadBlob(png, 'circulo-magico-rpg.png'); }, 'image/png');
  };
  img.src = url;
}

export function exportJson(): void {
  downloadBlob(new Blob([JSON.stringify(getProjectData(), null, 2)], { type: 'application/json' }), 'circulo-magico-projeto.json');
}

/** Molde geométrico: o desenho sem as runas, para reaproveitar com outros elementos */
export function exportSkeleton(): void {
  downloadBlob(new Blob([JSON.stringify(skeletonOf(getProjectData()), null, 2)], { type: 'application/json' }), 'circulo-magico-molde.json');
}

/** Lê as caixinhas do menu Exportar (e guarda a escolha) */
function readExportToggles(): ExportOptions {
  const t = document.getElementById('exportTransparent') as HTMLInputElement | null;
  const c = document.getElementById('exportClean') as HTMLInputElement | null;
  if (!t || !c) return exportOptions();
  return { transparent: t.checked, clean: c.checked };
}

export function setupExportOptions(): void {
  const opts = exportOptions();
  const t = byId<HTMLInputElement>('exportTransparent');
  const c = byId<HTMLInputElement>('exportClean');
  t.checked = opts.transparent;
  c.checked = opts.clean;
  const save = (): void => saveExportOptions(readExportToggles());
  t.addEventListener('change', save);
  c.addEventListener('change', save);
}

export function setupFileImport(): void {
  const input = byId<HTMLInputElement>('fileInputJson');
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let project = null;
      try {
        project = normalizeProject(JSON.parse(String(reader.result)));
      } catch {
        project = null;
      }
      if (!project) {
        alert('Arquivo JSON inválido.');
        return;
      }
      applyProject(project);
      store.savedCircle = null; // arquivo novo: não está ligado a um círculo salvo
    };
    reader.readAsText(file);
    input.value = '';
  });
}
