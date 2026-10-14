# ❂ Criador de Círculos Mágicos — Sistema de Runas RPG

Aplicação web interativa (`index.html` autocontido com HTML5, CSS3 e JavaScript/SVG vetorial) desenvolvida para criar, simular e exportar Círculos Mágicos do sistema de RPG.

## ⟳ Regras Fundamentais do Fluxo de Energia

- **Toda magia inicia no Prisma (◇ Core) e finaliza nele.** O circuito só é válido quando a energia sai do Prisma, percorre os componentes e encontra um caminho de volta ao Prisma.
- **O Prisma é essencial e nunca some.** É ele que faz a magia funcionar: sem o Prisma em um ciclo fechado, nada funciona (nenhuma runa recebe energia). O Prisma só pode ser ◇ Core ou ◇+□ Corp.
- **Os cabos são cabos de energia com direção.** O pequeno círculo `○` marca o componente **de onde a energia sai**; a outra ponta do cabo (sem `○`) indica **para onde ela vai**.
- Componentes que recebem energia mas não a devolvem ao Prisma ficam com a **energia presa** — exceto **Col** (□) e **Corp** (◇+□), que por função **retêm** a energia (entrada e bloqueio).

- **Círculos sobrepostos:** dois círculos mágicos podem se sobrepor. A **Estrela ☆ (Sobrepositor)** colocada na área de sobreposição junta os dois — ela só une, não substitui o Prisma. Cada círculo começa e termina no seu próprio Prisma, e os cabos só passam de um círculo para o outro através da Estrela. Use **◎ Novo círculo sobreposto** e arraste o Prisma de um círculo para movê-lo. Exemplo pronto: **Círculos Unidos pela Estrela**.
- **O formato é livre.** A disposição dos componentes pode ser qualquer uma para formar a magia desejada — o que define a magia são as runas e o caminho da energia. Exemplos incluídos: **Bola de Fogo** (Exemplo 1) e o mais complexo **Lança-Chamas** (Exemplo 2).

O painel de diagnóstico verifica essas regras automaticamente: indica se a magia não inicia no Prisma, se o fluxo está aberto (não volta ao Prisma), e quais nós estão sem energia ou com energia presa. Na lista de conexões, o botão **⇄** inverte a direção de um cabo.

## 📜 Livro de Magias

Magias de exemplo montadas com as regras do sistema, todas estáveis (carga abaixo de 70%). Abra pelo menu **★ Exemplos** ou pelo Grimório:

| Magia | Runas | Ideia |
|---|---|---|
| **Muralha de Terra** | Terra (Perfeito), Paralelepípedo, D.N. Vertical, Estado | Muralha vertical mantida pelo Col □; Lentidão e Petrificação |
| **Lâmina de Vento** | Vento (Perfeito), Pirâmide, Projétil, Direção | Lâmina de vento lançada; Corte Mágico +1d12 |
| **Descarga em Área** | Raio, Projétil (num Salor), Área, Direção (num Sal △) | Projétil que estoura em área; Paralisia −1d8 |
| **Cubo de Gelo** | Gelo, Cubo, Ser, Estado | Prende um ser num cubo de gelo; Congelamento −1d4 |
| **Grito Atordoante** | Som, Área, Esfera (num Sal △), Ser | Onda sonora em volta; Atordoamento |
| **Passo Veloz** | Movimento, Ser, Toque, Estado | +1 m/s de velocidade ao tocar um ser |
| **Falsa Ação** | Ilusão, Intenção (num Salor), Ser, Toque | Congela ou esconde 1 ação do alvo tocado |
| **Meteoro Flamejante** | Terra + Fogo (dois círculos unidos pela Estrela), Esfera, Projétil, Direção | Rocha em chamas lançada |
| **Tempestade Elétrica** | Vento + Raio (dois círculos unidos pela Estrela), Área, Projétil | Corte Mágico e Paralisia em área |

## ⚡ Carga, Sobrecarga e Explosão

Enquanto você monta o círculo, o app calcula se ele aguenta a energia e mostra o resultado no selo **Carga** (no canto do círculo) e na aba **Resultado**:

- **Carga** = energia total do círculo (custo de mana das runas).
- **Capacidade** = soma do máximo da faixa de cada forma que recebe energia do Prisma (Selo ○ 9,9 · Sal △ 9,5 · Rad ⬠ 9,9 · Red ☆ 15,1 · Salor 32,3 · Redor 44,4 …).
- **O Sal △ estabiliza o círculo.** O Selo ○ e o Col □ não seguram excesso de energia e podem estourar; o Sal △ (ou o Salor ○+△) segura o excesso.
- Até 70%: **estável** · 70–100%: **perto do limite** · acima de 100%: **explode** se não houver Sal △ · com Sal △, até 130% fica **sobrecarregado, mas estabilizado**, e acima disso explode. Abaixo do mínimo das formas, a magia **não ativa**.

O app explica o que aconteceria (por exemplo, a explosão aplicando o efeito da runa principal em volta do conjurador) e sugere o que fazer: qual forma adicionar, qual runa baixar de estado ou quando há folga para subir. *Essa regra é uma proposta, não está no caderno, e os limites podem ser ajustados.*

## 🗄️ Banco de Dados (SQL)

O arquivo [`database/runas.sql`](database/runas.sql) cria as tabelas `formas`, `estados`, `runas`, `niveis_carga` e `circulos` (para guardar círculos salvos), além da visão `v_runas_tabela`, no formato da tabela oficial. Funciona em **PostgreSQL / Supabase** e **SQLite**. Valores ainda não definidos ficam `NULL`.

## ✨ Funcionalidades Principais

### Editor Vetorial Interativo (Canvas SVG)

- Posicione, rotacione, redimensione e conecte formas estruturais simples e compostas dentro do anel do círculo mágico.
- Pontos de ancoragem circulares (`o`) gerados automaticamente na borda do componente de **origem** de cada cabo.
- Ligações em **Linha Reta** (Fluxo Direto) ou **Arco Curvo Externo/Interno** (Fluxo Orbital).
- Alternância visual imediata entre **Tema Caderno** (Traço Original Claro) e **Tema Grimório** (Modo Escuro Arcano).

### 9 Formas Estruturais (6 Simples + 3 Compostas Sobrepostas com Multiplicadores)

| Forma | Símbolo | Função | Valor base | Faixa |
|---|---|---|---|---|
| **Core** | ◇ Prisma / Losango | Essencial no centro. Saída e liberação / Fonte | 0,6 | 0,3 ~ 1,1 |
| **Col** | □ Quadrado | Entrada e bloqueio / Manter após receber | 0,6 | 0,4 ~ 1,3 |
| **Corp** | ◇+□ Composto Sobreposto | Restrição (Entrada e bloqueio + Saída e liberação) | 2,4 | 0,6 ~ 5,2 |
| **Selo** | ○ Círculo | Estabilizador e medidor / Receber e sair | 1,3 | 0,5 ~ 9,9 |
| **Sal** | △ Triângulo | Fortificador e triplicador / Equilíbrio | 3,1 | 1,1 ~ 9,5 |
| **Salor** | ○+△ Composto Inscrito | Sobrecarga (Estabilizador/Medidor + Fortificador/Triplicador) | 15,5 | 5,2 ~ 32,3 |
| **Rad** | ⬠ Pentágono | Comparador e capacitor | 5,0 | 3,3 ~ 9,9 |
| **Red** | ☆ Estrela (5 pontas) | Sobrepositor e carregador | 10,0 | 5,5 ~ 15,1 |
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

## 🚀 Como Usar / Publicar

- **Localmente:** basta abrir o `index.html` em qualquer navegador moderno — não há dependências externas nem etapa de build.
- **GitHub Pages:** em **Settings ➔ Pages**, selecione a branch `main` e a pasta `/ (root)`. O site ficará disponível em `https://pietropasqual.github.io/c-rculo-magico/`.
