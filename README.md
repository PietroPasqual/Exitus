# ❂ Criador de Círculos Mágicos — Sistema de Runas RPG

Aplicação web interativa (`index.html` autocontido com HTML5, CSS3 e JavaScript/SVG vetorial) desenvolvida para criar, simular e exportar Círculos Mágicos do sistema de RPG.

## ⟳ Regras Fundamentais do Fluxo de Energia

- **Toda magia inicia na Matriz ◇ e finaliza nela.** O circuito só é válido quando a energia sai da Matriz, percorre os componentes e encontra um caminho de volta à Matriz.
- **A Matriz é essencial e nunca some.** É ela que faz a magia funcionar: sem a Matriz em um ciclo fechado, nada funciona (nenhuma runa recebe energia). A Matriz só pode ser ◇ Matriz ou ◇+□ Matriz+Quadrado.
- **Os cabos são cabos de energia com direção.** O pequeno círculo `○` marca o componente **de onde a energia sai**; a outra ponta do cabo (sem `○`) indica **para onde ela vai**.
- **Selos estruturais** (chamados pelo formato, pois ainda não têm nomes próprios): ◇ **Matriz** fornece e finaliza; □ **Quadrado** só pega e reativa a runa a cada nova fonte (nunca solta); ○ **Círculo** mantém a runa estável; △ **Triângulo** multiplica Poder (base para baixo) ou efeito (base para cima); ⬠ **Pentágono** só passa quando todas as entradas estão ativas e divide a energia; ☆ **Estrela** une círculos sobrepostos (duas alinhadas) ou, sozinha, guarda energia e a devolve 1,2× à fonte.
- Componentes que recebem energia mas não a devolvem à Matriz ficam com a **energia presa** — exceto **Quadrado** (□) e **Matriz+Quadrado** (◇+□), que por função **retêm** a energia (entrada e bloqueio).

- **Círculos sobrepostos:** dois círculos mágicos podem se sobrepor e **só um precisa de Matriz**. Cada círculo é uma **camada**: na sobreposição ficam **duas Estrelas ☆ alinhadas, uma em cada camada**, que pegam a energia de um círculo e a passam para o outro (desalinhadas, não passam). **◎ Novo círculo sobreposto** já cria o círculo sem Matriz e as duas Estrelas. A barra **Camada** no desenho deixa mexer só nos selos de um círculo (os outros ficam apagados e travados, e a camada escolhida fica por cima); a Estrela gruda na parceira quando chega perto. Na Estrela, o painel mostra a camada e se está alinhada; a Estrela dupla antiga pode ser separada em duas camadas. Exemplo pronto: **Círculos Unidos pela Estrela**.
- **Formato do anel:** toque no anel de um círculo para escolhê-lo: nome, tamanho (40 a 900), **formato do anel** (círculo, losango, quadrado, triângulo, pentágono ou estrela, nos três estilos), moldura e excluir. Os selos ficam dentro do formato.
- **O formato é livre.** A disposição dos componentes pode ser qualquer uma para formar a magia desejada — o que define a magia são as runas e o caminho da energia. Exemplos incluídos: **Bola de Fogo** (Exemplo 1) e o mais complexo **Lança-Chamas** (Exemplo 2).

O painel de diagnóstico verifica essas regras automaticamente: indica se a magia não inicia na Matriz, se o fluxo está aberto (não volta à Matriz), e quais nós estão sem energia ou com energia presa. Também mostra a **rota exata** da energia (ex.: `Matriz ◇ ○──► #3 (Fogo) ○──► #1 (Esfera) ○──► #2 (Direção) ○──► Matriz ◇`). **Clicar num cabo** inverte o sentido (ou use **⇄** na aba Ligações), **Shift+clique** remove, e o botão **⚡ Fluxo** (ligado ao abrir) mostra o caminho da mana:

- **Azul**: a mana sai da Matriz, percorre o cabo e volta a ela — essa parte da magia funciona. A Matriz pulsa.
- **Âmbar**: a mana sai da Matriz mas não volta — o circuito está aberto e a energia vaza.
- **Apagado**: a mana não chega ali.

Cada cabo também tem uma **seta no meio** apontando da origem (○) para o destino, com o Fluxo ligado ou não.

## 📜 Livro de Magias

22 magias de exemplo montadas com as regras do sistema, cada uma com um desenho próprio e todas sem erros; com a energia da Ativação perfeita (automática), nenhuma pode falhar. Abra pelo menu **★ Exemplos** ou pelo Grimório:

| Magia | Desenho | Runas | Ideia |
|---|---|---|---|
| **Projétil de Fogo** | Do seu desenho | Matriz neutra, Fogo, Cubo/Pirâmide, Projétil, Direção | Projétil logo depois dos formatos; Queimação |
| **Muralha de Terra** | Escudo vertical | Terra (Perfeito), Paralelepípedo (Círculo+Triângulo), D.N. Vertical, Estado (Quadrado), Círculo ○ | Muralha sustentada pelo Quadrado; Lentidão e Petrificação |
| **Lâmina de Vento** | Varredura em arco | Vento (Perfeito), Pirâmide, Direção, Projétil | Lâmina de vento; Corte Mágico +1d12 |
| **Descarga Distante** | Triângulo invertido | Raio, Esfera, Projétil (Círculo+Triângulo), Área, Direção (Círculo ○) | O raio é reprojetado na superfície mais distante; Paralisia −1d8 |
| **Cubo de Gelo** | Cruz com dois ciclos | Gelo, Cubo, Ser, Círculo ○, Estado (Quadrado) | O Ser fecha Gelo e Cubo num só ser; o Estado não deixa derreter; Congelamento −1d4 |
| **Grito Atordoante** | Anel de ondas | Som, Esfera (Círculo ○), Ser, Direção | Onda inteira, sem se espalhar, para a frente; Atordoamento |
| **Passo Veloz** | Arco + Quadrado | Movimento, Ser, Toque, D.N. Lateral, Estado (Quadrado) | O Toque leva o Movimento (runa de conceito) à superfície: +1 m/s |
| **Falsa Ação** | Arco invertido | Ilusão, Intenção «Esconder» (Círculo+Triângulo), Ser, Toque, Círculo ○ | Esconde 1 ação de quem é tocado |
| **Escudo d'Água** | Cruz com dois ciclos | Água (Perfeito), Esfera, Órbita (Círculo ○), Ser, Estado (Quadrado) | Esfera d'água orbitando a magia; Inibição e Extração |
| **Órbita de Chamas** | Anel orbital | Fogo (Perfeito), Esfera, Órbita, Ser, Círculo ○ | Uma esfera de fogo girando em volta da magia |
| **Lança de Gelo** | Anel em cruz | Matriz neutra, Gelo num Pentágono ⬠ (Comparador), Pirâmide, Projétil, Direção (Círculo ○) | Lança de gelo; Congelamento |
| **Prensa Barométrica** | Triângulo invertido | Pressão, Área (Círculo+Triângulo), D.N. Vertical, Círculo ○ | A pressão cai na superfície mais distante; Diminuição −2 |
| **Mistura Caótica** | Losango | Caos, Esfera, Projétil, Ser, Círculo ○ | Mistura 1 atributo de quem é atingido ao caos |
| **Campo de Supressão** | Pentágono | Metal, Área (Pentágono+Estrela), Ser, Círculo ○, Estado (Quadrado), Intenção «Hostil» | Dispersa energias hostis na superfície mais distante |
| **Meteoro Flamejante** | 2 círculos na diagonal | Terra + Fogo unidos pela Estrela, Esfera, Direção, Projétil | Rocha em chamas lançada (Projétil logo depois da Esfera) |
| **Tempestade Elétrica** | 2 círculos na vertical | Raio + Vento unidos pela Estrela, Pirâmide, Projétil (Círculo+Triângulo), Área | Desaba na superfície mais distante: Corte Mágico e Paralisia |
| **Passo Ilusório** | 2 círculos | Ilusão + Movimento unidos pela Estrela, Ser (Círculo+Triângulo), Círculo ○, Direção | Desvia deixando uma imagem falsa |
| **Pele de Pedra** | Varredura + Quadrado | Terra, Cubo, Direção Contrária, Círculo ○, Estado (Quadrado) | A magia volta para o conjurador: Endurecimento nele mesmo |
| **Dardo Inabalável** | Anel em cruz | Fogo (Perfeito), Pirâmide, D.N. Vertical, D.N. Lateral, Projétil (Círculo ○) | Dardo de fogo que forças externas não desviam |
| **Erupção** | 3 círculos, 1 Estrela | Terra + Fogo + Pressão unidos por uma só Estrela no centro | Estoura na superfície mais distante: Lentidão, Queimação e Diminuição |

### ✕ Magias Falhas

As versões antigas das magias que tinham erros pelas regras atuais ficam guardadas como estavam no conjunto **Magias Falhas** (menu **★ Exemplos** e Grimório), cada uma com a lista do que estava errado e um botão para abrir a versão corrigida: Tríade de Intenção (virou o estudo **Ser e Órbita: Três Seres**), Descarga em Área (virou **Descarga Distante**), Cubo de Gelo, Grito Atordoante, Passo Veloz, Falsa Ação, Meteoro Flamejante, Tempestade Elétrica, Escudo d'Água, Órbita de Chamas, Prensa Barométrica, Mistura Caótica, Campo de Supressão, Erupção e Pele de Pedra. Os testes conferem que nenhuma magia do Livro, do caderno ou dos estudos tem erro na Leitura do Círculo.

## ⚡ Energia e Cargas Mágicas

Depois de desenhar o círculo, o mago **infunde uma quantia X de energia na Matriz** (aba **Mago & Pergaminho**, com Refino, Energia e Tempo — a média é 3 de energia a cada 0,1 s). A energia corre pelos fios como um líquido, e cada selo e cada runa gasta conforme o estado em que fica (Mínimo / Perfeito / Instável). Somando todos, a magia tem cinco faixas, que aparecem no **Resultado do Círculo**:

| Faixa | Bola de Fogo do exemplo | O que acontece |
|---|---|---|
| **Mínimo para ativação** | 9,6 | Abaixo disso a magia não ativa. |
| **Ativação estável** | 9,6 ~ 27,6 | Estável; a sobra sobe as runas para Perfeito na ordem do caminho (a 1ª runa primeiro). Runas fora de um Círculo ○ podem oscilar de estado. |
| **Ativação perfeita** | 27,7 | Tudo em Perfeito: não pode falhar. |
| **Instabilidade por sobrecarga** | 27,8 ~ 127,9 | Chance de falha de 20% (1d4) a 100%; a 1ª runa do caminho é a primeira que pode falhar (explosão). |
| **Autodestruição por sobrecarga** | 128 | A magia se destrói. |

Exemplo: Matriz-1 ( ) → Círculo-1 (Fogo) → Círculo-2 (Esfera) → Círculo-3 (Movimento) → Matriz-1 ( ), com Matriz 0,4/4/40, Círculo 0,2/2/20, Fogo 3,4/7,1/11,3, Esfera 1,2/3,4/4,2 e Movimento 4,0/7,2/12,5. Com 13,3 o Fogo entra em Perfeito; com 30 a magia fica instável (≈ 21,8% de falha).

Com **Energia nos fios** ligado, o desenho mostra quanta energia corre em cada fio mágico e fica em cada selo e runa. Por padrão a energia é a da **Ativação perfeita** (automática); os custos dos selos (fora Matriz e Círculo) e das runas de apoio são provisórios e o admin pode mudar pelo site.

## 👤 Contas e Círculos Salvos

Pelo botão **👤 Entrar**, cada pessoa cria uma conta (e-mail e senha) e passa a ter o painel **Meus Círculos**: salvar o círculo atual, atualizar, abrir, duplicar e excluir, em qualquer aparelho. Só o dono vê os próprios círculos (Row Level Security no banco). Sem conta, o site continua funcionando normalmente e dá para salvar pelo menu **⬇ Exportar (JSON)**.

As contas ficam no Supabase, projeto `circulo-magico` (São Paulo). A estrutura está em [`database/contas_supabase.sql`](database/contas_supabase.sql). A chave usada no site é a chave pública (*publishable*), feita para ficar no navegador.

## ⚙️ Regras do Sistema (admin)

A conta **admin** muda as informações do sistema direto no site, sem mexer no código: **Minha Conta → Regras do Sistema** (ou **Editar** no Grimório).

- **Runas:** Poder e Energia em Mínimo / Perfeito / Instável (usados nos cálculos), matéria faltante (%), nome, sigilo e a **ficha do Grimório**: citação, função principal, efeito principal e do 2º estágio (Tabela Geral), **colunas extras por estado** (ex.: Densidade em g/cm³, Volume, Temperatura), Componentes Faltantes, Passiva e Aplicação Perfeita.
- **Formas:** valor base, faixa (mínimo ~ máximo) e função de cada forma.
- **Selos:** a energia de cada selo em Mínimo / Perfeito / Instável.
- **Cálculo:** chance de falha inicial (20%), retorno da Estrela (1,2×), locomoção média da energia, bônus de Simultâneo (refino/densidade) e Sequencial (volume/área) e as medidas por ponto de Poder.
- As mudanças aparecem na hora (rascunho) e valem **para todo mundo** ao tocar em **Salvar para todos**. A aba **Versões** guarda cada versão anterior para voltar atrás.
- A **Tabela Geral** e as **fichas das runas** do Grimório são montadas a partir desses dados, então sempre mostram os valores atuais.

Segurança: a tabela `regras` pode ser lida por todos, mas só quem está na lista `admins` consegue alterar (Row Level Security). A estrutura está em [`database/regras_supabase.sql`](database/regras_supabase.sql), com o comando para colocar outra pessoa como admin.

## 🗄️ Banco de Dados (SQL)

O arquivo [`database/runas.sql`](database/runas.sql) cria as tabelas `formas`, `estados`, `runas`, `niveis_carga` e `circulos` (para guardar círculos salvos), além da visão `v_runas_tabela`, no formato da tabela oficial. Funciona em **PostgreSQL / Supabase** e **SQLite**. Valores ainda não definidos ficam `NULL`.

## ✨ Funcionalidades Principais

### Editor Vetorial Interativo (Canvas SVG)

- Posicione, rotacione, redimensione e conecte formas estruturais simples e compostas dentro do anel do círculo mágico.
- Pontos de ancoragem circulares (`o`) gerados automaticamente na borda do componente de **origem** de cada cabo.
- Ligações em **Linha Reta** (Fluxo Direto) ou **Arco Curvo Externo/Interno** (Fluxo Orbital).
- **Magia dentro da magia:** um Círculo ○ ou Quadrado □ pode guardar várias runas (até 8); a forma só delimita a função colocada lá dentro. Com o Selo selecionado, ligue **Magia dentro do selo** em Peças e toque nas runas; no painel do Nó, cada runa de dentro tem ✕ para tirar. No desenho elas aparecem ligadas, como no caderno: a magia de dentro também tem fonte, então a primeira runa de dentro fica num pequeno **Matriz ◇** e as outras em pequenos círculos. Uma magia assim é de **2º Círculo** (o selo aparece no Resultado e no Livro de Magias).
- **Círculos dentro de círculos (2º Círculo):** botão **Novo círculo dentro** em Peças cria um anel menor dentro do círculo selecionado, com a sua própria Matriz; o tamanho de cada círculo se ajusta no painel do centro dele. A Matriz de um círculo pode ficar fora do centro (como a Matriz da lança, embaixo). Dois cabos entre as mesmas formas, um de ida e outro de volta, aparecem como **linha dupla**.
- **Cada círculo funciona sozinho; entre eles a energia passa por fora, de anel a anel.** Em Ligações & Anel → Nova Ligação, além das formas, dá para escolher **o anel de um círculo** (o círculo inteiro) como origem ou destino. O que está dentro de um círculo não mexe nos outros. Um círculo sem Matriz própria funciona com a energia que chega pelo anel dele. Com o círculo em volta de tudo, uma forma pode ficar entre os círculos (ex.: a Matriz entre a lança e as bolas de fogo, na Lança de Fogo Plasmática). Exemplo: **Lança de Fogo Plasmática (só a lança)**.
- **Círculos separados ligados = 3º Círculo:** botão **Novo círculo ligado (separado)** em Peças; ligue uma forma da magia principal a uma forma do outro círculo. Um **círculo em volta de tudo** envolve todos (opção em Ligações & Anel; sem ele o resultado avisa). No centro de cada círculo dá para dar um **nome/função** e pôr o círculo **dentro de um quadrado** (efeito sustentado, não inerente). Se o círculo tem uma magia dentro de Selo, a Matriz dela é a fonte e o centro pode ser outra forma. Os níveis são um **check-list**: o Resultado mostra todos os alcançados (ex.: ✓ 2º · ✓ 3º). Exemplo: **Lança de Fogo Plasmática**.
- **Círculos sobrepostos = 2,5º Círculo** (acima do 2º, abaixo do 3º): duas Estrelas alinhadas na sobreposição, uma em cada camada (círculo). O painel da Estrela mostra se as duas estão alinhadas; desalinhadas, o Resultado avisa.
- **Toda forma tem fonte:** se há um Quadrado □ ou Círculo ○, ele sempre recebe energia de uma Matriz, nem que o cabo só vá e volte (Matriz ➔ forma ➔ Matriz). Sem isso o resultado mostra **✕ Forma sem Fonte**.
- **Runas estruturais (Propriedade): Projétil, Toque, Ser, Estado, Ligação, Órbita, Área e Intenção** — têm cor própria (🔴) e filtro na lista de runas.
- **Toque:** a magia, ou a parte anterior a ele, interage direto com a superfície mais próxima (quase como se tocasse). Mostra a utilidade com as **runas de conceito** (sem forma física, mas com efeitos sobrenaturais que se observam e com que se interage): **Tempo, Movimento, Pressão, Caos, Infinito, Vazio, Vida e Morte** — a Leitura do Círculo mostra o que toca a superfície e avisa quando o Toque está sendo útil.
- **Ser:** as runas anteriores a ele viram um conjunto (um ser); separa objetos ou elementos para que sejam, ou não, afetados por outra runa. Ex.: sem Ser, 3 objetos diferentes orbitam juntos com a **Órbita** — a Leitura do Círculo lista cada conjunto.
- **Órbita:** uma linha invisível paralela ao círculo; tudo ligado a ela orbita a magia, com os seres (os conjuntos do Ser) divididos igualmente pela circunferência — a leitura mostra quantos são e o ângulo entre eles (ex.: 4 seres, um a cada 90°).
- **Área:** como o Toque, mas com a **superfície mais distante** (quase como se reprojetada); com runas de **Espaço**, cria âncoras de ativação.
- **Ligação:** cola objetos ou elementos sem misturar; recomendada com o **Projétil** (formato fixo como um único objeto); objetos do mesmo elemento, ou de elementos que se derivam do mesmo, se **mesclam** — **Matéria** (Fogo, Raio, Ilusão, Vida, Luz, Natureza, Ácido), **Gravidade** (Terra, Metal, Pressão), **Tempo** (Água, Gelo, Movimento, Morte, Infinito) e **Espaço** (Vento, Som, Caos, Sombra, Vazio).
- **Intenção:** põe a intenção de quem usa na runa anterior (ou no círculo anterior). No painel do Nó, escreva a **palavra ou números de vínculo** e toque em **Vincular** — depois disso não dá para desvincular (só trocando a runa); a palavra aparece embaixo da runa no desenho.
- **Estado:** mantém o estado da(s) runa(s) anterior(es), **ou usadas ao mesmo tempo** (formas que recebem do mesmo ponto em paralelo), o mais perto de estável ou funcional (ex.: o Fogo não é apagado pelo vento nem pela umidade). O recomendado é usá-lo **logo depois de um conjunto de objetos (formatos) ou de elementos** — a Leitura do Círculo mostra o que cada Estado mantém e avisa quando ele vem em outro lugar.
- **Projétil:** une os diferentes formatos num único objeto aerodinâmico; com um contexto, tenta recriar esse conteúdo com os formatos disponíveis. O recomendado é usá-lo como **último passo do ciclo** ou **logo depois dos formatos** — a Leitura do Círculo avisa quando ele está em outro lugar.
- **Runas de Direção:** **Direção** — Dá a direção da magia: para onde ela vai. **D.N. Lateral** — A magia não sofre com forças externas que a empurrariam para os lados. **D.N. Vertical** — A magia não sofre com forças externas que a empurrariam para cima ou para baixo. **Direção Contrária** — A magia volta para quem a lançou.
- Cada tipo de símbolo interno tem uma cor: 🟠 **Elementais**, 🔵 **Formas**, 🔴 **Estruturais (Propriedade)** e 🟣 **Direção** (no círculo, na lista de runas e nas imagens exportadas).
- Três temas no botão ◐ (um toque passa para o próximo; a escolha fica lembrada): **Pergaminho** (papel envelhecido e tinta sépia), **Grimório** (modo escuro arcano) e **Caderno** (folha pautada com margem vermelha, como o caderno de rascunho).
- Desenhos enfeitados: o anel rúnico traz uma faixa de runas entre os dois traços, os anéis têm losangos dourados e as formas ganham um contorno interno e pontos nos cantos, como gravados à mão. No Pergaminho, o PNG/SVG exportado leva o papel junto.
- **Traço feito à mão** (padrão), mas caprichado: linhas quase retas com uma curvinha mínima, cantos que se cruzam só um pouquinho, círculos que fecham quase no ponto e uma segunda passada fina de pena colada na primeira; as runas do anel parecem escritas à mão com cuidado. O traço é sempre o mesmo para cada peça (não treme ao arrastar). Na aba **Ligações & Anel → Aparência do Círculo → Traço** dá para trocar para **Limpo**; a escolha fica lembrada no aparelho.

### Ferramentas de desenho

- **Barra rápida** ao lado do desenho (no celular em pé, na linha da Energia): ↶ **Desfazer** e ↷ **Refazer** (também **Ctrl+Z** e **Ctrl+Y**), **Ímã**, **Ver traçado** e zoom.
- **Mover um círculo inteiro:** arraste o **anel** de qualquer círculo (inclusive o principal) — ele leva junto tudo o que está dentro, até os círculos menores.
- **Ligar círculos:** no modo Reta ou Arco, toque no anel de um círculo e depois no anel do outro (ou puxe de um anel até o outro).
- **Puxar cabo:** no modo Reta ou Arco, arraste de uma forma até outra e solte (tocar numa e depois na outra continua funcionando). No modo Mover, segure **Alt** e arraste.
- **Curvar pela seta:** arraste a seta do meio de um cabo para fora (arco por fora), para dentro (arco por dentro) ou de volta à linha (reto). Um toque na seta ainda inverte o cabo.
- **Ímã:** ao arrastar, a forma gruda em ângulos de 15° em volta do centro do círculo e na mesma distância do centro que outras formas, para sair simétrico. Começa desligado; a escolha fica lembrada.
- **Zoom (de 10% a 2400%):** afaste até 10% para ver o desenho de longe, com espaço em volta; roda do mouse ou botões + e − no computador, **pinça com dois dedos** no celular; com zoom, arraste o fundo para andar pelo desenho. O botão de porcentagem volta a 100%.
- **Evoluir Forma** (painel do Nó): troca a forma simples pela composta e de volta, sem perder runa nem cabos (Círculo/Triângulo ↔ Círculo+Triângulo, Pentágono/Estrela ↔ Pentágono+Estrela, Quadrado/Matriz ↔ Matriz+Quadrado).
- **Ver traçado:** desenha o círculo traço por traço — primeiro as Matrizes, depois os cabos, as formas e por fim os anéis.
- A **Estrela** posta onde dois círculos se sobrepõem vai direto para o meio da sobreposição (a "lente"), mesmo com círculos de tamanhos diferentes.

### Aparência da Magia

No **Resultado**, o painel **Aparência da Magia** desenha, no traço do site, como a magia fica na cena — e muda sozinho quando as runas mudam. Quem lança fica à esquerda e a frente é para a direita:

- **Elementos** dão a cor; **Esfera, Cubo, Paralelepípedo e Pirâmide** dão a forma; elemento sem formato vira uma chama/nuvem; **runas de conceito** (Tempo, Movimento, Pressão…) aparecem como aura.
- Cada conjunto fechado por um **Ser** é um ser separado; o que não foi separado é a magia principal.
- **Projétil**: os formatos voam enfileirados como um só objeto, com a Pirâmide na ponta; **Toque**: na superfície mais próxima; **Área**: reprojetada na superfície mais distante; **Direção Contrária**: volta para quem lança; **Órbita**: os seres giram na linha em volta, divididos igualmente; seres separados sem lugar próprio **acompanham** o objeto em voo (ex.: as 4 bolas de fogo em volta da Lança Plasmática).
- **Estado** = moldura pontilhada; **Ligação** = elos entre as partes (ou cores mescladas, se os elementos se derivam do mesmo); **D.N. Vertical/Lateral** = travas; **Intenção** = a palavra de vínculo em cima.
- Embaixo do desenho, uma frase por ser explica o que aparece (seres iguais viram uma linha só: "4× …").

- **Ficha da magia** (embaixo do desenho), como num livro de RPG: nome, círculo, escola (os elementos) e tipo (Evocação, Projétil, Toque, Área distante, Pessoal, Órbita); Energia, Conjuração, Alcance, Área, Duração e Poder; o **Efeito** de cada elemento (★ o efeito perfeito, quando ativo); uma **Descrição** que narra como a magia aparece (ex.: "Uma esfera de chamas crepitantes surge diante de quem lança e avança em linha reta."); e os selos e runas do desenho.
### Exportar e reaproveitar

- **Imagem PNG** ou **Vetor SVG**, com duas opções que ficam lembradas: **Fundo transparente** (só os traços, para pôr por cima de outra arte) e **Limpa** (sem as setas do meio dos cabos e sem a grade de guia).
- **Molde sem runas:** baixa o desenho (formas, cabos, círculos e anel) sem nenhuma runa, para montar outra magia com a mesma geometria. Abre pelo **Abrir arquivo**.
- **Duplicar** (⧉ em Meus Círculos): cria uma cópia de um círculo salvo — "Nome (cópia)", "Nome (cópia 2)"… — para testar variações sem mexer no original.

### Menus

- **Peças**: formas para adicionar e a lista de runas, com busca e filtros por tipo (cada pílula mostra a cor e quantas runas há). Um aviso mostra para qual forma vai a runa tocada, com o botão **Tirar runa**.
- **Ligações & Anel**: aparência do círculo (anel único, duplo ou rúnico em cartões com desenho; traço feito à mão ou limpo; espessura; guias), **Nova Ligação** (De → Para com botão ⇅ para trocar, tipo de linha e especialização) e a lista de ligações com a runa de cada ponta, ⇄ para inverter e ✕ para remover.
- **Mago & Pergaminho**: Refino, Energia na Matriz (com Mínimo / Perfeita / Automática e as cinco faixas), Tempo (energia por segundo) e o botão **Energia nos fios**.
- No computador, as abas da esquerda são **Peças · Ligações · Mago** e as da direita **Nó · Resultado** (cada uma com o seu espaço; a bolinha na aba Resultado fica verde, amarela ou vermelha). Selecionar um selo no desenho abre o Nó; o selo de Energia no desenho abre o Resultado.
- **Nó** (selo selecionado): selo, a runa atual com **Trocar**, o estado (que vem da energia), tamanho (de 14 a 160, com campo para digitar) e rotação; no Triângulo, o botão **Base para cima** troca PoderX por EfeitoX.
- **Resultado**: combinação e matéria em botões com explicação, os números, a energia com as cinco faixas e a chance de falha, e a **Leitura do Círculo** em partes que abrem e fecham (as 3 primeiras abertas; o que você abrir ou fechar fica assim).
- **Exportar** separado em *Imagem do círculo* e *Projeto*; **Grimório** com o menu **Ir para…**; **Minha Conta** sobe de baixo no celular.
- Opções curtas viraram botões e os controles deslizantes seguem a cor do tema, sem textos cortados no celular.

### Selos Estruturais (6 simples + 3 compostos)

| Selo | Formato | Função | Energia (Mín. ~ Perf. ~ Inst.) |
|---|---|---|---|
| **Matriz** | ◇ Losango | Fornecedor / Finalizador: o mago insere energia por ela; quando a energia volta, a magia (ou etapa) é concluída. | 0,4 ~ 4 ~ 40 |
| **Quadrado** | □ Quadrado | Reativador / Supressor: a energia entra, mas não sai; a cada nova fonte, a runa escrita nele é reativada. | 0,3 ~ 3 ~ 30 (provisório) |
| **Círculo** | ○ Círculo | Estabilizador / Escritor: mantém a runa estável com o mínimo de energia; dois Círculos sobrepostos deixam escrever letras rúnicas entre eles. | 0,2 ~ 2 ~ 20 |
| **Triângulo** | △ Triângulo | PoderX / EfeitoX: base para baixo, Poder ×3 e custo ×5; base para cima, efeito ×2 e custo ×4. | 0,5 ~ 5 ~ 50 (provisório) |
| **Pentágono** | ⬠ Pentágono | Comparador / Capacitor: só passa energia quando todas as entradas estão ativas; divide a energia pelo número de entradas. | 0,8 ~ 8 ~ 80 (provisório) |
| **Estrela** | ☆ Estrela | Sobreposição / Carregador: duas Estrelas alinhadas unem círculos sobrepostos; sozinha, guarda energia e a devolve 1,2× à fonte (se for suficiente, reativa a magia) e depois apaga. | 1 ~ 10 ~ 100 (provisório) |
| **Matriz+Quadrado** | ◇+□ | Restrição | 0,7 ~ 7 ~ 70 (provisório) |
| **Círculo+Triângulo** | ○+△ | Sobrecarga (estável e multiplicado) | 0,7 ~ 7 ~ 70 (provisório) |
| **Pentágono+Estrela** | ⬠+☆ | Absorvedor | 1,8 ~ 18 ~ 180 (provisório) |

### Combinando runas estruturais

Cada runa estrutural é uma propriedade própria, na ordem do ciclo. Quando duas se conectam (ex.: **Projétil + Ser ➔ Órbita**), o resultado **liga os dois conceitos** — não é uma mistura deles.

### Tabelas Completas de Energia (Mínimo / Perfeito / Instável), Poder e Efeitos

| Runa | Energia (Mín ~ Perf ~ Ext) | Poder (Mín ~ Perf ~ Ext) | Efeito Principal e Regra de Dados |
|---|---|---|---|
| **Fogo (Ig)** | 4 ~ 7 ~ 12 (4,2 ~ 7,5 ~ 12,1) | 5 ~ 14 ~ 21 | **Queimação:** reduz 1 + 0,1% da vida atual / durabilidade |
| **Vento (Vs)** | 3 ~ 4 ~ 9 (3,5 ~ 4,5 ~ 9,0) | 3 ~ 8 ~ 14 | **Corte Mágico:** causa +1d12 de dano mágico adicional |
| **Terra (Tr)** | 5 ~ 14 ~ 20 (5,8 ~ 14,3 ~ 21,7) | 5 ~ 22 ~ 28 | **Lentidão:** reduz a velocidade geral em 0,2 (até 5:1) |
| **Água (Gu)** | 4 ~ 8 ~ 16 | 2 ~ 10 ~ 13 | **Inibição:** interage contra elemento base (exceto variações/evoluções) |
| **Raio** | 24 ~ 52 ~ 57 | 14 ~ 64 ~ 75 | **Paralisia:** diminui os movimentos em -1d8 |
| **Som** | 12 ~ 24 ~ 36 | 8 ~ 48 ~ 76 | **Atordoamento:** diminui pensamento em -2 e comunicação em -1d4 |
| **Gelo** | 10 ~ 30 ~ 40 | 10 ~ 45 ~ 60 | **Congelamento:** diminui o movimento e processos energéticos em -1d4 |
| **Metal** | 33 ~ 82 ~ 132 | 22 ~ 123 ~ 132 | **Supressão Energética:** dispersa energias externas em até 6/10 de poder 5 (1,75) |

| Runa | Energia (Mín ~ Perf ~ Ext) | Poder (Mín ~ Perf ~ Ext) | Efeito Principal (1º Estágio) | Efeito Secundário / Limite (2º Estágio) |
|---|---|---|---|---|
| **Ilusão** | 32 ~ 48 ~ 66 | 16 ~ 34 ~ 40 | **Falsa Ação:** congela ou esconde 1 ação | Ocultação completa de ação no turno |
| **Pressão** | 20 ~ 56 ~ 80 | 10 ~ 40 ~ 50 | **Diminuição:** diminui em -2 todos os mods | Supressão gravitacional/barométrica de modificadores |
| **Movimento** | 6 ~ 13 ~ 24 | 4 ~ 13 ~ 20 | **Velocidade:** aumenta ou diminui a velocidade em 1 m/s | Controle vetorial cinético por estágio |
| **Caos** | 12 ~ 26 ~ 36 | 6 ~ 20 ~ 24 | **Mistura:** mistura 1 atributo ao caos | Embaralhamento caótico de atributos |
| **Vida** | Escala 2x ~ 3,2x ~ 5x por Poder | — | Mantém 0,01% (até 50,0% do poder) do indivíduo no mesmo estado | Em 50%: o ser não pode ser alterado |
| **Morte** | Escala 2x ~ 3,2x ~ 5x por Poder | — | Volta o ser para um estado anterior 0,01% (até 50,0%) | Em 50%: condições do indivíduo são negadas |
| **Natureza** | Variável | Variável | Acelera o crescimento natural em 5% | Acima de 100%: o crescimento pode gerar mutação |
| **Ácido** | Variável | Variável | Separa componentes próximos em 2 | Aumenta o grau de pureza da matéria |

## 📱 Celular, tablet e computador

- **Computador:** três colunas — peças e ligações | desenho | nó e resultado.
- **Tablet deitado e celular deitado:** desenho à esquerda e um painel à direita, com as abas **Peças · Ligações · Nó · Resultado** no topo.
- **Tablet em pé:** desenho grande em cima, abas e painel embaixo.
- **Celular em pé:** desenho em cima, painel embaixo e as abas no rodapé, perto do polegar.
- **Menu ampliável (celular e tablet em pé):** a alça entre o desenho e o menu (**Ampliar menu**) sobe o menu e deixa o desenho pequeno em cima; toque nela de novo, arraste para baixo ou toque outra vez na aba aberta para voltar. **Trocar** runa e o selo de carga já abrem o menu ampliado. No celular, as formas ficam numa fileira que desliza para o lado, com as runas logo abaixo.
- Em telas de toque os botões ficam maiores, e as formas podem ser arrastadas com o dedo.

## 🛠️ Para desenvolver

O site é feito em **TypeScript** com **Vite**. Precisa do [Node.js](https://nodejs.org/) 22 ou mais novo.

```bash
npm install      # instala as dependências
npm run dev      # abre o site em modo de desenvolvimento (atualiza sozinho)
npm test         # roda os testes (regras, exemplos e magias)
npm run build    # confere os tipos e gera o site final em dist/
```

### Onde fica cada coisa

| Pasta / arquivo | O que tem |
|---|---|
| `index.html` | Estrutura da página (cabeçalho, painéis, janelas). Os botões usam `data-action`. |
| `src/main.ts` | Ponto de entrada: liga todas as partes. |
| `src/data/` | **Dados do sistema**: `runes.ts` (as 40 runas e suas cores), `shapes.ts` (formas e faixas), `presets.ts` (exemplos do caderno e estudos) e `spells.ts` (Livro de Magias). |
| `src/core/` | **Regras**, sem nada de tela: `flow.ts` (Matriz, ciclo e rotas), `charge.ts` (energia infundida, as cinco faixas, estado de cada runa, chance de falha e energia em cada fio), `analysis.ts` (cálculo completo e leitura do círculo), `circles.ts` (círculos sobrepostos e Estrela), `geometry.ts`, `project.ts` (abrir arquivos com segurança) e `types.ts`. |
| `src/ui/` | **Tela**: desenho (`canvas.ts`), enfeites dos anéis (`ornaments.ts`) e das formas (`shapes-svg.ts`), traço à mão (`sketch.ts`), arrastar e tocar (`interaction.ts`), ações do editor (`editor.ts`), painéis, resultado, exportar, Grimório (`grimoire-content.html`) e layout. |
| `src/cloud/` | Contas e "Meus Círculos" (Supabase). |
| `src/styles/` | Estilos separados por parte (cores dos temas e da mana em `tokens.css`, tamanhos de tela em `responsive.css`). |
| `tests/` | Testes automáticos das regras e de todos os exemplos e magias. |
| `database/` | Banco de dados (SQL). |

**Exemplos de mudanças comuns:**
- Nova magia no Livro: adicione em `src/data/spells.ts` (os testes conferem se ela é estável e se nenhuma forma encosta na outra).
- Mudar valores de uma runa: `src/data/runes.ts`.
- Mudar uma regra de energia (faixas, ordem em que as runas sobem, falha): `src/core/charge.ts`.
- Mudar um texto do Grimório: `src/ui/grimoire-content.html`.

## 🚀 Publicação

A cada atualização na branch padrão do repositório, o **GitHub Actions** confere os tipos, roda os testes, compila e publica o site sozinho em `https://pietropasqual.github.io/c-rculo-magico/`.

Configuração (uma vez só): em **Settings ➔ Pages ➔ Build and deployment ➔ Source**, escolha **GitHub Actions**.


## Ficha do sistema de RPG

A ficha segue o material fornecido em [docs/rpg/creation-reference.txt](docs/rpg/creation-reference.txt):

- Descrição, aparência, sete arquétipos com vantagens e desvantagens, classes, subclasses, estilos, pilar e talentos.
- Elementos, dez estatísticas com valor, modificador, ALT, DR, talento para cálculo e limite; estados, recursos, defesas, efeitos e ações.
- Perícias com etapa, grau, execução, tipo, efeito, condição, complementar e fundamentos; inventário por localização, características, feitos, títulos, jornada e aprendizado.
- Consulta de fórmulas, descansos, categorias de rolagem e ranks. Cálculos das reservas, ValorDiário, LimiteDeGanho, valor por idade, Consenso, Cadeia de Substância e energias especiais usam os dados preenchidos.
- Até 20 cópias de círculos por ficha; o editor atual e a aparência das runas e círculos são preservados. A energia da ficha não altera automaticamente a energia aplicada na matriz do editor.

As reservas iniciais do modelo (Vida 50, Fadiga 20, Psicológico 10, Energia 10) são preservadas. Vida e Fadiga divergem das fórmulas quando todos os modificadores são −20; por isso os resultados são exibidos para consulta, sem sobrescrever recursos atuais ou máximos. Campos que dependem de definição do mestre permanecem manuais: conversão de valor em modificador, Roleta Elemental, desbloqueios e variáveis não definidas. O número usado como Talentos na fórmula é informado explicitamente; não é inferido da lista de talentos.

Os limites de espaços do arquétipo aparecem na criação; mudar de arquétipo ou reduzir avanços não apaga registros existentes. Referências narrativas não executam automaticamente consequências ou sorteios. Backups anteriores continuam aceitos, e seus registros livres são mantidos em **Registros livres e fichas anteriores**. Exportação/importação JSON inclui os novos dados, com limite de 2 MB por ficha.


## Entrada e estilo de grimório

O site abre na tela de acesso: sessão existente é restaurada automaticamente; sem sessão, é possível entrar, criar conta ou continuar sem conta. Falha ou demora na conexão não bloqueia o editor nem a ficha. O cadastro pede confirmação de senha; o login tem controle de mostrar/ocultar senha. Somente os círculos são sincronizados com a conta nesta etapa.

A interface usa pergaminho rústico: papel envelhecido, fibras, manchas suaves, tinta sépia e bordas gastas, com títulos em Cormorant Garamond. A coleção apresenta os personagens como folhas de um manuscrito; a ficha tem capítulos contínuos e um índice marrom na encadernação. A textura usa geometria SVG estática e gradientes locais, sem downloads externos. Os temas escuro e Caderno continuam disponíveis, com campos de leitura simples. No celular o formulário de acesso aparece antes da apresentação.

A fonte Cormorant Garamond é servida pelo próprio site, em WOFF2 com `font-display: swap`; sua licença está em [docs/fonts/Cormorant-Garamond-OFL.txt](docs/fonts/Cormorant-Garamond-OFL.txt). As cores e os traços usados no desenho das runas e círculos são preservados. Veja as [capturas e verificações do visual](docs/visual-review.md).


## Seleção de personagens

Depois do acesso, a primeira tela é a seleção de personagens. Crie um personagem ou importe uma ficha JSON; abra o cartão para preencher identidade, história, atributos, perícias, recursos, habilidades e inventário. Criar ou importar adiciona um personagem, sem substituir os anteriores. Também é possível duplicar, baixar e excluir personagens com confirmação.

As fichas ficam nesta instalação do navegador: até 24 personagens e 4 MB para a coleção, com o limite de 2 MB por ficha. A ficha única do formato anterior é recuperada automaticamente e a chave antiga é preservada como cópia. Falhas de armazenamento são informadas; nesse caso baixe os JSONs antes de fechar a página.

Dentro da ficha, a seção **Magias e círculos** abre o editor completo. O botão **Guardar na ficha** cria uma cópia para o personagem aberto. **Voltar à ficha** mantém o rascunho apenas durante a sessão. Os rascunhos e o histórico de desfazer são separados ao trocar de personagem; para guardar um círculo após recarregar, salve a cópia na ficha ou exporte o JSON.

O índice lateral da ficha permanece disponível durante a rolagem e destaca a seção atual. Seus atalhos também abrem registros recolhidos e levam o foco ao título da seção. Em telas menores, o índice vira um seletor compacto no topo da ficha.
