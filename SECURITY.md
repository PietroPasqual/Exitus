# Segurança

## Revisão de 16/10/2026

Correções nesta branch:

- IDs de nós, cabos e camadas vindos de JSON são escapados antes de entrar em atributos HTML/SVG. Isso impede sair do atributo e inserir eventos JavaScript. Os IDs originais são preservados.
- Nome e sigilo de runas configuráveis são exibidos como texto na paleta, impedindo HTML executável vindo das regras ou do cache local.
- Projetos e regras aceitam apenas formas/runas próprias dos catálogos. Chaves herdadas como `constructor` e `__proto__` são ignoradas.
- Importação local limitada a 2 MB antes da leitura. Projetos externos aceitam até 500 nós, 2.000 cabos e 32 camadas; IDs de nós duplicados são rejeitados; descrições são limitadas a 4.000 caracteres. Esses limites reduzem abuso de recursos, sem garantir proteção contra todo grafo de custo elevado.
- Fichas em PDF são lidas no próprio navegador com pdf.js (versão exata, carregado só quando um PDF é importado): até 20 MB e 60 páginas, apenas o texto é extraído, sem carregar fontes nem formulários XFA do arquivo, e o resultado passa pela mesma validação de uma ficha JSON. Nada é enviado a servidores.
- Supabase JS, Vite e Vitest atualizados com versões exatas e lockfile. CI usa Node 22, executa auditoria de dependências e concede permissões de publicação somente ao job de deploy.
- Removida a mensagem de erro que recomendava desligar a confirmação de e-mail.

## Validação

- 289 testes passando, incluindo seis testes de segurança com payloads de HTML, atributos SVG e chaves de protótipo.
- `npm run build`: TypeScript e compilação aprovados.
- `npm audit`: zero vulnerabilidades reportadas após a atualização. Esse resultado depende da base de avisos disponível na execução e não é garantia de ausência de falhas.

## Validação adicional após o merge

- PR #1 mesclado, com check do GitHub Actions aprovado.
- Supabase `circulo-magico` confirmado como ACTIVE_HEALTHY. As quatro tabelas públicas têm RLS ativo e políticas correspondentes ao repositório.
- Removidos privilégios excessivos das tabelas, sequência do histórico e função de trigger. Aplicado no banco pela migration `restrict_public_table_privileges`; script de referência: `database/permissoes_supabase.sql`. Zero grants TRUNCATE/TRIGGER/REFERENCES para visitantes e usuários; CRUD de círculos mantido para authenticated; regras continuam públicas para leitura.
- `database/security-checks.sql` executado com sucesso no banco em uma transação revertida: duas contas temporárias isoladas, criação/leitura/edição/exclusão próprias permitidas, leitura/update/delete/insert alheios bloqueados, transferência de propriedade bloqueada, autopromoção negada, histórico protegido e regras protegidas contra alteração por usuário comum. Nenhuma conta ou círculo de teste persistiu.
- Site publicado abriu no navegador, carregou exemplo e permitiu adicionar selo. O bundle ainda era anterior às correções; encontrado e corrigido o workflow que publicava somente a main apesar de a branch padrão ter outro nome. Agora publica a branch padrão.

## Pendências e limites

O advisor de segurança do Supabase informa proteção contra senhas vazadas desativada. Ativar nas configurações de Auth se disponível no plano: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

Os testes de autorização usam o papel e as claims do usuário dentro do banco, sem login por e-mail/senha. Não validam entrega de e-mail, criação de sessão nem todo o fluxo de Auth no navegador. A suíte faz rollback e não altera dados reais. Verificar CSP e cabeçalhos da hospedagem. O arquivo `database/runas.sql` é um modelo antigo, não configuração segura para reaplicar sem revisão de RLS.

A chave `sb_publishable_...` do frontend é pública por definição; a proteção dos dados depende das permissões e RLS do banco. Nunca colocar chaves secret/service_role no frontend.

Referências: https://supabase.com/docs/guides/database/postgres/row-level-security e https://github.com/advisories/GHSA-8r88-6cj9-9fh5.
