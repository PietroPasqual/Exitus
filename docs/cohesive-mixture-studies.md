# Segundo lote de corpos combinados integrado localmente

Este checkpoint está integrado localmente; o termo “produção” abaixo indica o dispatcher real, não uma publicação no site.

As três construções desenvolvidas no checkpoint `89bd1a2` agora são selecionadas pelo dispatcher normal de produção, nas duas ordens de material:

- **Raio/Metal:** contatos de aço rígidos e percurso elétrico ramificado. Metal dominante conserva duas faces maiores e uma junta com descarga localizada; Raio dominante abre canais entre ramos luminosos apoiados nos dentes metálicos.
- **Água/Metal:** corrente cruza as faces do aço por baixo e pela frente. Água dominante conserva massa líquida maior; Metal dominante tem uma janela sinuosa rebaixada e um pé submerso. Aço cinza com corte duro, água azul com curvas.
- **Fogo/Terra:** blocos rugosos encaixados, fissura irregular e chama ligada ao ombro. Terra dominante conserva três volumes; Fogo dominante envolve duas rochas e encobre parte de suas raízes.

A seleção continua limitada a um corpo com exatamente dois materiais e uma única forma de esfera, sem forma de Intenção nem glifo. O primeiro material conserva a dominância. Cubos, montagens, glifos, dragões e trios mantêm suas rotas anteriores. Os pares já aceitos Fogo/Metal, Água/Gelo e Sombra/Gelo continuam intactos.

Os helpers de produção terminam em `-sphere.ts`; os nomes `Study` foram removidos dessas rotas. A integração não muda runas, regras, interpretação, desenho do círculo ou relógio de animação. Nenhuma fusão mecânica é presumida: as provas usam composição/coexistência e grupos de fusão vazios.

## Prova reproduzível, sem substituição de fonte

Os nomes históricos `proof-next-pair-studies.mjs` e `compose-next-pair-studies.py` são mantidos, mas agora a prova compila os imports reais de produção com esbuild, sem plugin de reescrita nem substituição do dispatcher. O script exige uma escolha explícita:

```sh
node scripts/proof-next-pair-studies.mjs /tmp/expanded-pair-production \
  --baseline /caminho/renderer-anterior-congelado.mjs
```

O módulo congelado deve exportar `renderPixelScene`, `layoutScene` e `boundsOfBeing`. Quando também exporta `pairSpriteOf`, a prova confirma que os novos pares ainda não eram selecionados nessa base. A produção atual nunca é compilada como se fosse o “antes”. O módulo fornecido é copiado sem alterações para a pasta de saída e seu SHA-256 fica no manifesto.

Para inspecionar apenas a produção atual:

```sh
node scripts/proof-next-pair-studies.mjs /tmp/expanded-pair-current --current-only
```

Esse modo produz 96 capturas e folhas `current-only-*`. Não apresenta uma coluna “antes”, não afirma equivalência com uma versão anterior e registra as comparações históricas como indisponíveis.

Opcionalmente, a prova pode comparar os pixels com as capturas do estudo aprovado:

```sh
node scripts/proof-next-pair-studies.mjs /tmp/expanded-pair-production \
  --baseline /caminho/renderer-anterior-congelado.mjs \
  --accepted-study /caminho/capturas-do-estudo-aprovado
```

A referência histórica usa nomes `*-study-*.rgba`; a prova atual usa `*-current-*.rgba`. Em modo comparativo, os arquivos `*-before-*.rgba` também são conferidos. Os estudos são somente uma referência de pixels, nunca parte do bundle atual.

### Saídas e verificações

- `production.bundle.mjs`: renderer e dispatcher reais; `baseline.bundle.mjs`: cópia exata da base fornecida, quando houver.
- `manifest.json`: hashes dos arquivos compilados, bundles, scripts e capturas, seleção efetiva dos seis casos, poses, limites e contagens de verificações.
- 192 capturas principais no modo comparativo: seis ordens × dois temas × oito fases × duas versões.
- Quatro PNGs e quatro GIFs: dia/noite e ambas as dominâncias. Antes/depois usam o mesmo recorte, na mesma escala 3× por vizinho mais próximo. Cada linha também mostra a cena completa 180 × 105 e os recortes em 1×. Rótulos ficam abaixo dos recortes nativos.
- Cada GIF tem oito quadros com durações alternadas de 120/130 ms, totalizando um segundo. O compositor reabre os arquivos para conferir quantidade de quadros, duração e repetição.
- Cada render e cálculo de layout mantém os dados de entrada; os limites conservadores do corpo cabem na cena. Nos seis casos principais, esses limites também cabem no recorte comparativo.
- Todas as oito fases são comparadas com a fase correspondente no ciclo seguinte. O script confirma que os seis novos casos passam pelo dispatcher de produção.
- 41 fixtures de controle: cinco materiais puros, seis ordens dos pares já aceitos e seis casos de cada exclusão (cubo, montagem, glifo, dragão e trio). Com dois temas e oito fases, são 656 comparações byte a byte contra a base congelada.

## Resultado verificado da integração

A execução de 17 de outubro de 2026 utilizou a base congelada com SHA-256 `b3f72d5f187b272cb68d042ef6336b292278df92e4bd9a07eb2c67a6873b15b8` e as capturas do estudo aprovado. A prova passou com:

- 192 capturas principais e zero substituições de fonte.
- 192 comparações byte a byte idênticas às capturas do estudo aprovado, incluindo as referências “antes”. Os 96 quadros novos de produção preservam exatamente a arte aprovada, nas duas dominâncias e nos dois temas.
- 656 controles fora do escopo byte-idênticos à base, incluindo os seis casos dos pares anteriormente aceitos.
- 1.504 verificações de repetição de oito quadros e 3.008 verificações de entrada inalterada e enquadramento.
- Quatro GIFs verificados, com oito quadros e um segundo cada; folhas revisadas visualmente em 3× e 1×.

As capturas principais mostram a colocação frontal. Essa equivalência não afirma que cenas com cópias, Órbita ou retorno tenham sido capturadas por este script; sua validação de integração deve ser registrada separadamente. Também não substitui a suíte completa nem um benchmark da produção integrada.

## Limites visuais e de medição

Raio/Metal continua sendo a composição mais estilizada. Em tamanhos mínimos, materiais viram pistas de poucos pixels e algumas poses podem se repetir. O ciclo contém sustentação intencional; oito fases não significam oito desenhos necessariamente únicos. Os limites conferidos são do corpo conservador, sem a extensão intencional de brilho suave e rastros; a cena nativa completa continua visível nas folhas.

O benchmark de 26 cenas do checkpoint anterior não mede estes novos pares integrados nem comprova desempenho móvel. Medições do renderer integrado precisam identificar seu próprio conjunto de cenas, aquecimento, cache e ambiente.


## Revisão independente da integração

A revisão comparou a fonte com o checkpoint `89bd1a22afeafcc72c0aafc8a41e417f43444978` sem alterar o repositório:

- 1.552 quadros de cena, nas seis ordens, em dia/noite e todas as fases: frente, toque, longe, retorno real `self+back`, voo, cópias, conceitos e órbitas com 1/2/3/4/6/8 seres. Nenhum corpo vazio, escape do envelope, invasão do rosto ou mudança de escala ajustada conforme a fase.
- 3.840 rasters isolados: seis ordens, oito escalas de 1 a 20, cinco origens fracionárias, dois sentidos e oito fases. Todos não vazios, conectados, espelhados exatamente e dentro dos limites. Normalização de fases inválidas, negativas e repetidas aprovada.
- 976 controles RGBA exatos para materiais puros, pares anteriores, formas não esféricas, montagens, glifos, dragões, corpos livres e terceiros materiais. Nenhuma diferença.
- Os 96 quadros herói reproduzem exatamente o estudo aceito. Foram inspecionadas folhas nativas de dia/noite, retorno e ciclos completos de oito orbitadores.
- 144 quadros adicionais com quatro a oito conceitos: nenhum pixel de corpo visível ou rosto sobrescrito pelas auras.
- Auditoria separada de 1.009 seleções/exclusões e 23 testes do controlador/pausa/reduced motion. Nenhuma mudança em core, dados, narrativa, círculo, controlador ou montagem da cena neste lote.

O valor de Intenção `8` continua sujeito ao limite existente de seis cópias. Os testes de oito orbitadores usam oito seres reais. Muitas auras sobre miniaturas ainda tornam a cena visualmente densa; segurança de sobreposição não equivale a legibilidade de cada detalhe individual.

## Validação final do checkpoint local

Em 17 de outubro de 2026, após a integração:

- `npm test -- --maxWorkers=2`: **2.946 testes em 69 arquivos**, todos aprovados.
- `npm run typecheck` e `npm run build`: aprovados. O build mantém o aviso existente de um chunk acima de 500 kB; o maior chunk JS desta revisão tem 565,01 kB antes de gzip.
- `npm audit --json`: zero vulnerabilidades; nenhuma dependência adicionada ou alterada.
- `git diff --check`: aprovado. Nenhuma alteração deste lote em `src/core`, `src/data`, controlador, desenho de círculo ou arquivos de dependências.

A primeira execução revelou um controle antigo de Metal/Raio que ainda exigia o envelope do metal puro, agora substituído intencionalmente pela construção do par. O teste de fallback foi mantido com Metal/Natureza; os controles dedicados de Metal/Raio verificam seu envelope novo. O sweep legado de 200 silhuetas excedeu o limite padrão de cinco segundos na execução concorrente; recebeu um limite local de 15 segundos. Os 241 testes afetados e a suíte completa passaram após esses ajustes, sem mudanças adicionais no renderer.


## Medição do renderer integrado

Comparação no mesmo processo Node contra o renderer congelado de `89bd1a2`: 40 cenas, oito fases, dois aquecimentos e seis rodadas medidas com alternância da ordem das versões em cada caso. São 1.920 amostras por versão, além de 320 amostras do primeiro ciclo. O cache de imagens da UI foi contornado; os caches geométricos reais continuam ativos. Inclui heróis, seis cópias, oito orbitadores, trios/quartetos, 8/16 constituintes e quatro/oito conceitos.

Comando reproduzível:

```sh
node scripts/benchmark-expanded-pairs.mjs /caminho/renderer-89bd1a2.mjs /tmp/expanded-pairs-benchmark
```

| Cena | Mediana antes → atual (ms) | p95 antes → atual (ms) |
| --- | ---: | ---: |
| Conjunto de 40 cenas | 6.97 → 7.12 | 17.14 → 16.70 |
| Raio/Metal | 2.77 → 5.94 | 3.83 → 8.73 |
| Metal/Raio | 3.43 → 4.66 | 4.18 → 5.91 |
| Água/Metal | 5.89 → 2.70 | 9.43 → 5.46 |
| Metal/Água | 4.05 → 2.78 | 6.31 → 8.81 |
| Fogo/Terra | 6.65 → 3.55 | 8.66 → 7.12 |
| Terra/Fogo | 4.27 → 2.97 | 9.40 → 7.39 |
| Seis cópias Raio/Metal | 5.22 → 14.17 | 7.55 → 24.95 |
| Oito orbitadores Raio/Metal | 4.55 → 8.97 | 7.02 → 13.98 |
| Seis cópias Metal/Água | 9.05 → 3.24 | 17.11 → 24.17 |
| Seis cópias Terra/Fogo | 15.60 → 5.42 | 22.17 → 15.47 |
| Oito orbitadores de pares com quatro conceitos | 11.13 → 11.98 | 14.94 → 16.06 |
| Oito orbitadores com oito conceitos | 14.34 → 13.79 | 18.92 → 17.61 |

Primeiro ciclo da execução: mediana 7.77 → 6.97 ms; p95 20.53 → 18.01 ms; máximo 56.36 → 40.30 ms. Essa ordem inicial não é um teste controlado de cold start de navegador.

**Limite importante:** Raio/Metal custa mais que a divisão genérica anterior, sobretudo com seis cópias. Água/Metal e Fogo/Terra são mais baratos em vários cenários; isso não compensa automaticamente o custo elétrico em qualquer composição. A distribuição global próxima também não significa aceleração universal. Há variação entre execuções no host compartilhado; não se atribui uma melhora de tempo à micro-otimização isolada sem medição limpa específica.

A otimização elétrica reutiliza uma projeção de trajeto já calculada no mesmo pixel; não adiciona cache de quadros, temporizador ou armazenamento persistente. A equivalência exigiu 2.560 rasters e 384 cenas com pixels/limites idênticos. A prova principal foi regenerada na fonte final, e seus quatro GIFs são byte-idênticos aos anteriores à otimização.

Não houve teste interativo em navegador, CPU 4× ou dispositivo móvel neste lote. Estes tempos são evidência comparativa do renderer Node, não garantia de fluidez móvel.

Hashes da medição final:
- Base: `e5197b24340bef61c3c94724143c60989ee823e6910d4e84077d7c0794f63a74`
- Renderer atual: `81c53e04250cd0f1073ec2bc7928ec6880eebd2deff7419c95f5ce33623814af`
