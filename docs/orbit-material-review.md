# Órbita, rastros e interação de materiais

Revisão local baseada na PR 17 (`ac8f9de`). Não publicada.

## Órbita real

- Os membros percorrem a mesma elipse em torno da magia central. Sem núcleo, o centro continua sendo o lançador; retorno mantém o posicionamento previsto sobre a capa.
- Posição e ordem de profundidade são recalculadas em cada um dos oito quadros. Material, semente e identidade não mudam ao cruzar a metade traseira.
- Cópias visualmente iguais avançam uma posição por ciclo. Isso evita o falso movimento de oito objetos idênticos que apenas trocariam de lugar a cada quadro. Grupos mistos completam a volta e mantêm suas identidades.
- O tamanho e o raio são escolhidos para o ciclo inteiro, incluindo a proteção do rosto do mago. Escoltas sem Órbita permanecem estáticas.
- Guia mais discreto, desenhado antes dos corpos. As curvas individuais entre a mão e cada satélite foram removidas; o rastro tangente mostra o percurso orbital.

## Rastro conectado e proporcional

- Uma faixa contínua nasce em pixels ocupados da superfície traseira. O corpo é composto depois e cobre a junção.
- A base segue a seção real do ponto de ligação: uma esfera larga recebe uma saída maior, mas a ponta larga de uma lança não engrossa artificialmente o rastro da haste.
- A extensão e a largura diminuem nas cópias pequenas. Órbitas densas usam limites menores; órbitas esparsas têm margem para uma base mais cheia.
- O rastro orbital usa a elipse analítica. Nunca usa a posição anterior de um índice que pode ter sido permutado no fechamento do ciclo.
- A curva de lançamento chega à emissão com tangente horizontal e sem setas/traços paralelos amontoados. Estado, guardas e contatos de superfície continuam presentes.

## Materiais dentro da mesma forma

- O segundo material deixa de ser uma esfera pequena colada sobre o primeiro. As regiões, correntes e contatos são pintados dentro da máscara existente.
- Gravidade/Espaço, Fogo/Raio, Água/Gelo, Terra/Fogo, Metal/Raio e campos escuros têm tratamentos próprios. Outras combinações usam uma fronteira material genérica. Isso não equivale a redesenhar manualmente todas as combinações possíveis.
- O refinamento de Gravidade/Espaço abre uma região roxa na parte inferior, com dobra de retorno sob a crista azul e deslocamento da fronteira. Fogo/Raio conduz um pulso seguido da resposta da chama; Água/Gelo desvia a corrente junto à faceta rígida. O ganho mais evidente está em Gravidade/Espaço; os outros dois contatos são mais discretos.
- Os oito sprites autorais existentes são conservados quando recebem um segundo elemento. A lança de Raio+Fogo também usa o desenho autoral; a ordem dos elementos continua escolhendo a paleta primária.
- Transparência, furos e cortes escuros são preservados. Pontos máximos de luz também permanecem, exceto pelos reflexos de água não semânticos que uma placa opaca de gelo cobre dentro de regiões conhecidas. Elementos de famílias diferentes não passam a ser fundidos por esta camada visual.
- Runas conceituais continuam separadas dos materiais. Em corpos mistos, seus sinais particulares permanecem, mas o anel genérico repetido de cada aura não é empilhado sobre os demais.

## Evidência e limites

As imagens são produzidas pelo renderer do repositório, em 180 × 105 pixels; não há assets copiados ou geração de imagem. Os GIFs usam oito quadros com durações alternadas de 120/130 ms, totalizando um segundo.

O círculo enviado em fotografia serviu como referência. Os glifos legíveis incluem Gravidade, Espaço, Infinito, Esfera, Caos, Área e direções. Conexões pequenas não permitem reconstruir a ordem exata: a composição de teste é identificada como representativa. As fotografias privadas não fazem parte da documentação pública.

O controlador, cache, pausa, movimento reduzido, regras, dados de runas, ficha, login e estrutura geral da interface não foram alterados. Cada quadro é uma pose completa que pode ficar pausada.

### Refinamento Água + Gelo

A comparação dedicada `water-ice-comparison` coloca o elemento principal puro, a mistura anterior e a revisão lado a lado. A terceira linha usa realmente gelo como primeiro elemento; as outras usam água. Não há inversão artificial da ordem para escolher um sprite mais bonito.

- A esfera agora contém três placas rígidas e pontudas, com face clara, aresta e lateral azul escura. A água circula nos canais entre elas. As coordenadas das placas usam o volume fixo, para não oscilar com a crista da água.
- No dragão de água, o gelo acompanha o plano da asa e o dorso. A placa usa a mesma dobra da asa, enquanto rosto, olhos e corrente do pescoço/cauda permanecem legíveis.
- Nos dragões minúsculos, até dois pixels já ocupados da ponta da asa recebem tons de gelo. É uma indicação compacta, sem acrescentar pixels à silhueta ou alcançar o rosto; não reproduz todos os detalhes das placas grandes.
- O mapeamento anatômico pertence somente ao dragão autoral de água. Dragões de outros elementos, inclusive gelo como primeiro elemento, continuam usando sua geometria genérica; não são apresentados como redesenhados nesta etapa.
- Na mescla ligada da mesma família, a face lateral do gelo recebe um reflexo discreto da água, sem deformar a placa.

`material-v1-v2` documenta o passo anterior de refinamento das fronteiras, especialmente Gravidade/Espaço. A comparação dedicada de Água/Gelo é a referência posterior para essa dupla.

### Verificação

- `npm test -- --maxWorkers=2`: **2.644 testes aprovados em 52 arquivos**, após o refinamento final de Água/Gelo. O limite de dois workers evita competição excessiva no executor; uma execução anterior com paralelismo padrão atingiu o timeout de um teste pesado de dragão.
- `npm run build`: typecheck e build de produção aprovados. `git diff --check` aprovado.
- `npm audit --json`: nenhuma vulnerabilidade; não foram adicionadas dependências.
- As 45 descrições semânticas dos presets continuam idênticas à base. Na comparação de 352 quadros de referência, 320 são byte a byte iguais; as mudanças concentram-se nos 16 quadros de lança em voo e nos 16 de Órbita previstos para essa seleção.
- Revisão independente: 115 casos de layout, cada um nos oito quadros, sem recortes, sobreposições entre corpos/núcleo, variação de escala/raio ou mutação de entradas. Em 119 casos e 952 quadros comparados com o mesmo renderer sem rastros, nenhum pixel de outro corpo ou do rosto do mago foi coberto pelo rastro.
- 160 testes focados foram executados também pela revisão independente, incluindo pausa/movimento reduzido, órbita, material, rastro e seleção de sprites. As folhas nativas e os ciclos representativos foram inspecionados visualmente.
- O refinamento posterior de gelo tem 48 testes de material, além de quatro testes da integração de coordenadas/formas. Na comparação posterior de 288 quadros, os 240 que não contêm Água/Gelo continuam idênticos; as alterações aparecem somente nos 48 quadros dessa dupla. A exceção da asa minúscula altera somente até dois pixels já ocupados por dragão, sem alterar alpha ou rosto.

### Desempenho

Medição da integração orbital no checkpoint `2deafd4`, antes das placas mais explícitas de Água/Gelo: Node na mesma máquina, versões alternadas, 24 aquecimentos e 120 amostras por caso. Cada amostra gera o quadro inteiro sem o cache de imagens da interface. Valores em milissegundos; estes resultados não equivalem a um teste de navegador com CPU reduzida em 4×.

| Caso | Mediana anterior → atual | p95 anterior → atual |
| --- | ---: | ---: |
| Esfera de fogo com direção | 5,45 → 6,14 | 8,91 → 8,69 |
| Lança de fogo | 3,93 → 3,89 | 4,65 → 4,96 |
| Oito órbitas | 9,43 → 3,98 | 11,62 → 5,03 |
| Gravidade + Espaço | 2,32 → 2,38 | 3,29 → 3,94 |
| Órbita mista | 4,84 → 4,69 | 5,79 → 5,85 |
| Lança Raio + Fogo | 6,18 → 3,95 | 7,34 → 4,85 |
| Esfera Água + Gelo | 2,31 → 4,00 | 2,92 → 4,96 |
| Dragão Água + Gelo | 24,96 → 8,60 | 28,90 → 11,06 |

A esfera Água/Gelo agora conserva o sprite autoral animado, mais caro que a esfera genérica anterior. Não há melhora universal de tempo: Gravidade/Espaço e alguns percentis também ficaram maiores. A remoção de efeitos redundantes e a conservação do dragão autoral reduzem outros casos. O cache e o relógio da interface continuam inalterados.

Uma segunda medição comparou o checkpoint com a revisão final de gelo, alternando 80 amostras após 16 aquecimentos. Houve variação maior do executor, inclusive uma amostra anterior de 139,70 ms; os números não devem ser comparados diretamente à primeira tabela.

| Revisão final de gelo | Mediana anterior → final | p95 anterior → final |
| --- | ---: | ---: |
| Água + Gelo | 4,54 → 5,12 | 10,84 → 8,27 |
| Gelo + Água | 6,00 → 6,55 | 14,69 → 17,15 |
| Dragão Água + Gelo | 17,06 → 16,89 | 29,11 → 29,37 |

Não foi feito teste interativo de navegador nem medição de CPU 4× desta etapa. A validação pública da PR 17 é anterior e não substitui esse teste.
