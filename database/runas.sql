-- =============================================================================
-- Círculos Mágicos — Sistema de Runas RPG
-- Banco de dados com as formas, runas, estados e a regra de carga/sobrecarga.
--
-- Compatível com PostgreSQL (inclusive Supabase) e SQLite.
-- Valores NULL = ainda não definidos na tabela oficial (o app usa valores
-- provisórios nesses casos e mostra um aviso).
-- =============================================================================

DROP VIEW IF EXISTS v_runas_tabela;
DROP TABLE IF EXISTS circulos;
DROP TABLE IF EXISTS niveis_carga;
DROP TABLE IF EXISTS runas;
DROP TABLE IF EXISTS estados;
DROP TABLE IF EXISTS formas;

-- -----------------------------------------------------------------------------
-- Formas estruturais (os nós do círculo)
-- faixa_min / faixa_max: faixa operacional. Na regra de carga, faixa_max é o
-- quanto de energia a forma aguenta e faixa_min o quanto ela precisa para ativar.
-- -----------------------------------------------------------------------------
CREATE TABLE formas (
  id          TEXT PRIMARY KEY,      -- chave usada pelo app
  sigla       TEXT NOT NULL,
  simbolo     TEXT NOT NULL,
  geometria   TEXT NOT NULL,
  funcao      TEXT NOT NULL,
  valor_base  NUMERIC NOT NULL,
  faixa_min   NUMERIC NOT NULL,
  faixa_max   NUMERIC NOT NULL,
  composta_de TEXT                   -- formas simples que formam a composta
);

INSERT INTO formas (id, sigla, simbolo, geometria, funcao, valor_base, faixa_min, faixa_max, composta_de) VALUES
  ('prism',    'Core',  '◇',   'Prisma / Losango',      'Fonte: núcleo essencial no centro. Pode ter uma runa elemental matriz ou ficar neutro, irradiando mana aos nós.',                     0.6,  0.3,  1.1, NULL),
  ('square',   'Col',   '□',   'Quadrado',              'Manter (só pega): recebe a energia e sustenta o efeito ou a condição ativa continuamente. Nunca solta: não tem cabo de saída. Não segura excesso: pode estourar.',                                       0.6,  0.4,  1.3, NULL),
  ('circle',   'Selo',  '○',   'Círculo',               'Liberar (pega e solta): recebe o fluxo de energia e realiza a saída / liberação da runa. Não segura excesso: pode estourar.',                                 1.3,  0.5,  9.9, NULL),
  ('triangle', 'Sal',   '△',   'Triângulo',             'Equilíbrio (regulariza a energia): estabiliza o circuito e neutraliza o risco de colapso quando há runas no Extremo (Instável).',                           3.1,  1.1,  9.5, NULL),
  ('hexagon',  'Rad',   '⬠',   'Pentágono',             'Comparador e Capacitor: compara condições (lógica) e armazena mana.',                                           5.0,  3.3,  9.9, NULL),
  ('star',     'Red',   '☆',   'Estrela de 5 pontas',   'Sobrepositor e Carregador: sobrepõe efeitos simultâneos (ex.: Brisa + Ventania + Tempestade = Tornado), multiplica cargas de Poder e une círculos sobrepostos.',                                       10.0,  5.5, 15.1, NULL),
  ('corp',     'Corp',  '◇+□', 'Composto sobreposto',   'Restrição (entrada e bloqueio + saída e liberação).',               2.4,  0.6,  5.2, 'prism+square'),
  ('salor',    'Salor', '○+△', 'Composto inscrito',     'Sobrecarga (estabilizador/medidor + fortificador/triplicador).',   15.5,  5.2, 32.3, 'circle+triangle'),
  ('redor',    'Redor', '⬠+☆', 'Composto inscrito',     'Absorvedor (comparador/capacitor + sobrepositor/carregador).',     33.3, 22.2, 44.4, 'hexagon+star');

-- -----------------------------------------------------------------------------
-- Estados de ativação de uma runa
-- -----------------------------------------------------------------------------
CREATE TABLE estados (
  id    TEXT PRIMARY KEY,
  nome  TEXT NOT NULL,
  ordem INTEGER NOT NULL
);

INSERT INTO estados (id, nome, ordem) VALUES
  ('ativacao', 'Mínimo / Ativação', 1),
  ('perfeito', 'Perfeito',          2),
  ('instavel', 'Extremo / Instável', 3);

-- -----------------------------------------------------------------------------
-- Runas
-- categoria: elemental | forma | acao
-- energia_* = custo de mana; poder_* = poder. (_min, _perf, _ext = estados)
-- energia_obs: quando a energia não é um número fixo (escala ou variável)
-- penalidade_materia: aumento de custo quando falta matéria (0.3333 = +1/3)
-- fator_auxiliares: quanto do poder das runas auxiliares soma (0.5 = 50%)
-- provisoria: TRUE quando a runa ainda não tem valores na tabela oficial
-- -----------------------------------------------------------------------------
CREATE TABLE runas (
  id                 TEXT PRIMARY KEY,
  nome               TEXT NOT NULL,
  sigilo             TEXT,
  categoria          TEXT NOT NULL CHECK (categoria IN ('elemental', 'forma', 'estrutural', 'acao')),
  energia_min        NUMERIC,
  energia_perf       NUMERIC,
  energia_ext        NUMERIC,
  energia_obs        TEXT,
  poder_min          NUMERIC,
  poder_perf         NUMERIC,
  poder_ext          NUMERIC,
  poder_obs          TEXT,
  efeito_1           TEXT,           -- efeito principal / 1º estágio
  efeito_2           TEXT,           -- aplicação perfeita / 2º estágio
  penalidade_materia NUMERIC,
  fator_auxiliares   NUMERIC,
  provisoria         BOOLEAN NOT NULL DEFAULT FALSE
);

-- Tabela oficial: runas elementais com valores fixos
INSERT INTO runas (id, nome, sigilo, categoria, energia_min, energia_perf, energia_ext, energia_obs, poder_min, poder_perf, poder_ext, poder_obs, efeito_1, efeito_2, penalidade_materia, fator_auxiliares, provisoria) VALUES
  ('fogo',  'Fogo (Ig)',  'Uhz', 'elemental',  4.2,  7.5, 12.1, NULL,  5,  14,  21, NULL, 'Queimação: reduz 1 + 0,1% da vida atual / durabilidade', 'Incineração: por 3s reduz 1 + 0,01% da vida/durabilidade máxima por segundo', 0.3333, 0.5, FALSE),
  ('vento', 'Vento (Vs)', 'Vs',  'elemental',  3.5,  4.5,  9.0, NULL,  3,   8,  14, NULL, 'Corte Mágico: causa +1d12 de dano mágico adicional', 'Tornado: combina Brisa, Ventania e Tempestade', 0.2, NULL, FALSE),
  ('terra', 'Terra (Tr)', 'Já',  'elemental',  5.8, 14.3, 21.7, NULL,  5,  22,  28, NULL, 'Lentidão: reduz a velocidade geral em 0,2 (até 5:1)', 'Petrificação: transforma 0,05% do alvo em pedra por 3s', 0.3333, 0.0, FALSE),
  ('agua',  'Água (Gu)',  'Ze',  'elemental',  4,    8,   16,   NULL,  2,  10,  13, NULL, 'Inibição: interage contra elemento base (exceto variações/evoluções)', 'Extração: cria substância líquida com 5% da propriedade afetada pela Diluição', 0.5, 0.5, FALSE),
  ('raio',  'Raio',       'Ra',  'elemental', 24,   52,   57,   NULL, 14,  64,  75, NULL, 'Paralisia: diminui os movimentos em -1d8', NULL, NULL, NULL, FALSE),
  ('som',   'Som',        'So',  'elemental', 12,   24,   36,   NULL,  8,  48,  76, NULL, 'Atordoamento: diminui pensamento em -2 e comunicação em -1d4', NULL, NULL, NULL, FALSE),
  ('gelo',  'Gelo',       'Ge',  'elemental', 10,   30,   40,   NULL, 10,  45,  60, NULL, 'Congelamento: diminui o movimento e processos energéticos em -1d4', NULL, NULL, NULL, FALSE),
  ('metal', 'Metal',      'Me',  'elemental', 33,   82,  132,   NULL, 22, 123, 132, NULL, 'Supressão Energética: dispersa energias externas em até 6/10 de poder 5 (1,75)', NULL, NULL, NULL, FALSE);

-- Tabela oficial: runas com efeito de 1º e 2º estágio
INSERT INTO runas (id, nome, sigilo, categoria, energia_min, energia_perf, energia_ext, energia_obs, poder_min, poder_perf, poder_ext, poder_obs, efeito_1, efeito_2, penalidade_materia, fator_auxiliares, provisoria) VALUES
  ('ilusao',    'Ilusão',    'Il', 'elemental', 32, 48, 66, NULL, 16, 34, 40, NULL, 'Falsa Ação: congela ou esconde 1 ação', 'Ocultação completa de ação no turno', NULL, NULL, FALSE),
  ('pressao',   'Pressão',   'Pr', 'elemental', 20, 56, 80, NULL, 10, 40, 50, NULL, 'Diminuição: diminui em -2 todos os mods', 'Supressão gravitacional/barométrica de modificadores', NULL, NULL, FALSE),
  ('movimento', 'Movimento', 'Mv', 'elemental',  6, 13, 24, NULL,  4, 13, 20, NULL, 'Velocidade: aumenta ou diminui a velocidade em 1 m/s', 'Controle vetorial cinético por estágio', NULL, NULL, FALSE),
  ('caos',      'Caos',      'Ca', 'elemental', 12, 26, 36, NULL,  6, 20, 24, NULL, 'Mistura: mistura 1 atributo ao caos', 'Embaralhamento caótico de atributos', NULL, NULL, FALSE),
  ('vida',      'Vida',      'Vi', 'elemental', NULL, NULL, NULL, 'Escala 2x ~ 3,2x ~ 5x por Poder', NULL, NULL, NULL, '—', 'Mantém 0,01% (até 50,0% do poder) do indivíduo no mesmo estado', 'Em 50%: o ser não pode ser alterado', NULL, NULL, FALSE),
  ('morte',     'Morte',     'Mo', 'elemental', NULL, NULL, NULL, 'Escala 2x ~ 3,2x ~ 5x por Poder', NULL, NULL, NULL, '—', 'Volta o ser para um estado anterior 0,01% (até 50,0%)', 'Em 50%: condições do indivíduo são negadas', NULL, NULL, FALSE),
  ('natureza',  'Natureza',  'Na', 'elemental', NULL, NULL, NULL, 'Variável', NULL, NULL, NULL, 'Variável', 'Acelera o crescimento natural em 5%', 'Acima de 100%: o crescimento pode gerar mutação', NULL, NULL, FALSE),
  ('acido',     'Ácido',     'Ac', 'elemental', NULL, NULL, NULL, 'Variável', NULL, NULL, NULL, 'Variável', 'Separa componentes próximos em 2', 'Aumenta o grau de pureza da matéria', NULL, NULL, FALSE);

-- Runas desenhadas mas ainda sem valores na tabela oficial
INSERT INTO runas (id, nome, sigilo, categoria, provisoria) VALUES
  ('luz',       'Luz',       'Lu', 'elemental', TRUE),
  ('sombra',    'Sombra',    'Sb', 'elemental', TRUE),
  ('materia',   'Matéria',   'Mt', 'elemental', TRUE),
  ('gravidade', 'Gravidade', 'Gr', 'elemental', TRUE),
  ('tempo',     'Tempo',     'Tp', 'elemental', TRUE),
  ('espaco',    'Espaço',    'Es', 'elemental', TRUE),
  ('infinito',  'Infinito',  'In', 'elemental', TRUE),
  ('vazio',     'Vazio',     'Vz', 'elemental', TRUE);

-- Runas de forma (moldam a manifestação), estruturais (Propriedade) e de ação/direção
INSERT INTO runas (id, nome, sigilo, categoria, efeito_1) VALUES
  ('forma_esfera',         'Esfera / Círculo',         'Forma',         'forma', 'Molda a manifestação em Esfera (3D) ou Círculo (2D).'),
  ('forma_cubo',           'Cubo / Quadrado',          'Forma',         'forma', 'Molda a manifestação em Cubo (3D) ou Quadrado (2D).'),
  ('forma_paralelepipedo', 'Paralelepípedo / Retâng.', 'Forma',         'forma', 'Molda a manifestação em Paralelepípedo ou Retângulo.'),
  ('forma_piramide',       'Pirâmide / Triângulo',     'Forma',         'forma', 'Molda a manifestação em Pirâmide, Cone ou Triângulo.'),
  ('mod_projetil',         'Projétil',                 'Propriedade',   'estrutural', 'Une os diferentes formatos num único objeto aerodinâmico; com um contexto, tenta recriá-lo com os formatos disponíveis.'),
  ('mod_toque',            'Toque',                    'Propriedade',   'estrutural', 'A magia, ou a parte anterior a ela, interage direto com a superfície mais próxima (útil com runas sem forma física, como a Vida).'),
  ('mod_ser',              'Ser',                      'Propriedade',   'estrutural', 'As runas anteriores viram um conjunto: separa objetos ou elementos para que sejam, ou não, afetados por outra runa (ex.: Órbita).'),
  ('mod_estado',           'Estado',                   'Propriedade',   'estrutural', 'Mantém o estado das runas anteriores, ou usadas ao mesmo tempo, o mais perto de estável ou funcional.'),
  ('mod_ligacao',          'Ligação',                  'Vínculo',       'acao',  'Ser + Toque: elo contínuo entre dois pontos ou alvos.'),
  ('mod_orbita',           'Órbita',                   'Trajetória',    'acao',  'Projétil + Ser: a magia orbita ao redor de um ser ou ponto.'),
  ('mod_area',             'Área',                     'Alcance',       'acao',  'Projétil + Toque: o efeito se espalha numa área.'),
  ('mod_intencao',         'Intenção',                 'Gatilho',       'acao',  'Governa Projétil, Ser e Toque no centro da tríade.'),
  ('dir_padrao',           'Direção',                  'Vetor',         'acao',  'Dá a direção da magia: para onde ela vai.'),
  ('dir_lateral',          'D. N. Lateral',            'Vetor',         'acao',  'A magia não sofre com forças externas que a empurrariam para os lados.'),
  ('dir_vertical',         'D. N. Vertical',           'Vetor',         'acao',  'A magia não sofre com forças externas que a empurrariam para cima ou para baixo.'),
  ('dir_contraria',        'Direção Contrária',        'Vetor Inverso', 'acao',  'A magia volta para quem a lançou.');

-- -----------------------------------------------------------------------------
-- Regra de carga e sobrecarga (proposta usada pelo app)
-- carga = energia total do círculo; capacidade = soma de formas.faixa_max das
-- formas que recebem energia do Prisma. razão = carga / capacidade.
-- Se a carga for menor que a soma de formas.faixa_min, a magia não ativa.
-- Sem Sal △ (triangle) ou Salor (salor) no fluxo, qualquer razão acima de 1.0 já explode.
-- -----------------------------------------------------------------------------
CREATE TABLE niveis_carga (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  razao_ate   NUMERIC,                -- limite superior da razão (NULL = sem limite)
  consequencia TEXT NOT NULL
);

INSERT INTO niveis_carga (id, nome, razao_ate, consequencia) VALUES
  ('estavel',    'Estável',         0.7,  'O círculo segura a energia com folga. A magia sai como planejado.'),
  ('carregado',  'Perto do limite', 1.0,  'Funciona, mas qualquer aumento de energia pode sobrecarregar. Sem Sal △, passar de 100% explode.'),
  ('sobrecarga', 'Sobrecarregado',  1.3,  'Só com Sal △ (ou Salor): o triângulo segura o excesso e a magia funciona instável, sem explodir.'),
  ('explosao',   'Explode',         NULL, 'Selos ○ e Cols □ recebem energia demais e estouram: o círculo explode e libera a energia que sobra em volta do conjurador, aplicando o efeito da runa principal em tudo ao redor.');

-- -----------------------------------------------------------------------------
-- Círculos salvos (o conteúdo é o JSON exportado pelo app em "Salvar projeto")
-- -----------------------------------------------------------------------------
CREATE TABLE circulos (
  id           TEXT PRIMARY KEY,
  nome         TEXT NOT NULL,
  autor        TEXT,
  criado_em    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  projeto_json TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- Visão no formato da tabela oficial (Mín ~ Perf ~ Ext)
-- -----------------------------------------------------------------------------
CREATE VIEW v_runas_tabela AS
SELECT
  nome AS runa,
  COALESCE(energia_obs, CAST(energia_min AS TEXT) || ' ~ ' || CAST(energia_perf AS TEXT) || ' ~ ' || CAST(energia_ext AS TEXT)) AS energia,
  COALESCE(poder_obs,   CAST(poder_min AS TEXT)   || ' ~ ' || CAST(poder_perf AS TEXT)   || ' ~ ' || CAST(poder_ext AS TEXT))   AS poder,
  efeito_1,
  efeito_2
FROM runas
WHERE categoria = 'elemental' AND provisoria = FALSE;

-- Exemplo: capacidade e mínimo do "Lança-Chamas" (1 Prisma, 3 Selos, 1 Col)
-- SELECT SUM(faixa_max) AS capacidade, SUM(faixa_min) AS minimo
-- FROM formas f
-- JOIN (SELECT 'prism' AS id UNION ALL SELECT 'circle' UNION ALL SELECT 'circle'
--       UNION ALL SELECT 'circle' UNION ALL SELECT 'square') c ON c.id = f.id;
-- → capacidade 32.1, mínimo 2.2
