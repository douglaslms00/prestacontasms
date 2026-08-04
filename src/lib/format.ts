export const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? 0);

export const dateBR = (value?: string | null) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR") : "-";

export const statusLabel: Record<string, string> = {
  aberto: "Aberto",
  em_analise: "Em análise",
  fechado: "Fechado",
};
