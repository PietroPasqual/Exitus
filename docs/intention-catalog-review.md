# Mais palavras com formas próprias

O vínculo «bomba» antes desenhava os caracteres da palavra. Agora gera uma bomba em pixel art, com corpo, pavio e faísca feitos do material da magia. O catálogo passou de sete para **81 silhuetas**, reconhecidas por **442 palavras distintas após normalizar acentos e caixa**, incluindo plurais e sinônimos explícitos.

![36 formas de armas, equipamentos, criaturas e símbolos](visuals/intention-forms-next.png)

[As outras 45 formas do catálogo](visuals/intention-forms-expanded.png).

## Formas

| Grupo | Silhuetas |
| --- | --- |
| Armas | Lança, espada, escudo, flecha, martelo, machado, adaga, foice, arco, tridente, chicote, corrente, cajado, picareta, kunai, agulha, shuriken, mangual, clava, besta, bumerangue e disco |
| Objetos e geometria | Parede, bomba, esfera, cubo, pirâmide, cone, anel, estrela, espiral, cruz, coração, coroa, chave, cristal, mão, explosão, ampulheta e crânio |
| Equipamentos | Armadura, elmo, manopla, bota, livro e pergaminho |
| Fenômenos e símbolos | Raio, chama, gota, onda, tornado, nuvem, sol, lua, meteoro e cometa |
| Natureza e criaturas | Árvore, flor, folha, raiz, vinha, asa, garra, presa, serpente, dragão, lobo, pássaro, tentáculo, fênix, urso, leão, raposa, gato, morcego, aranha, escorpião, tartaruga, peixe, tubarão e cogumelo |

Sinônimos usam silhuetas genéricas da mesma família: «granada» usa Bomba; «sabre» usa Espada; «cipó» usa Vinha. Plurais também escolhem a mesma forma, sem multiplicar a magia. Uma segunda Intenção numérica continua indicando quantidade.

## Uso no editor

No campo de Intenção, a seção recolhida **81 formas ilustradas** mostra miniaturas reais das silhuetas, permite filtrar por categoria e pesquisar nome ou sinônimo. A busca informa o sinônimo encontrado, e a escolha fica marcada no catálogo. Escolher uma opção apenas preenche o campo e atualiza a leitura; **Vincular** mantém a confirmação existente. Depois de confirmar, o catálogo continua consultável, com as opções bloqueadas até trocar a runa.

![Galeria no editor](visuals/intention-catalog-gallery.jpg)

A busca aceita «granadas», «DRAGOES» ou «cristais». As miniaturas douradas mostram a silhueta; a prévia completa continua usando o material e as cores reais da magia. Elas só são desenhadas ao abrir a seção, e os pixels ficam em cache. A vinculação continua limitada a uma palavra ou inteiro positivo por runa, sem aproximar substrings ou aceitar frases. Palavras fora do catálogo preservam o desenho tipográfico existente.

## Arte e regras

Todas as novas formas são polígonos rasterizados pelo mesmo painter e recebem `materialPixel`: nenhuma lâmina, cabo, planta ou criatura força madeira, metal ou outra matéria. Elementos, estados, origem, direção, Projétil, Área, Órbita e Ser permanecem determinados pelas runas. Uma bomba não ganha dano explosivo automaticamente, uma asa não cria voo e um dragão não cria vida. «Raio» ou «chama» apenas escolhem uma silhueta: uma chama feita de Água continua Água, sem ganhar propriedades de Fogo. Armaduras e livros também são apenas a forma da matéria, sem novos bônus ou efeitos.

Os 45 desenhos que já tinham silhuetas permanecem intactos. O catálogo define artigos em português para a descrição, como «uma bomba», «um dragão» e «um cristal». Nenhuma migração de projeto, alteração de energia ou nova regra de custo foi introduzida.

## Validação

Testes cobrem as 81 formas, todos os aliases, consulta exata, gêneros, persistência, escolha sem vínculo automático, catálogo bloqueado, pixels e limites de desenho. O layout verifica cada forma nos seis destinos, com e sem Projétil, quantidades, oito órbitas e preservação das entradas. A conferência visual inclui Fogo, Água e Metal e o caso de bomba multimatéria em Área mostrado na imagem enviada.

- **1.320 testes aprovados**, em 32 arquivos, com TypeScript e build Vite aprovados.
- 81 formas × três materiais × dia/noite: 486 cenas nativas conferidas.
- As 270 imagens de referência das 45 formas anteriores são idênticas, byte a byte, às anteriores.
- Os 45 presets mantêm a mesma interpretação, propriedades e estatísticas; três SVGs e três PNGs dos círculos também permanecem idênticos.
- Revisão independente do catálogo, artigos, consulta exata, segurança e seleção sem vínculo automático: sem bloqueios.
- Fluxos de «FÊNIX», «labaredas», «RELÂMPAGOS», «estrela-cadente», «códices», «LEÕES» e «maças» aprovados, com elementos e estatísticas preservados. Uma Intenção «fênix» e outra «3» mostram três fênix; o escopo de Ser permanece correto. A validação anterior também cobriu bomba/dragão, troca de runa, histórico e salvar/reabrir.
- 16 verificações de UI e 32 capturas conferidas em desktop e celulares de 320/390 pixels, nos temas Grimório e Pergaminho, sem erros de página ou transbordamento. Miniaturas, busca combinada com categoria, sinônimos, seleção, bloqueio e modal com Esc aprovados. Catálogo aberto mede 270/270 e 340/340 pixels de largura disponível/ocupada.
