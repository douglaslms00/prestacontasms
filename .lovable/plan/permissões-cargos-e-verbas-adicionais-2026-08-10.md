# Permissões, cargos e verbas adicionais

Dois módulos novos: um sistema de cargos com permissões configuráveis, e a possibilidade de o gestor injetar verbas extras em adiantamentos ativos.

## 1. Cargos e permissões

Hoje só existem dois papéis fixos (admin e funcionário). Passa a existir:

- **Cargos personalizados** criados pelo gestor (ex.: "Financeiro", "Supervisor de obra"), com nome e descrição.
- **Permissões** marcadas por cargo, a partir de uma lista fixa do sistema:
  - criar adiantamentos
  - adicionar verbas em adiantamentos
  - aprovar/rejeitar prestações
  - ver todos os adiantamentos (não só os próprios)
  - lançar/editar despesas
  - gerenciar cargos e usuários
- **Atribuição**: cada usuário pode receber um ou mais cargos, numa tela de gestão de usuários.
- Admin continua com acesso total, independentemente de cargo (evita travar o sistema).

Nova página **Cargos e permissões** (acessível a quem tem "gerenciar cargos e usuários" ou é admin), com:
- lista de cargos, criar/editar/excluir;
- grade de permissões por cargo (checkboxes);
- lista de usuários com os cargos atribuídos e seletor para adicionar/remover.

As telas existentes (painel e detalhe do adiantamento) passam a mostrar/ocultar botões conforme as permissões, no lugar do teste "é admin?" atual.

## 2. Verbas adicionais nos adiantamentos ativos

- No detalhe do adiantamento, se o adiantamento estiver **aberto** (ativo) e o usuário tiver a permissão de adicionar verba, aparece um formulário: valor, data e observação.
- Cada verba fica registrada num histórico (quem lançou, quando, quanto, observação), visível na página do adiantamento.
- O **total liberado** passa a ser o valor inicial + soma das verbas; saldo e valor a prestar são recalculados em todos os lugares (painel, detalhe e relatório PDF).
- O PDF ganha uma seção listando as verbas adicionais.

## Detalhes técnicos

Migração:
- `app_permission` (enum) com as permissões acima.
- `cargos` (nome, descrição), `cargo_permissions` (cargo_id, permission), `user_cargos` (user_id, cargo_id) — com GRANTs, RLS e políticas: leitura para autenticados dos próprios cargos e leitura ampla para quem gerencia; escrita apenas para admin ou quem tem `gerenciar_acessos`.
- Função security definer `has_permission(_user_id uuid, _permission app_permission)` que retorna verdadeiro para admin ou para quem tem cargo com a permissão; usada nas policies (evita recursão).
- `advance_topups` (advance_id, amount, note, issued_at, created_by) com GRANT/RLS: leitura pelo dono do adiantamento e por quem vê todos; inserção só com permissão de adicionar verba e apenas quando `status = 'aberto'`.
- Ajuste em `enforce_advance_update` e nas policies de `advances`/`expenses` para usarem `has_permission` em vez de somente `has_role('admin')`.

Frontend:
- `usePermissions()` em `src/hooks/useAuth.ts` (consulta única de permissões efetivas do usuário).
- Nova rota `src/routes/_authenticated/acessos.tsx` + link no `AppShell`.
- `adiantamento.$id.tsx`: bloco de verbas + histórico; totais recalculados.
- `painel.tsx`: totais somando verbas; botões condicionados a permissões.
- `src/lib/report.ts`: seção de verbas no PDF.
