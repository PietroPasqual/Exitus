# Segurança

## Revisão de 16/10/2026

Correções nesta branch:

- IDs de nós, cabos e camadas vindos de JSON são escapados antes de entrar em atributos HTML/SVG. Isso impede sair do atributo e inserir eventos JavaScript. Os IDs originais são preservados.
- Nome e sigilo de runas configuráveis são exibidos como texto na paleta, impedindo HTML executável vindo das regras ou do cache local.
- Projetos e regras aceitam apenas formas/runas próprias dos catálogos. Chaves herdadas como `constructor` e `__proto__` são ignoradas.
- Importação local limitada a 2 MB antes da leitura. Projetos externos aceitam até 500 nós, 2.000 cabos e 32 camadas; IDs de nós duplicados são rejeitados; descrições são limitadas a 4.000 caracteres. Esses limites reduzem abuso de recursos, sem garantir proteção contra todo grafo de custo elevado.
- Supabase JS, Vite e Vitest atualizados com versões exatas e lockfile. CI usa Node 22, executa auditoria de dependências e concede permissões de publicação somente ao job de deploy.
- Removida a mensagem de erro que recomendava desligar a confirmação de e-mail.

## Validação

- 289 testes passando, incluindo seis testes de segurança com payloads de HTML, atributos SVG e chaves de protótipo.
- `npm run build`: TypeScript e compilação aprovados.
- `npm audit`: zero vulnerabilidades reportadas após a atualização. Esse resultado depende da base de avisos disponível na execução e não é garantia de ausência de falhas.

## Escopo e pendências

A revisão foi feita no código do repositório. Não foram alterados dados ou configurações do banco em produção, nem realizados testes autenticados com contas reais.

Os scripts `database/contas_supabase.sql` e `database/regras_supabase.sql` incluem RLS por proprietário e autorização administrativa no banco. Isso não comprova que o ambiente publicado esteja com os mesmos scripts aplicados. Validar no Supabase: duas contas não acessam círculos uma da outra, visitante não acessa círculos, usuário comum não altera regras nem se promove a admin, somente admin acessa histórico. Conferir também tabelas antigas: `database/runas.sql` é um modelo anterior e não deve ser aplicado como configuração segura de produção sem revisar RLS e privilégios.

Manter confirmação de e-mail, proteção contra abuso de login/cadastro e URLs de redirecionamento restritas ao domínio do site. Verificar CSP e cabeçalhos de segurança na hospedagem e testar login, salvamento e exportação no preview antes de publicar. Nenhuma falha de isolamento do banco foi confirmada nesta revisão.

A chave `sb_publishable_...` do frontend é pública por definição; a proteção dos dados depende das permissões e RLS do banco. Nunca colocar chaves secret/service_role no frontend.

Referências: https://supabase.com/docs/guides/database/postgres/row-level-security e https://github.com/advisories/GHSA-8r88-6cj9-9fh5.
