# LivroX

SPA em React para controle de livro-caixa de pequena empresa, com foco em responsividade, onboarding inicial e gestão de usuários por empresa.

## Funcionalidades implementadas neste repositório
- Onboarding de primeiro acesso para cadastrar:
  - empresa;
  - bancos/carteiras;
  - categorias de receita e despesa.
- Página principal de livro-caixa com:
  - seletor central de mês/ano e carga sob demanda;
  - cadastro/edição/exclusão lógica de transações (soft delete);
  - busca por descrição;
  - filtros por categoria e por tipo (receitas/despesas);
  - botão flutuante para nova transação.
- Cadastro e remoção de categorias.
- Cadastro e remoção de contas.
- Área de usuários com CRUD (criar, editar e excluir) para perfil `master`.
- Tela de login com verificação de login/senha simples e botão de sair da conta.
- Página de perfil para alteração de login/senha (fluxo de UI).
- Layout responsivo com sidebar lateral (desktop) e menu recolhível (mobile), em tema dashboard financeiro claro.
- UI refeita com Tailwind CSS e ícones Lucide para estilo SaaS moderno.

## Supabase
A aplicação já está apontada para:
- URL: `https://cvdzsijdrrwfmufhigpe.supabase.co`
- Publishable key: `sb_publishable_Q0--F1B26kpn3MC7-cDbSA_HSIsoIWr`

> Recomendado mover esses valores para variáveis de ambiente em produção.

### Variáveis de ambiente (opcional)
Crie um `.env`:

```env
VITE_SUPABASE_URL=https://cvdzsijdrrwfmufhigpe.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_Q0--F1B26kpn3MC7-cDbSA_HSIsoIWr
```

## Banco de dados
Use o script em `supabase/schema.sql` para criar as tabelas e policies.

## Rodando localmente
```bash
npm install
npm run dev
```

## Deploy
- Código no GitHub.
- Deploy do SPA no Netlify.
- Backend e banco no Supabase.
- `netlify.toml` e `public/_redirects` já configurados para SPA fallback.

## Hospedando direto no GitHub Pages
Sim, você pode hospedar este frontend diretamente no GitHub Pages (sem Netlify).

### Opção rápida (manual)
1. Rode `npm run build`.
2. Publique o conteúdo da pasta `dist/` em uma branch `gh-pages`.
3. Em `Settings > Pages`, selecione a branch `gh-pages`.

### Opção recomendada (GitHub Actions)
1. Ative `Settings > Pages > Build and deployment: GitHub Actions`.
2. Use o workflow em `.github/workflows/deploy-gh-pages.yml`.
3. Adicione no repositório (Settings > Secrets and variables > Actions > Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

> Observação: GitHub Pages hospeda apenas frontend estático, o Supabase continua como backend.

## Observação sobre PR no Codex
Para evitar erro de PR com arquivo binário (`Arquivos binários não são compatíveis`), não versionar `.zip` no repositório.
Se precisar do pacote, gere localmente com:

```bash
zip -r release/livrox-upload.zip . -x '.git/*' 'release/*' 'node_modules/*' 'dist/*' '*.env' '*.env.*'
```

## Troubleshooting (Netlify em branco)
Se a página abrir em branco após o deploy:

1. Abra `Site configuration > Environment variables` e valide:
   - `VITE_SUPABASE_URL` = `https://cvdzsijdrrwfmufhigpe.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_Q0--F1B26kpn3MC7-cDbSA_HSIsoIWr`
2. Abra o deploy log e confirme:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Abra o console do navegador e confira o erro exibido na tela inicial (o app agora mostra erros de conexão com Supabase em vez de falhar silenciosamente).

### Erro específico: `infinite recursion detected in policy for relation "app_users"`
Se este erro aparecer, aplique novamente o `supabase/schema.sql` atualizado (ele inclui funções `security definer` para evitar recursão de policy em `app_users`).

### Erro no onboarding: botão "Finalizar configuração" não avança
Se clicar e nada acontecer, normalmente é política RLS bloqueando inserts.
1. Reaplique `supabase/schema.sql` atualizado.
2. Este MVP usa políticas abertas para facilitar testes sem login completo (`*_open` policies).

### Login sempre com senha incorreta
Reaplique `supabase/schema.sql` para garantir a coluna `app_users.password` e depois ajuste as senhas dos usuários no banco.
