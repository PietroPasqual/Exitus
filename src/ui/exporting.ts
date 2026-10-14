import { getViewBox } from '../core/circles';
import { normalizeProject } from '../core/project';
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

/** SVG independente, com as cores do tema atual "congeladas" */
export function getStandaloneSvgString(): string {
  const isSketch = document.body.classList.contains('theme-sketch');
  const bg = isSketch ? '#fbf8f1' : '#0d111c';
  const stroke = isSketch ? '#1f2433' : '#ece6d6';
  const fillNode = isSketch ? '#fbf8f1' : '#0d111c';
  const portFill = isSketch ? '#fffdf8' : '#0d111c';
  const accent = isSketch ? '#8a5d14' : '#d4a853';

  const clone = byId('magicCircleSvg').cloneNode(true) as Element;
  // Sem seleção, sem animação e sem as áreas de toque invisíveis
  clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  clone.querySelectorAll('.flow-pulse, .conn-hit').forEach(el => el.remove());

  const raw = clone.innerHTML
    .replaceAll('var(--stroke-circle)', stroke)
    .replaceAll('var(--fill-node)', fillNode)
    .replaceAll('var(--port-fill)', portFill)
    .replaceAll('var(--accent)', accent)
    .replaceAll('var(--danger)', '#f85149')
    .replaceAll('currentColor', stroke);

  const vb = getViewBox(store.state.circles);
  const scale = 1024 / 700;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${Math.round(vb.w * scale)}" height="${Math.round(vb.h * scale)}">
        <rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="${bg}"/>
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
    const vb = getViewBox(store.state.circles);
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
