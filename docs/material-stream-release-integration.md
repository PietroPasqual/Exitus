# Integração dos jatos com a base concorrente

A publicação começou pela árvore exata `cc93341a4ec9cd55c2295da6c03ac8e9be56a286`, correspondente ao checkpoint aprovado `fbfa6ae569be89486b87688599cd3bc155e3cb6f`. O commit remoto equivalente é `ca939026994043197db9137daea4bf58372e6f86`.

Durante o envio, a PR #21 foi integrada por outra sessão. A base passou de `88fc878` para `c5db581`. A resolução conserva os dois trabalhos: os 16 jatos materiais e cinco sequências mistas continuam na rota estrutural aprovada; a serpente, o fogo livre e a composição genérica da nova base permanecem intactos. Não incorpora a PR #19 nem o cache experimental local.

## Controle visual e semântico da resolução

- 256 quadros dos 16 jatos puros e 160 quadros dos cinco adaptadores (herói e seis cópias), em ambos os fundos e oito fases, idênticos ao commit aprovado `ca939026`.
- 1.536 quadros fora do predicado de emissão e 576 cenas de arte não-jato, incluindo serpente e fogo livre, idênticos à base `c5db581`.
- 130 interpretações comparadas sem alteração de regras ou efeitos; as descrições continuam usando o mesmo predicado estrutural aprovado.
- Referências de superfície dos jatos mistos genéricos continuam fixas na fase 0. Sua composição passa a usar as melhorias da PR #21. Esses fallbacks não são novos adaptadores artesanais.

## Fixtures atualizados com procedência

`directed-stream-controls.json` usa a base remota para os negativos. Apenas as quatro esferas puras redesenhadas pela PR #21 (Vento, Natureza, Luz e Sombra) mudaram os hashes; o Fogo mantido conserva sua referência histórica.

`stream-contact-controls.json` mantém os 16 jatos puros originais. Os 20 negativos mistos são comparados à base remota; seis jatos de composição genérica registram a combinação do jato aprovado com o compositor da nova base. A procedência consta em cada entrada alterada.

`stream-approved-release.json` adiciona 416 comparações explícitas contra a arte aprovada, incluindo as duas dominâncias de Água/Gelo e Raio/Metal. Nenhuma expectativa foi removida para esconder diferença artística.

Os custos e limites de miniaturas documentados nas quatro revisões anteriores continuam aplicáveis. A integração não constitui medição nova em navegador ou celular.
