# Materiais combinados, emissão contínua e descrições

Estudo local após a PR #18 (`ddf4e5d322647b35d7b0bc02b69d1040d379e3bc`).
A aprovação desta revisão visual e sua publicação são etapas separadas.

## Escopo real

- Assinaturas de superfície para os 16 materiais físicos dentro de misturas: Fogo, Terra, Água, Vento, Raio, Metal, Gelo, Som, Natureza, Ácido, Ilusão, Luz, Sombra, Matéria, Gravidade e Espaço.
- 120 pares distintos, 240 ordens de dominância e alocação explícita para três ou mais materiais. O primeiro continua dominante. Isso é um sistema de composição, não 120 sprites desenhados individualmente.
- Os oito sprites autorais puros já existentes mantêm suas silhuetas; três pares esféricos têm construção própria nas duas dominâncias. As 200 formas de Intenção continuam com seu desenho próprio; esta etapa não redesenha as 200 formas.
- Os materiais puros genéricos continuam no pintor anterior. O registro novo não representa um redesenho de todos os materiais puros.
- Oito motivos não físicos distintos: Tempo, Movimento, Pressão, Caos, Infinito, Vazio, Vida e Morte.
- Jato contínuo para a manifestação real do preset Lança-Chamas: Fogo primário, Estado, Direção para a frente, colocação frontal, sem forma, Intenção, Projétil ou Órbita.
- Descrições em português baseadas nos fatos da interpretação existente.

## Construção visual

As regiões de cada constituinte seguem os pixels ocupados da forma. Recortes, olhos, contornos e aberturas não são preenchidos. Componentes posteriores têm orçamento próprio, em vez de depender de uma pequena faixa que podia ocultar totalmente o terceiro elemento. O brilho de um material secundário não depende da escuridão de Sombra como primário.

As âncoras são estáveis no espaço local e variam conforme a identidade material: líquidos envolvem a base ou o flanco, sólidos ocupam faces oblíquas, nervuras orgânicas atravessam a massa e campos formam dobras laterais. A direção de retorno espelha essas âncoras; a ordem de renderização não muda seu resultado.

O registro distingue planos rígidos, correntes, dobras radiantes, fluxos, nervuras orgânicas e campos. Metal usa plano de aço escuro e reflexo estreito; Gelo usa faces opacas e aresta reta; Água conserva curvas e canais. Não há ruído aleatório adicional cobrindo o corpo.

A alocação dos corpos animados usa uma silhueta de referência estável. Assim, a mudança do brilho ou da asa não pode trocar a identidade de um material entre cabeça e cauda. Alguns contatos autorais recebem adaptação própria: Água/Gelo/Fogo conserva placas na asa e ombro do dragão, com uma dobra de fogo conectada ao ombro, deixando focinho e corrente do pescoço aquáticos. Na esfera, a água passa entre placas e o fogo acompanha uma borda comum. Sombra/Gelo tem uma lâmina oblíqua inserida no volume. Na esfera genérica única de Sombra, faces secundárias podem ocupar o tom escuro interno sem apagar o contorno. Essa exceção não se aplica a olhos, glifos, formas de Intenção ou corpos com várias peças.

Os corpos continuam em 180 × 105 pixels, sem suavização. A animação usa o controlador existente de oito quadros a oito fps; não adiciona relógio, temporizador ou mecanismo de pausa.

## Três construções de corpo integradas

Após o feedback sobre duplas pouco expressivas, três corpos autorais usam outra construção, agora selecionada no dispatcher de produção apenas para uma esfera única com exatamente dois materiais: Fogo/Metal, Água/Gelo e Sombra/Gelo. A prévia original usou uma build de estudo; a integração usa os mesmos helpers e limites compartilhados no renderer real, com margem horizontal para o espelhamento fracionário. `node scripts/proof-authored-pairs.mjs <pasta> --baseline <renderer-anterior.mjs>` reproduz a comparação pela rota normal, sem substituir fontes. O baseline é opcional para provas apenas da versão atual. Fogo/Metal e Sombra/Gelo coexistem entre famílias diferentes. O estudo Água/Gelo também usa coexistência; nenhuma fusão é preenchida manualmente para melhorar sua aparência.

Metal-first conserva uma carcaça de três placas e uma junta quente contínua; Fire-first usa uma nervura menor envolvendo o núcleo. Água-first conserva duas placas e uma dobra líquida maior, enquanto Gelo-first tem três placas mais volumosas. Sombra/Gelo faz o cristal emergir de uma fenda oblíqua. Este último é mais sóbrio e sua troca de dominância é mais sutil. A direção dos três foi aceita pelo usuário; isso não é aprovação de uma biblioteca inteira nem autorização de publicação.

## Semântica preservada

O resultado de `checkLigacao` é observado no ponto em que o motor já confirma uma fusão. Metadados de apresentação carregam apenas a composição física desse grupo, respeitando os limites de Ser e as ocorrências reais. As regras de elegibilidade, energia, efeitos, alcance e quantidade não mudam.

O booleano geral `merged` não permite descobrir quais famílias se fundiram. A paleta e o contato não inventam essa informação quando os grupos exatos estão ausentes. A geometria composta mantém a interpretação anterior: os metadados não identificam quais objetos podem trocar de forma.

A narrativa distingue fusão parcial, partes do mesmo elemento, Órbita e Movimento. Estado não vira duração infinita, Toque não vira propagação automática e Área não vira impacto. As 11 runas com `semEfeito` continuam explicitamente sem efeito definido; não recebem mecânicas ilustrativas inventadas.

O catálogo contém 51 runas: 40 com funções existentes e 11 marcadas como sem efeito definido. A auditoria cobre a influência já existente de forma, direção, colocação, quantidade, ligação, órbita e estado. O redesenho desta etapa se concentra nos materiais combinados, oito motivos conceituais e emissão mantida; não afirma redesenhar individualmente a manifestação das 51 runas.

Exemplos de narrativa gerada:

- Lança-Chamas: “Um jato de chamas crepitantes surge diante de quem lança e avança em linha reta. Estado mantém a emissão estável.”
- Fusão parcial confirmada: “Água e Gelo se fundem pela Ligação. Fogo permanece na composição, sem se fundir a esses grupos.”
- Duas partes de Fogo confirmadas: “As partes de Fogo se fundem pela Ligação.”
- Runa indefinida: “Runas sem efeito definido nas regras: Mente.”

Os gestos animados são ilustrações. Sua cadência de oito quadros não define a duração, velocidade, força ou alcance de um efeito no jogo.

Nenhum desenho, glifo ou layout do círculo mágico, arquivo de runas, regra de energia ou efeito foi alterado.

## Limites visuais

- Uma miniatura com poucos pixels não mostra três assinaturas completas. O relatório usa pixels efetivamente pintados, e não apenas área reservada. Algumas formas finas têm uma única pista de cor.
- No dragão triplo menor (`s=3`), preservam-se Água e Gelo; não há espaço seguro para a dobra de fogo sem apagar a anatomia. Em `s=7` e `s=15`, a chama é conectada em todos os oito quadros.
- O adaptador anatômico do dragão pertence ao sprite autoral de Água. Um dragão com outro primário usa sua geometria genérica e não recebe coordenadas da asa errada.
- Várias emissões contínuas simultâneas formam ramificações estreitas ligadas à mão. Isso é uma amostra visual das cópias, não uma regra nova.
- Muitas auras conceituais em oito corpos minúsculos ainda formam bordas densas. A composição protege o rosto e corpos anteriores, mas isso não torna todos os motivos individualmente legíveis nessa escala.
- Mudanças de contatos confirmados podem ser pequenas na escala nativa, especialmente em formas compostas com muitos materiais.

## Evidência e reprodução

`node scripts/proof-material-signatures.mjs <pasta>` gera provas do amostrador e capturas do renderer real, identificadas separadamente. `node scripts/probe-material-production.mjs <arquivo.json>` registra quais assinaturas realmente pintaram a produção. `node scripts/proof-concept-motifs.mjs <pasta>` gera os motivos conceituais reais, com manifesto de fontes.

`node scripts/proof-material-pairs.mjs <pasta>` gera a matriz real de 240 ordens de pares e 16 controles puros nos dois temas. `node scripts/benchmark-material-mixtures.mjs <renderer-base.mjs> <pasta>` mede 26 cenas, separando primeiro ciclo e rodadas aquecidas; o módulo de base precisa exportar `renderPixelScene`.

`node scripts/proof-confirmed-fusion.mjs <pasta>` constrói seis circuitos fechados reais, executa fluxo/checker/aparência e guarda modelos, grupos confirmados e descrições ao lado das cenas. Cobre ligação sem fusão, fusão parcial, duas famílias e o apoio conceitual existente. Não preenche os resultados manualmente.

As comparações animadas usam oito quadros com durações alternadas de 120/130 ms, totalizando um segundo. São rasterizações reais do projeto, sem imagens geradas como substituto do resultado implementado.

## Verificação

A execução final após a integração dos três pares e as otimizações passou em 2.938 testes/68 arquivos, com typecheck e build. O bundle mantém o aviso de tamanho acima de 500 kB. A auditoria anterior não encontrou vulnerabilidades; dependências não mudaram. A suíte inclui comparação byte-exata dos caches, fases, centros fracionários, dominância, espelhamento e reuso A→B→A.

A revisão independente das âncoras verificou 1.200 amostras (200 formas × três trios × dois tamanhos): alpha, cortes e realces autorais preservados. As 3.360 ordens possíveis de trios passaram no corpo compacto, com dominância primária e presença efetivamente pintada; 56 sequências A→B→A mantiveram hashes idênticos. Isso valida cobertura e estabilidade, não um julgamento artístico de 3.360 desenhos. Os 45 presets e oito circuitos adicionais mantêm resultados do motor e campos legados de aparência idênticos à versão aprovada.

A integração dos três pares passou em 2.304 amostras de corpo (seis ordens × seis escalas × quatro centros fracionários × duas orientações × oito quadros). O teste independente renderizou 632 quadros de contexto e confirmou 656 controles fora do escopo byte-idênticos ao renderer anterior à integração. A margem horizontal compartilhada inclui o arredondamento do retorno espelhado.

O teste independente de composição conceitual cobre 128 quadros cheios. Depois da proteção compartilhada dos corpos e da elipse do rosto, nenhum pixel protegido foi sobrescrito (antes havia falhas em 31 quadros). Os gestos dos conceitos continuam iguais nos pixels não protegidos.

A comparação local inicial de desempenho usa o mesmo processo Node, alterna as versões, cobre 11 cenas × oito quadros × cinco rodadas e ignora o cache de imagens da interface. O p95 inicial foi 13,08 ms na versão aprovada e 25,00 ms nesta etapa antes da otimização. Mediana: 5,73 → 9,59 ms. Não é uma medição de navegador, dispositivo móvel ou CPU 4×.


### Medida quieta após caches e proteção de cena

O mesmo processo Node comparou a base aprovada com a fonte congelada antes da última otimização de conceitos: 17 cenas × oito quadros × seis rodadas alternadas, 816 amostras por versão. Primeiro ciclo medido separadamente; cache de imagens da UI não participa.

- Rodadas aquecidas: mediana 5,64 → 7,08 ms; p95 11,03 → 14,99 ms.
- Primeiro ciclo: p95 13,46 → 18,29 ms.
- Oito orbitadores mistos: mediana 5,75 → 11,10 ms, p95 8,01 → 15,41 ms.
- Dragão com quatro conceitos: mediana 9,30 → 14,21 ms, p95 13,45 → 18,10 ms.
- Oito conceitos num corpo: mediana 2,73 → 6,46 ms, p95 3,36 → 8,28 ms.
- Dragão Água/Gelo/Fogo: mediana 9,63 → 9,93 ms; seis cópias 10,32 → 10,43 ms.

Os custos cresceram principalmente nos orbitadores e campos conceituais. Esta etapa não é universalmente mais rápida. Não houve medição de navegador interativo, CPU 4× ou desempenho móvel. O JSON preserva todas as amostras e hashes dos dois renderers, em `visuals/complete-mixtures/performance-node-pre-concept-optimization.json`.


### Otimização exata dos campos conceituais

A análise do contorno/reentrâncias é compartilhada por conceitos do mesmo corpo, com validação do alpha e um único cache limitado. Segmentos fora da caixa de influência são descartados antes do cálculo de distância. 512 motivos isolados, 256 corpos/recortes, 32 stacks com mutação/reuso e 128 cenas completas mantiveram hashes idênticos.

Na comparação específica antes/depois dessa otimização, a mediana do renderer completo caiu de 7,06 para 5,76 ms na esfera com quatro conceitos, de 13,19 para 11,10 ms no dragão com quatro, de 8,74 para 6,68 ms na esfera com oito e de 18,76 para 14,02 ms no dragão com oito. São ganhos locais de 16–25%; não anulam o custo adicional frente à versão aprovada. Os relatórios completos estão em `visuals/complete-mixtures/integration/`.


### Otimizações exatas dos corpos autorais

Fogo/Metal conserva somente a construção rígida em um LRU de 24 entradas e 65.536 células (quatro arrays de um byte, até 256 KiB de payload). A chave inclui centro exato, escala e dominância. A frente quente e a língua animada não entram no cache. 5.440 sprites e 224 cenas completas mantiveram pixels e limites idênticos; a suíte inclui goldens pré-cache e troca de destino/escala/centro/dominância após evicção.

Sombra/Gelo amostra uma vez o corpo por pixel, com margem de um pixel, e reutiliza as amostras no contorno. 448 sprites mantiveram o hash pré-otimização exato. As provas estão em `visuals/complete-mixtures/integration/`. O timing separado de Fogo/Metal sofreu pausas externas grandes e não foi usado como medição final.


### Medida final integrada (26 cenas)

Depois da integração e de todas as otimizações, a mesma medição Node cobre 26 cenas × oito quadros × seis rodadas alternadas: 1.248 amostras por versão, além de 208 amostras de primeiro ciclo. Não havia outros renders/testes nossos em execução.

- Rodadas aquecidas: mediana 6,03 → 6,65 ms; p95 12,40 → 15,49 ms.
- Primeiro ciclo: mediana 6,76 → 9,93 ms; p95 15,75 → 26,65 ms; máximo observado 38,54 → 117,96 ms.
- Metal/Fogo autoral: mediana 3,20 → 3,08 ms; seis cópias 7,98 → 5,01 ms.
- Fogo/Metal autoral: mediana 6,64 → 3,37 ms.
- Dragão Água/Gelo/Fogo: mediana 10,76 → 11,21 ms; seis cópias 11,27 → 11,25 ms.
- Oito orbitadores mistos: mediana 6,15 → 11,94 ms; p95 16,78 → 23,62 ms.
- Oito orbitadores com oito conceitos: mediana 6,28 → 14,25 ms; p95 8,15 → 22,43 ms.

O custo agregado está cerca de 10% maior na mediana e 25% maior no p95. Os casos cheios de misturas/conceitos ainda são mais caros, apesar dos ganhos nos novos corpos. Primeiro ciclo, alocação e pausas do processo produzem outliers. O cache de imagens da interface não participa desta medição; não há comprovação atual de desempenho em navegador interativo, CPU 4× ou celular. Dados brutos e hashes dos renderers: `visuals/complete-mixtures/performance-node-final.json`.
