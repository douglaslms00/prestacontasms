import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ClipboardCheck, Clock, X } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useAuth";
import { brl, dateBR } from "@/lib/format";
import { pushPrestacao } from "@/lib/obras.functions";

export const Route = createFileRoute("/_authenticated/aprovacoes")({
  head: () => ({
    meta: [
      { title: "Aprovações de prestações | Prestação de Contas" },
      {
        name: "description",
        content:
          "Veja as prestações pendentes de análise e as já aprovadas, com botões para aprovar ou recusar com comentário.",
      },
      { property: "og:title", content: "Aprovações de prestações" },
      {
        property: "og:description",
        content: "Fila de prestações pendentes e histórico de aprovações e recusas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Aprovacoes,
});

type Row = {
  id: string;
  title: string;
  amount: number;
  issued_at: string;
  status: string;
  employee_id: string;
  obra_id: string | null;
  decision: string | null;
  review_comment: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  expenses: { amount: number }[];
  advance_topups: { amount: number }[];
};

function Aprovacoes() {
  const { user } = useSession();
  const { isAdmin, can, isLoading } = usePermissions(user?.id);
  const canReview = isAdmin || can("aprovar_prestacao");
  const queryClient = useQueryClient();
  const runPush = useServerFn(pushPrestacao);

  const [tab, setTab] = useState<"pendentes" | "aprovadas">("pendentes");
  const [comment, setComment] = useState<Record<string, string>>({});

  const advances = useQuery({
    queryKey: ["advances"],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("advances")
        .select(
          "id, title, amount, issued_at, status, employee_id, obra_id, decision, review_comment, reviewed_at, submitted_at, expenses(amount), advance_topups(amount)",
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
    return p?.full_name || p?.email || (id === user?.id ? "Você" : "Funcionário");
  };

  const rows = advances.data ?? [];
  const liberado = (a: Row) =>
    Number(a.amount) + (a.advance_topups ?? []).reduce((t, v) => t + Number(v.amount), 0);
  const gasto = (a: Row) => (a.expenses ?? []).reduce((t, e) => t + Number(e.amount), 0);

  const pendentes = useMemo(() => rows.filter((a) => a.status === "em_analise"), [rows]);
  const decididas = useMemo(
    () => rows.filter((a) => a.status === "fechado" || a.decision),
    [rows],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["advances"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const decide = useMutation({
    mutationFn: async (input: { advance: Row; decision: "aprovado" | "rejeitado" }) => {
      const text = (comment[input.advance.id] ?? "").trim();
      if (input.decision === "rejeitado" && !text)
        throw new Error("Explique o motivo da recusa");
      const { error } = await supabase
        .from("advances")
        .update({
          status: input.decision === "aprovado" ? "fechado" : "aberto",
          decision: input.decision,
          review_comment: text || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
        })
        .eq("id", input.advance.id);
      if (error) throw error;
      return input;
    },
    onSuccess: async ({ advance, decision }) => {
      toast.success(decision === "aprovado" ? "Prestação aprovada" : "Prestação recusada");
      setComment((s) => ({ ...s, [advance.id]: "" }));
      invalidate();
      if (decision === "aprovado" && advance.obra_id) {
        try {
          const res = await runPush({ data: { advanceId: advance.id } });
          toast[res.ok ? "success" : "error"](res.message);
        } catch (e) {
          toast.error((e as Error).message);
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AppShell subtitle="Aprovações">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </AppShell>
    );
  }

  if (!canReview) {
    return (
      <AppShell subtitle="Aprovações">
        <div className="surface p-6">
          <h1 className="text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você não tem permissão para aprovar prestações.
          </p>
        </div>
      </AppShell>
    );
  }

  const list = tab === "pendentes" ? pendentes : decididas;

  return (
    <AppShell subtitle="Aprovações">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <ClipboardCheck className="size-5 text-primary" /> Aprovações
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Analise as prestações enviadas e registre a aprovação ou a recusa com comentário.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={tab === "pendentes" ? "default" : "secondary"}
          onClick={() => setTab("pendentes")}
        >
          <Clock className="mr-2 size-4" /> Pendentes ({pendentes.length})
        </Button>
        <Button
          size="sm"
          variant={tab === "aprovadas" ? "default" : "secondary"}
          onClick={() => setTab("aprovadas")}
        >
          <Check className="mr-2 size-4" /> Analisadas ({decididas.length})
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        {advances.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando prestações…</p>
        ) : null}
        {!advances.isLoading && list.length === 0 ? (
          <div className="surface p-6 text-sm text-muted-foreground">
            {tab === "pendentes"
              ? "Nenhuma prestação aguardando análise."
              : "Nenhuma prestação analisada ainda."}
          </div>
        ) : null}

        {list.map((a) => {
          const total = liberado(a);
          const usado = gasto(a);
          return (
            <div key={a.id} className="surface space-y-3 p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {nameOf(a.employee_id)} · {dateBR(a.issued_at)}
                  </p>
                </div>
                <Badge
                  variant={
                    a.decision === "rejeitado"
                      ? "destructive"
                      : a.decision === "aprovado"
                        ? "default"
                        : "secondary"
                  }
                >
                  {a.decision === "aprovado"
                    ? "Aprovada"
                    : a.decision === "rejeitado"
                      ? "Recusada"
                      : "Em análise"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Liberado</p>
                  <p className="font-medium">{brl(total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gasto</p>
                  <p className="font-medium">{brl(usado)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">A prestar</p>
                  <p className="font-medium">{brl(total - usado)}</p>
                </div>
              </div>

              {a.review_comment ? (
                <p className="rounded-md bg-secondary p-3 text-xs text-muted-foreground">
                  Comentário: {a.review_comment}
                </p>
              ) : null}

              {tab === "pendentes" ? (
                <div className="space-y-3">
                  <Textarea
                    value={comment[a.id] ?? ""}
                    onChange={(e) => setComment((s) => ({ ...s, [a.id]: e.target.value }))}
                    placeholder="Comentário (obrigatório para recusar)"
                    rows={2}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => decide.mutate({ advance: a, decision: "aprovado" })}
                      disabled={decide.isPending}
                    >
                      <Check className="mr-2 size-4" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => decide.mutate({ advance: a, decision: "rejeitado" })}
                      disabled={decide.isPending}
                    >
                      <X className="mr-2 size-4" /> Recusar
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/adiantamento/$id" params={{ id: a.id }}>
                        Ver detalhes
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/adiantamento/$id" params={{ id: a.id }}>
                    Ver detalhes
                  </Link>
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
