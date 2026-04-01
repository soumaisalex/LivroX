 # LivroX
-Livro caixa para pequenas empresas
+
+Livro caixa para pequenas empresas.
+
+## Status
+Este repositório agora contém uma **base de arquitetura** para o produto solicitado, incluindo:
+
+- visão técnica do projeto SPA React responsivo;
+- proposta de autenticação e papéis (master/member);
+- fluxo de primeiro acesso (onboarding da empresa);
+- modelagem inicial de banco no Supabase com RLS.
+
+## Arquivos principais
+- `docs/arquitetura.md`: guia funcional/técnico e decisões de stack.
+- `supabase/schema.sql`: schema inicial (tabelas, índices, políticas RLS e triggers).
+
+## Próximos passos recomendados
+1. Criar o frontend React (Vite + TypeScript) seguindo `docs/arquitetura.md`.
+2. Aplicar `supabase/schema.sql` no projeto Supabase.
+3. Configurar o deploy no Netlify com o GitHub.
+4. Implementar autenticação por username+senha conforme opção arquitetural escolhida.
+
+## Observação
+No ambiente atual, a instalação automática de dependências npm foi bloqueada por política de acesso ao registry externo. Mesmo assim, a estrutura de arquitetura e banco foi entregue para acelerar o início do desenvolvimento.
