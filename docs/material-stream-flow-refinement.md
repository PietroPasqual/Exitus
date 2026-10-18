# Refinamento do fluxo dos jatos

Revisão local sobre `fa1467de0b95c95eba32eab366fd2b454ae93857`, a prévia de 16 materiais e cinco misturas avaliada pelo usuário. A comparação desta rodada usa esse checkpoint local, e não a versão publicada da PR20.

## Escopo artístico

- **Terra:** dois agregados de tamanhos diferentes, planos oblíquos, quinas lascadas e fraturas curtas. A massa avança dentro de uma alimentação de pó contínua.
- **Gelo:** três prismas sobrepostos em dois planos, com faces inclinadas rígidas, biséis e espessura escura. O desenho deixa de ser uma fila de picos triangulares.
- **Natureza:** uma fibra mais larga e uma raiz mais fina se cruzam em profundidade. Duas superfícies foliares desiguais abrem ao longo do percurso, com interior escuro e nervura curta.
- **Raio/Metal e Metal/Raio:** a descarga chega à borda móvel, concentra luz no contato, salta para o trecho seguinte e deixa um resíduo menor. As faces de aço continuam legíveis. A versão com Raio dominante reserva seus picos de luz para esses contatos.

Gelo/Água também muda por usar o desenho primário de Gelo. Sua corrente inferior é um controle visual obrigatório. Água/Gelo e Água/Gelo/Fogo usam suas próprias placas e ficam idênticos ao checkpoint.

A seleção estrutural, os 16 materiais disponíveis, a ordem de dominância, o envelope, a alimentação ligada à mão, o layout e o controlador de animação não mudam nesta rodada. Tampouco mudam as descrições, interpretação, energia, efeitos das runas ou desenho do círculo. A produção altera somente os dois painters de jatos.

## Comparação reproduzível

Com o renderer congelado do checkpoint disponível:

```sh
node scripts/proof-directed-streams.mjs baseline-renderer.mjs /tmp/stream-refinement-final \
  fa1467de0b95c95eba32eab366fd2b454ae93857 \
  'PREVIA ANTERIOR' 'terra,gelo,natureza,raio-metal' 'REFINADO - LOCAL'
python scripts/compose-stream-refinement.py /tmp/stream-refinement-final
node scripts/benchmark-directed-streams.mjs baseline-renderer.mjs \
  /tmp/stream-refinement-final /tmp/stream-refinement-benchmark.json \
  'terra,natureza,metal-raio,gelo-agua'
```

Os círculos são interpretados pelo motor real e renderizados pela rota de produção, sem substituir dispatcher ou montar uma imagem ilustrativa. O manifesto registra os modelos, materiais, descrições, hashes dos dois renderers e a origem do baseline. Os GIFs usam oito quadros com 120/130 ms alternados: um segundo por ciclo.

Comparação: [animação noturna](visuals/stream-refinement/comparison-night.gif), [quadro diurno](visuals/stream-refinement/comparison-day.png) e [poses 0/2/4/6](visuals/stream-refinement/keyposes-night.png). O par de recortes 1× permite conferir a mudança no tamanho real, além da ampliação sem interpolação.

## Validação local

- `npm test -- --maxWorkers=2`: **3.119 testes / 76 arquivos**, todos passaram (104,68 s).
- Typecheck e build passaram. O aviso existente de chunk acima de 500 kB permanece; bundle principal de 579,27 kB antes de gzip.
- Audit: zero vulnerabilidades; sem mudanças de dependências ou lockfile.
- Novos testes congelam os outros 13 corpos, as 16 alimentações e 240 quadros reais de controles contra `fa1467d`. Também verificam volume, fonte, envelope, poses completas, hierarquia dos contatos e pontes elétricas enraizadas no aço.
- Revisão independente: **576 quadros de cenas**, **1.440 rasters fracionários** e **912 controles byte-idênticos**. Nenhum corpo vazio, escape de envelope, fonte desconectada, invasão do rosto, mutação de entrada ou alteração indevida nos controles. As folhas nativas e os ciclos foram inspecionados; as contagens não implicam julgamento artístico individual de todas as amostras.
- Uma defasagem intermediária entre a repetição geométrica e o estágio elétrico foi encontrada e removida. O ciclo final mantém o contato entre os dois trilhos sem reinício abrupto em 7→0.

### Custo observado

Duas passagens separadas, cada uma com 32 cenas e 64 quadros por versão/cena. As versões alternam a ordem de execução. Ambas as passagens ficam registradas, inclusive a variação nos controles com pixels idênticos. Valores em milissegundos:

| Cena | Mediana, passagem 1 | p95, passagem 1 | Mediana, passagem 2 | p95, passagem 2 |
|---|---:|---:|---:|---:|
| Terra | 1,98 → 2,11 | 3,18 → 3,38 | 1,77 → 1,96 | 2,28 → 2,58 |
| Gelo | 1,84 → 1,83 | 2,14 → 2,55 | 1,79 → 1,74 | 2,45 → 2,57 |
| Natureza | 1,92 → 1,95 | 3,21 → 2,66 | 1,85 → 1,78 | 2,60 → 2,34 |
| Raio/Metal | 2,48 → 2,77 | 3,52 → 3,69 | 2,39 → 2,86 | 3,15 → 3,46 |
| Metal/Raio | 2,14 → 2,43 | 2,63 → 3,07 | 2,29 → 2,49 | 2,98 → 3,26 |
| Seis Raio/Metal | 3,81 → 4,25 | 4,96 → 5,51 | 3,76 → 4,31 | 5,43 → 5,85 |
| Seis Metal/Raio | 3,12 → 3,57 | 3,87 → 6,13 | 3,23 → 3,43 | 4,17 → 4,09 |
| Água inalterada | 1,80 → 1,88 | 2,45 → 4,06 | 1,70 → 1,71 | 2,35 → 2,41 |

As novas descargas têm custo adicional de geração, inclusive nas medianas das duas passagens; esta revisão não é uma aceleração. O p95 de seis Metal/Raio subiu na primeira e não se repetiu na segunda. A variação também aparece em controles com raster idêntico: Água na primeira passagem e seis Água/Gelo na segunda (p95 de 4,03 → 7,03 ms). A repetição não resolve estatisticamente essa variabilidade. Não se deve ocultar a primeira medição nem tomar um pico isolado como regressão universal. Dados completos: [passagem 1](visuals/stream-refinement/benchmark.json) e [passagem 2](visuals/stream-refinement/benchmark-repeat.json).

## Limites

Esta rodada trabalha três primários e os dois sentidos de uma mistura. Os outros materiais preservam a arte do checkpoint; não se trata de um novo redesenho de todos os jatos. Natureza tem um ganho mais discreto que Terra e Gelo. Nas seis cópias pequenas, faces e contatos viram pistas reduzidas. Os demais mistos continuam no tratamento já existente.

O benchmark compara geração real de quadros em Node, sem cache de imagens. Os caches geométricos estão aquecidos para as amostras. `initialEightFrameCycleMs` é a primeira passagem de cada caso no mesmo módulo já usado pelos casos anteriores, não uma medição de módulo/JIT frio. Não há inferência de desempenho de navegador, CPU 4× ou celular. O experimento separado de cache das esferas Raio/Metal não faz parte desta revisão.
