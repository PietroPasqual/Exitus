# Magias em pixel art

A arte dos efeitos usa blocos de cor, planos de luz e texturas próprias para cada material. A resolução permanece em 180 × 105 pixels, ampliada sem suavização. A esfera de fogo mantém o corpo redondo; as chamas acompanham sua borda. Cubos e pirâmides também conservam a geometria, e as ligações iluminam as emendas sem cobrir o corpo inteiro com uma faixa branca.

| Elemento | Aparência |
|---|---|
| Fogo | Núcleo marfim, camadas quentes, pequenas línguas ligadas ao corpo e brasas |
| Raio / Luz | Correntes ramificadas para eletricidade; feixes retos para luz |
| Água / Ácido | Ondas turquesa e gotas para água; bolhas para ácido |
| Gelo | Planos cristalinos e lascas facetadas |
| Terra / Metal | Manchas minerais e fissuras; faixas de reflexão para metal |
| Vento / Som | Fitas abertas e frentes de onda |
| Natureza / Vida | Ramos, folhas e pequenos brilhos |
| Sombra / Espaço / Ilusão | Corpo escuro e névoa; arcos e fragmentos espectrais |

## Comparação

Referência: `43e37e2`. As imagens abaixo vêm do próprio renderizador, com as mesmas entradas antes/depois e ampliação de 2× por vizinho mais próximo. O cenário é o mesmo.

![Antes e depois dos materiais](visuals/magic-materials-comparison.png)

![Lança plasmática no tema escuro](visuals/magic-plasma.jpg)

## Verificações

- 424 testes e build aprovados. Os 32 testes novos cobrem paletas, luz, blocos de cor, determinismo, entradas sem mutação, moldura e efeitos secundários que compartilham o mesmo material, como água/ácido e luz/raio.
- 28 cenas em dia/noite revisadas visualmente: elementos, esfera/cubo/pirâmide, projéteis compostos e exemplos reais. As partículas foram reduzidas para manter as silhuetas reconhecíveis.
- Appearance e ficha dos 45 exemplos exatamente iguais à referência. As duas cenas vazias também são idênticas pixel a pixel, confirmando que o cenário foi preservado nesta mudança.
- 12 exportações dos círculos, SVG e PNG de três magias nos dois temas, idênticas byte a byte à referência.
- Prévia real em Chromium, no computador e em celulares de 390 e 320 px, sem erros de JavaScript ou transbordamento horizontal observado. Capturas com dados de demonstração.

O desenho das runas, os cálculos e o comportamento das magias continuam preservados.
