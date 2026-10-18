# Contato e propagação nos jatos mistos

Rodada local sobre `0b86a4d14e175cb7068d9a46b1ca479763589b49`, a versão da última prévia. O renderer congelado usado no comparativo tem os sete hashes de fonte conferidos contra esse commit.

## Escopo

Os contatos de Água/Gelo e Raio/Metal são trabalhados nas duas dominâncias. A sequência Água/Gelo/Fogo reutiliza o contato aquático revisado, mantendo seu pequeno fluxo de fogo. A seleção continua limitada às mesmas cinco sequências exatas; as outras misturas usam a composição genérica existente.

Os 16 jatos primários, suas alimentações, o predicado estrutural, o controlador de oito quadros, regras, efeitos, energia, textos e desenho do círculo permanecem intactos. O experimento separado de cache elétrico e a PR #19 não fazem parte desta etapa.

## Construção e movimento

- **Água/Gelo:** duas placas desiguais com faces longas e biséis substituem as pequenas tampas triangulares. Uma dobra principal desce até o pé da placa maior, passa por baixo e sobe além de sua ponta. Os contatos menores ficam discretos. Água e placas compartilham a coordenada de transporte.
- **Gelo/Água:** os prismas primários continuam rígidos; a corrente azul acompanha seus pés inclinados, estreita no contato e se abre depois dele. Uma pequena face azul dá espessura à curva de entrada. O ganho é mais discreto que na dominância aquática.
- **Raio/Metal:** uma frente alcança sucessivamente os três contatos metálicos. O contato ativo concentra uma pequena base amarela e núcleo claro, com o trajeto anterior em resíduo mais escuro. A geometria do aço permanece estável.
- **Metal/Raio:** uma carga atravessa os contatos físicos dos trilhos, em vez de iluminar todas as células juntas. Os reflexos longos do aço descem um tom existente apenas neste misto, para distinguir o salto curto da reflexão branca. A seleção do contato depende de sua posição real; não usa uma fase presa ao índice da célula que muda na volta do ciclo.

A tabela privada de oito contatos ativos evita recalcular a mesma escolha em cada pixel. Ela não guarda rasters nem altera o cache de animação. A mudança elétrica é sobretudo de propagação e hierarquia de luz, sem prometer um grande redesenho de silhueta.

## Procedência da prova

```sh
node scripts/proof-directed-streams.mjs baseline-renderer.mjs /tmp/stream-contact-final \
  0b86a4d14e175cb7068d9a46b1ca479763589b49 \
  'ULTIMA PREVIA' 'agua-gelo,gelo-agua,raio-metal,metal-raio' 'CONTATO REFINADO - LOCAL'
python scripts/compose-stream-refinement.py /tmp/stream-contact-final \
  'agua-gelo,gelo-agua' water-contact
python scripts/compose-stream-refinement.py /tmp/stream-contact-final \
  'raio-metal,metal-raio' electric-contact
```

Os modelos são interpretações reais do círculo de emissão mantida, com os materiais substituídos. A montagem contém recortes nativos e ampliação por vizinho mais próximo. Os GIFs usam oito quadros com atrasos alternados de 120/130 ms, totalizando exatamente um segundo por ciclo. O manifesto registra os modelos, a ordem dos materiais e os hashes das fontes.

Comparações: [Água/Gelo](visuals/stream-material-contacts/water-contact-night.gif) e [Raio/Metal](visuals/stream-material-contacts/electric-contact-night.gif). Há também quadros diurnos de [Água/Gelo](visuals/stream-material-contacts/water-contact-day.png) e [Raio/Metal](visuals/stream-material-contacts/electric-contact-day.png).

## Controles de escopo

A nova fixture preserva **672 quadros** da versão anterior: 16 jatos puros, seis misturas genéricas fora dos adaptadores e 20 controles estruturais dos pares revisados (forma, retorno, órbita, ausência de Estado ou de Direção). As assertivas históricas dos jatos puros continuam com os hashes originais. Só os pares deliberadamente redesenhados saem dos antigos testes de igualdade de pixels; sua geometria, materiais, continuidade e integração continuam sujeitos aos testes comportamentais atuais.

## Validação local

- `npm test -- --maxWorkers=2`: **3.184 testes / 81 arquivos**, todos passaram (100,11 s).
- Typecheck e build passaram. Permanece o aviso existente de chunk acima de 500 kB; bundle principal de 581,60 kB (199,44 kB gzip).
- Audit: zero vulnerabilidades; dependências e lockfile intactos.
- Os testes de contato verificam faces rígidas, corrente conectada, transporte comum, preservação dos topos de gelo, fogo do trio enraizado e um único contato elétrico dominante avançando pelas células.
- Em Gelo/Água, 82,6–85,0% dos pixels primários e 97–100% dos topos amostrados permanecem exatos; a água fica conectada nas oito poses. A prova de transporte interior registra mais de 99% de concordância ao deslocar corrente e placas na mesma velocidade.
- Revisão independente: **320 quadros de cenas**, **1.200 rasters fracionários** e **960 controles byte-idênticos** contra `0b86a4d`. Nenhum escape de envelope, falha da fonte, invasão do rosto, mutação de entrada ou mudança indevida. Foram inspecionadas folhas nativas, os ciclos completos, seis cópias, conceitos e companheiros em órbita; as contagens não significam julgamento artístico individual de cada amostra.


## Custo observado

Duas passagens na mesma máquina, cada uma com 30 casos e 64 amostras por versão/caso. Valores em milissegundos; as duas séries completas ficam preservadas.

| Cena | Mediana 1 | p95 1 | Mediana 2 | p95 2 |
|---|---:|---:|---:|---:|
| Água/Gelo | 1,82 → 1,86 | 2,73 → 2,54 | 1,88 → 2,03 | 2,45 → 3,13 |
| Gelo/Água | 1,79 → 1,81 | 2,66 → 2,47 | 1,74 → 1,88 | 2,57 → 2,62 |
| Raio/Metal | 2,69 → 2,73 | 3,98 → 3,37 | 2,61 → 2,62 | 3,42 → 3,27 |
| Metal/Raio | 2,49 → 2,18 | 4,21 → 2,79 | 2,44 → 2,17 | 4,03 → 2,82 |
| Água/Gelo/Fogo | 1,67 → 1,89 | 2,22 → 2,67 | 1,76 → 1,85 | 2,33 → 2,77 |
| Seis Água/Gelo | 2,50 → 2,75 | 3,38 → 3,50 | 2,52 → 2,61 | 3,39 → 3,27 |
| Seis Gelo/Água | 2,47 → 2,77 | 3,53 → 3,90 | 2,67 → 3,06 | 3,27 → 4,61 |
| Seis Raio/Metal | 4,24 → 4,12 | 5,40 → 5,35 | 4,15 → 4,05 | 5,34 → 5,11 |
| Seis Metal/Raio | 3,34 → 3,15 | 4,25 → 4,47 | 3,37 → 3,01 | 4,57 → 4,05 |
| Seis Água/Gelo/Fogo | 2,76 → 2,90 | 3,50 → 3,62 | 2,67 → 3,09 | 5,63 → 4,28 |

Há custo adicional nos contatos aquáticos, especialmente em seis Gelo/Água; a mediana elétrica Metal/Raio diminuiu nas duas passagens. O p95 também varia em controles com pixels idênticos, como Água pura com seis cópias (4,47 → 6,82 ms na primeira passagem). Não se trata de aceleração universal nem de uma conclusão estatística sobre a variabilidade.

Medidas completas: [passagem 1](visuals/stream-material-contacts/benchmark.json) e [passagem 2](visuals/stream-material-contacts/benchmark-repeat.json).

O benchmark gera rasters em Node, sem cache de imagens e com geometria aquecida. `initialEightFrameCycleMs` é a primeira passagem daquele caso no mesmo módulo já usado pelos casos anteriores, não módulo/JIT frio. Não foram medidos navegador, CPU 4× ou celular.

```sh
node scripts/benchmark-directed-streams.mjs baseline-renderer.mjs \
  /tmp/stream-contact-final /tmp/stream-contact-benchmark.json \
  'gelo-agua,metal-raio'
```

## Limites

Os detalhes de contato se reduzem nas cópias pequenas. Metal/Raio possui pequenos fragmentos de saída já presentes no checkpoint: o probe encontrou 47 amostras com componentes separados e confirmou as mesmas máscaras no baseline. Não são uma regressão desta rodada nem um corpo inteiramente conectado.

Os demais jatos mistos continuam no fallback genérico existente; esta rodada não cria desenhos próprios para todos os pares. A fonte de produção alterada é apenas `pixel-mixed-stream.ts`.
