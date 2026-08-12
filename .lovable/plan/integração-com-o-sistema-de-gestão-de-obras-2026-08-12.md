# Integração com o sistema de Gestão de Obras

Conectar a Prestação de Contas ao sistema em `https://gestaoobraspro.lovable.app`, com botão de acesso rápido, importação de obras e envio da prestação aprovada de volta para a obra.

## Situação atual verificada

O endereço `https://gestaoobraspro.lovable.app` responde normalmente, mas não existe hoje nenhum endpoint público de API nele (`/api/public/obras` retorna 404). Ou seja: a troca de dados só funciona depois que o sistema de obras publicar dois endpoints. Este plano entrega tudo do lado da Prestação de Contas e deixa o contrato pronto para o outro sistema.

## O que será construído aqui

**1. Nova permissão "Integração com obras"**
- Nova permissão no módulo de Acessos, que controla quem vê o botão e quem pode sincronizar obras.

**2. Botão de acesso rápido**
- Botão "Gestão de Obras" no topo (AppShell), visível só para quem tem a nova permissão, abrindo o sistema em nova aba.

**3. Vínculo obra ↔ adiantamento**
- Tabela local de obras sincronizadas (código externo, nome, cliente, status).
- Botão "Sincronizar obras" na tela de Acessos, que busca a lista no sistema de obras.
- Campo "Obra" no formulário de novo adiantamento e exibição da obra no painel, no detalhe e no PDF.

**4. Envio da prestação aprovada**
- Ao aprovar uma prestação, os totais (liberado, gasto, saldo a devolver, lista de despesas) são enviados para o sistema de obras vinculado.
- Registro de cada envio com data, resultado e mensagem de erro, com botão "Reenviar" caso falhe.

## O que o sistema de obras precisa expor

Peço que sejam criados lá dois endpoints públicos protegidos por chave:

```text
GET  /api/public/obras
  header: x-api-key
  resposta: [{ id, codigo, nome, cliente, status }]

POST /api/public/prestacoes
  header: x-api-key
  corpo: { obra_id, adiantamento_id, titulo, funcionario,
           total_liberado, total_gasto, saldo, aprovado_em,
           despesas: [{ descricao, categoria, valor, data }] }
```

A chave de acesso será guardada como segredo aqui (`OBRAS_API_KEY`) e usada apenas no servidor — nunca no navegador.

## Detalhes técnicos

- Migração: enum `app_permission` ganha `integrar_obras`; novas tabelas `obras` (espelho local, escrita só por integração/admin) e `obra_sync_logs`; coluna `obra_id` em `advances`. Todas com GRANT + RLS (leitura para autenticados, escrita restrita à permissão).
- `src/lib/obras.functions.ts` com `createServerFn` + `requireSupabaseAuth`: `syncObras` (GET na API externa, upsert local) e `pushPrestacao` (POST). `OBRAS_API_KEY` e a URL base lidas com `process.env` dentro do handler.
- `usePermissions` já suporta a nova permissão automaticamente; UI condicional em `AppShell`, `painel.tsx`, `adiantamento.$id.tsx` e `acessos.tsx`.
- Enquanto os endpoints não existirem no outro sistema, a sincronização mostra aviso claro ("integração indisponível") em vez de quebrar a tela.

## Ordem de execução

1. Migração do banco (permissão, obras, vínculo, logs).
2. Segredo `OBRAS_API_KEY` + funções de servidor da integração.
3. Botão de acesso, seleção de obra e envio na aprovação.
