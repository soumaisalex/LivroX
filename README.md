 # LivroX
Livro caixa para pequenas empresas

SPA em React para controle de livro-caixa de pequena empresa, com foco em responsividade, onboarding inicial e gestão de usuários por empresa.

## Funcionalidades implementadas neste repositório
- Onboarding de primeiro acesso para cadastrar:
  - empresa;
  - bancos/carteiras;
  - categorias de receita e despesa.
- Página principal de livro-caixa com:
  - cadastro de transações;
  - busca por descrição;
  - filtros por data e categoria;
  - timestamp (`created_at`) visível em cada registro.
- Área de usuários para perfil `master` criar usuários.
- Página de perfil para alteração de login/senha (fluxo de UI).
- Layout responsivo desktop/mobile em tons de verde pastel.


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

## Troubleshooting (Netlify em branco)
Se a página abrir em branco após o deploy:

1. Abra `Site configuration > Environment variables` e valide:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. Abra o deploy log e confirme:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Abra o console do navegador e confira o erro exibido na tela inicial (o app agora mostra erros de conexão com Supabase em vez de falhar silenciosamente).
