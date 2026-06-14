# Arthea Finanças

Finanças pessoais para casais — importação de fatura por IA, conta compartilhada, recorrências, metas e relatórios.

## Subindo o projeto

### 1. Criar o repo no GitHub
1. Vai em https://github.com/new
2. Nome: `arthea-financas` (ou o que preferir)
3. Privado
4. **NÃO** marca "Add README" — vai vir o desta migração
5. Cria

### 2. Subir o código deste projeto pra esse repo
Estando neste diretório (`migration/arthea-financas/`):

```bash
git init
git add .
git commit -m "init: Arthea Finanças standalone"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/arthea-financas.git
git push -u origin main
```

### 3. Criar o banco PostgreSQL (Neon — recomendado)
1. https://neon.tech → cria projeto
2. Copia a connection string (formato `postgresql://...?sslmode=require`)
3. Guarda — vai precisar no Vercel

### 4. Criar o projeto no Vercel
1. https://vercel.com/new → escolhe o repo `arthea-financas`
2. Framework: Next.js (auto-detectado)
3. Em **Environment Variables**, adiciona:
   - `DATABASE_URL` — a connection string do Neon
   - `SESSION_SECRET` — gera com `openssl rand -hex 32`
   - `ANTHROPIC_API_KEY` — sua chave da Anthropic
4. Deploy

### 5. Subir o schema pro banco novo
Localmente, com o `.env` apontando pro banco do Neon:
```bash
npm install
npm run db:push
```

### 6. Apontar o domínio
No Vercel → Settings → Domains → adiciona `app.arthea.com.br` (ou outro). Eles dão o registro DNS pra você apontar no seu provedor.

## Migração de dados (se você quer trazer dados antigos)

Se você já tem dados no projeto Arthea atual e quer trazer pra esse novo banco:

```bash
# No projeto antigo (Arthea), exporta os dados de Finanças
npm run -- tsx scripts/export-financas.ts > financas-export.json

# No projeto novo, importa
npm run -- tsx scripts/import-financas.ts financas-export.json
```

(Os scripts ainda precisam ser criados — me avisa quando chegar nessa etapa)

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | dev server local |
| `npm run build` | build de produção |
| `npm run db:push` | aplica o schema no banco |
| `npm run db:studio` | abre o Prisma Studio (UI do banco) |

## Stack

- Next.js 14 (App Router)
- Prisma + PostgreSQL
- Tailwind CSS v4
- Anthropic SDK (importação IA de fatura)
- next-themes (dark/light)
- Cormorant Garamond + Inter

## Estrutura

```
src/
├─ app/
│  ├─ (authed)/        # rotas protegidas (dashboard, cartoes, etc)
│  ├─ api/             # endpoints
│  ├─ login/
│  ├─ setup/
│  ├─ page.tsx         # landing
│  └─ layout.tsx       # root + ThemeProvider
├─ lib/
│  ├─ financas/        # lógica de domínio (couple, balances, etc)
│  ├─ prisma.ts
│  └─ utils.ts
└─ components/
   ├─ financas/        # componentes específicos do produto
   └─ ui/              # primitives (modal)
```
