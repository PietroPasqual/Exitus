# Emissão mantida por material

Revisão local sobre a versão publicada `88fc8789b8b32690eb50db22229a0b6f331bf372` (PR20).

## Contrato visual e texto

O mesmo círculo do exemplo Lança-Chamas passa a mostrar emissão mantida ao trocar as duas runas Fogo por qualquer um dos 16 materiais corporais. A condição compartilhada por layout, arte e descrição é: material corporal presente, Estado, Direção para frente, colocação diante do mago, sem Projétil, Órbita, forma geométrica, forma de Intenção ou glifo. Uma Intenção numérica continua usando o limite ilustrativo existente de seis cópias.

Essa é uma interpretação de apresentação dos fatos existentes. Não modifica o modelo, a interpretação, custos, poder, efeitos, regras de Ligação/Mescla, dados das runas nem o desenho do círculo. O retorno continua na sua colocação e direção originais, sem ser convertido em emissão frontal.

`isMaintainedDirectedStream` é o predicado comum. O nome anterior `isMaintainedFireJet` permanece um wrapper específico de Fogo para compatibilidade dos testes e helpers antigos.

## Arte

Cada material possui construção e movimento próprios em pixels nítidos, na resolução existente de 180 × 105:

- Fogo: mantém exatamente o desenho e o ciclo publicados.
- Água: corrente arredondada, dobra e crista que avançam.
- Gelo: prismas desiguais com faces rígidas transportados no eixo.
- Terra: agregados opacos e irregulares dentro de uma corrente de pó discreta.
- Raio: canais em zigue-zague, surto localizado e salto de canal.
- Metal: lâminas/tiras com cortes duros e reflexo estreito.
- Vento: faixas abertas e onduladas.
- Som: frentes curvas repetidas que avançam.
- Natureza: corrente de nervuras e folhas enraizadas no eixo.
- Ácido: volume líquido com bolsas e cavidades.
- Ilusão: planos interrompidos e deslocados.
- Luz: feixe contínuo com frente luminosa.
- Sombra: lâmina volumosa escura com lábio restrito.
- Matéria: extrusão densa com poucas juntas.
- Gravidade: frentes curvas que se comprimem adiante.
- Espaço: planos dobrados com aberturas escalonadas.

Cinco sequências ordenadas têm contato autoral dentro do jato: Água/Gelo, Gelo/Água, Raio/Metal, Metal/Raio e Água/Gelo/Fogo. Os prismas percorrem a corrente líquida; contatos de aço e descargas compartilham as bordas; a terceira chama viaja numa dobra do líquido. A seleção é exata e não descarta um terceiro ou quarto material para reaproveitar um par. Não infere fusão nem altera a ordem lida pelo motor. Outros jatos mistos mantêm a composição genérica existente e não possuem o mesmo tratamento artesanal.

Todos compartilham o envelope de emissão já aprovado e uma alimentação ligada à mão, desenhada atrás de corpos e do mago. Materiais rígidos e frentes abertas não precisam formar uma única área opaca: a fonte e o trajeto permanecem reconhecíveis em cada pose.

O controlador existente de oito quadros, pausa, redução de movimento, suspensão de visibilidade e cache de imagens não foi alterado. Os GIFs de evidência alternam 120/130 ms, totalizando exatamente um segundo por ciclo.

## Evidência reproduzível

- `scripts/proof-directed-streams.mjs`: interpreta os 16 círculos reais substituídos e os controles mistos; registra modelos, Appearance, textos e hashes dos renderers. Não substitui o dispatcher da cena.
- `scripts/compose-directed-streams.py`: comparação publicada/local em 2× e 1× e matriz nativa de 16 materiais, dia/noite.
- `scripts/benchmark-directed-streams.mjs`: compara geração de quadros em Node, no mesmo ambiente, sem o cache de imagens. Não é medição de navegador ou celular.
- `tests/directed-stream-narrative.test.ts`: congela os resultados mecânicos completos de cada substituição e verifica a prosa.
- `tests/pixel-directed-stream-integration.test.ts`: 576 hashes de controles fora da condição, 16 quadros de Fogo publicado, colocação, normalização e cópias.
- `tests/pixel-material-stream.test.ts`: desenho, envelope, fonte, identidade, periodicidade e alimentação dos materiais.
- `tests/pixel-mixed-stream.test.ts`: seleção exata dos cinco adaptadores, ordens, paletas, limites, fonte, dominância e terceira chama móvel.

## Limites

Esta revisão trata da emissão livre mantida. Não redesenha as 200 formas de Intenção nem altera as magias que possuem forma, Projétil, retorno ou Órbita. Em cópias muito pequenas, a corrente retém uma pista de material, com menos detalhe. Vários conceitos e vários feixes simultâneos continuam sujeitos à densidade visual de uma tela nativa pequena.

O experimento de cache de Raio/Metal está em branch/commit separados e não pertence a esta revisão. Seus ganhos quentes e regressões de primeiro desenho não são atribuídos aos jatos.


## Validação do checkpoint local `fa1467d`

- `npm test -- --maxWorkers=2`: **3.095 testes / 73 arquivos**, todos passaram (94,43 s).
- `npm run typecheck` e `npm run build`: passaram. O aviso já existente de chunk acima de 500 kB permanece; o bundle principal ficou em 577,50 kB antes de gzip.
- `npm audit --audit-level=moderate`: zero vulnerabilidades; dependências e lockfile não mudaram.
- Revisão independente: 264 circuitos preservam interpretação, checkers, energia, efeitos e componentes; 23 testes do controlador/reduced motion; 3.456 cenas negativas idênticas à PR20.
- Arte/contexto: 1.024 cenas dos 16 primários, 320 cenas finais dos cinco mistos, 3.120 rasters isolados e 516 controles de pureza/gates. Sem fonte desconectada, corpo vazio, escape de envelope ou invasão do rosto. As folhas nativas e ciclos completos foram inspecionados; as contagens não significam julgamento individual de cada pixel de cada amostra.
- Seis GIFs finais: oito quadros cada, 120/130 ms alternados, 1.000 ms por ciclo.

### Desempenho observado

Node, mesma máquina, execução sequencial e ordem alternada entre versões. São 64 quadros por versão por caso, após uma passagem de oito quadros, com cache de imagens desativado e geometria aquecida. A primeira passagem registrada em `initialEightFrameCycleMs` ocorre no mesmo módulo usado pelos casos anteriores; **não mede módulo/JIT frio**.

| Cena | Mediana publicada → local | p95 publicada → local |
|---|---:|---:|
| Água | 2.75 → 1.67 ms | 3.39 → 2.03 ms |
| Gelo | 2.66 → 1.67 ms | 3.32 → 2.10 ms |
| Raio | 2.63 → 2.25 ms | 3.66 → 2.80 ms |
| Fogo preservado | 2.38 → 2.16 ms | 3.95 → 4.04 ms |
| Água/Gelo | 3.03 → 1.81 ms | 3.81 → 2.33 ms |
| Seis jatos de Raio | 5.48 → 4.12 ms | 6.74 → 6.84 ms |
| Seis jatos Raio/Metal | 5.53 → 3.81 ms | 9.05 → 4.67 ms |
| Seis jatos Água/Gelo/Fogo | 6.55 → 2.73 ms | 7.73 → 3.38 ms |

As medianas foram menores nos 28 casos medidos. O p95 de Fogo e de seis jatos de Raio subiu levemente, como exposto acima; isso não sustenta aceleração universal. A comparação também muda o desenho e a colocação do corpo, não é uma otimização pixel-idêntica. Esses resultados **não medem celular, navegador com CPU 4×, nem as esferas Raio/Metal** do experimento separado. Dados completos: `docs/visuals/directed-streams/benchmark.json`.
