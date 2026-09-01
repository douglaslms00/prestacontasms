import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { brl, dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios financeiros | Prestação de Contas" },
      {
        name: "description",
        content:
          "Gráficos de verbas liberadas por mês, saldo de cada funcionário e histórico de prestações aprovadas.",
      },
      { property: "og:title", content: "Relatórios financeiros" },
      {
        property: "og:description",
        content: "Acompanhe verbas liberadas, saldos por funcionário e prestações aprovadas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Relatorios,
});

type Row = {
  id: string;
  title: string;
  amount: number;
  issued_at: string;
  status: string;
  decision: string | null;
  reviewed_at: string | null;
  employee_id: string;
  expenses: { amount: number }[];
  advance_topups: { amount: number; issued_at: string }[];
};

const COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#f59e0b", "#a855f7", "#ef4444"];

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${m}/${y.slice(2)}`;
}

function Relatorios() {
  const { user } = useSession();

  const advances = useQuery({
    queryKey: ["advances-report"],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("advances")
        .select(
          "id, title, amount, issued_at, status, decision, reviewed_at, employee_id, expenses(amount), advance_topups(amount, issued_at)",
        )
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const people = useQuery({
    queryKey: ["profiles"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameOf = (id: string) => {
    const p = people.data?.find((x) => x.id === id);
    return p?.full_name?.trim() || p?.email || "Funcionário";
  };

  const rows = advances.data ?? [];

  const totals = useMemo(() => {
    let liberado = 0;
    let gasto = 0;
    let aprovadas = 0;
    for (const a of rows) {
      liberado += Number(a.amount) + a.advance_topups.reduce((s, t) => s + Number(t.amount), 0);
      gasto += a.expenses.reduce((s, e) => s + Number(e.amount), 0);
      if (a.status === "fechado" && a.decision !== "rejeitado") aprovadas += 1;
    }
    return { liberado, gasto, saldo: liberado - gasto, aprovadas };
  }, [rows]);

  const porMes = useMemo(() => {
    const map = new Map<string, { mes: string; adiantamentos: number; verbas: number }>();
    const bump = (iso: string, field: "adiantamentos" | "verbas", value: number) => {
      const k = monthKey(iso);
      const cur = map.get(k) ?? { mes: k, adiantamentos: 0, verbas: 0 };
      cur[field] += value;
      map.set(k, cur);
    };
    for (const a of rows) {
      bump(a.issued_at, "adiantamentos", Number(a.amount));
      for (const t of a.advance_topups) bump(t.issued_at, "verbas", Number(t.amount));
    }
    return [...map.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-12)
      .map((m) => ({ ...m, mes: monthLabel(m.mes) }));
  }, [rows]);

  const porFuncionario = useMemo(() => {
    const map = new Map<string, { nome: string; liberado: number; gasto: number; saldo: number }>();
    for (const a of rows) {
      const liberado = Number(a.amount) + a.advance_topups.reduce((s, t) => s + Number(t.amount), 0);
      const gasto = a.expenses.reduce((s, e) => s + Number(e.amount), 0);
      const cur = map.get(a.employee_id) ?? {
        nome: nameOf(a.employee_id),
        liberado: 0,
        gasto: 0,
        saldo: 0,
      };
      cur.nome = nameOf(a.employee_id);
      cur.liberado += liberado;
      cur.gasto += gasto;
      cur.saldo = cur.liberado - cur.gasto;
      map.set(a.employee_id, cur);
    }
    return [...map.values()].sort((a, b) => b.liberado - a.liberado);
  }, [rows, people.data]);

  const aprovadas = useMemo(
    () =>
      rows
        .filter((a) => a.status === "fechado" && a.decision !== "rejeitado")
        .sort((a, b) => (a.reviewed_at ?? "").localeCompare(b.reviewed_at ?? "")),
    [rows],
  );

  const historico = useMemo(() => {
    const map = new Map<string, { mes: string; prestacoes: number; valor: number }>();
    for (const a of aprovadas) {
      const k = monthKey((a.reviewed_at ?? a.issued_at).slice(0, 10));
      const cur = map.get(k) ?? { mes: k, prestacoes: 0, valor: 0 };
      cur.prestacoes += 1;
      cur.valor += a.expenses.reduce((s, e) => s + Number(e.amount), 0);
      map.set(k, cur);
    }
    return [...map.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-12)
      .map((m) => ({ ...m, mes: monthLabel(m.mes) }));
  }, [aprovadas]);

  const money = (v: number) => brl(Number(v));

  return (
    <AppShell subtitle="Relatórios">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verbas liberadas, saldos por funcionário e histórico de prestações aprovadas.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/gestao">Ir para a gestão</Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total liberado", value: money(totals.liberado) },
          { label: "Total gasto", value: money(totals.gasto) },
          { label: "Saldo em aberto", value: money(totals.saldo) },
          { label: "Prestações aprovadas", value: String(totals.aprovadas) },
        ].map((k) => (
          <div key={k.label} className="surface p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-1 font-display text-xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      {advances.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando dados...</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Ainda não há dados para exibir.</p>
      ) : (
        <div className="mt-6 grid gap-6">
          <section className="surface p-4 sm:p-6">
            <h2 className="font-semibold">Verbas liberadas por mês</h2>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porMes}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" fontSize={12} />
                  <YAxis fontSize={12} width={80} tickFormatter={(v) => money(Number(v))} />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Legend />
                  <Bar dataKey="adiantamentos" name="Adiantamentos" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="verbas" name="Verbas extras" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="surface p-4 sm:p-6">
            <h2 className="font-semibold">Saldo por funcionário</h2>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porFuncionario} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" fontSize={12} tickFormatter={(v) => money(Number(v))} />
                  <YAxis type="category" dataKey="nome" width={140} fontSize={12} />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Bar dataKey="saldo" name="Saldo" radius={[0, 4, 4, 0]}>
                    {porFuncionario.map((p, i) => (
                      <Cell key={p.nome} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2">Funcionário</th>
                    <th className="py-2">Liberado</th>
                    <th className="py-2">Gasto</th>
                    <th className="py-2">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {porFuncionario.map((p) => (
                    <tr key={p.nome}>
                      <td className="py-2">{p.nome}</td>
                      <td className="py-2">{money(p.liberado)}</td>
                      <td className="py-2">{money(p.gasto)}</td>
                      <td className="py-2 font-medium">{money(p.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface p-4 sm:p-6">
            <h2 className="font-semibold">Histórico de prestações aprovadas</h2>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historico}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" fontSize={12} />
                  <YAxis fontSize={12} width={80} tickFormatter={(v) => money(Number(v))} />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Line
                    type="monotone"
                    dataKey="valor"
                    name="Valor prestado"
                    stroke={COLORS[0]}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-4 divide-y">
              {aprovadas
                .slice()
                .reverse()
                .slice(0, 10)
                .map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <Link
                        to="/adiantamento/$id"
                        params={{ id: a.id }}
                        className="font-medium hover:underline"
                      >
                        {a.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {nameOf(a.employee_id)} ·{" "}
                        {a.reviewed_at
                          ? new Date(a.reviewed_at).toLocaleDateString("pt-BR")
                          : dateBR(a.issued_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {money(a.expenses.reduce((s, e) => s + Number(e.amount), 0))}
                      </Badge>
                    </div>
                  </li>
                ))}
              {aprovadas.length === 0 ? (
                <li className="py-3 text-sm text-muted-foreground">
                  Nenhuma prestação aprovada ainda.
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      )}
    </AppShell>
  );
}
