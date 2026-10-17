// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeCircleContext } from '../src/core/editor-context';
import { normalizeProject } from '../src/core/project';
import { setupFileImport } from '../src/ui/exporting';

const mocks = vi.hoisted(() => ({
  applyProject: vi.fn(),
  store: { savedCircle: null as null | { id: string; nome: string } }
}));

vi.mock('../src/ui/editor', () => ({ applyProject: mocks.applyProject, getProjectData: vi.fn() }));
vi.mock('../src/ui/store', () => ({ store: mocks.store }));

class ControlledFileReader {
  static instances: ControlledFileReader[] = [];
  result: string | null = null;
  onload: (() => void) | null = null;
  readAsText = vi.fn();

  constructor() { ControlledFileReader.instances.push(this); }

  finish(result: string): void {
    this.result = result;
    this.onload?.();
  }
}

const imported = {
  nodes: [{ id: 'prism_center', shape: 'prism', lockedCenter: true }],
  spellInfo: { name: 'Memória do primeiro personagem', desc: '' }
};

function chooseFile(): ControlledFileReader {
  const input = document.getElementById('fileInputJson') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [new File([JSON.stringify(imported)], 'circulo.json', { type: 'application/json' })] });
  input.dispatchEvent(new Event('change'));
  const reader = ControlledFileReader.instances.at(-1)!;
  expect(reader.readAsText).toHaveBeenCalledTimes(1);
  return reader;
}

beforeEach(() => {
  vi.clearAllMocks();
  ControlledFileReader.instances = [];
  mocks.store.savedCircle = null;
  document.body.innerHTML = '<input id="fileInputJson" type="file" />';
  vi.stubGlobal('FileReader', ControlledFileReader);
  setupFileImport();
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('Importação de círculos e contexto do personagem', () => {
  it('abre um JSON válido quando o editor permanece no mesmo contexto', () => {
    mocks.store.savedCircle = { id: 'circle-a', nome: 'Círculo anterior' };
    const reader = chooseFile();
    reader.finish(JSON.stringify(imported));

    expect(mocks.applyProject).toHaveBeenCalledExactlyOnceWith(normalizeProject(imported));
    expect(mocks.store.savedCircle).toBeNull();
  });

  it('descarta a leitura atrasada depois de trocar personagem ou projeto', () => {
    const reader = chooseFile();
    changeCircleContext();
    const currentCircle = { id: 'circle-b', nome: 'Círculo do segundo personagem' };
    mocks.store.savedCircle = currentCircle;
    reader.finish(JSON.stringify(imported));

    expect(mocks.applyProject).not.toHaveBeenCalled();
    expect(mocks.store.savedCircle).toBe(currentCircle);
  });
});
