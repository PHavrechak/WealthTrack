# WealthTrack

Sistema de controle financeiro pessoal que responde a uma pergunta simples e difícil: **"quanto eu posso gastar agora sem sabotar minha meta de investimento?"**

Diferente de um app comum de registro de gastos, o WealthTrack não se limita a guardar lançamentos — ele automatiza o raciocínio financeiro, cruzando receitas, despesas e a meta de investimento do mês para entregar uma resposta direta, em tempo real.

> Projeto de portfólio em desenvolvimento ativo.

---

## O problema que resolve

Planilhas e apps de finanças tradicionais mostram *o que já aconteceu*. O WealthTrack existe para responder *o que fazer agora*: ao invés de só listar transações, ele calcula continuamente o quanto ainda pode ser gasto no mês sem comprometer a meta de investimento definida — substituindo a conta de cabeça (ou a planilha manual) que a maioria das pessoas faz sozinha.

## Funcionalidades

**No MVP (em desenvolvimento):**
- Autenticação de usuário (cadastro e login)
- Cadastro de categorias de receita e despesa
- Registro de transações
- Definição de meta de investimento mensal
- Card "disponível para gastar" em tempo real
- Relatórios de padrão de gasto

**Diferenciais futuros:**
- Detector de inflação de estilo de vida (alerta quando o crescimento de despesas supera o crescimento de renda)
- Análise financeira assistida por IA

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite + TypeScript + TailwindCSS |
| Backend | FastAPI (Python) |
| Banco de dados / Auth | Supabase (PostgreSQL) |

## Arquitetura

Alguns princípios seguidos ao longo do projeto:

- **Autenticação no frontend, autorização no backend.** O Supabase Auth é tratado inteiramente pelo `supabase-js` no frontend; o FastAPI apenas valida o JWT recebido (via JWKS) e nunca lida com login/signup diretamente.
- **Lógica de negócio só no backend.** Cálculos e regras nunca vivem no frontend — o frontend apenas exibe o que o backend calcula.
- **Isolamento de dados por usuário garantido no código, não só no banco.** Como o backend usa a chave `secret` do Supabase (que ignora Row Level Security por padrão), todo acesso a dado é filtrado explicitamente pelo `user_id` extraído do JWT validado — nunca por um valor recebido do cliente. RLS também está habilitado em todas as tabelas como camada adicional de defesa.
- **Dinheiro como `NUMERIC(12,2)`**, nunca `float`, para evitar erros de arredondamento.

## Rodando o projeto localmente

### Pré-requisitos
- Node.js 20+
- Python 3.12
- Uma conta e projeto criados no [Supabase](https://supabase.com)

### 1. Clonar o repositório
```bash
git clone https://github.com/PHavrechak/WealthTrack.git
cd WealthTrack
```

### 2. Backend
```bash
cd backend
py -3.12 -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

Crie um arquivo `.env` dentro de `backend/` com:
```
SUPABASE_URL=sua_url_aqui
SUPABASE_SECRET_KEY=sua_chave_secreta_aqui
```

Rode as migrations em `supabase/migrations/` no **SQL Editor** do seu projeto Supabase antes de iniciar o servidor.

Suba o servidor:
```bash
uvicorn main:app --reload
```
Docs interativos disponíveis em `http://127.0.0.1:8000/docs`.

### 3. Frontend
```bash
cd frontend
npm install
```

Crie um arquivo `.env.local` dentro de `frontend/` com:
```
VITE_SUPABASE_URL=sua_url_aqui
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publicavel_aqui
VITE_API_BASE_URL=http://localhost:8000
```

Suba o servidor:
```bash
npm run dev
```
Aplicação disponível em `http://localhost:5173`.

> As chaves do Supabase ficam em **Project Settings → API Keys** no dashboard do seu projeto. Nenhum arquivo `.env` é versionado neste repositório — cada ambiente precisa criar o seu.

## Status do desenvolvimento

Roadmap dividido em 8 etapas (1–6 compõem o MVP demonstrável; 7–8 são diferenciais).

- [x] Etapa 1 — Setup do ambiente e scaffold do projeto
- [x] Etapa 2 — Autenticação (login, cadastro, rota protegida)
- [x] Etapa 3 — Modelagem de dados e CRUD (categorias, transações, meta mensal)
- [x] Etapa 4 — Telas do frontend consumindo os endpoints
- [x] Etapa 5 — Card "disponível para gastar" em tempo real
- [ ] Etapa 6 — Relatórios de padrão de gasto
- [ ] Etapa 7 — Detector de inflação de estilo de vida
- [ ] Etapa 8 — Análise assistida por IA

## Licença

Projeto pessoal de portfólio. Sem licença de uso definida no momento.
