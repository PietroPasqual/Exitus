/** Consulta estática da referência de criação fornecida pelo mestre.
 * As expressões abaixo são texto, inclusive onde a fonte ainda deixa dúvidas.
 */
export const ACTION_REFERENCE = {
  roundSeconds: 3,
  rotationSeconds: 6,
  rows: [
    { tipo: 'Ação', usos: '1/1', tempo: '0', mvs: '0', drs: '', explicacao: 'Uma rodada tem 3s, uma rotação tem 6s.' },
    { tipo: 'Física', usos: '1/1', tempo: '1s', mvs: '0', drs: '', explicacao: '2 Movimento + (1 a cada 10 por rolagem)' },
    { tipo: 'Mental', usos: '1/1', tempo: '0,5s', mvs: '0', drs: '', explicacao: '1 Pensamento + (1 a cada 15 por rolagem)' },
    { tipo: 'Expressão', usos: '1/1', tempo: '1,5s', mvs: '0', drs: '', explicacao: '1 Comunicação + (1 a cada 5 por rolagem)' },
    { tipo: 'Energia', usos: '1/1', tempo: '1s', mvs: '0', drs: '', explicacao: '1 Manipulação + (1 a cada 10 por rolagem)' }
  ]
} as const;

export const REST_REFERENCE = {
  interruption: 'Descansos interrompidos mudam para uma versão inferior e descontando os usos, fome e sede ou a recuperação é reduzida em 2/3.',
  rows: [
    { descanso: 'D. Curto', usos: '8/8', condicao: 'S/DRs', tempo: '5m', fadiga: '1%', energia: '0,2%', vida: '0%' },
    { descanso: 'D. Médio', usos: '3/3', condicao: 'Imóvel', tempo: '25m', fadiga: '4%', energia: '1%', vida: '0,2%' },
    { descanso: 'D. Longo', usos: '—', condicao: 'Dormir', tempo: '6~8h', fadiga: '50%', energia: '14%', vida: '3%' }
  ]
} as const;

/** Ordem da classificação; anormalidades, Lapz e Miguel não entram nessa escala. */
export const RANKS = [
  { id: 'F', nome: 'Comum' },
  { id: 'E', nome: 'Incomum' },
  { id: 'D', nome: 'Raro' },
  { id: 'C', nome: 'Elite' },
  { id: 'B', nome: 'Lenda' },
  { id: 'A', nome: 'Milagre' },
  { id: 'S', nome: 'Divino' },
  { id: 'SS', nome: 'Imaginário' },
  { id: 'Z', nome: 'Imensurável' },
  { id: 'M', nome: 'Absoluto' }
] as const;

export const SPECIAL_RANKS = [
  { id: '+', nome: 'Anormalidade +' },
  { id: '-', nome: 'Anormalidade −' },
  { id: 'Lp', nome: 'Lapz' },
  { id: 'Mg', nome: 'Miguel' }
] as const;

export const ROLL_CATEGORIES = [
  { nome: 'Desastre', min: 1, max: 1 },
  { nome: 'Péssimo', min: 2, max: 2 },
  { nome: 'Fracasso', min: 3, max: 5 },
  { nome: 'Tentativa', min: 6, max: 14 },
  { nome: 'Sucesso', min: 15, max: 18 },
  { nome: 'Excelente', min: 19, max: 19 },
  { nome: 'Perfeito', min: 20, max: 20 }
] as const;

export const ADVANTAGE_REFERENCE = {
  cancellation: 'Vantagens podem ser anuladas por suas desvantagens de mesmo tipo.',
  rows: [
    { nome: 'Categoria', explicacao: 'Joga-se os dados e melhora ou piora em X a categoria das rolagens.' },
    { nome: 'Rolagem', explicacao: 'Joga-se +X dados a mais e escolhem-se os piores ou melhores resultados.' },
    { nome: 'Atributo', explicacao: 'Aplica-se uma alteração X de modificador da estatística Y.' },
    { nome: 'Terreno', explicacao: 'Aplica-se uma condição que, caso seja ou não atendida, divide ou multiplica em 1,5 o resultado dos dados.' },
    { nome: 'Ambiente', explicacao: 'Aplica-se uma condição que, caso seja ou não atendida, transforma todos os resultados dos dados em desastres ou perfeitos.' },
    { nome: 'Efeito', explicacao: 'Torna os testes para redução ou aumento de um efeito duas vezes mais difícil ou fácil.' }
  ]
} as const;

export interface FormulaReference {
  grupo: string;
  nome: string;
  formula: string;
  nota?: string;
}

/** Fórmulas de consulta: não deduzem os modificadores, críticos ou valores ausentes. */
export const FORMULA_REFERENCE: readonly FormulaReference[] = [
  { grupo: 'Descrição', nome: 'Aparência', formula: '2d6 (+?)', nota: 'O complemento (+?) não foi definido na referência. Âmago permite adicionar +1d12.' },
  { grupo: 'Status', nome: 'Valor por idade', formula: 'Anos * 365 * ValorDiário' },
  { grupo: 'Status', nome: 'Valor diário', formula: '0,04 + (Talentos / 16)' },
  { grupo: 'Status', nome: 'Limite de ganho', formula: 'ValorDiário * 10' },
  { grupo: 'Recursos', nome: 'Vida', formula: '[(ModConst + 25) * 5] + 10' },
  { grupo: 'Recursos', nome: 'Fadiga', formula: '[(ModConst + ModVont + 40) * 3] + 10' },
  { grupo: 'Recursos', nome: 'Psicológico', formula: '[(ModVont + 10) * 1] + 20' },
  { grupo: 'Recursos', nome: 'Energia', formula: '[(ModEner + 20) * 2] + 10' },
  { grupo: 'Existência', nome: 'Consenso', formula: 'Existência * 1' },
  { grupo: 'Existência', nome: 'Cadeia de substância', formula: '[Existência * (ModPoder + ModEner)] / 100' },
  { grupo: 'Energia', nome: 'Energia demoníaca', formula: '[(ModEner + 20) * 5 + Elemento] + 30', nota: 'Conversão de 1 pra 2 de energia demoníaca.' },
  { grupo: 'Energia', nome: 'Energia celeste', formula: '[(ModEner + 10) * 2 + Elemento] + 10', nota: 'Conversão de 1 pra 0,5 de energia celeste.' },
  { grupo: 'Energia', nome: 'Estoque de Pilar', formula: '[(ModEner + 20) * 2 + Elemento] + 5', nota: 'Conversão de 1 pra 0,2 de energia de pilar.' },
  { grupo: 'Combate físico', nome: 'Dano C.', formula: '(Arma + ModForça) * Críticos' },
  { grupo: 'Combate físico', nome: 'Dano M.', formula: '[Arma + (ModForça + ModDestreza) / 2] * Críticos' },
  { grupo: 'Combate físico', nome: 'Dano L.', formula: '(Arma + ModDes) * Críticos' },
  { grupo: 'Combate sobrenatural', nome: 'Dano P. (E)', formula: '[Efeito + (Habi + ModPoder + (Energia / 2))] * Críticos' },
  { grupo: 'Combate comunicativo', nome: 'Efeito Ex. ou In.', formula: '[Aparência + (ModLábia ou ModCharme)] * Críticos' },
  { grupo: 'Combate comunicativo', nome: 'Distração ou Auxílio', formula: '[Aparência + (ModCharme + ModLábia) / 2] * Críticos' },
  { grupo: 'Combate comunicativo', nome: 'Zombaria', formula: '(Auxílio ou Distração ou Efeito) / 100', nota: 'Dano no Psicológico.' },
  { grupo: 'Defesas', nome: 'Defesa F Natural', formula: '(ModConst * CritConst) + Características + Títulos', nota: 'A referência escreve “Defesa F Natural -” antes da expressão. A defesa física reduz ou anula os danos direcionados à vida.' },
  { grupo: 'Defesas', nome: 'Defesa F Alterado', formula: '[(Armaduras + Equipamentos + Amuletos + “Outros”) / 16', nota: 'O colchete de abertura está sem fechamento na referência.' },
  { grupo: 'Defesas', nome: 'Defesa M Natural', formula: '(ModVont * CritConst) + Características + Títulos', nota: 'A referência usa CritConst nesta fórmula. A defesa mental reduz ou anula os danos direcionados ao psicológico.' },
  { grupo: 'Defesas', nome: 'Defesa M Alterado', formula: '[(Armaduras + Equipamentos + Amuletos + “Outros”) / 4', nota: 'O colchete de abertura está sem fechamento na referência.' },
  { grupo: 'Defesas', nome: 'Defesa E Natural', formula: '(ModPoder * CritPoder) + Características + Títulos', nota: 'A defesa energética reduz ou anula os danos direcionados à vida, psicológico, energia ou fadiga. A prioridade sempre será a vida.' },
  { grupo: 'Defesas', nome: 'Defesa E alterada', formula: '[(Armaduras + Equipamentos + Amuletos + “Outros”) / 8', nota: 'O colchete de abertura está sem fechamento na referência.' },
  { grupo: 'Defesas', nome: 'Defesa Geral', formula: '(DefesaFN + DefesaMN + DefesaEN) / 100', nota: 'A defesa geral reduz ou anula os danos direcionados ao usuário.' }
];
