# ❂ Criador de Círculos Mágicos — Sistema de Runas RPG

Aplicação web interativa (`index.html` autocontido com HTML5, CSS3 e JavaScript/SVG vetorial) desenvolvida para criar, simular e exportar Círculos Mágicos do sistema de RPG.

## ⟳ Regras Fundamentais do Fluxo de Energia

- **Toda magia inicia no Prisma (◇ Core) e finaliza nele.** O circuito só é válido quando a energia sai do Prisma, percorre os componentes e encontra um caminho de volta ao Prisma.
- **Os cabos são cabos de energia com direção.** O pequeno círculo `○` marca o componente **de onde a energia sai**; a outra ponta do cabo (sem `○`) indica **para onde ela vai**.
- Componentes que recebem energia mas não a devolvem ao Prisma ficam com a **energia presa** — exceto **Col** (□) e **Corp** (◇+□), que por função **retêm** a energia (entrada e bloqueio).

- **O formato é livre.** A disposição dos componentes pode ser qualquer uma para formar a magia desejada — o que define a magia são as runas e o caminho da energia. Exemplos incluídos: **Bola de Fogo** (Exemplo 1) e o mais complexo **Lança-Chamas** (Exemplo 2).

O painel de diagnóstico verifica essas regras automaticamente: indica se a magia não inicia no Prisma, se o fluxo está aberto (não volta ao Prisma), e quais nós estão sem energia ou com energia presa. Na lista de conexões, o botão **⇄** inverte a direção de um cabo.

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

| Elemento | Energia | Poder | Efeito |
|---|---|---|---|
| **Fogo (Ig)** | 4 ~ 7 ~ 12 (4,2 ~ 7,5 ~ 12,1) | 5 ~ 14 ~ 21 | **Queimação:** reduz 1 + 0,1% da vida atual/durabilidade. |
| **Vento (Vs)** | 3 ~ 4 ~ 9 (3,5 ~ 4,5 ~ 9,0) | 3 ~ 8 ~ 14 | **Corte Mágico:** causa +1d12 de dano mágico adicional. |
| **Terra (Tr)** | 5 ~ 14 ~ 20 (5,8 ~ 14,3 ~ 21,7) | 5 ~ 22 ~ 28 | **Lentidão:** reduz velocidade geral em 0,2 (até 5:1). |
| **Água (Gu)** | 4 ~ 8 ~ 16 | 2 ~ 10 ~ 13 | **Inibição / Diluição:** interage contra elemento base (exceto variações e evoluções). |
| **Raio** | 24 ~ 52 ~ 57 | 14 ~ 64 ~ 75 | **Paralisia:** diminui os movimentos em -1d8. |
| **Som** | 12 ~ 24 ~ 36 | 8 ~ 48 ~ 76 | **Atordoamento:** diminui pensamento em -2 e comunicação em -1d4. |
| **Gelo** | 10 ~ 30 ~ 40 | 10 ~ 45 ~ 60 | **Congelamento:** diminui o movimento e energéticos em -1d4. |
| **Metal** | 33 ~ 82 ~ 132 | 22 ~ 123 ~ 132 | **Supressão Energética:** dispersa energias externas em até 6/10 de poder 5 (índice 1,75). |
| **Ilusão** | 32 ~ 48 ~ 66 | 10 ~ 34 ~ 40 | **Falsa Ação:** congela ou esconde 1 ação. |
| **Pressão** | 20 ~ 56 ~ 80 | 10 ~ 40 ~ 50 | **Diminuição:** diminui em -2 todos os modificadores (mods). |
| **Movimento** | 6 ~ 13 ~ 24 | 4 ~ 13 ~ 20 | **Velocidade:** aumenta ou diminui a velocidade em 1 m/s. |
| **Caos** | 12 ~ 26 ~ 36 | 6 ~ 20 ~ 24 | **Mistura:** mistura 1 atributo ao caos. |
| **Vida** | Escala 2x ~ 3,2x ~ 5x por Poder | — | **Preservação:** mantém 0,01% (até 50,0% do poder) do indivíduo no mesmo estado; em 50% o ser não pode ser alterado. |
| **Morte** | Escala 2x ~ 3,2x ~ 5x por Poder | — | **Regressão:** volta o ser para um estado anterior 0,01% (até 50,0%); em 50% contradições do indivíduo são negadas. |
| **Natureza** | — | — | **Crescimento:** acelera o crescimento natural em 5%; acima de 100% o crescimento pode gerar mutação. |
| **Ácido** | — | — | **Separação & Pureza:** separa componentes próximos em 2 e aumenta o grau de pureza da matéria. |

## 🚀 Como Usar / Publicar

- **Localmente:** basta abrir o `index.html` em qualquer navegador moderno — não há dependências externas nem etapa de build.
- **GitHub Pages:** em **Settings ➔ Pages**, selecione a branch `main` e a pasta `/ (root)`. O site ficará disponível em `https://pietropasqual.github.io/c-rculo-magico/`.
