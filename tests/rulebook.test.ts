// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { ARCHETYPES } from '../src/data/rpg-archetypes';
import { CLASS_RANKS, CLASS_SUGGESTIONS, derivedWeaponSlots, lifePhase, RULEBOOK } from '../src/data/rulebook';
import { closeRulebook, filterRulebook, openRulebook, RULEBOOK_CHAPTERS, setupRulebook } from '../src/ui/rulebook';
import { renderRpgSheet } from '../src/ui/rpg-sheet';
import { newRpgSheet } from '../src/core/rpg-sheet';

const byId = (id: string): (typeof ARCHETYPES)[number] => ARCHETYPES.find(a => a.id === id)!;

describe('Arquétipos do Livro de Regras', () => {
  it('cada arquétipo principal recebe as penalidades dos outros quatro', () => {
    for (const id of ['ramo', 'adepto', 'ente', 'amago', 'tracos']) {
      const a = byId(id);
      expect(a.penalidade).toHaveLength(4);
      expect(a.grupos.map(g => g.de)).not.toContain(a.nome);
      expect(a.grupos).toHaveLength(4);
      expect(a.desvantagens).toHaveLength(16);
      for (const g of a.grupos) {
        const source = ARCHETYPES.find(other => other.nome === g.de)!;
        expect(g.regras).toEqual(source.penalidade);
      }
    }
  });

  it('Justo tem penalidades reduzidas e não impõe nada; Tales carrega todas', () => {
    expect(byId('justo').penalidade).toEqual([]);
    expect(byId('justo').desvantagens).toHaveLength(11);
    expect(byId('justo').desvantagens).toContain('Adquire 1 característica negativa ao nascer.');
    expect(byId('tales').desvantagens).toHaveLength(20);
    expect(byId('ramo').vantagens).toContain('Permite escolher uma entre três classes ou sub-classes (especial) a cada avanço.');
  });
});

describe('Regras da Ficha Existus', () => {
  it('fase da vida segue a tabela humana', () => {
    expect(lifePhase(null)).toBeNull();
    expect(lifePhase(1)?.estado).toBe('Nascimento');
    expect(lifePhase(16)?.estado).toBe('Adolescência');
    expect(lifePhase(20)).toMatchObject({ estado: 'Adultização', defesas: '+', recuperacao: '+', status: '+' });
    expect(lifePhase(50)?.estado).toBe('Adulto');
    expect(lifePhase(80)).toMatchObject({ estado: 'Velhice', defesas: '-' });
    expect(lifePhase(130)?.estado).toBe('Definhação');
    // Outra raça: 300 anos de vida, 60 anos = 20%
    expect(lifePhase(60, 300)?.estado).toBe('Adultização');
  });

  it('espaços de armamento derivado sobem nas porcentagens elementais', () => {
    expect(derivedWeaponSlots(0)).toBe(0);
    expect(derivedWeaponSlots(5)).toBe(1);
    expect(derivedWeaponSlots(30)).toBe(3);
    expect(derivedWeaponSlots(90)).toBe(7);
  });

  it('classes vão do Rank F ao S e alimentam as sugestões da ficha', () => {
    expect(CLASS_RANKS.map(r => r.id)).toEqual(['F', 'E', 'D', 'C', 'B', 'A', 'S']);
    expect(CLASS_SUGGESTIONS).toContain('Espadachim');
    expect(CLASS_SUGGESTIONS).toContain('Rei Demônio');
    expect(new Set(CLASS_SUGGESTIONS).size).toBe(CLASS_SUGGESTIONS.length);
  });
});

describe('Livro de Regras (tela)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  function mount(): HTMLElement {
    document.body.innerHTML = `<div class="modal-backdrop" id="rulebookModal"><button id="rulebookTocToggle"></button><input id="rulebookSearch"><span id="rulebookStatus"></span><button id="rulebookClose"></button><nav id="rulebookToc"></nav><div id="rulebookPages"></div></div>`;
    setupRulebook();
    return document.getElementById('rulebookModal')!;
  }

  it('monta os sete capítulos na ordem do livro do mestre', () => {
    const modal = mount();
    expect(RULEBOOK_CHAPTERS.map(c => c.titulo)).toEqual(['Ficha Existus', 'Raças', 'Arquétipos', 'Classes', 'Pilares', 'Estilos e Habilidades', 'Jogo e cálculos']);
    expect(RULEBOOK_CHAPTERS.map(c => c.numeral)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']);
    expect(modal.querySelectorAll('.rb-chapter')).toHaveLength(7);
    expect(modal.querySelector('#rb-racas-venereus')?.textContent).toContain('Marca do Sábado');
    expect(modal.querySelector('#rb-pilares-runas')?.textContent).toContain('Termis (Tempo)');
    expect(modal.querySelector('#rb-habilidades-classificacoes')?.textContent).toContain('Divergentes');
    expect(modal.querySelector('#rb-jogo-titulos')?.textContent).toContain('10000');
    expect(modal.querySelector('#rb-pilares-aura')?.textContent).toContain('Vermondy');
    expect(modal.querySelector('#rb-arquetipos-justo')).not.toBeNull();
    const sections = RULEBOOK.reduce((n, c) => n + c.secoes.length, 0);
    expect(modal.querySelectorAll('#rulebookToc li').length).toBeGreaterThan(sections);
  });

  it('a busca ignora acentos e esconde o resto', () => {
    const modal = mount();
    expect(filterRulebook(modal, 'apostolo')).toBeGreaterThan(0);
    expect(modal.querySelector<HTMLElement>('#rb-pilares-pilar')!.hidden).toBe(false);
    expect(modal.querySelector<HTMLElement>('#rb-jogo-descansos')!.hidden).toBe(true);
    expect(modal.querySelector<HTMLElement>('#rb-jogo')!.hidden).toBe(true);
    expect(filterRulebook(modal, 'xyzzy')).toBe(0);
    filterRulebook(modal, '');
    expect(modal.querySelectorAll('.rb-section[hidden]')).toHaveLength(0);
  });

  it('abre, limpa a busca e fecha', () => {
    const modal = mount();
    const search = document.getElementById('rulebookSearch') as HTMLInputElement;
    search.value = 'aura';
    search.dispatchEvent(new Event('input'));
    expect(modal.querySelectorAll('.rb-section[hidden]').length).toBeGreaterThan(0);
    openRulebook();
    expect(modal.classList.contains('open')).toBe(true);
    expect(search.value).toBe('');
    expect(modal.querySelectorAll('.rb-section[hidden]')).toHaveLength(0);
    closeRulebook();
    expect(modal.classList.contains('open')).toBe(false);
  });

  it('o texto do livro é escapado (só **negrito** vira tag)', () => {
    const modal = mount();
    expect(modal.querySelector('#rulebookPages script, #rulebookPages img')).toBeNull();
    expect(modal.querySelector('#rb-ficha-descricao b')?.textContent).toContain('Nome');
  });
});

describe('Ficha ligada ao livro', () => {
  it('mostra a fase da vida e sugere classes e pilares', () => {
    const sheet = newRpgSheet();
    sheet.descricao.idade = 20;
    document.body.innerHTML = renderRpgSheet(sheet);
    expect(document.querySelector('.rpg-life-phase strong')?.textContent).toBe('Adultização');
    expect(document.querySelector('#rpg-dl-classes option[value="Ferreiro"]')).not.toBeNull();
    expect(document.querySelector('[data-rpg-field="progressao.pilar"]')?.getAttribute('list')).toBe('rpg-dl-pilares');
    expect(document.querySelectorAll('#rpg-section-referencia [data-action="open-rulebook"]')).toHaveLength(7);
    expect(document.querySelector('[data-rpg-field="descricao.raca"]')?.getAttribute('list')).toBe('rpg-dl-racas');
    expect(document.querySelector('#rpg-section-arquetipo .rpg-rule-origin')?.textContent).toBe('de Adepto');
    const life = document.querySelector('.rpg-resource-vida .rpg-bar')!;
    expect(life.getAttribute('aria-valuenow')).toBe('50');
    expect(life.querySelector<HTMLElement>('.rpg-bar-fill')!.style.width).toBe('100%');
    expect(life.querySelector('.rpg-bar-text')?.textContent).toBe('50 / 50');
  });
});
