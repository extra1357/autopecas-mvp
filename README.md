[DOCUMENTACAO_TECNICA.md](https://github.com/user-attachments/files/30143744/DOCUMENTACAO_TECNICA.md)
# Documentação Técnica — Autopeças MVP
**Repositório:** `github.com/extra1357/autopecas-mvp`
**Versão do documento:** 1.0 — gerado a partir do código-fonte em `main` (última leitura: julho/2026)

> Este documento foi produzido lendo diretamente o código-fonte do repositório (não apenas o README). Onde o comportamento real do código diverge do que os arquivos de configuração sugerem, isso está sinalizado explicitamente na seção 10 (Inconsistências Conhecidas).

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Stack Tecnológica](#3-stack-tecnológica)
4. [Estrutura de Pastas](#4-estrutura-de-pastas)
5. [Modelo de Dados](#5-modelo-de-dados)
6. [Módulos da API — Detalhamento Funcional](#6-módulos-da-api--detalhamento-funcional)
7. [Fluxo Conversacional (Máquina de Estados)](#7-fluxo-conversacional-máquina-de-estados)
8. [API — Endpoints](#8-api--endpoints)
9. [Setup de Ambiente](#9-setup-de-ambiente)
10. [Inconsistências Conhecidas / Dívida Técnica](#10-inconsistências-conhecidas--dívida-técnica)
11. [Deploy e Infraestrutura](#11-deploy-e-infraestrutura)
12. [Escalabilidade](#12-escalabilidade)
13. [Manutenção e Sustentação (Runbook)](#13-manutenção-e-sustentação-runbook)
14. [Segurança](#14-segurança)
15. [Observabilidade e Monitoramento](#15-observabilidade-e-monitoramento)
16. [Roadmap Técnico Recomendado](#16-roadmap-técnico-recomendado)

---

## 1. Visão Geral

O **Autopeças MVP** é um sistema de **atendimento conversacional via WhatsApp** para uma loja de autopeças, com:

- **Bot de IA** que entende linguagem natural (classificação de intenção via LLM), busca peças em estoque, calcula formas de pagamento, coleta endereço e monta pedidos.
- **RAG (Retrieval-Augmented Generation)** para responder perguntas sobre políticas da loja (horário, entrega, garantia) usando busca vetorial (pgvector) sobre uma base de conhecimento.
- **Handoff (transbordo) para atendente humano** com fila (Bull/Redis), controle de SLA e lock otimista para evitar que dois vendedores assumam o mesmo atendimento.
- **Dashboard web (Next.js)** em tempo real (via SSE) para vendedores acompanharem e assumirem atendimentos, e para gestores verem métricas de conversão.
- **Consentimento LGPD** coletado no primeiro contato via WhatsApp.

Em resumo: é um middleware operacional que fica entre o WhatsApp Business (Meta Cloud API) e a operação comercial da loja, com IA fazendo a triagem e um painel humano para os casos que a IA não resolve.

---

## 2. Arquitetura do Sistema

```
                         ┌─────────────────────────┐
                         │   Meta WhatsApp Cloud    │
                         │   Business API           │
                         └───────────┬──────────────┘
                                     │ Webhook (POST /api/whatsapp/webhook)
                                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                         apps/api  (NestJS)                         │
│                                                                      │
│  WhatsappController → ConversasService (orquestrador central)       │
│        │                     │                                      │
│        │                     ├── AiService (Groq LLM) → classifica  │
│        │                     │   intenção                           │
│        │                     ├── WorkflowEngine → executa workflow  │
│        │                     │     ├── BuscarPecaWorkflow            │
│        │                     │     └── EntregaWorkflow               │
│        │                     ├── RagService → busca vetorial        │
│        │                     │   (pgvector) + catálogo de produtos  │
│        │                     └── HandoffService → fila Bull/Redis   │
│        │                                                              │
│  InventoryController/Service → consulta de estoque                  │
│  HandoffController → SSE (/api/handoff/stream) para o dashboard     │
│  AdminController → métricas agregadas                               │
│  InatividadeService (cron @NestJS/schedule) → encerra/lembra        │
│  conversas inativas                                                 │
└───────────────────┬───────────────────────────┬─────────────────────┘
                     │                           │
             ┌───────▼────────┐         ┌────────▼─────────┐
             │  PostgreSQL     │         │  Redis (Bull)     │
             │  + pgvector     │         │  fila "handoff"   │
             │  (Prisma ORM)   │         └───────────────────┘
             └─────────────────┘
                     ▲
                     │ REST + SSE
┌────────────────────┴────────────────────────────────────────────────┐
│                     apps/web  (Next.js 14 / React 18)                │
│  Dashboard único (page.tsx) com abas:                                │
│   - Fila de atendimento (assumir/resolver/responder)                 │
│   - Métricas (conversão, receita, vendedores)                        │
│   - Perguntas sem resposta (curadoria da base de conhecimento RAG)   │
└────────────────────────────────────────────────────────────────────┘
```

**Padrão arquitetural:** monorepo com Yarn Workspaces, API em NestJS modular (DDD leve por domínio), fila assíncrona para desacoplar notificações de SLA do fluxo síncrono do webhook, e um "workflow engine" plugável por `intent`.

---

## 3. Stack Tecnológica

| Camada | Tecnologia | Versão (package.json) |
|---|---|---|
| Runtime | Node.js | ≥ 20.0.0 |
| Gerenciador de pacotes | Yarn (workspaces) | ≥ 1.22.0 |
| Backend framework | NestJS | ^10.3.0 |
| ORM | Prisma | ^5.11.0 |
| Banco de dados | PostgreSQL + extensão **pgvector** | 16 (docker-compose) |
| Fila / cache | Redis + Bull | ioredis ^5.3.2, bull ^4.12.0 |
| LLM (classificação de intenção + geração de resposta) | **Groq** (`llama-3.3-70b-versatile`) | groq-sdk ^1.2.0 |
| Embeddings (busca semântica) | Hugging Face Transformers.js (local, `Xenova/paraphrase-multilingual-MiniLM-L12-v2`) + `@huggingface/inference` | ^4.x |
| Canal de mensagens | WhatsApp Cloud API (Meta) — chamada direta via `axios`, `graph.facebook.com/v25.0` | — |
| Validação | class-validator / class-transformer / zod | — |
| Documentação de API | Swagger (`@nestjs/swagger`) em `/docs` | — |
| Frontend | Next.js 14 (App Router) + React 18 | — |
| Estilo frontend | Tailwind CSS | ^3.4.0 |
| Deploy sugerido (API) | Render.com (`render.yaml`) | — |
| Deploy sugerido (Web) | Vercel (`vercel.json`) | — |

---

## 4. Estrutura de Pastas

```
autopecas-mvp/
├── apps/
│   ├── api/                        # Backend NestJS
│   │   ├── src/
│   │   │   ├── main.ts             # bootstrap, prefixo /api, Swagger em /docs
│   │   │   ├── app.module.ts       # módulo raiz — importa todos os módulos
│   │   │   ├── health.controller.ts
│   │   │   └── modules/
│   │   │       ├── prisma/         # PrismaService (@Global)
│   │   │       ├── ai/             # classificação de intenção (Groq)
│   │   │       ├── conversations/  # orquestrador da conversa + state machine
│   │   │       ├── workflows/      # engine de workflows por intent
│   │   │       ├── inventory/      # busca de peças em estoque
│   │   │       ├── rag/            # RAG (catálogo + base de conhecimento)
│   │   │       ├── handoff/        # fila, SLA, SSE, lock otimista
│   │   │       ├── whatsapp/       # webhook, envio de mensagens, inatividade
│   │   │       └── admin/          # métricas agregadas
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed*.ts, enable-pgvector.ts, add-embedding.ts, enriquecer-base.ts, ...
│   │   ├── keep-alive.js           # ping /health a cada 14 min (evita cold start no Render free tier)
│   │   ├── test-pipeline.sh        # script de smoke test via curl
│   │   └── package.json
│   ├── web/                        # Dashboard Next.js
│   │   ├── src/app/page.tsx        # única página — fila, métricas, perguntas sem resposta
│   │   ├── src/app/layout.tsx
│   │   ├── next.config.js          # rewrite de /api/* para a API
│   │   └── vercel.json
│   └── worker/                     # apenas .env.example — sem código-fonte ainda (ver seção 10)
├── docker-compose.yml              # Postgres local + Redis Commander (UI)
├── render.yaml                     # infra-as-code para deploy da API no Render
├── package.json                    # raiz — Yarn workspaces + scripts agregadores
├── setup.sh                        # script que recria a árvore de pastas do zero
├── INSTALAR.ps1                    # script PowerShell "cole os blocos" — histórico de patch manual (ver seção 10)
└── (arquivos soltos na raiz — ver seção 10: página, controller e service duplicados)
```

---

## 5. Modelo de Dados

Fonte: `apps/api/prisma/schema.prisma`. Banco: PostgreSQL, com extensão `vector` (pgvector) habilitada manualmente (não está na migration principal — ver seção 10).

### Entidades principais

| Modelo | Papel |
|---|---|
| `Cliente` | Pessoa que fala com o bot via WhatsApp (`telefone` é chave única). Guarda consentimento LGPD (`aceitaMarketing`, `consentimentoEm`, `consentimentoOrigem`) e dados de veículo informados. |
| `Conversa` | Uma sessão de atendimento. Tem `status` (ciclo de vida macro) e `estadoAtual` (posição na máquina de estados). `contexto` é um JSON livre usado como "memória de curto prazo" do workflow (carrinho, endereço, forma de pagamento etc.). |
| `Mensagem` | Histórico de mensagens, com `origem` (`CLIENTE`, `IA`, `HUMANO`, `SISTEMA`). |
| `Produto` | Catálogo de peças (`codigo` único, `estoque`, `preco`, `aplicacao` — texto livre usado para casar com veículo/ano). |
| `Pedido` / `ItemPedido` | Modelo de pedido já desenhado no schema, mas **ainda não há um `OrdersModule`/controller que o popule** (ver seção 10). |
| `Atendimento` | Representa um handoff para humano. 1:1 com `Conversa` (`conversaId` é `@unique`). Tem `prioridade`, `slaMinutos`, `status`. |
| `LogConversa` | Log de auditoria de eventos por conversa (`tipo` + `payload` JSON) — usado para rastrear `HANDOFF_NOTIFICADO`, `SLA_VIOLADO`, `WORKFLOW_EXECUTADO`, `RAG_RESPONDEU`, `SEM_RESPOSTA`, `HANDOFF_ASSUMIDO`. |
| `BaseConhecimento` | Base vetorial de perguntas/respostas sobre políticas da loja. Coluna `embedding` (`vector(1536)`) adicionada fora do fluxo padrão de migration. |
| `PerguntaSemResposta` | Fila de curadoria: perguntas que nem o catálogo nem a base de conhecimento resolveram, para um humano revisar e "ensinar" o bot (vira uma nova entrada em `BaseConhecimento` com embedding). |

### Enums relevantes
`StatusConversa`, `EstadoConversa`, `OrigemMensagem`, `StatusPedido`, `TipoEntrega`, `TipoPagamento`, `StatusAtendimento`, `PrioridadeAtendimento`.

> ⚠️ **Observação:** o enum `EstadoConversa` no `schema.prisma` tem valores duplicados (`FINALIZADA` aparece duas vezes) — ver seção 10.

### Migrations existentes
```
20260518225851_init                      # schema inicial completo
20260606191335_add_lgpd_consentimento    # colunas de consentimento LGPD em Cliente
20260612232755_add_base_conhecimento     # cria tabela base_conhecimento (SEM a coluna embedding e SEM CREATE EXTENSION vector)
```

---

## 6. Módulos da API — Detalhamento Funcional

### 6.1 `WhatsappModule`
- **Webhook** (`GET/POST /api/whatsapp/webhook`): verificação do Meta (`hub.challenge`) e recebimento de mensagens.
- Deduplicação de mensagens por `msgId` (Set em memória, TTL de 60s).
- **Rate limiting por telefone em memória** (`processingByPhone` / `pendingByPhone`): se uma mensagem do mesmo número chega enquanto a anterior ainda está sendo processada, ela espera 4s e só é processada se ainda for a mais recente.
- `WhatsappService.enviarMensagem` chama a Graph API da Meta (`v25.0`) diretamente via `axios`.
- `InatividadeService`: cron a cada minuto (`@Cron(CronExpression.EVERY_MINUTE)`) que envia lembrete após 3 min de inatividade e encerra a conversa após 8 min.

### 6.2 `ConversasModule` (orquestrador central)
`ConversasService.processarMensagem` é o coração do sistema. Fluxo, em ordem:
1. Cria/recupera `Cliente` e `Conversa` ativa.
2. Registra a mensagem do cliente.
3. Se a conversa está `AGUARDANDO_HUMANO`/`EM_ATENDIMENTO`, **não responde** (silêncio — o humano assumiu).
4. **Onboarding**: se é a primeira interação, pergunta o nome e depois pede consentimento LGPD (opt-in de marketing) antes de prosseguir.
5. Classifica a intenção via `AiService` (LLM).
6. Trata casos especiais direto (`falar_vendedor` → cria handoff imediato; `saudacao` → resposta fixa).
7. Se intenção é `desconhecido` ou confiança < 0.6 → aciona `RagService`; se RAG também não resolve e já são 5+ mensagens do cliente sem resolução → cria handoff automático.
8. Caso contrário, delega para o `WorkflowEngine`.
9. Se o resultado do workflow sinalizar `handoff.necessario`, cria o handoff com o resumo/carrinho já coletado.

### 6.3 `AiModule` (`AiService`)
- Usa Groq (`llama-3.3-70b-versatile`, `temperature: 0.1`) com um prompt de few-shot detalhado para classificar a mensagem em um de ~14 intents (`buscar_peca`, `informar_endereco`, `confirmar_pedido`, `falar_vendedor` etc.), retornando JSON estruturado com `intent`, `entidades` e `confianca`.
- É **stateful em relação ao `estadoAtual`** da conversa (o prompt recebe o estado atual para decidir se `escolher_entrega`/`escolher_retirada` fazem sentido).

### 6.4 `WorkflowsModule`
- `WorkflowEngine` é um **registry** de workflows por `intent` (`registrar()` mapeia intents → workflow). Hoje há dois workflows implementados: `BuscarPecaWorkflow` e `EntregaWorkflow`.
- Se não há workflow para o intent, cai no RAG como fallback, e se o RAG também falhar, responde genericamente e loga `SEM_RESPOSTA`.
- Toda execução atualiza `Conversa.estadoAtual`/`contexto` e grava um `LogConversa` do tipo `WORKFLOW_EXECUTADO`.

### 6.5 `InventoryModule`
- `buscarPeca`: busca por nome (contains, case-insensitive) + filtro opcional por `veiculo` (contains em `aplicacao`) + filtro opcional por ano (parse de range tipo `2015-2020` ou ano único no texto de `aplicacao`).
- `buscarPecaSemantica`: expande o termo de busca usando o LLM (sinônimos/nomes populares no Brasil) antes de consultar o banco — mitigação para nomenclatura popular divergente da técnica.
- `GET /api/inventory/pagamento?preco=X`: calcula simulação de PIX / cartão 2x / dinheiro (regra fixa, sem gateway de pagamento real).

### 6.6 `RagModule`
- **Roteador de duas rotas**: classifica heuristicamente (lista de palavras-chave, sem LLM) se a pergunta é sobre **peça** (vai direto ao catálogo `Produto`) ou sobre **política da loja** (vai para busca vetorial em `BaseConhecimento` via pgvector, operador `<=>` de distância de cosseno).
- Embeddings gerados localmente com Transformers.js (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, quantização `q8`) — **não depende de API externa para gerar embeddings de busca**, mas ainda usa Groq para redigir a resposta final em linguagem natural.
- Threshold de similaridade: `> 0.2` (bastante permissivo).
- Perguntas sem resposta (nem catálogo, nem base) são gravadas em `PerguntaSemResposta` para curadoria humana via `RagController` (`GET /rag/perguntas-sem-resposta`, `PATCH /rag/perguntas-sem-resposta/:id/resolver`) — ao resolver, gera embedding e insere um novo registro em `BaseConhecimento` (**self-improving loop**).

### 6.7 `HandoffModule`
- Fila **Bull** (`handoff`) com dois jobs por handoff criado:
  - `novo-handoff`: grava log `HANDOFF_NOTIFICADO` (3 tentativas, backoff exponencial).
  - `verificar-sla`: agendado com `delay = slaMinutos * 60000`; se o atendimento ainda estiver `PENDENTE` quando disparar, escala a prioridade para `URGENTE` e grava log `SLA_VIOLADO`.
- **Lock otimista** em `assumirAtendimento`: usa `updateMany` com `where: { status: 'PENDENTE' }`; se `count === 0`, lança `409 ConflictException` — impede que dois vendedores assumam o mesmo atendimento em condição de corrida.
- **SSE** (`GET /api/handoff/stream`) via `RxJS Subject` — o dashboard abre uma conexão e recebe eventos `novo`/`assumido`/`resolvido` em tempo real, evitando polling.
- Envio de mensagem manual do vendedor: `POST /api/handoff/:id/mensagem` — só funciona se `status === EM_ANDAMENTO`.

### 6.8 `AdminModule`
- `GET /api/admin/metricas?mes=YYYY-MM-DD`: agrega, por mês, total de leads, taxa de atendimento pela IA, taxa de abandono, taxa de conversão, receita estimada (`ticketMedio` fixo em R$ 350 — **valor hardcoded**), horas economizadas (estimativa fixa de 5 min/lead) e ranking por vendedor (código = 3 primeiras letras do `vendedorId`).

---

## 7. Fluxo Conversacional (Máquina de Estados)

Existem **duas fontes de verdade para estados**, que precisam ser lidas em conjunto (ver também seção 10):

1. `EstadoConversa` no `schema.prisma` (persistido no banco).
2. `StateMachineService` (`apps/api/src/modules/conversations/state-machine.service.ts`) — define transições `estado + intent → novo estado`, mas **não é chamado por `ConversasService`**; quem efetivamente muda o `estadoAtual` hoje é o retorno de cada `Workflow` (`resultado.novoEstado`), aplicado pelo `WorkflowEngine`.

Fluxo típico feliz:
```
INICIO
 → (nome + LGPD coletados)
 → buscar_peca → AGUARDANDO_PECA / AGUARDANDO_VEICULO → CONSULTANDO_ESTOQUE
 → escolher_entrega → AGUARDANDO_ENDERECO
   ou escolher_retirada → AGUARDANDO_PAGAMENTO
 → informar_pagamento → FINALIZADO
```
Desvios:
- `falar_vendedor` em qualquer ponto → `AGUARDANDO_VENDEDOR` + handoff imediato (SLA 10 min).
- Intenção desconhecida ou baixa confiança → RAG; se persistir por 5+ mensagens → handoff automático (SLA 15 min).
- Erro interno em qualquer workflow → handoff automático com prioridade `ALTA` e mensagem de fallback ao cliente.
- Inatividade → lembrete aos 3 min, encerramento (`EXPIRADA`) aos 8 min.

---

## 8. API — Endpoints

Prefixo global: **`/api`**. Documentação interativa (Swagger): **`/docs`**.

| Método | Rota | Módulo | Descrição |
|---|---|---|---|
| GET | `/api/health` | Health | Healthcheck simples (`{status, timestamp}`) |
| GET | `/api/whatsapp/webhook` | Whatsapp | Verificação do webhook Meta |
| POST | `/api/whatsapp/webhook` | Whatsapp | Recebimento de mensagens do WhatsApp |
| POST | `/api/test/mensagem` | Whatsapp (test) | Simula uma mensagem sem passar pelo WhatsApp real — usado por `test-pipeline.sh` |
| GET | `/api/conversas/cliente/:telefone` | Conversas | Busca/cria conversa ativa de um telefone |
| GET | `/api/inventory/buscar?peca=&veiculo=&ano=` | Inventory | Busca de peças em estoque |
| GET | `/api/inventory/pagamento?preco=` | Inventory | Simulação de formas de pagamento |
| GET | `/api/rag/perguntas-sem-resposta` | Rag | Lista perguntas não resolvidas |
| PATCH | `/api/rag/perguntas-sem-resposta/:id/resolver` | Rag | Resolve pergunta e alimenta a base vetorial |
| GET | `/api/handoff/stream` | Handoff | **SSE** — eventos em tempo real |
| GET | `/api/handoff/pendentes` | Handoff | Lista atendimentos pendentes/em andamento |
| POST | `/api/handoff/:id/assumir` | Handoff | Vendedor assume o atendimento (lock otimista, pode retornar 409) |
| POST | `/api/handoff/:id/resolver` | Handoff | Marca atendimento como resolvido |
| POST | `/api/handoff/:id/mensagem` | Handoff | Vendedor envia mensagem manual ao cliente via WhatsApp |
| GET | `/api/admin/metricas?mes=` | Admin | Métricas agregadas do mês |

> Nenhuma rota acima possui autenticação/autorização no código atual (ver seção 14 — Segurança).

---

## 9. Setup de Ambiente

### 9.1 Pré-requisitos
- Node.js ≥ 20
- Yarn ≥ 1.22
- Docker (para Postgres/Redis locais) ou instâncias gerenciadas

### 9.2 Subindo a infra local
```bash
docker compose up -d
# sobe:
#  - postgres:16-alpine na porta 5433 (usuário/senha/db: autopecas / autopecas123 / autopecas_dev)
#  - redis-commander (UI de Redis) na porta 8081 — assume Redis já rodando em host.docker.internal:6379
```
> ⚠️ O `docker-compose.yml` **não sobe um container Redis** — só a UI (`redis-commander`) apontando para um Redis externo/local. É necessário rodar Redis separadamente (ex.: `redis-server` local ou um serviço gerenciado) — ver seção 10.

### 9.3 Variáveis de ambiente (API — `apps/api/.env`)
Baseado em `.env.example` **+ variáveis realmente lidas no código** (há divergência — ver seção 10):

```bash
# Banco de dados
DATABASE_URL="postgresql://autopecas:autopecas123@localhost:5433/autopecas_dev"

# Redis / fila
REDIS_URL="redis://localhost:6379"     # usado por app.module.ts (BullModule.forRoot)

# App
PORT=3001
NODE_ENV=development

# LLM — Groq (usado de fato pelo código: ai.service.ts, rag.service.ts, inventory.service.ts)
GROQ_API_KEY=your_groq_api_key_here

# Embeddings — Hugging Face (rag.service.ts)
HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# WhatsApp Cloud API (Meta)
WHATSAPP_TOKEN=your_whatsapp_token_here
WHATSAPP_PHONE_ID=your_phone_id_here
WHATSAPP_VERIFY_TOKEN=your_verify_token_here
```

### 9.4 Preparando o banco
```bash
cd apps/api
yarn install
yarn prisma:generate
yarn prisma:migrate          # aplica as migrations existentes

# habilitar pgvector e a coluna de embedding (fora do fluxo normal de migration — ver seção 10)
npx ts-node prisma/enable-pgvector.ts
npx ts-node prisma/add-embedding.ts

# seeds (opcional)
npx ts-node prisma/seed.ts
npx ts-node prisma/seed-produtos.ts
npx ts-node prisma/seed-estoque.ts
npx ts-node prisma/seed-conhecimento.ts
```

### 9.5 Rodando em desenvolvimento
```bash
# a partir da raiz do monorepo
yarn dev:api     # API em http://localhost:3001 (docs em /docs)
yarn dev:web     # Web em http://localhost:3000
```

### 9.6 Testando o pipeline ponta a ponta sem WhatsApp real
```bash
cd apps/api
bash test-pipeline.sh
# ou diretamente:
curl -X POST http://localhost:3001/api/test/mensagem \
  -H "Content-Type: application/json" \
  -d '{"telefone":"5511999999999","mensagem":"tem pastilha de freio para Civic 2018?"}'
```

---

## 10. Inconsistências Conhecidas / Dívida Técnica

Estas divergências foram encontradas comparando código, schema, configs e scripts. Recomenda-se resolvê-las antes de qualquer scale-up sério ou onboarding de novos desenvolvedores.

1. **Variável de ambiente de IA divergente**: `apps/api/.env.example` define `GROK_API_KEY`/`GROK_MODEL`, mas o código (`ai.service.ts`, `rag.service.ts`, `inventory.service.ts`) usa `process.env.GROQ_API_KEY` (Groq, não "Grok"). Além disso, `render.yaml` declara `ANTHROPIC_API_KEY`, que **não é usada em nenhum lugar do código atual**. Isso pode causar falha silenciosa em produção se alguém confiar apenas no `.env.example`.
2. **`HUGGINGFACE_API_KEY` não está documentada** em nenhum `.env.example`, mas é obrigatória para o RAG funcionar (`RagService` instancia `HfInference` com essa variável).
3. **Redis não sobe via `docker-compose.yml`** — apenas a UI `redis-commander` está definida, assumindo um Redis já disponível em `host.docker.internal:6379`. Times novos vão precisar subir Redis manualmente.
4. **`apps/web/.env.example` e `apps/worker/.env.example` estão vazios.** O frontend depende de `NEXT_PUBLIC_API_URL` (usado em `page.tsx` e `next.config.js`), que não está documentado em nenhum lugar.
5. **`apps/worker` não tem código-fonte** — só o `.env.example` vazio. A fila Bull/Redis é hoje processada dentro do próprio processo da API (`HandoffProcessor` está registrado em `HandoffModule`, não em um worker isolado). Se a intenção original era ter um worker separado (nome sugere isso), isso ainda não foi implementado — hoje é um monólito com fila embutida.
6. **`Pedido`/`ItemPedido` existem no schema mas não há controller/service que os popule.** O "pedido" hoje vive dentro do `contexto` JSON da `Conversa` (campo `carrinho`) e só vira registro estruturado quando um humano assume via handoff. Ou seja, o funil de vendas de fato **não persiste pedidos como entidade relacional** — todo o histórico de pedido fica solto em JSON.
7. **`schema.prisma` tem `EstadoConversa` com valores duplicados** (`AGUARDANDO_HUMANO` e `FINALIZADA` aparecem tanto no bloco antigo quanto no bloco novo do enum). Isso funciona no Postgres (enums permitem duplicata textual seria erro, na verdade — **precisa ser validado/corrigido antes da próxima migration**, pois `CREATE TYPE` com valor duplicado causa erro de migration).
8. **A coluna `embedding` (pgvector) não está em nenhuma migration versionada** — foi adicionada via script avulso (`add-embedding.ts`) rodado manualmente. Isso quebra a reprodutibilidade do banco em um ambiente novo só com `prisma migrate deploy`; é necessário rodar os scripts avulsos na ordem certa (`enable-pgvector.ts` → migrations → `add-embedding.ts`).
9. **`StateMachineService` existe mas não é usado** pelo `ConversasService`/`WorkflowEngine` — a transição de estado real acontece dentro de cada `Workflow`. Ou seja, há duas implementações de máquina de estados coexistindo, uma delas morta (dead code) ou não integrada.
10. **Arquivos duplicados/soltos na raiz do repositório**: `page.tsx`, `handoff.controller.ts`, `handoff.service.ts`, `test-pipeline.sh` existem tanto na raiz quanto dentro de `apps/`. A comparação mostra que são **versões ligeiramente diferentes/mais antigas** dos arquivos reais usados pelo build. O `INSTALAR.ps1` (588 linhas) é um script "cole blocos no PowerShell" que parece ser um histórico de patches aplicados manualmente em produção — não faz parte do pipeline de build e deveria ser removido do controle de versão principal (ou movido para uma pasta `docs/patches-historicos/`).
11. **Nenhuma autenticação/autorização** nos endpoints administrativos e de handoff (`/api/admin/metricas`, `/api/handoff/*`) — qualquer pessoa com a URL pode assumir atendimentos, ver métricas ou responder clientes em nome da loja.
12. **`vendedorId` é uma string livre** vinda do corpo da requisição (`POST /api/handoff/:id/assumir`), sem vínculo com uma tabela de usuários/vendedores — não há cadastro de vendedores no schema.
13. **`isTeste = telefone.startsWith('5500')`** em `conversas.service.ts` é uma regra hardcoded para pular a etapa de onboarding em testes — deve ser substituída por uma flag de ambiente antes de ir para produção, para não haver ambiguidade com números reais que comecem com 5500.
14. **`ticketMedio` (R$ 350) e `minutosEconomizadosPorLead` (5 min) são constantes fixas** no `AdminController` — deveriam ser configuráveis (env var ou tabela de configuração) por serem específicas do negócio e sujeitas a mudar.
15. **`files.zip` (10,8 KB) versionado na raiz** sem descrição — recomenda-se documentar o conteúdo ou remover do repositório.

---

## 11. Deploy e Infraestrutura

### 11.1 API — Render (`render.yaml`)
```yaml
buildCommand: npm install && npx prisma generate && npm run build
startCommand: npx prisma migrate deploy && node dist/main
```
- Roda migrations automaticamente no start (`migrate deploy`) — **atenção ao item 8 da seção 10**: as migrations versionadas sozinhas não recriam a extensão `vector` nem a coluna `embedding`; isso precisa ser adicionado ao pipeline de deploy (idealmente como uma migration Prisma real, não script avulso).
- Variáveis marcadas `sync: false` (`DATABASE_URL`, `REDIS_URL`, e a hoje-não-usada `ANTHROPIC_API_KEY`) devem ser configuradas manualmente no painel do Render. **Faltam no `render.yaml`**: `GROQ_API_KEY`, `HUGGINGFACE_API_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` — precisam ser adicionadas manualmente também.
- `keep-alive.js` faz ping em `/health` a cada 14 minutos — típico workaround para o "cold start" do plano gratuito do Render (que hiberna serviços web inativos). Deve rodar como processo separado (ex.: outro serviço agendado, ou removido se o plano pago for usado).

### 11.2 Web — Vercel (`vercel.json` + `next.config.js`)
- Deploy padrão Next.js.
- Necessário configurar `NEXT_PUBLIC_API_URL` apontando para a URL pública da API em produção.
- `next.config.js` faz rewrite de `/api/*` para a API — permite que o frontend chame `/api/...` relativo, evitando CORS no client (a API já tem `app.enableCors()` habilitado de qualquer forma).

### 11.3 Banco de dados
- Local: Postgres 16 via Docker, porta **5433** (não a padrão 5432 — evita conflito com instalações locais).
- Produção: qualquer Postgres gerenciado com suporte à extensão `pgvector` (ex.: Supabase, Neon com pgvector, RDS com extensão habilitada, Render Postgres).

### 11.4 Fila / Redis
- Produção: Redis gerenciado (ex.: Upstash, Redis Cloud, ElastiCache) com suporte a TLS — o `app.module.ts` já trata `rediss://` habilitando TLS automaticamente.

---

## 12. Escalabilidade

Pontos fortes do design atual:
- **Fila assíncrona (Bull/Redis)** já desacopla a criação do handoff do processamento de notificação/SLA — pode escalar workers horizontalmente sem mudança de código, desde que se separe o processor da API (ver item 5 da seção 10).
- **SSE em vez de polling** no dashboard reduz carga no backend com múltiplos vendedores conectados simultaneamente.
- **Embeddings gerados localmente** (Transformers.js) evitam depender de rate limit de API externa para a etapa mais chamada do RAG.

Recomendações para crescer com segurança:

| Gargalo potencial | Recomendação |
|---|---|
| API monolítica processa webhook, IA, RAG e fila no mesmo processo | Extrair `HandoffProcessor` (e futuros processors) para o app `worker` já previsto na estrutura de pastas, escalando API e worker independentemente |
| Deduplicação de mensagens em memória (`Set`/`Map` no `WhatsappController`) | Não sobrevive a múltiplas instâncias/réplicas da API nem a restarts — migrar para Redis (`SETNX` com TTL) antes de rodar mais de 1 réplica |
| Rate limit por telefone em memória (mesmo problema acima) | Idem — mover para Redis para funcionar com múltiplas réplicas |
| Groq (LLM) é chamado em cada mensagem para classificar intenção | Monitorar rate limits do provedor; considerar cache de classificação para mensagens muito repetidas (ex. "oi", "tchau") |
| Busca de produtos usa `contains`/`ILIKE` sem índice full-text | Para catálogos grandes, considerar índice `GIN`/`pg_trgm` em `nome`/`aplicacao`, ou unificar com a busca vetorial já existente |
| Busca vetorial sem índice `ivfflat`/`hnsw` no pgvector (não aparece na migration) | Criar índice apropriado (`CREATE INDEX ... USING ivfflat (embedding vector_cosine_ops)`) conforme a base de conhecimento crescer |
| `Pedido` não é persistido estruturadamente (item 6, seção 10) | Necessário antes de qualquer relatório financeiro sério ou integração com ERP/faturamento |
| Nenhuma autenticação (item 11, seção 10) | Bloqueador para multi-loja / multi-tenant — implementar antes de escalar para mais de um cliente/loja |

---

## 13. Manutenção e Sustentação (Runbook)

### 13.1 Checklist de saúde do sistema
```bash
curl https://<sua-api>/api/health                      # deve retornar {"status":"ok",...}
curl https://<sua-api>/api/handoff/pendentes            # fila de atendimento humano
curl https://<sua-api>/api/rag/perguntas-sem-resposta   # perguntas não resolvidas pelo bot
```

### 13.2 Tarefas recorrentes de curadoria
- Revisar `PerguntaSemResposta` periodicamente e resolvê-las via `PATCH /api/rag/perguntas-sem-resposta/:id/resolver` — isso alimenta diretamente a qualidade do RAG.
- Monitorar `LogConversa` do tipo `SLA_VIOLADO` para identificar horários/dias com falta de cobertura de vendedores.

### 13.3 Adicionando um novo workflow (novo `intent`)
1. Criar `src/modules/workflows/<nome>.workflow.ts` implementando a interface `Workflow` (`nome`, `intents: string[]`, `executar(ctx, prisma)`).
2. Registrar no `WorkflowsModule` (`providers`) e injetar/chamar `workflowEngine.registrar(...)` (hoje isso é feito manualmente — verificar onde os workflows existentes se registram, tipicamente no `onModuleInit` do módulo ou no `WorkflowEngine`).
3. Adicionar o novo `intent` na lista de intents possíveis do prompt em `AiService.classificarIntencao`, com exemplos claros (o modelo depende inteiramente de few-shot bem escrito).

### 13.4 Alterando o schema do banco
```bash
cd apps/api
# editar prisma/schema.prisma
npx prisma migrate dev --name <descricao_da_mudanca>
```
> Antes de rodar em produção, corrigir o item 7 da seção 10 (enum duplicado) e considerar formalizar `enable-pgvector.ts`/`add-embedding.ts` como migrations reais para reprodutibilidade.

### 13.5 Rotação de credenciais
- `WHATSAPP_TOKEN` da Meta Cloud API expira periodicamente (tokens de sistema de longa duração ainda assim precisam ser rotacionados por política de segurança) — atualizar no painel do Render sem downtime (`sync: false` permite update sem novo deploy).
- `GROQ_API_KEY` / `HUGGINGFACE_API_KEY` — rotacionar conforme política interna; ambas usadas em runtime, sem cache local do valor além da instância do serviço.

### 13.6 Limpeza de dados / arquivos legados
- Recomenda-se, em um momento de manutenção planejada: remover os arquivos duplicados da raiz (`page.tsx`, `handoff.controller.ts`, `handoff.service.ts`, `test-pipeline.sh` da raiz), arquivar ou remover `INSTALAR.ps1` e `files.zip`, e mover scripts avulsos do Prisma (`check-*.ts`, `fix-*.ts`, `reset-db.ts`, `reset060.js`) para uma pasta `scripts/manutencao/` com um README explicando quando cada um deve ser usado.

---

## 14. Segurança

Estado atual (a partir do código):
- **Sem autenticação** em nenhum endpoint — inclusive os que permitem enviar mensagens em nome da loja (`/api/handoff/:id/mensagem`) e ver métricas de negócio (`/api/admin/metricas`).
- **Webhook do WhatsApp** validado apenas pelo `hub.verify_token` na etapa de *subscribe* (GET) — o `POST` que recebe mensagens **não valida a assinatura `X-Hub-Signature-256`** enviada pela Meta, o que permitiria, em tese, que qualquer requisição forjada para essa rota fosse processada como se viesse do WhatsApp.
- **CORS totalmente aberto** (`app.enableCors()` sem opções — libera qualquer origem).
- **LGPD**: há tratamento explícito de consentimento de marketing no fluxo de onboarding (campo `aceitaMarketing`, `consentimentoEm`, `consentimentoOrigem`), o que é positivo, mas não há endpoint de exclusão/portabilidade de dados do titular implementado no código revisado.
- **Segredos**: todas as chaves de API (`GROQ_API_KEY`, `HUGGINGFACE_API_KEY`, `WHATSAPP_TOKEN`) são lidas via variável de ambiente — correto — mas não há gestão de secrets (ex.: rotação automática, vault) além do painel do provedor de hospedagem.

Recomendações mínimas antes de produção com clientes reais:
1. Validar a assinatura do webhook do WhatsApp (`X-Hub-Signature-256` com `WEBHOOK_SECRET`, que já está previsto no `.env.example` mas não é usado no código).
2. Adicionar autenticação (JWT ou sessão) para todas as rotas de `handoff` e `admin`, associadas a uma tabela real de vendedores/usuários.
3. Restringir CORS às origens conhecidas (domínio do dashboard).
4. Implementar rota de exclusão de dados do cliente (LGPD, direito ao esquecimento).
5. Adicionar rate limiting em nível de API (ex. `@nestjs/throttler`) além do rate limit ad-hoc já existente para o WhatsApp.

---

## 15. Observabilidade e Monitoramento

Estado atual:
- Logging estruturado via `Logger` do NestJS em praticamente todos os serviços, com prefixos por contexto (`[Conversas]`, `[Handoff]`, `[SLA]`, `[RAG]`, `[Inatividade]`) — bom ponto de partida para grep/alertas, mas **não há integração com uma ferramenta de log centralizado** (ex. Datadog, Grafana Loki, CloudWatch) no código.
- `LogConversa` funciona como uma trilha de auditoria de negócio no próprio banco (por conversa), útil para reconstruir o que aconteceu em um atendimento específico.
- `/api/health` existe mas retorna apenas status estático — não verifica conectividade real com Postgres/Redis/Groq.

Recomendações:
1. Evoluir `/api/health` para um health-check profundo (checar `$queryRaw` no Prisma e `ping` no Redis), retornando 503 se alguma dependência crítica estiver fora.
2. Adicionar métricas de aplicação (ex. Prometheus + `@willsoto/nestjs-prometheus`): latência de resposta do LLM, taxa de handoff automático, taxa de SLA violado, tempo médio de resposta do RAG.
3. Configurar alertas para: fila `handoff` com jobs falhando repetidamente, taxa de `SEM_RESPOSTA` acima de um limiar, erro de conexão com WhatsApp (`enviarMensagem` lançando exceção).
4. Centralizar logs (o `Logger` do Nest já suporta transports customizados) em produção.

---

## 16. Roadmap Técnico Recomendado

Ordem sugerida de prioridade para amadurecer o produto de MVP para produção sustentável:

1. **Corrigir inconsistências de configuração** (seção 10, itens 1–4) — evita incidentes de "funciona na minha máquina, quebra em produção".
2. **Formalizar migrations do pgvector** (item 8) — hoje o setup de um ambiente novo depende de passos manuais fora do Prisma.
3. **Autenticação/autorização** nas rotas administrativas e de handoff (seção 14) — bloqueador de segurança mais crítico.
4. **Validação de assinatura do webhook do WhatsApp** — segundo bloqueador de segurança mais crítico.
5. **Mover deduplicação/rate-limit do WhatsApp de memória para Redis** — pré-requisito para rodar mais de uma réplica da API.
6. **Extrair o `worker`** real (hoje só existe a pasta/env vazios) para separar processamento de fila da API HTTP.
7. **Persistir `Pedido`/`ItemPedido`** de fato, em vez de manter o carrinho apenas no `contexto` JSON.
8. **Resolver a duplicação de máquina de estados** (`StateMachineService` morto vs. lógica embutida nos workflows).
9. **Limpeza de repositório** (arquivos duplicados na raiz, `INSTALAR.ps1`, `files.zip`) para reduzir ruído para novos desenvolvedores.
10. **Observabilidade** (health-check profundo, métricas, alertas) antes de qualquer aumento relevante de volume de conversas.

---

*Documento gerado por leitura direta do código-fonte (clone completo do branch `main`). Recomenda-se revisão por um responsável técnico do time antes de tratá-lo como fonte oficial de verdade, e atualização a cada mudança estrutural relevante no repositório.*
