# Arquitetura sugerida - LivroX

## É possível com GitHub + Supabase + Netlify?
Sim. Esta combinação é muito comum e funciona muito bem para um SPA em React:

- **Frontend (React SPA)**: hospedado no **Netlify** (ou Vercel).
- **Código-fonte**: versionado no **GitHub**.
- **Banco + autenticação + API**: **Supabase**.

> Fluxo: push no GitHub -> deploy automático no Netlify -> app consome Supabase via URL pública + chave ANON.

## Stack recomendada
- React + TypeScript + Vite
- React Router (rotas de autenticação, setup inicial e app)
- TanStack Query (cache e sincronização)
- Tailwind CSS + componentes (layout moderno e responsivo)
- Supabase JS (auth + banco)
- Zod + React Hook Form (validação)

## Requisitos cobertos

### 1) Livro-caixa com busca e filtros
- Tela principal com:
  - listagem de transações
  - busca textual global
  - filtros por período (`data_inicio`, `data_fim`)
  - filtro por categoria
  - filtro por conta (banco/carteira)
  - filtro por tipo (receita/despesa)
- Cada transação com:
  - `timestamp` automático (`created_at`)
  - valor
  - descrição
  - categoria
  - conta (Banco do Brasil, dinheiro, Santander...)
  - usuário que criou

### 2) Controle de usuários por empresa
- Usuário **master** com perfil `master`.
- Usuários comuns com perfil `member`.
- Master cria, ativa/desativa e redefine senha dos demais usuários.
- Multi-empresa isolada por `company_id`.

### 3) Primeiro acesso (setup obrigatório)
No primeiro login do master:
1. cadastrar empresa
2. cadastrar contas (bancos/carteiras)
3. cadastrar categorias de receita e despesa

Enquanto não concluir, redirecionar para `/setup`.

### 4) Login sem e-mail para usuários comuns
Como o Supabase Auth padrão é voltado para e-mail/telefone, há duas opções:

#### Opção A (recomendada): tabela própria de credenciais (username + senha hash)
- Não usar o login padrão do Supabase para os usuários comuns.
- Criar tabela `user_credentials` com:
  - `username` único por empresa
  - `password_hash`
  - `must_change_password`
- Endpoint (Edge Function) para autenticar e emitir sessão JWT customizada.
- **Pró**: atende exatamente "nome de acesso + senha" sem e-mail.
- **Contra**: implementação de auth customizada (mais trabalho).

#### Opção B (mais simples tecnicamente): e-mail interno técnico para todos
- Manter Supabase Auth padrão.
- Para usuários comuns, usar e-mail interno invisível para o usuário (ex.: `usuario+empresa@interno.local`).
- Login na UI continua por `username`; backend resolve para e-mail interno.
- Apenas master usa e-mail real para recuperação.
- **Pró**: menos complexidade.
- **Contra**: workaround arquitetural.

## Segurança
- RLS obrigatório em todas as tabelas de negócio.
- Todas as queries sempre vinculadas ao `company_id` do usuário.
- Auditoria mínima: `created_at`, `created_by`, `updated_at`.

## Cores e UI (inspirado no template Figma)
- Base: fundo claro com cinzas suaves.
- Primária: verde pastel (ex. `#7FBF9E`).
- Acentos: verde médio (`#5FAF87`) e neutros para contraste.
- Cards com borda sutil, sombra leve e tipografia limpa.

## Deploy
1. Criar projeto no Supabase.
2. Rodar script SQL de schema (`supabase/schema.sql`).
3. Configurar variáveis no Netlify:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Conectar repositório do GitHub no Netlify.
5. Build command: `npm run build` | publish: `dist`.
