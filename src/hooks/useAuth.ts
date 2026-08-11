export const PERMISSIONS = [
  "criar_adiantamento",
  "adicionar_verba",
  "aprovar_prestacao",
  "ver_todos",
  "lancar_despesa",
  "gerenciar_acessos",
] as const;

export type AppPermission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<AppPermission, string> = {
  criar_adiantamento: "Criar adiantamentos",
  adicionar_verba: "Adicionar verbas em adiantamentos",
  aprovar_prestacao: "Aprovar ou rejeitar prestações",
  ver_todos: "Ver todos os adiantamentos",
  lancar_despesa: "Lançar e editar despesas",
  gerenciar_acessos: "Gerenciar cargos e usuários",
};
