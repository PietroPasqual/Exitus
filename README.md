# ❂ Criador de Círculos Mágicos — Sistema de Runas RPG

Aplicação web interativa (`index.html` autocontido com HTML5, CSS3 e JavaScript/SVG vetorial) desenvolvida para criar, simular e exportar Círculos Mágicos do sistema de RPG.

## ⟳ Regras Fundamentais do Fluxo de Energia

- **Toda magia inicia no Prisma (◇ Core) e finaliza nele.** O circuito só é válido quando a energia sai do Prisma, percorre os componentes e encontra um caminho de volta ao Prisma.
- **O Prisma é essencial e nunca some.** É ele que faz a magia funcionar: sem o Prisma em um ciclo fechado, nada funciona (nenhuma runa recebe energia). O Prisma só pode ser ◇ Core ou ◇+□ Corp.
- **Os cabos são cabos de energia com direção.** O pequeno círculo `○` marca o componente **de onde a energia sai**; a outra ponta do cabo (sem `○`) indica **para onde ela vai**.
- **○ Círculo (Liberar) pega e solta** a energia; **□ Quadrado (Manter) só pega** — sustenta o efeito continuamente e nunca solta (não pode ter cabo de saída); **△ Triângulo (Equilíbrio) regulariza** a energia e neutraliza o risco de colapso das runas no Extremo.
- Componentes que recebem energia mas não a devolvem ao Prisma ficam com a **energia presa** — exceto **Col** (□) e **Corp** (◇+□), que por função **retêm** a energia (entrada e bloqueio).

- **Círculos sobrepostos:** dois círculos mágicos podem se sobrepor. A **Estrela ☆ (Sobrepositor)** colocada na área de sobreposição junta os dois — ela só une, não substitui o Prisma. Cada círculo começa e termina no seu próprio Prisma, e os cabos só passam de um círculo para o outro através da Estrela. Use **◎ Novo círculo sobreposto** e arraste o Prisma de um círculo para movê-lo. Exemplo pronto: **Círculos Unidos pela Estrela**.
- **O formato é livre.** A disposição dos componentes pode ser qualquer uma para formar a magia desejada — o que define a magia são as runas e o caminho da energia. Exemplos incluídos: **Bola de Fogo** (Exemplo 1) e o mais complexo **Lança-Chamas** (Exemplo 2).

O painel de diagnóstico verifica essas regras automaticamente: indica se a magia não inicia no Prisma, se o fluxo está aberto (não volta ao Prisma), e quais nós estão sem energia ou com energia presa. Também mostra a **rota exata** da energia (ex.: `Prisma ◇ ○──► #3 (Fogo) ○──► #1 (Esfera) ○──► #2 (Direção) ○──► Prisma ◇`). **Clicar num cabo** inverte o sentido (ou use **⇄** na aba Ligações), **Shift+clique** remove, e o botão **⚡ Fluxo** (ligado ao abrir) mostra o caminho da mana:

- **Azul**: a mana sai do Prisma, percorre o cabo e volta a ele — essa parte da magia funciona. O Prisma pulsa.
- **Âmbar**: a mana sai do Prisma mas não volta — o circuito está aberto e a energia vaza.
- **Apagado**: a mana não chega ali.

Cada cabo também tem uma **seta no meio** apontando da origem (○) para o destino, com o Fluxo ligado ou não.

## 📜 Livro de Magias

22 magias de exemplo montadas com as regras do sistema, cada uma com um desenho próprio e todas estáveis (carga abaixo de 70%). Abra pelo menu **★ Exemplos** ou pelo Grimório:

| Magia | Desenho | Runas | Ideia |
|---|---|---|---|
| **Projétil de Fogo** | Do seu desenho | Prisma neutro, Fogo, Cubo/Pirâmide, Projétil, Direção | Projétil logo depois dos formatos; Queimação |
| **Muralha de Terra** | Escudo vertical | Terra (Perfeito), Paralelepípedo (Salor), D.N. Vertical, Estado (Col), Sal △ | Muralha sustentada pelo Col; Lentidão e Petrificação |
| **Lâmina de Vento** | Varredura em arco | Vento (Perfeito), Pirâmide, Direção, Projétil | Lâmina de vento; Corte Mágico +1d12 |
| **Descarga em Área** | Triângulo invertido | Raio, Projétil (Salor), Área, Direção (Sal △) | Projétil que estoura em área; Paralisia −1d8 |
| **Cubo de Gelo** | Cruz com dois ciclos | Gelo, Cubo, Ser, Sal △, Estado (Col) | Prende um ser num cubo de gelo; Congelamento −1d4 |
| **Grito Atordoante** | Anel de ondas | Som, Área, Esfera (Sal △), Ser, Direção | Onda sonora para a frente; Atordoamento |
| **Passo Veloz** | Arco + Col | Movimento, Ser, D.N. Lateral, Toque, Estado (Col) | +1 m/s ao tocar um ser |
| **Falsa Ação** | Arco invertido | Ilusão, Intenção (Salor), Ser, Toque, Sal △ | Congela ou esconde 1 ação do alvo |
| **Escudo d'Água** | Cruz com dois ciclos | Água (Perfeito), Esfera, Órbita (Sal △), Ser, Estado (Col) | Bolha d'água orbitando o ser; Inibição e Extração |
| **Órbita de Chamas** | Anel orbital | Fogo (Perfeito), Esfera, Órbita, Ser, Sal △ | Esferas de fogo girando em volta de um ser |
| **Lança de Gelo** | Anel em cruz | Prisma neutro, Gelo num Rad ⬠ (carga 2x), Pirâmide, Projétil, Direção (Sal △) | Lança com o dobro de Poder; Congelamento |
| **Prensa Barométrica** | Triângulo invertido | Pressão, Área (Salor), D.N. Vertical, Sal △ | Diminuição −2 em todos os mods na área |
| **Mistura Caótica** | Triângulo | Caos, Projétil, Ser, Sal △ | Mistura 1 atributo do alvo ao caos |
| **Campo de Supressão** | Pentágono | Metal, Área (Redor), Ser, Sal △, Estado (Col), Intenção | Campo que dispersa energias externas |
| **Meteoro Flamejante** | 2 círculos na diagonal | Terra + Fogo unidos pela Estrela, Esfera, Projétil, Direção | Rocha em chamas lançada |
| **Tempestade Elétrica** | 2 círculos na vertical | Raio + Vento unidos pela Estrela, Projétil (Salor), Área | Corte Mágico e Paralisia em área |
| **Passo Ilusório** | 2 círculos | Ilusão + Movimento unidos pela Estrela, Ser (Salor), Sal △, Direção | Desvia deixando uma imagem falsa |
| **Pele de Pedra** | Varredura + Col | Terra, Cubo, Direção Contrária, Sal △, Estado (Col) | A magia volta para o conjurador: Endurecimento nele mesmo |
| **Dardo Inabalável** | Anel em cruz | Fogo (Perfeito), Pirâmide, D.N. Vertical, D.N. Lateral, Projétil (Sal △) | Dardo de fogo que forças externas não desviam |
| **Erupção** | 3 círculos, 1 Estrela | Terra + Fogo + Pressão unidos por uma só Estrela no centro | Erupção em área: Lentidão, Queimação e Diminuição |

## ⚡ Carga, Sobrecarga e Explosão

Enquanto você monta o círculo, o app calcula se ele aguenta a energia e mostra o resultado no selo **Carga** (no canto do círculo) e na aba **Resultado**:

- **Carga** = energia total do círculo (custo de mana das runas).
- **Capacidade** = soma do máximo da faixa de cada forma que recebe energia do Prisma (Selo ○ 9,9 · Sal △ 9,5 · Rad ⬠ 9,9 · Red ☆ 15,1 · Salor 32,3 · Redor 44,4 …).
- **O Sal △ regulariza a energia e estabiliza o círculo.** O Selo ○ e o Col □ não seguram excesso de energia e podem estourar; o Sal △ (ou o Salor ○+△) segura o excesso.
- Até 70%: **estável** · 70–100%: **perto do limite** · acima de 100%: **explode** se não houver Sal △ · com Sal △, até 130% fica **sobrecarregado, mas estabilizado**, e acima disso explode. Abaixo do mínimo das formas, a magia **não ativa**.

O app explica o que aconteceria (por exemplo, a explosão aplicando o efeito da runa principal em volta do conjurador) e sugere o que fazer: qual forma adicionar, qual runa baixar de estado ou quando há folga para subir. *Essa regra é uma proposta, não está no caderno, e os limites podem ser ajustados.*

## 👤 Contas e Círculos Salvos

Pelo botão **👤 Entrar**, cada pessoa cria uma conta (e-mail e senha) e passa a ter o painel **Meus Círculos**: salvar o círculo atual, atualizar, abrir, duplicar e excluir, em qualquer aparelho. Só o dono vê os próprios círculos (Row Level Security no banco). Sem conta, o site continua funcionando normalmente e dá para salvar pelo menu **⬇ Exportar (JSON)**.

As contas ficam no Supabase, projeto `circulo-magico` (São Paulo). A estrutura está em [`database/contas_supabase.sql`](database/contas_supabase.sql). A chave usada no site é a chave pública (*publishable*), feita para ficar no navegador.

## 🗄️ Banco de Dados (SQL)

O arquivo [`database/runas.sql`](database/runas.sql) cria as tabelas `formas`, `estados`, `runas`, `niveis_carga` e `circulos` (para guardar círculos salvos), além da visão `v_runas_tabela`, no formato da tabela oficial. Funciona em **PostgreSQL / Supabase** e **SQLite**. Valores ainda não definidos ficam `NULL`.

## ✨ Funcionalidades Principais

### Editor Vetorial Interativo (Canvas SVG)

- Posicione, rotacione, redimensione e conecte formas estruturais simples e compostas dentro do anel do círculo mágico.
- Pontos de ancoragem circulares (`o`) gerados automaticamente na borda do componente de **origem** de cada cabo.
- Ligações em **Linha Reta** (Fluxo Direto) ou **Arco Curvo Externo/Interno** (Fluxo Orbital).
- **Magia dentro da magia:** um Selo ○ ou Col □ pode guardar várias runas (até 8); a forma só delimita a função colocada lá dentro. Com o Selo selecionado, ligue **Magia dentro do selo** em Peças e toque nas runas; no painel do Nó, cada runa de dentro tem ✕ para tirar. No desenho elas aparecem ligadas, como no caderno: a magia de dentro também tem fonte, então a primeira runa de dentro fica num pequeno **Prisma ◇** e as outras em pequenos círculos. Uma magia assim é de **2º Círculo** (o selo aparece no Resultado e no Livro de Magias).
- **Círculos dentro de círculos (2º Círculo):** botão **Novo círculo dentro** em Peças cria um anel menor dentro do círculo selecionado, com seu próprio Prisma; o tamanho de cada círculo se ajusta no painel do centro dele. O Prisma de um círculo pode ficar fora do centro (como o Prisma da lança, embaixo). Dois cabos entre as mesmas formas, um de ida e outro de volta, aparecem como **linha dupla**.
- **Cada círculo funciona sozinho; entre eles a energia passa por fora, de anel a anel.** Em Ligações & Anel → Nova Ligação, além das formas, dá para escolher **o anel de um círculo** (o círculo inteiro) como origem ou destino. O que está dentro de um círculo não mexe nos outros. Um círculo sem Prisma próprio funciona com a energia que chega pelo anel dele. Com o círculo em volta de tudo, uma forma pode ficar entre os círculos (ex.: o Prisma entre a lança e as bolas de fogo, na Lança de Fogo Plasmática). Exemplo: **Lança de Fogo Plasmática (só a lança)**.
- **Círculos separados ligados = 3º Círculo:** botão **Novo círculo ligado (separado)** em Peças; ligue uma forma da magia principal a uma forma do outro círculo. Um **círculo em volta de tudo** envolve todos (opção em Ligações & Anel; sem ele o resultado avisa). No centro de cada círculo dá para dar um **nome/função** e pôr o círculo **dentro de um quadrado** (efeito sustentado, não inerente). Se o círculo tem uma magia dentro de Selo, o Prisma dela é a fonte e o centro pode ser outra forma. Os níveis são um **check-list**: o Resultado mostra todos os alcançados (ex.: ✓ 2º · ✓ 3º). Exemplo: **Lança de Fogo Plasmática**.
- **Círculos sobrepostos = 2,5º Círculo** (acima do 2º, abaixo do 3º). Para sobrepor certinho são **duas Estrelas uma em cima da outra, uma para cada círculo**: a Estrela posta na sobreposição já entra dupla (desenhada como estrela de 10 pontas), e no painel da forma há a opção **Estrela dupla**. Com uma Estrela só, o resultado avisa **⚠ Falta a 2ª Estrela**.
- **Toda forma tem fonte:** se há um Col □ ou Selo ○, ele sempre recebe energia de um Prisma, nem que o cabo só vá e volte (Prisma ➔ forma ➔ Prisma). Sem isso o resultado mostra **✕ Forma sem Fonte**.
- **Runas estruturais (Propriedade): Projétil, Toque, Ser e Estado** — têm cor própria (🔴) e filtro na lista de runas.
- **Toque:** a magia, ou a parte anterior a ele, interage direto com a superfície mais próxima (quase como se tocasse). Mostra a utilidade com runas sem forma física, como a **Vida** — a Leitura do Círculo mostra o que toca a superfície e avisa quando o Toque está sendo útil.
- **Ser:** as runas anteriores a ele viram um conjunto; separa objetos ou elementos para que sejam, ou não, afetados por outra runa. Ex.: sem Ser, 3 objetos diferentes orbitam juntos com a **Órbita** — a Leitura do Círculo lista cada conjunto e o que a Órbita leva.
- **Estado:** mantém o estado da(s) runa(s) anterior(es), **ou usadas ao mesmo tempo** (formas que recebem do mesmo ponto em paralelo), o mais perto de estável ou funcional (ex.: o Fogo não é apagado pelo vento nem pela umidade). O recomendado é usá-lo **logo depois de um conjunto de objetos (formatos) ou de elementos** — a Leitura do Círculo mostra o que cada Estado mantém e avisa quando ele vem em outro lugar.
- **Projétil:** une os diferentes formatos num único objeto aerodinâmico; com um contexto, tenta recriar esse conteúdo com os formatos disponíveis. O recomendado é usá-lo como **último passo do ciclo** ou **logo depois dos formatos** — a Leitura do Círculo avisa quando ele está em outro lugar.
- **Runas de Direção:** **Direção** — Dá a direção da magia: para onde ela vai. **D.N. Lateral** — A magia não sofre com forças externas que a empurrariam para os lados. **D.N. Vertical** — A magia não sofre com forças externas que a empurrariam para cima ou para baixo. **Direção Contrária** — A magia volta para quem a lançou.
- Cada tipo de símbolo interno tem uma cor: 🟠 **Elementais**, 🔵 **Formas**, 🔴 **Estruturais**, 🟢 **Ação / Alvo** e 🟣 **Direção** (no círculo, na lista de runas e nas imagens exportadas).
- Três temas no botão ◐ (um toque passa para o próximo; a escolha fica lembrada): **Pergaminho** (papel envelhecido e tinta sépia), **Grimório** (modo escuro arcano) e **Caderno** (folha pautada com margem vermelha, como o caderno de rascunho).
- Desenhos enfeitados: o anel rúnico traz uma faixa de runas entre os dois traços, os anéis têm losangos dourados e as formas ganham um contorno interno e pontos nos cantos, como gravados à mão. No Pergaminho, o PNG/SVG exportado leva o papel junto.
- **Traço feito à mão** (padrão), mas caprichado: linhas quase retas com uma curvinha mínima, cantos que se cruzam só um pouquinho, círculos que fecham quase no ponto e uma segunda passada fina de pena colada na primeira; as runas do anel parecem escritas à mão com cuidado. O traço é sempre o mesmo para cada peça (não treme ao arrastar). Na aba **Ligações & Anel → Aparência do Círculo → Traço** dá para trocar para **Limpo**; a escolha fica lembrada no aparelho.

### Ferramentas de desenho

- **Barra rápida** ao lado do desenho (no celular em pé, na linha da Carga): ↶ **Desfazer** e ↷ **Refazer** (também **Ctrl+Z** e **Ctrl+Y**), **Ímã**, **Ver traçado** e zoom.
- **Puxar cabo:** no modo Reta ou Arco, arraste de uma forma até outra e solte (tocar numa e depois na outra continua funcionando). No modo Mover, segure **Alt** e arraste.
- **Curvar pela seta:** arraste a seta do meio de um cabo para fora (arco por fora), para dentro (arco por dentro) ou de volta à linha (reto). Um toque na seta ainda inverte o cabo.
- **Ímã:** ao arrastar, a forma gruda em ângulos de 15° em volta do centro do círculo e na mesma distância do centro que outras formas, para sair simétrico. Começa desligado; a escolha fica lembrada.
- **Zoom:** roda do mouse ou botões + e − no computador, **pinça com dois dedos** no celular; com zoom, arraste o fundo para andar pelo desenho. O botão de porcentagem volta a 100%.
- **Evoluir Forma** (painel do Nó): troca a forma simples pela composta e de volta, sem perder runa nem cabos (Selo/Sal ↔ Salor, Rad/Estrela ↔ Redor, Col/Prisma ↔ Corp).
- **Ver traçado:** desenha o círculo traço por traço — primeiro os Prismas, depois os cabos, as formas e por fim os anéis.
- A **Estrela** posta onde dois círculos se sobrepõem vai direto para o meio da sobreposição (a "lente"), mesmo com círculos de tamanhos diferentes.

### Exportar e reaproveitar

- **Imagem PNG** ou **Vetor SVG**, com duas opções que ficam lembradas: **Fundo transparente** (só os traços, para pôr por cima de outra arte) e **Limpa** (sem as setas do meio dos cabos e sem a grade de guia).
- **Molde sem runas:** baixa o desenho (formas, cabos, círculos e anel) sem nenhuma runa, para montar outra magia com a mesma geometria. Abre pelo **Abrir arquivo**.
- **Duplicar** (⧉ em Meus Círculos): cria uma cópia de um círculo salvo — "Nome (cópia)", "Nome (cópia 2)"… — para testar variações sem mexer no original.

### Menus

- **Peças**: formas para adicionar e a lista de runas, com busca e filtros por tipo (cada pílula mostra a cor e quantas runas há). Um aviso mostra para qual forma vai a runa tocada, com o botão **Tirar runa**.
- **Ligações & Anel**: aparência do círculo (anel único, duplo ou rúnico em cartões com desenho; traço feito à mão ou limpo; espessura; guias), **Nova Ligação** (De → Para com botão ⇅ para trocar, tipo de linha e especialização) e a lista de ligações com a runa de cada ponta, ⇄ para inverter e ✕ para remover.
- **Nó** (forma selecionada): forma, a runa atual com **Trocar**, estado (**Mínimo / Perfeito / Extremo**, com uma frase explicando cada um), tamanho e rotação. **Cargas extras** só aparecem na Estrela e no Rad, onde contam.
- **Resultado**: combinação e matéria em botões com explicação, os números, a carga e a **Leitura do Círculo** em partes que abrem e fecham (as 3 primeiras abertas; o que você abrir ou fechar fica assim).
- **Exportar** separado em *Imagem do círculo* e *Projeto*; **Grimório** com o menu **Ir para…**; **Minha Conta** sobe de baixo no celular.
- Opções curtas viraram botões e os controles deslizantes seguem a cor do tema, sem textos cortados no celular.

### 9 Formas Estruturais (6 Simples + 3 Compostas Sobrepostas com Multiplicadores)

| Forma | Símbolo | Função | Valor base | Faixa |
|---|---|---|---|---|
| **Core** | ◇ Prisma / Losango | Fonte: núcleo essencial no centro. Pode ter uma runa elemental matriz ou ficar neutro, irradiando mana aos nós. | 0,6 | 0,3 ~ 1,1 |
| **Col** | □ Quadrado | Manter (só pega): recebe a energia e sustenta o efeito ou a condição ativa continuamente. Nunca solta: não tem cabo de saída. | 0,6 | 0,4 ~ 1,3 |
| **Corp** | ◇+□ Composto Sobreposto | Restrição (Entrada e bloqueio + Saída e liberação) | 2,4 | 0,6 ~ 5,2 |
| **Selo** | ○ Círculo | Liberar (pega e solta): recebe o fluxo de energia e realiza a saída / liberação da runa. | 1,3 | 0,5 ~ 9,9 |
| **Sal** | △ Triângulo | Equilíbrio (regulariza a energia): estabiliza o circuito e neutraliza o risco de colapso quando há runas no Extremo (Instável). | 3,1 | 1,1 ~ 9,5 |
| **Salor** | ○+△ Composto Inscrito | Sobrecarga (Estabilizador/Medidor + Fortificador/Triplicador) | 15,5 | 5,2 ~ 32,3 |
| **Rad** | ⬠ Pentágono | Comparador e Capacitor: compara condições (lógica) e armazena mana. | 5,0 | 3,3 ~ 9,9 |
| **Red** | ☆ Estrela (5 pontas) | Sobrepositor e Carregador: sobrepõe efeitos simultâneos (ex.: Brisa + Ventania + Tempestade = Tornado), multiplica cargas de Poder e une círculos sobrepostos. | 10,0 | 5,5 ~ 15,1 |
| **Redor** | ⬠+☆ Composto Inscrito | Absorvedor (Comparador/Capacitor + Sobrepositor/Carregador) | 33,3 | 22,2 ~ 44,4 |

### Tríade de Aplicação & Intenção

Reconhecimento automático das sinergias espaciais governadas pela Intenção central:

- **Projétil + Ser** ➔ Órbita
- **Projétil + Toque** ➔ Área
- **Ser + Toque** ➔ Ligação

### Tabelas Completas de Energia (Mínimo / Perfeito / Extremo), Poder e Efeitos

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

O site é feito em **TypeScript** com **Vite**. Precisa do [Node.js](https://nodejs.org/) 20 ou mais novo.

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
| `src/core/` | **Regras**, sem nada de tela: `flow.ts` (Prisma, ciclo e rotas), `load.ts` (carga, Sal △ e explosão), `analysis.ts` (cálculo completo e leitura do círculo), `circles.ts` (círculos sobrepostos e Estrela), `geometry.ts`, `project.ts` (abrir arquivos com segurança) e `types.ts`. |
| `src/ui/` | **Tela**: desenho (`canvas.ts`), enfeites dos anéis (`ornaments.ts`) e das formas (`shapes-svg.ts`), traço à mão (`sketch.ts`), arrastar e tocar (`interaction.ts`), ações do editor (`editor.ts`), painéis, resultado, exportar, Grimório (`grimoire-content.html`) e layout. |
| `src/cloud/` | Contas e "Meus Círculos" (Supabase). |
| `src/styles/` | Estilos separados por parte (cores dos temas e da mana em `tokens.css`, tamanhos de tela em `responsive.css`). |
| `tests/` | Testes automáticos das regras e de todos os exemplos e magias. |
| `database/` | Banco de dados (SQL). |

**Exemplos de mudanças comuns:**
- Nova magia no Livro: adicione em `src/data/spells.ts` (os testes conferem se ela é estável e se nenhuma forma encosta na outra).
- Mudar valores de uma runa: `src/data/runes.ts`.
- Mudar uma regra (ex.: quanto o Sal △ segura): `src/core/load.ts`.
- Mudar um texto do Grimório: `src/ui/grimoire-content.html`.

## 🚀 Publicação

A cada atualização na branch `main`, o **GitHub Actions** confere os tipos, roda os testes, compila e publica o site sozinho em `https://pietropasqual.github.io/c-rculo-magico/`.

Configuração (uma vez só): em **Settings ➔ Pages ➔ Build and deployment ➔ Source**, escolha **GitHub Actions**.
