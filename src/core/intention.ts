/** Silhuetas visuais que a palavra de Intenção pode dar à matéria já existente. */
export type IntentionForm =
  | 'lanca' | 'espada' | 'escudo' | 'flecha' | 'martelo' | 'parede' | 'machado'
  | 'adaga' | 'foice' | 'arco' | 'tridente' | 'chicote' | 'corrente' | 'cajado' | 'picareta' | 'kunai' | 'agulha'
  | 'bomba' | 'esfera' | 'cubo' | 'piramide' | 'cone' | 'anel' | 'estrela' | 'espiral' | 'cruz'
  | 'coracao' | 'coroa' | 'chave' | 'cristal' | 'mao' | 'explosao'
  | 'arvore' | 'flor' | 'folha' | 'raiz' | 'vinha' | 'asa' | 'garra' | 'presa' | 'serpente' | 'dragao' | 'lobo' | 'passaro' | 'tentaculo'
  | 'shuriken' | 'mangual' | 'clava' | 'besta' | 'bumerangue' | 'disco' | 'armadura' | 'elmo' | 'manopla' | 'bota' | 'livro' | 'pergaminho'
  | 'fenix' | 'urso' | 'leao' | 'raposa' | 'gato' | 'morcego' | 'aranha' | 'escorpiao' | 'tartaruga' | 'peixe' | 'tubarao' | 'cogumelo'
  | 'raio' | 'chama' | 'gota' | 'onda' | 'tornado' | 'nuvem' | 'sol' | 'lua' | 'meteoro' | 'cometa' | 'ampulheta' | 'cranio';

interface IntentionDefinition {
  readonly name: string;
  readonly article: 'um' | 'uma';
  readonly category: string;
  readonly words: readonly string[];
}

export interface IntentionCatalogEntry extends IntentionDefinition {
  readonly id: IntentionForm;
}

// Aliases explícitos: não há aproximação, stemming nem leitura de substrings.
// Variações de acento e caixa são normalizadas na consulta, sem entradas extras.
const FORM_DEFINITIONS = {
  lanca: { name: 'Lança', article: 'uma', category: 'Armas', words: ['lança', 'lanças', 'azagaia', 'azagaias', 'dardo', 'dardos', 'pique', 'piques'] },
  espada: { name: 'Espada', article: 'uma', category: 'Armas', words: ['espada', 'espadas', 'sabre', 'sabres', 'gládio', 'gládios', 'montante', 'montantes', 'katana', 'katanas', 'rapieira', 'rapieiras', 'florete', 'floretes'] },
  escudo: { name: 'Escudo', article: 'um', category: 'Armas', words: ['escudo', 'escudos', 'broquel', 'broquéis', 'pavês', 'paveses'] },
  flecha: { name: 'Flecha', article: 'uma', category: 'Armas', words: ['flecha', 'flechas', 'seta', 'setas', 'virote', 'virotes'] },
  martelo: { name: 'Martelo', article: 'um', category: 'Armas', words: ['martelo', 'martelos', 'malho', 'malhos', 'marreta', 'marretas'] },
  parede: { name: 'Parede', article: 'uma', category: 'Objetos e geometria', words: ['parede', 'paredes', 'muro', 'muros', 'muralha', 'muralhas', 'barreira', 'barreiras'] },
  machado: { name: 'Machado', article: 'um', category: 'Armas', words: ['machado', 'machados', 'acha', 'achas', 'machadinha', 'machadinhas', 'alabarda', 'alabardas'] },
  adaga: { name: 'Adaga', article: 'uma', category: 'Armas', words: ['adaga', 'adagas', 'punhal', 'punhais', 'faca', 'facas', 'estilete', 'estiletes'] },
  foice: { name: 'Foice', article: 'uma', category: 'Armas', words: ['foice', 'foices', 'gadanha', 'gadanhas'] },
  arco: { name: 'Arco', article: 'um', category: 'Armas', words: ['arco', 'arcos'] },
  tridente: { name: 'Tridente', article: 'um', category: 'Armas', words: ['tridente', 'tridentes', 'forquilha', 'forquilhas', 'forcado', 'forcados'] },
  chicote: { name: 'Chicote', article: 'um', category: 'Armas', words: ['chicote', 'chicotes', 'azorrague', 'azorragues', 'látego', 'látegos', 'açoite', 'açoites'] },
  corrente: { name: 'Corrente', article: 'uma', category: 'Armas', words: ['corrente', 'correntes', 'cadeia', 'cadeias', 'grilhão', 'grilhões'] },
  cajado: { name: 'Cajado', article: 'um', category: 'Armas', words: ['cajado', 'cajados', 'báculo', 'báculos', 'bordão', 'bordões', 'bastão', 'bastões'] },
  picareta: { name: 'Picareta', article: 'uma', category: 'Armas', words: ['picareta', 'picaretas', 'picão', 'picões', 'alvião', 'alviões'] },
  kunai: { name: 'Kunai', article: 'uma', category: 'Armas', words: ['kunai', 'kunais'] },
  agulha: { name: 'Agulha', article: 'uma', category: 'Armas', words: ['agulha', 'agulhas', 'alfinete', 'alfinetes', 'espinho', 'espinhos'] },
  bomba: { name: 'Bomba', article: 'uma', category: 'Objetos e geometria', words: ['bomba', 'bombas', 'granada', 'granadas', 'explosivo', 'explosivos'] },
  esfera: { name: 'Esfera', article: 'uma', category: 'Objetos e geometria', words: ['esfera', 'esferas', 'bola', 'bolas', 'orbe', 'orbes', 'globo', 'globos'] },
  cubo: { name: 'Cubo', article: 'um', category: 'Objetos e geometria', words: ['cubo', 'cubos', 'dado', 'dados'] },
  piramide: { name: 'Pirâmide', article: 'uma', category: 'Objetos e geometria', words: ['pirâmide', 'pirâmides', 'tetraedro', 'tetraedros'] },
  cone: { name: 'Cone', article: 'um', category: 'Objetos e geometria', words: ['cone', 'cones'] },
  anel: { name: 'Anel', article: 'um', category: 'Objetos e geometria', words: ['anel', 'anéis', 'aro', 'aros', 'argola', 'argolas', 'aliança', 'alianças'] },
  estrela: { name: 'Estrela', article: 'uma', category: 'Objetos e geometria', words: ['estrela', 'estrelas', 'estrelinha', 'estrelinhas'] },
  espiral: { name: 'Espiral', article: 'uma', category: 'Objetos e geometria', words: ['espiral', 'espirais', 'caracol', 'caracóis', 'hélice', 'hélices', 'redemoinho', 'redemoinhos'] },
  cruz: { name: 'Cruz', article: 'uma', category: 'Objetos e geometria', words: ['cruz', 'cruzes', 'crucifixo', 'crucifixos'] },
  coracao: { name: 'Coração', article: 'um', category: 'Objetos e geometria', words: ['coração', 'corações'] },
  coroa: { name: 'Coroa', article: 'uma', category: 'Objetos e geometria', words: ['coroa', 'coroas', 'tiara', 'tiaras', 'diadema', 'diademas'] },
  chave: { name: 'Chave', article: 'uma', category: 'Objetos e geometria', words: ['chave', 'chaves'] },
  cristal: { name: 'Cristal', article: 'um', category: 'Objetos e geometria', words: ['cristal', 'cristais', 'gema', 'gemas', 'joia', 'joias', 'quartzo', 'quartzos', 'diamante', 'diamantes', 'rubi', 'rubis', 'esmeralda', 'esmeraldas', 'safira', 'safiras'] },
  mao: { name: 'Mão', article: 'uma', category: 'Objetos e geometria', words: ['mão', 'mãos', 'palma', 'palmas'] },
  explosao: { name: 'Explosão', article: 'uma', category: 'Objetos e geometria', words: ['explosão', 'explosões', 'estouro', 'estouros', 'detonação', 'detonações'] },
  arvore: { name: 'Árvore', article: 'uma', category: 'Natureza e criaturas', words: ['árvore', 'árvores', 'carvalho', 'carvalhos', 'pinheiro', 'pinheiros', 'salgueiro', 'salgueiros'] },
  flor: { name: 'Flor', article: 'uma', category: 'Natureza e criaturas', words: ['flor', 'flores', 'rosa', 'rosas', 'lírio', 'lírios', 'lótus', 'margarida', 'margaridas'] },
  folha: { name: 'Folha', article: 'uma', category: 'Natureza e criaturas', words: ['folha', 'folhas', 'folhagem', 'folhagens', 'folíolo', 'folíolos'] },
  raiz: { name: 'Raiz', article: 'uma', category: 'Natureza e criaturas', words: ['raiz', 'raízes', 'radícula', 'radículas'] },
  vinha: { name: 'Vinha', article: 'uma', category: 'Natureza e criaturas', words: ['vinha', 'vinhas', 'videira', 'videiras', 'cipó', 'cipós', 'trepadeira', 'trepadeiras', 'liana', 'lianas'] },
  asa: { name: 'Asa', article: 'uma', category: 'Natureza e criaturas', words: ['asa', 'asas'] },
  garra: { name: 'Garra', article: 'uma', category: 'Natureza e criaturas', words: ['garra', 'garras', 'unha', 'unhas'] },
  presa: { name: 'Presa', article: 'uma', category: 'Natureza e criaturas', words: ['presa', 'presas', 'canino', 'caninos', 'dente', 'dentes'] },
  serpente: { name: 'Serpente', article: 'uma', category: 'Natureza e criaturas', words: ['serpente', 'serpentes', 'cobra', 'cobras', 'víbora', 'víboras', 'jiboia', 'jiboias', 'sucuri', 'sucuris', 'píton', 'pítons'] },
  dragao: { name: 'Dragão', article: 'um', category: 'Natureza e criaturas', words: ['dragão', 'dragões', 'dragonete', 'dragonetes'] },
  lobo: { name: 'Lobo', article: 'um', category: 'Natureza e criaturas', words: ['lobo', 'lobos', 'loba', 'lobas'] },
  passaro: { name: 'Pássaro', article: 'um', category: 'Natureza e criaturas', words: ['pássaro', 'pássaros', 'ave', 'aves', 'passarinho', 'passarinhos', 'corvo', 'corvos', 'águia', 'águias', 'falcão', 'falcões'] },
  tentaculo: { name: 'Tentáculo', article: 'um', category: 'Natureza e criaturas', words: ['tentáculo', 'tentáculos'] },
  shuriken: { name: 'Shuriken', article: 'uma', category: 'Armas', words: ['shuriken', 'shurikens'] },
  mangual: { name: 'Mangual', article: 'um', category: 'Armas', words: ['mangual', 'manguais'] },
  clava: { name: 'Clava', article: 'uma', category: 'Armas', words: ['clava', 'clavas', 'porrete', 'porretes', 'tacape', 'tacapes', 'maça', 'maças'] },
  besta: { name: 'Besta', article: 'uma', category: 'Armas', words: ['besta', 'bestas', 'balestra', 'balestras'] },
  bumerangue: { name: 'Bumerangue', article: 'um', category: 'Armas', words: ['bumerangue', 'bumerangues', 'bumerang', 'bumerangs'] },
  disco: { name: 'Disco', article: 'um', category: 'Armas', words: ['disco', 'discos', 'chakram', 'chakrams'] },
  armadura: { name: 'Armadura', article: 'uma', category: 'Equipamentos', words: ['armadura', 'armaduras', 'couraça', 'couraças', 'peitoral', 'peitorais'] },
  elmo: { name: 'Elmo', article: 'um', category: 'Equipamentos', words: ['elmo', 'elmos', 'capacete', 'capacetes'] },
  manopla: { name: 'Manopla', article: 'uma', category: 'Equipamentos', words: ['manopla', 'manoplas', 'luva', 'luvas'] },
  bota: { name: 'Bota', article: 'uma', category: 'Equipamentos', words: ['bota', 'botas', 'botina', 'botinas'] },
  livro: { name: 'Livro', article: 'um', category: 'Equipamentos', words: ['livro', 'livros', 'tomo', 'tomos', 'grimório', 'grimórios', 'códice', 'códices'] },
  pergaminho: { name: 'Pergaminho', article: 'um', category: 'Equipamentos', words: ['pergaminho', 'pergaminhos', 'rolo', 'rolos'] },
  fenix: { name: 'Fênix', article: 'uma', category: 'Natureza e criaturas', words: ['fênix'] },
  urso: { name: 'Urso', article: 'um', category: 'Natureza e criaturas', words: ['urso', 'ursos', 'ursa', 'ursas'] },
  leao: { name: 'Leão', article: 'um', category: 'Natureza e criaturas', words: ['leão', 'leões', 'leoa', 'leoas'] },
  raposa: { name: 'Raposa', article: 'uma', category: 'Natureza e criaturas', words: ['raposa', 'raposas', 'raposo', 'raposos'] },
  gato: { name: 'Gato', article: 'um', category: 'Natureza e criaturas', words: ['gato', 'gatos', 'gata', 'gatas', 'gatinho', 'gatinhos'] },
  morcego: { name: 'Morcego', article: 'um', category: 'Natureza e criaturas', words: ['morcego', 'morcegos', 'quiróptero', 'quirópteros'] },
  aranha: { name: 'Aranha', article: 'uma', category: 'Natureza e criaturas', words: ['aranha', 'aranhas', 'tarântula', 'tarântulas', 'caranguejeira', 'caranguejeiras'] },
  escorpiao: { name: 'Escorpião', article: 'um', category: 'Natureza e criaturas', words: ['escorpião', 'escorpiões', 'lacrau', 'lacraus'] },
  tartaruga: { name: 'Tartaruga', article: 'uma', category: 'Natureza e criaturas', words: ['tartaruga', 'tartarugas', 'jabuti', 'jabutis', 'cágado', 'cágados'] },
  peixe: { name: 'Peixe', article: 'um', category: 'Natureza e criaturas', words: ['peixe', 'peixes', 'carpa', 'carpas', 'truta', 'trutas', 'salmão', 'salmões'] },
  tubarao: { name: 'Tubarão', article: 'um', category: 'Natureza e criaturas', words: ['tubarão', 'tubarões', 'cação', 'cações'] },
  cogumelo: { name: 'Cogumelo', article: 'um', category: 'Natureza e criaturas', words: ['cogumelo', 'cogumelos', 'fungo', 'fungos'] },
  raio: { name: 'Raio', article: 'um', category: 'Fenômenos e símbolos', words: ['raio', 'raios', 'relâmpago', 'relâmpagos', 'corisco', 'coriscos'] },
  chama: { name: 'Chama', article: 'uma', category: 'Fenômenos e símbolos', words: ['chama', 'chamas', 'labareda', 'labaredas', 'fagulha', 'fagulhas'] },
  gota: { name: 'Gota', article: 'uma', category: 'Fenômenos e símbolos', words: ['gota', 'gotas', 'pingo', 'pingos', 'gotícula', 'gotículas'] },
  onda: { name: 'Onda', article: 'uma', category: 'Fenômenos e símbolos', words: ['onda', 'ondas', 'vagalhão', 'vagalhões', 'marola', 'marolas'] },
  tornado: { name: 'Tornado', article: 'um', category: 'Fenômenos e símbolos', words: ['tornado', 'tornados', 'furacão', 'furacões', 'ciclone', 'ciclones', 'vórtice', 'vórtices'] },
  nuvem: { name: 'Nuvem', article: 'uma', category: 'Fenômenos e símbolos', words: ['nuvem', 'nuvens'] },
  sol: { name: 'Sol', article: 'um', category: 'Fenômenos e símbolos', words: ['sol', 'sóis'] },
  lua: { name: 'Lua', article: 'uma', category: 'Fenômenos e símbolos', words: ['lua', 'luas', 'crescente', 'crescentes'] },
  meteoro: { name: 'Meteoro', article: 'um', category: 'Fenômenos e símbolos', words: ['meteoro', 'meteoros', 'meteorito', 'meteoritos', 'estrela-cadente', 'estrelas-cadentes'] },
  cometa: { name: 'Cometa', article: 'um', category: 'Fenômenos e símbolos', words: ['cometa', 'cometas'] },
  ampulheta: { name: 'Ampulheta', article: 'uma', category: 'Objetos e geometria', words: ['ampulheta', 'ampulhetas'] },
  cranio: { name: 'Crânio', article: 'um', category: 'Objetos e geometria', words: ['crânio', 'crânios', 'caveira', 'caveiras'] }
} as const satisfies Record<IntentionForm, IntentionDefinition>;

export const INTENTION_CATALOG: readonly IntentionCatalogEntry[] = Object.freeze(Object.entries(FORM_DEFINITIONS)
  .map(([id, entry]) => Object.freeze({ id: id as IntentionForm, ...entry, words: Object.freeze([...entry.words]) })));

const wordKey = (word: string): string => word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const WORD_FORMS = new Map(INTENTION_CATALOG.flatMap(entry => entry.words.map(word => [wordKey(word), entry.id] as const)));

export interface IntentionReading {
  status: 'recognized' | 'unknown';
  form: IntentionForm | null;
  /** A forma ilustrada reconhecida, quando houver; outras palavras usam tipografia. */
  matches: IntentionForm[];
}

export interface IntentionWord {
  value: string;
  error: string | null;
}

/** Quantidade visual exata; nunca converte para Number nem altera o poder. */
export function intentionQuantity(raw: string): string | null {
  const value = raw.trim().normalize('NFC');
  if ([...value].length > 40 || !/^\+?\d+$/.test(value)) return null;
  const quantity = BigInt(value);
  return quantity > 0n ? quantity.toString() : null;
}

/** Uma única palavra ou número. Só normaliza a apresentação; nunca corta o texto. */
export function validateIntentionWord(raw: string): IntentionWord {
  const value = raw.trim().normalize('NFC');
  if (!value) return { value, error: 'Escreva uma palavra ou um número.' };
  if ([...value].length > 40) return { value, error: 'Use no máximo 40 caracteres na Intenção.' };
  if (intentionQuantity(value)) return { value, error: null };
  const numeric = /^[+\-\u2212]?(?:\p{Nd}+(?:[.,]\p{Nd}*)?|[.,]\p{Nd}+)$/u;
  if (numeric.test(value)) return { value, error: 'A quantidade deve ser um número inteiro maior que zero.' };
  const word = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:[-\u2010\u2011'’][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*$/u;
  if (!word.test(value)) {
    return { value, error: 'Use uma única palavra ou número, sem espaços nem outros símbolos.' };
  }
  return { value, error: null };
}

/** Nome de apresentação; os identificadores continuam sem acentos. */
export const intentionFormName = (form: IntentionForm): string => FORM_DEFINITIONS[form].name;
export const intentionFormArticle = (form: IntentionForm): 'um' | 'uma' => FORM_DEFINITIONS[form].article;

/**
 * Reconhece as silhuetas ilustradas de uma única palavra. Outras palavras moldam
 * a aparência através de seus caracteres; inteiros positivos indicam quantidade.
 * Não cria elemento, custo, poder, Projétil ou alcance. Vínculos antigos com mais
 * de uma palavra ficam preservados como texto, sem nova interpretação visual.
 */
export function inspectIntention(word: string): IntentionReading {
  const { value, error } = validateIntentionWord(word);
  if (error) return { status: 'unknown', form: null, matches: [] };
  const form = WORD_FORMS.get(wordKey(value));
  if (!form) return { status: 'unknown', form: null, matches: [] };
  return { status: 'recognized', form, matches: [form] };
}

export const resolveIntentionForm = (word: string): IntentionForm | null => inspectIntention(word).form;
