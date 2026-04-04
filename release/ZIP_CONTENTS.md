# Conteúdo do pacote de upload (`livrox-upload.zip`)

Arquivos incluídos no pacote para upload manual no GitHub:

- README.md
- .gitignore
- docs/arquitetura.md
- supabase/schema.sql
- index.html
- package.json
- vite.config.js
- src/main.jsx
- src/App.jsx
- src/styles.css
- src/lib/supabase.js

Arquivos/pastas excluídos no empacotamento:

- .git/
- release/
- node_modules/
- dist/
- .env / .env.*

## Importante
- O arquivo `.zip` **não deve ser versionado no Git** (para evitar erro de PR com arquivo binário).
- Gere o pacote localmente quando precisar:

```bash
zip -r release/livrox-upload.zip . -x '.git/*' 'release/*' 'node_modules/*' 'dist/*' '*.env' '*.env.*'
```
