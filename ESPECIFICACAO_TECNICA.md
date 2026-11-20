# BABA HUMILDES — ESPECIFICAÇÃO TÉCNICA E FUNCIONAL

Este documento consolida a arquitetura, regras de negócio, diagramas de estado, schemas e contratos de dados para alimentar novos desenvolvimentos (App Mobile React Native / Flutter, APIs REST independentes e microserviços), mantendo total fidelidade aos modelos do **Baba Humildes**.

---

## 1. Visão Geral e Arquitetura

O sistema atua como o motor operacional e financeiro do baba de domingo:
- **Área Pública (Livre):** Consulta de tabelas de pontos, artilharia, assistências, cartões disciplinares, transparência de entradas/despesas, avisos oficiais e confirmação de presença com travas automáticas.
- **Área Administrativa (/admin):** Gestão de temporadas, elenco anual, súmula de partidas em tempo real, geração em lote de mensalidades, registro de despesas e comunicados.

---

## 2. Motor de Disciplina e Suspensões (State Machine)

```
[Início da Temporada]
       │
       ▼
[Partida Cronológica]
       │
       ├─► 3 Cartões Amarelos Acumulados ──► [SUSPENSÃO PENDENTE: 3 Amarelos]
       │
       ├─► 2º Cartão Amarelo no Mesmo Jogo ─► [Converte em Cartão Vermelho]
       │                                              │
       ├─► Cartão Vermelho Direto ─────────► [SUSPENSÃO PENDENTE: Vermelho]
       │                                              │
       ▼                                              ▼
[Partida Seguinte Finalizada]                [Bloqueio de Presença Ativo]
       │
       ├─► Atleta NÃO compareceu (presença = false):
       │   └──► Suspensão CUMPRIDA! Zera os 3 amarelos da punição.
       │
       └─► Atleta compareceu (jogou suspenso irregularmente):
           └──► Suspensão CONTINUA ATIVA para o próximo jogo.
```

---

## 3. Inadimplência e Tolerância de Carência

- **Regra:** Tolerância de **1 mês e 10 dias**.
- **Cálculo de Data Limite:** `Data_Atual - 1 mês - 10 dias`.
- **Efeito:** Caso o atleta possua qualquer mensalidade pendente de competência anterior ou igual ao mês limite, ele é considerado **Inadimplente**.
- **Travas:**
  1. O atleta fica bloqueado de confirmar presença pública no próximo jogo.
  2. É listado na seção de inadimplentes com opção de geração de card de cobrança via WhatsApp.
- **Isenção:** Atletas com `is_diretoria = true` são isentos de cobrança e nunca entram em inadimplência.

---

## 4. Classificação dos Times

A pontuação dos times na temporada ativa é calculada dinamicamente com base em partidas com status `Finalizada`:
- Vitória: **+3 pontos**
- Empate: **+1 ponto**
- Derrota: **0 pontos**
- **Critérios de Desempate (Ordem Decrescente):**
  1. Pontos (`pontos`)
  2. Número de Vitórias (`vitorias`)
  3. Saldo de Gols (`saldoGols = golsPro - golsContra`)
  4. Gols Pró (`golsPro`)

---

## 5. Estrutura de Arquivos de Contratos

- [schema.prisma](file:///c:/Users/deivide/Desktop/baba_humildes/contracts/schema.prisma) — Modelo Prisma oficial para geração de migrations e Client.
- [types.ts](file:///c:/Users/deivide/Desktop/baba_humildes/contracts/types.ts) — Contratos e DTOs em TypeScript para mobile e APIs.
- [schema.sql](file:///c:/Users/deivide/Desktop/baba_humildes/sql/schema.sql) — DDL PostgreSQL com RLS para Supabase ou Postgres nativo.
