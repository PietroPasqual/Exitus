# Continuidade das folhas e saída dos jatos

Refinamento local sobre `d89b9299a2c4e1c36107b5b0e6318e60ec7f4e81`, a última prévia entregue. A comparação usa exatamente esse desenho anterior, preservado em um renderer congelado.

## Mudanças

- **Natureza:** duas lâminas foliares assimétricas e enraizadas, com abertura alternada, nervura curta e uma borda que se recolhe sobre a própria face. A folha permanece reconhecível também nos quadros finais. Folhas e caule agora avançam na mesma coordenada material; antes, a fibra avançava à metade da velocidade das folhas.
- **Terra:** a parte final ganha uma fissura oblíqua e perde planos progressivamente, terminando numa cunha de pó ligada ao restante do fluxo. Os primeiros 73% do desenho ficam byte-idênticos ao checkpoint.
- **Gelo:** acabamento estreito da saída. A espessura é preservada até um corte oblíquo com face curta, em vez de afinar o prisma inteiro. Os primeiros 89% permanecem byte-idênticos. A corrente de Água no par Gelo/Água continua presente.

Os dois sentidos de Raio/Metal e os outros 13 primários permanecem intactos. A produção altera apenas `pixel-material-stream.ts`, nas três funções e numa tabela de abertura foliar. Não muda os 16 materiais elegíveis, seleção estrutural, alimentação ligada à mão, envelope, layout, controlador, descrição, regras, energia, efeitos das runas ou desenho do círculo.

## Prova reproduzível

```sh
node scripts/proof-directed-streams.mjs baseline-renderer.mjs /tmp/stream-tip-final \
  d89b9299a2c4e1c36107b5b0e6318e60ec7f4e81 \
  'ULTIMA PREVIA' 'natureza,terra' 'FLUXO REFINADO - LOCAL'
python scripts/compose-stream-refinement.py /tmp/stream-tip-final
node scripts/benchmark-directed-streams.mjs baseline-renderer.mjs \
  /tmp/stream-tip-final /tmp/stream-tip-benchmark.json \
  'terra,natureza,metal-raio,gelo-agua'
```

São círculos interpretados pelo motor e quadros do renderer real, sem substituição de dispatcher. O manifesto registra modelos, ordem dos materiais e hashes. A [comparação curta](visuals/stream-tip-continuity/comparison-night.gif) destaca Natureza/Terra; [quadro diurno](visuals/stream-tip-continuity/comparison-day.png) e [poses 0/2/4/6](visuals/stream-tip-continuity/keyposes-night.png) incluem tamanho nativo e ampliação sem interpolação. Os GIFs mantêm oito quadros e exatamente um segundo por volta.

## Validação local

- `npm test -- --maxWorkers=2`: **3.140 testes / 78 arquivos**, todos passaram (105,94 s).
- Typecheck e build passaram. O aviso existente de chunk acima de 500 kB permanece; bundle principal de 579,92 kB antes de gzip.
- Audit: zero vulnerabilidades, sem mudar dependências ou lockfile.
- Novos controles: 272 quadros reais preservados, incluindo ambos os sentidos de Raio/Metal; hashes dos trechos anteriores de Terra/Gelo; 432 combinações de tamanho, origem e fase com raízes conectadas.
- O teste de transporte de Natureza verifica todas as oito transições: deslocar o desenho na velocidade de advecção comum aproxima os quadros melhor que mantê-los fixos ou usar a antiga meia velocidade da fibra. O ciclo não depende apenas de troca de brilho.
- Revisão independente: **256 quadros de cenas**, **960 rasters fracionários** e **944 controles byte-idênticos** contra `d89b929`. Nenhum corpo vazio, escape de envelope, invasão do rosto, fonte desconectada, mutação de entrada ou alteração indevida. Foram inspecionadas folhas nativas, ciclos completos e contextos compactos; as contagens não significam julgamento artístico individual de todas as amostras.

### Custo observado

Duas passagens separadas de 32 casos, com 64 amostras por versão/caso e ordem alternada entre renderers. Os valores abaixo são milissegundos; ambas as passagens ficam preservadas.

| Cena | Mediana, passagem 1 | p95, passagem 1 | Mediana, passagem 2 | p95, passagem 2 |
|---|---:|---:|---:|---:|
| Natureza | 1,76 → 1,76 | 2,29 → 2,52 | 1,91 → 1,86 | 2,70 → 2,36 |
| Terra | 2,11 → 2,02 | 3,21 → 2,81 | 1,93 → 2,01 | 2,91 → 3,23 |
| Gelo | 1,83 → 1,75 | 2,30 → 2,54 | 1,73 → 1,78 | 2,26 → 2,23 |
| Seis Natureza | 3,04 → 3,19 | 4,09 → 4,66 | 3,42 → 3,38 | 7,85 → 4,07 |
| Seis Terra | 2,98 → 3,06 | 3,97 → 3,86 | 3,39 → 3,32 | 4,43 → 5,60 |
| Seis Gelo | 3,13 → 2,99 | 3,70 → 3,52 | 3,12 → 3,09 | 4,06 → 3,93 |
| Seis Gelo/Água | 2,76 → 2,65 | 4,49 → 3,32 | 2,79 → 2,91 | 6,09 → 4,21 |

As medianas dos desenhos alterados ficaram próximas nestas amostras. O p95 de seis Terra aumentou na segunda passagem; os controles com pixels idênticos também oscilaram. Esses dados não demonstram aceleração universal nem resolvem estatisticamente a variabilidade. As medidas completas incluem os 32 casos: [passagem 1](visuals/stream-tip-continuity/benchmark.json) e [passagem 2](visuals/stream-tip-continuity/benchmark-repeat.json).

## Limites

Natureza tem uma dobra estilizada; os pequenos detalhes se reduzem nas miniaturas. Gelo recebeu acabamento de ponta, não outro redesenho completo. Misturas genéricas derivadas continuam menos trabalhadas que os cinco adaptadores de jatos já existentes. Esta rodada não estende o tratamento artesanal a todos os pares.

O benchmark é geração de quadros em Node na mesma máquina, sem cache de imagens e com geometria aquecida. `initialEightFrameCycleMs` é uma primeira passagem no módulo já usado pelos casos anteriores; não mede módulo/JIT frio. Não há medição de navegador, CPU 4× ou celular. O experimento separado de cache das esferas elétricas continua fora desta branch.
