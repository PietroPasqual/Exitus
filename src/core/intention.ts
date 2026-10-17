/** Silhuetas visuais que a palavra de Intenção pode dar à matéria já existente. */
export type IntentionForm =
  | 'lanca' | 'espada' | 'escudo' | 'flecha' | 'martelo' | 'parede' | 'machado'
  | 'adaga' | 'foice' | 'arco' | 'tridente' | 'chicote' | 'corrente' | 'cajado' | 'picareta' | 'kunai' | 'agulha'
  | 'bomba' | 'esfera' | 'cubo' | 'piramide' | 'cone' | 'anel' | 'estrela' | 'espiral' | 'cruz'
  | 'coracao' | 'coroa' | 'chave' | 'cristal' | 'mao' | 'explosao'
  | 'arvore' | 'flor' | 'folha' | 'raiz' | 'vinha' | 'asa' | 'garra' | 'presa' | 'serpente' | 'dragao' | 'lobo' | 'passaro' | 'tentaculo'
  | 'shuriken' | 'mangual' | 'clava' | 'besta' | 'bumerangue' | 'disco' | 'armadura' | 'elmo' | 'manopla' | 'bota' | 'livro' | 'pergaminho'
  | 'fenix' | 'urso' | 'leao' | 'raposa' | 'gato' | 'morcego' | 'aranha' | 'escorpiao' | 'tartaruga' | 'peixe' | 'tubarao' | 'cogumelo'
  | 'raio' | 'chama' | 'gota' | 'onda' | 'tornado' | 'nuvem' | 'sol' | 'lua' | 'meteoro' | 'cometa' | 'ampulheta' | 'cranio'
  | 'cavalo' | 'coruja' | 'coelho' | 'cervo' | 'javali' | 'elefante' | 'rinoceronte' | 'touro' | 'gorila' | 'crocodilo' | 'polvo' | 'escaravelho'
  | 'golem' | 'gigante' | 'esqueleto' | 'zumbi' | 'fantasma' | 'demonio' | 'anjo' | 'unicornio' | 'grifo' | 'hidra' | 'slime' | 'quimera'
  | 'portal' | 'jaula' | 'ponte' | 'escada' | 'torre' | 'pilar' | 'teia' | 'rede' | 'ancora' | 'engrenagem' | 'sino' | 'lanterna'
  | 'tesoura' | 'serra' | 'broca' | 'pa' | 'enxada' | 'balanca' | 'frasco' | 'calice' | 'mascara' | 'olho' | 'boca'
  | 'arpao' | 'tonfa' | 'nunchaku' | 'sai' | 'kusarigama' | 'cimitarra' | 'cutelo' | 'canhao' | 'zarabatana' | 'estilingue' | 'lamina' | 'balista'
  | 'tigre' | 'cachorro' | 'rato' | 'esquilo' | 'ourico' | 'pinguim' | 'pavao' | 'flamingo' | 'sapo' | 'camaleao' | 'medusa' | 'baleia'
  | 'vampiro' | 'lobisomem' | 'centauro' | 'minotauro' | 'sereia' | 'harpia' | 'gargula' | 'basilisco' | 'fada' | 'duende' | 'ogro' | 'ciclope'
  | 'cacto' | 'bambu' | 'palmeira' | 'samambaia' | 'trigo' | 'milho' | 'abobora' | 'morango' | 'uva' | 'cereja' | 'semente' | 'bolota'
  | 'bau' | 'barril' | 'caixao' | 'trono' | 'espelho' | 'moeda' | 'pena' | 'harpa' | 'violino' | 'flauta' | 'tambor' | 'vassoura'
  | 'castelo' | 'casa' | 'cabana' | 'templo' | 'tenda' | 'navio' | 'barco' | 'carroca' | 'roda' | 'cupula' | 'totem' | 'tumulo';

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
  cranio: { name: 'Crânio', article: 'um', category: 'Objetos e geometria', words: ['crânio', 'crânios', 'caveira', 'caveiras'] },
  cavalo: { name: 'Cavalo', article: 'um', category: 'Natureza e criaturas', words: ['cavalo', 'cavalos', 'égua', 'éguas', 'corcel', 'corcéis', 'pônei', 'pôneis', 'potro', 'potros'] },
  coruja: { name: 'Coruja', article: 'uma', category: 'Natureza e criaturas', words: ['coruja', 'corujas', 'mocho', 'mochos', 'caburé', 'caburés'] },
  coelho: { name: 'Coelho', article: 'um', category: 'Natureza e criaturas', words: ['coelho', 'coelhos', 'coelha', 'coelhas', 'lebre', 'lebres'] },
  cervo: { name: 'Cervo', article: 'um', category: 'Natureza e criaturas', words: ['cervo', 'cervos', 'veado', 'veados', 'alce', 'alces', 'corsa', 'corsas', 'rena', 'renas'] },
  javali: { name: 'Javali', article: 'um', category: 'Natureza e criaturas', words: ['javali', 'javalis', 'porco', 'porcos', 'porca', 'porcas', 'caititu', 'caititus'] },
  elefante: { name: 'Elefante', article: 'um', category: 'Natureza e criaturas', words: ['elefante', 'elefantes', 'mamute', 'mamutes'] },
  rinoceronte: { name: 'Rinoceronte', article: 'um', category: 'Natureza e criaturas', words: ['rinoceronte', 'rinocerontes', 'rino', 'rinos'] },
  touro: { name: 'Touro', article: 'um', category: 'Natureza e criaturas', words: ['touro', 'touros', 'boi', 'bois', 'vaca', 'vacas', 'búfalo', 'búfalos', 'bisão', 'bisões'] },
  gorila: { name: 'Gorila', article: 'um', category: 'Natureza e criaturas', words: ['gorila', 'gorilas', 'símio', 'símios', 'macaco', 'macacos', 'primata', 'primatas'] },
  crocodilo: { name: 'Crocodilo', article: 'um', category: 'Natureza e criaturas', words: ['crocodilo', 'crocodilos', 'jacaré', 'jacarés', 'caimão', 'caimões', 'aligátor', 'aligátores'] },
  polvo: { name: 'Polvo', article: 'um', category: 'Natureza e criaturas', words: ['polvo', 'polvos', 'octópode', 'octópodes', 'kraken', 'krakens'] },
  escaravelho: { name: 'Escaravelho', article: 'um', category: 'Natureza e criaturas', words: ['escaravelho', 'escaravelhos', 'besouro', 'besouros', 'coleóptero', 'coleópteros'] },
  golem: { name: 'Golem', article: 'um', category: 'Criaturas míticas', words: ['golem', 'golens', 'golems'] },
  gigante: { name: 'Gigante', article: 'um', category: 'Criaturas míticas', words: ['gigante', 'gigantes', 'titã', 'titãs', 'colosso', 'colossos'] },
  esqueleto: { name: 'Esqueleto', article: 'um', category: 'Criaturas míticas', words: ['esqueleto', 'esqueletos', 'ossada', 'ossadas'] },
  zumbi: { name: 'Zumbi', article: 'um', category: 'Criaturas míticas', words: ['zumbi', 'zumbis', 'zombie', 'zombies', 'morto-vivo', 'mortos-vivos', 'cadáver', 'cadáveres'] },
  fantasma: { name: 'Fantasma', article: 'um', category: 'Criaturas míticas', words: ['fantasma', 'fantasmas', 'espectro', 'espectros', 'assombração', 'assombrações', 'aparição', 'aparições'] },
  demonio: { name: 'Demônio', article: 'um', category: 'Criaturas míticas', words: ['demônio', 'demônios', 'diabo', 'diabos'] },
  anjo: { name: 'Anjo', article: 'um', category: 'Criaturas míticas', words: ['anjo', 'anjos', 'arcanjo', 'arcanjos', 'serafim', 'serafins', 'querubim', 'querubins'] },
  unicornio: { name: 'Unicórnio', article: 'um', category: 'Criaturas míticas', words: ['unicórnio', 'unicórnios', 'unicórnia', 'unicórnias'] },
  grifo: { name: 'Grifo', article: 'um', category: 'Criaturas míticas', words: ['grifo', 'grifos', 'hipogrifo', 'hipogrifos'] },
  hidra: { name: 'Hidra', article: 'uma', category: 'Criaturas míticas', words: ['hidra', 'hidras'] },
  slime: { name: 'Slime', article: 'um', category: 'Criaturas míticas', words: ['slime', 'slimes', 'gosma', 'gosmas', 'limo', 'limos', 'gelatina', 'gelatinas'] },
  quimera: { name: 'Quimera', article: 'uma', category: 'Criaturas míticas', words: ['quimera', 'quimeras'] },
  portal: { name: 'Portal', article: 'um', category: 'Construções', words: ['portal', 'portais', 'pórtico', 'pórticos', 'arcada', 'arcadas', 'portão', 'portões'] },
  jaula: { name: 'Jaula', article: 'uma', category: 'Construções', words: ['jaula', 'jaulas', 'gaiola', 'gaiolas', 'cela', 'celas'] },
  ponte: { name: 'Ponte', article: 'uma', category: 'Construções', words: ['ponte', 'pontes', 'passarela', 'passarelas', 'viaduto', 'viadutos'] },
  escada: { name: 'Escada', article: 'uma', category: 'Construções', words: ['escada', 'escadas', 'escadaria', 'escadarias'] },
  torre: { name: 'Torre', article: 'uma', category: 'Construções', words: ['torre', 'torres', 'torreão', 'torreões', 'atalaia', 'atalaias'] },
  pilar: { name: 'Pilar', article: 'um', category: 'Construções', words: ['pilar', 'pilares', 'coluna', 'colunas', 'pilastra', 'pilastras'] },
  teia: { name: 'Teia', article: 'uma', category: 'Construções', words: ['teia', 'teias', 'teia-de-aranha', 'teias-de-aranha'] },
  rede: { name: 'Rede', article: 'uma', category: 'Construções', words: ['rede', 'redes', 'malha', 'malhas', 'grade', 'grades', 'tela', 'telas'] },
  ancora: { name: 'Âncora', article: 'uma', category: 'Equipamentos', words: ['âncora', 'âncoras', 'ancorote', 'ancorotes'] },
  engrenagem: { name: 'Engrenagem', article: 'uma', category: 'Equipamentos', words: ['engrenagem', 'engrenagens', 'roda-dentada', 'rodas-dentadas'] },
  sino: { name: 'Sino', article: 'um', category: 'Equipamentos', words: ['sino', 'sinos', 'sineta', 'sinetas', 'campainha', 'campainhas'] },
  lanterna: { name: 'Lanterna', article: 'uma', category: 'Equipamentos', words: ['lanterna', 'lanternas', 'lampião', 'lampiões', 'lamparina', 'lamparinas', 'luminária', 'luminárias'] },
  tesoura: { name: 'Tesoura', article: 'uma', category: 'Equipamentos', words: ['tesoura', 'tesouras', 'cisalha', 'cisalhas', 'tesourão', 'tesourões'] },
  serra: { name: 'Serra', article: 'uma', category: 'Equipamentos', words: ['serra', 'serras', 'serrote', 'serrotes'] },
  broca: { name: 'Broca', article: 'uma', category: 'Equipamentos', words: ['broca', 'brocas', 'perfurador', 'perfuradores', 'trivela', 'trivelas'] },
  pa: { name: 'Pá', article: 'uma', category: 'Equipamentos', words: ['pá', 'pás', 'pazinha', 'pazinhas'] },
  enxada: { name: 'Enxada', article: 'uma', category: 'Equipamentos', words: ['enxada', 'enxadas', 'sacho', 'sachos', 'enxadão', 'enxadões'] },
  balanca: { name: 'Balança', article: 'uma', category: 'Equipamentos', words: ['balança', 'balanças', 'balancinha', 'balancinhas'] },
  frasco: { name: 'Frasco', article: 'um', category: 'Equipamentos', words: ['frasco', 'frascos', 'garrafa', 'garrafas', 'vidro', 'vidros', 'ampola', 'ampolas', 'poção', 'poções'] },
  calice: { name: 'Cálice', article: 'um', category: 'Equipamentos', words: ['cálice', 'cálices', 'taça', 'taças', 'copa', 'copas', 'graal'] },
  mascara: { name: 'Máscara', article: 'uma', category: 'Equipamentos', words: ['máscara', 'máscaras', 'careta', 'caretas', 'visor', 'visores'] },
  olho: { name: 'Olho', article: 'um', category: 'Natureza e criaturas', words: ['olho', 'olhos', 'íris', 'pupila', 'pupilas', 'ocular', 'oculares'] },
  boca: { name: 'Boca', article: 'uma', category: 'Natureza e criaturas', words: ['boca', 'bocas', 'mandíbula', 'mandíbulas', 'maxilar', 'maxilares', 'fauce', 'fauces'] },
  arpao: { name: 'Arpão', article: 'um', category: 'Armas', words: ['arpão', 'arpões'] },
  tonfa: { name: 'Tonfa', article: 'uma', category: 'Armas', words: ['tonfa', 'tonfas', 'cassetete', 'cassetetes'] },
  nunchaku: { name: 'Nunchaku', article: 'um', category: 'Armas', words: ['nunchaku', 'nunchakus', 'nunchuck', 'nunchucks'] },
  sai: { name: 'Sai', article: 'um', category: 'Armas', words: ['sai', 'sais'] },
  kusarigama: { name: 'Kusarigama', article: 'uma', category: 'Armas', words: ['kusarigama', 'kusarigamas'] },
  cimitarra: { name: 'Cimitarra', article: 'uma', category: 'Armas', words: ['cimitarra', 'cimitarras', 'alfanje', 'alfanjes'] },
  cutelo: { name: 'Cutelo', article: 'um', category: 'Armas', words: ['cutelo', 'cutelos', 'facão', 'facões'] },
  canhao: { name: 'Canhão', article: 'um', category: 'Armas', words: ['canhão', 'canhões', 'bombarda', 'bombardas'] },
  zarabatana: { name: 'Zarabatana', article: 'uma', category: 'Armas', words: ['zarabatana', 'zarabatanas'] },
  estilingue: { name: 'Estilingue', article: 'um', category: 'Armas', words: ['estilingue', 'estilingues', 'funda', 'fundas', 'atiradeira', 'atiradeiras'] },
  lamina: { name: 'Lâmina', article: 'uma', category: 'Armas', words: ['lâmina', 'lâminas', 'gume', 'gumes'] },
  balista: { name: 'Balista', article: 'uma', category: 'Armas', words: ['balista', 'balistas', 'escorpião-balista', 'escorpiões-balistas'] },
  tigre: { name: 'Tigre', article: 'um', category: 'Natureza e criaturas', words: ['tigre', 'tigres', 'tigresa', 'tigresas'] },
  cachorro: { name: 'Cachorro', article: 'um', category: 'Natureza e criaturas', words: ['cachorro', 'cachorros', 'cão', 'cães', 'cadela', 'cadelas', 'cachorrinho', 'cachorrinhos'] },
  rato: { name: 'Rato', article: 'um', category: 'Natureza e criaturas', words: ['rato', 'ratos', 'rata', 'ratas', 'camundongo', 'camundongos', 'ratazana', 'ratazanas'] },
  esquilo: { name: 'Esquilo', article: 'um', category: 'Natureza e criaturas', words: ['esquilo', 'esquilos', 'esquila', 'esquilas'] },
  ourico: { name: 'Ouriço', article: 'um', category: 'Natureza e criaturas', words: ['ouriço', 'ouriços', 'ouriço-cacheiro', 'ouriços-cacheiros', 'porco-espinho', 'porcos-espinhos'] },
  pinguim: { name: 'Pinguim', article: 'um', category: 'Natureza e criaturas', words: ['pinguim', 'pinguins'] },
  pavao: { name: 'Pavão', article: 'um', category: 'Natureza e criaturas', words: ['pavão', 'pavões', 'pavoa', 'pavoas'] },
  flamingo: { name: 'Flamingo', article: 'um', category: 'Natureza e criaturas', words: ['flamingo', 'flamingos'] },
  sapo: { name: 'Sapo', article: 'um', category: 'Natureza e criaturas', words: ['sapo', 'sapos', 'rã', 'rãs', 'perereca', 'pererecas'] },
  camaleao: { name: 'Camaleão', article: 'um', category: 'Natureza e criaturas', words: ['camaleão', 'camaleões', 'iguana', 'iguanas', 'lagarto', 'lagartos', 'lagartixa', 'lagartixas'] },
  medusa: { name: 'Água-viva', article: 'uma', category: 'Natureza e criaturas', words: ['água-viva', 'águas-vivas', 'medusa', 'medusas', 'alforreca', 'alforrecas'] },
  baleia: { name: 'Baleia', article: 'uma', category: 'Natureza e criaturas', words: ['baleia', 'baleias', 'jubarte', 'jubartes', 'cachalote', 'cachalotes'] },
  vampiro: { name: 'Vampiro', article: 'um', category: 'Criaturas míticas', words: ['vampiro', 'vampiros', 'vampira', 'vampiras', 'nosferatu'] },
  lobisomem: { name: 'Lobisomem', article: 'um', category: 'Criaturas míticas', words: ['lobisomem', 'lobisomens', 'licântropo', 'licântropos'] },
  centauro: { name: 'Centauro', article: 'um', category: 'Criaturas míticas', words: ['centauro', 'centauros', 'centaura', 'centauras'] },
  minotauro: { name: 'Minotauro', article: 'um', category: 'Criaturas míticas', words: ['minotauro', 'minotauros', 'minotaura', 'minotauras'] },
  sereia: { name: 'Sereia', article: 'uma', category: 'Criaturas míticas', words: ['sereia', 'sereias', 'tritão', 'tritões'] },
  harpia: { name: 'Harpia', article: 'uma', category: 'Criaturas míticas', words: ['harpia', 'harpias'] },
  gargula: { name: 'Gárgula', article: 'uma', category: 'Criaturas míticas', words: ['gárgula', 'gárgulas', 'gárgula-alada', 'gárgulas-aladas'] },
  basilisco: { name: 'Basilisco', article: 'um', category: 'Criaturas míticas', words: ['basilisco', 'basiliscos', 'cocatriz', 'cocatrizes'] },
  fada: { name: 'Fada', article: 'uma', category: 'Criaturas míticas', words: ['fada', 'fadas', 'pixie', 'pixies', 'silfo', 'silfos', 'sílfide', 'sílfides'] },
  duende: { name: 'Duende', article: 'um', category: 'Criaturas míticas', words: ['duende', 'duendes', 'gnomo', 'gnomos', 'goblin', 'goblins'] },
  ogro: { name: 'Ogro', article: 'um', category: 'Criaturas míticas', words: ['ogro', 'ogros', 'ogra', 'ogras', 'troll', 'trolls'] },
  ciclope: { name: 'Ciclope', article: 'um', category: 'Criaturas míticas', words: ['ciclope', 'ciclopes'] },
  cacto: { name: 'Cacto', article: 'um', category: 'Plantas e frutos', words: ['cacto', 'cactos', 'cáctus', 'mandacaru', 'mandacarus'] },
  bambu: { name: 'Bambu', article: 'um', category: 'Plantas e frutos', words: ['bambu', 'bambus', 'taquara', 'taquaras', 'taboca', 'tabocas'] },
  palmeira: { name: 'Palmeira', article: 'uma', category: 'Plantas e frutos', words: ['palmeira', 'palmeiras', 'coqueiro', 'coqueiros', 'tamareira', 'tamareiras'] },
  samambaia: { name: 'Samambaia', article: 'uma', category: 'Plantas e frutos', words: ['samambaia', 'samambaias', 'avenca', 'avencas', 'feto', 'fetos'] },
  trigo: { name: 'Trigo', article: 'um', category: 'Plantas e frutos', words: ['trigo', 'trigos', 'espiga', 'espigas', 'centeio', 'centeios'] },
  milho: { name: 'Milho', article: 'um', category: 'Plantas e frutos', words: ['milho', 'milhos', 'maçaroca', 'maçarocas', 'sabugo', 'sabugos'] },
  abobora: { name: 'Abóbora', article: 'uma', category: 'Plantas e frutos', words: ['abóbora', 'abóboras', 'jerimum', 'jerimuns', 'moranga', 'morangas'] },
  morango: { name: 'Morango', article: 'um', category: 'Plantas e frutos', words: ['morango', 'morangos'] },
  uva: { name: 'Uva', article: 'uma', category: 'Plantas e frutos', words: ['uva', 'uvas', 'cacho', 'cachos'] },
  cereja: { name: 'Cereja', article: 'uma', category: 'Plantas e frutos', words: ['cereja', 'cerejas', 'ginja', 'ginjas'] },
  semente: { name: 'Semente', article: 'uma', category: 'Plantas e frutos', words: ['semente', 'sementes', 'grão', 'grãos', 'feijão', 'feijões'] },
  bolota: { name: 'Bolota', article: 'uma', category: 'Plantas e frutos', words: ['bolota', 'bolotas'] },
  bau: { name: 'Baú', article: 'um', category: 'Artefatos e instrumentos', words: ['baú', 'baús', 'arca', 'arcas', 'cofre', 'cofres'] },
  barril: { name: 'Barril', article: 'um', category: 'Artefatos e instrumentos', words: ['barril', 'barris', 'tonel', 'tonéis', 'barrica', 'barricas'] },
  caixao: { name: 'Caixão', article: 'um', category: 'Artefatos e instrumentos', words: ['caixão', 'caixões', 'ataúde', 'ataúdes', 'féretro', 'féretros', 'sarcófago', 'sarcófagos'] },
  trono: { name: 'Trono', article: 'um', category: 'Artefatos e instrumentos', words: ['trono', 'tronos', 'cadeirão', 'cadeirões', 'cátedra', 'cátedras'] },
  espelho: { name: 'Espelho', article: 'um', category: 'Artefatos e instrumentos', words: ['espelho', 'espelhos', 'espelhinho', 'espelhinhos'] },
  moeda: { name: 'Moeda', article: 'uma', category: 'Artefatos e instrumentos', words: ['moeda', 'moedas', 'medalha', 'medalhas', 'medalhão', 'medalhões', 'dobrão', 'dobrões'] },
  pena: { name: 'Pena', article: 'uma', category: 'Artefatos e instrumentos', words: ['pena', 'penas', 'pluma', 'plumas', 'plumagem', 'plumagens'] },
  harpa: { name: 'Harpa', article: 'uma', category: 'Artefatos e instrumentos', words: ['harpa', 'harpas', 'lira', 'liras'] },
  violino: { name: 'Violino', article: 'um', category: 'Artefatos e instrumentos', words: ['violino', 'violinos', 'rabeca', 'rabecas', 'viola', 'violas'] },
  flauta: { name: 'Flauta', article: 'uma', category: 'Artefatos e instrumentos', words: ['flauta', 'flautas', 'pífaro', 'pífaros', 'flautim', 'flautins'] },
  tambor: { name: 'Tambor', article: 'um', category: 'Artefatos e instrumentos', words: ['tambor', 'tambores', 'bombo', 'bombos', 'tamborim', 'tamborins', 'atabaque', 'atabaques'] },
  vassoura: { name: 'Vassoura', article: 'uma', category: 'Artefatos e instrumentos', words: ['vassoura', 'vassouras', 'vassourinha', 'vassourinhas'] },
  castelo: { name: 'Castelo', article: 'um', category: 'Construções', words: ['castelo', 'castelos', 'fortaleza', 'fortalezas', 'forte', 'fortes', 'cidadela', 'cidadelas'] },
  casa: { name: 'Casa', article: 'uma', category: 'Construções', words: ['casa', 'casas', 'casinha', 'casinhas', 'moradia', 'moradias', 'residência', 'residências'] },
  cabana: { name: 'Cabana', article: 'uma', category: 'Construções', words: ['cabana', 'cabanas', 'choupana', 'choupanas', 'casebre', 'casebres', 'chalé', 'chalés'] },
  templo: { name: 'Templo', article: 'um', category: 'Construções', words: ['templo', 'templos', 'santuário', 'santuários', 'panteão', 'panteões'] },
  tenda: { name: 'Tenda', article: 'uma', category: 'Construções', words: ['tenda', 'tendas', 'barraca', 'barracas', 'pavilhão', 'pavilhões'] },
  navio: { name: 'Navio', article: 'um', category: 'Construções', words: ['navio', 'navios', 'nau', 'naus', 'galeão', 'galeões', 'fragata', 'fragatas', 'veleiro', 'veleiros'] },
  barco: { name: 'Barco', article: 'um', category: 'Construções', words: ['barco', 'barcos', 'bote', 'botes', 'canoa', 'canoas', 'batel', 'batéis'] },
  carroca: { name: 'Carroça', article: 'uma', category: 'Construções', words: ['carroça', 'carroças', 'carroção', 'carroções', 'carro-de-boi', 'carros-de-boi'] },
  roda: { name: 'Roda', article: 'uma', category: 'Construções', words: ['roda', 'rodas', 'rodinha', 'rodinhas', 'rodado', 'rodados'] },
  cupula: { name: 'Cúpula', article: 'uma', category: 'Construções', words: ['cúpula', 'cúpulas', 'domo', 'domos', 'abóbada', 'abóbadas'] },
  totem: { name: 'Totem', article: 'um', category: 'Construções', words: ['totem', 'totens', 'ídolo', 'ídolos', 'efígie', 'efígies'] },
  tumulo: { name: 'Túmulo', article: 'um', category: 'Construções', words: ['túmulo', 'túmulos', 'lápide', 'lápides', 'sepultura', 'sepulturas', 'tumba', 'tumbas'] }
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
