import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowRight, Check, Plus, Wallet, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useAuth";
import { brl, dateBR, statusLabel } from "@/lib/format";
import { pushPrestacao } from "@/lib/obras.functions";

export const Route = createFileRoute("/_authenticated/gestao")({
  head: () => ({
    meta: [
      { title: "Gestão de adiantamentos | Prestação de Contas" },
      {
        name: "description",
        content:
          "Painel do gestor: crie adiantamentos, libere verba extra, aprove prestações e acompanhe o saldo de cada funcionário.",
      },
      { property: "og:title", content: "Gestão de adiantamentos" },
      {
        property: "og:description",
        content: "Crie adiantamentos, libere verba, aprove prestações e veja o saldo por funcionário.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Gestao,
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
  submitted_at: string | null;
  expenses: { amount: number }[];
  advance_topups: { amount: number }[];
};

const advanceSchema = z.object({
  title: z.string().trim().min(2, "Informe um título").max(120),
  description: z.string().trim().max(500).optional(),
  amount: z.number().positive("Valor deve ser maior que zero"),
  employee_id: z.string().uuid("Selecione o funcionário"),
  obra_id: z.string().uuid().optional(),
  issued_at: z.string().min(1, "Informe a data"),
});

function Gestao() {
  const { user } = useSession();
  const { isAdmin, can } = usePermissions(user?.id);
  const canCreate = can("criar_adiantamento");
  const canTopup = can("adicionar_verba");
  const canReview = can("aprovar_prestacao");
  const queryClient = useQueryClient();
  const runPush = useServerFn(pushPrestacao);

  const [openForm, setOpenForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [employeeFilter, setEmployeeFilter] = useState<string>("todos");
  const [comment, setComment] = useState<Record<string, string>>({});
  const [topup, setTopup] = useState<Record<string, string>>({});

  const advances = useQuery({
    queryKey: ["advances"],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("advances")
        .select(
          "id, title, amount, issued_at, status, employee_id, obra_id, decision, submitted_at, expenses(amount), advance_topups(amount)",
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
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const obras = useQuery({
    queryKey: ["obras"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, nome, codigo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameOf = (id: string) => {
    const p = people.data?.find((x) => x.id === id);
    return p?.full_name || p?.email || (id === user?.id ? "Você" : "Funcionário");
  };

  const rows = advances.data ?? [];
  const liberadoDe = (a: Row) =>
    Number(a.amount) + (a.advance_topups ?? []).reduce((t, v) => t + Number(v.amount), 0);
  const gastoDe = (a: Row) => (a.expenses ?? []).reduce((t, e) => t + Number(e.amount), 0);

  const filtered = rows.filter(
    (a) =>
      (statusFilter === "todos" || a.status === statusFilter) &&
      (employeeFilter === "todos" || a.employee_id === employeeFilter),
  );

  const pendentes = rows.filter((a) => a.status === "em_analise");

  const porFuncionario = useMemo(() => {
    const map = new Map<
      string,
      { id: string; liberado: number; gasto: number; abertos: number; total: number }
    >();
    for (const a of rows) {
      const cur =
        map.get(a.employee_id) ??
        { id: a.employee_id, liberado: 0, gasto: 0, abertos: 0, total: 0 };
      cur.liberado += liberadoDe(a);
      cur.gasto += gastoDe(a);
      cur.total += 1;
      if (a.status !== "fechado") cur.abertos += 1;
      map.set(a.employee_id, cur);
    }
    return [...map.values()].sort((x, y) => y.liberado - x.liberado);
  }, [rows]);

  const totalLiberado = rows.reduce((s, a) => s + liberadoDe(a), 0);
  const totalGasto = rows.reduce((s, a) => s + gastoDe(a), 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["advances"] });
    queryClient.invalidateQueries({ queryKey: ["advance"] });
  };

  const create = useMutation({
    mutationFn: async (form: z.infer<typeof advanceSchema>) => {
      const { error } = await supabase.from("advances").insert({
        title: form.title,
        description: form.description ?? null,
        amount: form.amount,
        employee_id: form.employee_id,
        obra_id: form.obra_id ?? null,
        issued_at: form.issued_at,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adiantamento liberado");
      setOpenForm(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTopup = useMutation({
    mutationFn: async (advanceId: string) => {
      const value = Number((topup[advanceId] ?? "").replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) throw new Error("Informe um valor válido");
      const { error } = await supabase.from("advance_topups").insert({
        advance_id: advanceId,
        amount: value,
        issued_at: new Date().toISOString().slice(0, 10),
        created_by: user!.id,
      });
      if (error) throw error;
      return advanceId;
    },
    onSuccess: (advanceId) => {
      toast.success("Verba adicionada");
      setTopup((s) => ({ ...s, [advanceId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["topups", advanceId] });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async (input: { advance: Row; decision: "aprovado" | "rejeitado" }) => {
      const text = (comment[input.advance.id] ?? "").trim();
      if (input.decision === "rejeitado" && !text)
        throw new Error("Explique o motivo da rejeição");
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
      toast.success("Decisão registrada");
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

  if (!isAdmin && !canCreate && !canTopup && !canReview) {
    return (
      <AppShell subtitle="Gestão">
        <div className="surface p-6">
          <h1 className="text-xl font-semibold">Área do gestor</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você não tem permissão para gerenciar adiantamentos. Fale com um administrador.
          </p>
          <Button asChild className="mt-4">
            <Link to="/painel">Ir para o painel</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell subtitle="Gestão de adiantamentos">
      <h1 className="font-display text-2xl font-semibold">Gestão</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Crie adiantamentos, libere verba extra, aprove prestações e acompanhe o saldo de cada
        funcionário.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Card label="Total liberado" value={brl(totalLiberado)} />
        <Card label="Total gasto" value={brl(totalGasto)} />
        <Card label="Saldo em aberto" value={brl(totalLiberado - totalGasto)} highlight />
        <Card label="Aguardando aprovação" value={String(pendentes.length)} />
      </div>

      {canCreate ? (
        <section className="mt-10">
          {openForm ? (
            <NewAdvanceForm
              people={people.data ?? []}
              obras={obras.data ?? []}
              pending={create.isPending}
              onCancel={() => setOpenForm(false)}
              onSubmit={(form) => create.mutate(form)}
            />
          ) : (
            <Button onClick={() => setOpenForm(true)}>
              <Plus className="mr-2 size-4" /> Novo adiantamento
            </Button>
          )}
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Prestações aguardando aprovação</h2>
        <div className="mt-4 space-y-3">
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma prestação pendente.</p>
          ) : null}
          {pendentes.map((a) => {
            const gasto = gastoDe(a);
            const liberado = liberadoDe(a);
            return (
              <div key={a.id} className="surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {nameOf(a.employee_id)} · enviado em{" "}
                      {a.submitted_at
                        ? new Date(a.submitted_at).toLocaleString("pt-BR")
                        : dateBR(a.issued_at)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p>Liberado {brl(liberado)}</p>
                    <p className="text-muted-foreground">Gasto {brl(gasto)}</p>
                    <p className="font-semibold">A prestar {brl(liberado - gasto)}</p>
                  </div>
                </div>
                {canReview ? (
                  <div className="mt-4 space-y-3">
                    <Textarea
                      placeholder="Comentário (obrigatório para rejeitar)"
                      value={comment[a.id] ?? ""}
                      onChange={(e) => setComment((s) => ({ ...s, [a.id]: e.target.value }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ advance: a, decision: "aprovado" })}
                      >
                        <Check className="mr-2 size-4" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ advance: a, decision: "rejeitado" })}
                      >
                        <X className="mr-2 size-4" /> Rejeitar
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/adiantamento/$id" params={{ id: a.id }}>
                          Ver detalhes e PDF <ArrowRight className="ml-2 size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Sem permissão para aprovar prestações.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Saldo por funcionário</h2>
        <div className="surface mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left">
              <tr>
                <th className="p-3">Funcionário</th>
                <th className="p-3">Adiantamentos</th>
                <th className="p-3">Liberado</th>
                <th className="p-3">Gasto</th>
                <th className="p-3">Saldo / a prestar</th>
              </tr>
            </thead>
            <tbody>
              {porFuncionario.length === 0 ? (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={5}>
                    Nenhum adiantamento registrado.
                  </td>
                </tr>
              ) : null}
              {porFuncionario.map((p) => (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="p-3 font-medium">{nameOf(p.id)}</td>
                  <td className="p-3">
                    {p.total} ({p.abertos} em andamento)
                  </td>
                  <td className="p-3">{brl(p.liberado)}</td>
                  <td className="p-3">{brl(p.gasto)}</td>
                  <td className="p-3 font-semibold">{brl(p.liberado - p.gasto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Todos os adiantamentos</h2>
          <div className="flex flex-wrap gap-2">
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Funcionário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os funcionários</SelectItem>
                {(people.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="em_analise">Em análise</SelectItem>
                <SelectItem value="fechado">Fechado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {advances.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : null}
          {!advances.isLoading && filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum adiantamento com esse filtro.</p>
          ) : null}
          {filtered.map((a) => {
            const liberado = liberadoDe(a);
            const gasto = gastoDe(a);
            return (
              <div key={a.id} className="surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{a.title}</p>
                      <Badge variant="secondary">
                        {statusLabel[a.status] ?? a.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {nameOf(a.employee_id)} · {dateBR(a.issued_at)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p>Liberado {brl(liberado)}</p>
                    <p className="text-muted-foreground">Gasto {brl(gasto)}</p>
                    <p className="font-semibold">Saldo {brl(liberado - gasto)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {canTopup && a.status === "aberto" ? (
                    <>
                      <Input
                        className="w-40"
                        inputMode="decimal"
                        placeholder="Verba extra (R$)"
                        value={topup[a.id] ?? ""}
                        onChange={(e) => setTopup((s) => ({ ...s, [a.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={addTopup.isPending}
                        onClick={() => addTopup.mutate(a.id)}
                      >
                        <Wallet className="mr-2 size-4" /> Liberar verba
                      </Button>
                    </>
                  ) : null}
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/adiantamento/$id" params={{ id: a.id }}>
                      Abrir <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}

function Card({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`surface p-5 ${highlight ? "border-primary/40" : ""}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

function NewAdvanceForm({
  people,
  obras,
  onCancel,
  onSubmit,
  pending,
}: {
  people: { id: string; full_name: string | null; email: string | null }[];
  obras: { id: string; nome: string; codigo: string | null }[];
  onCancel: () => void;
  onSubmit: (form: z.infer<typeof advanceSchema>) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [obraId, setObraId] = useState("");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10));

  const submit = () => {
    const parsed = advanceSchema.safeParse({
      title,
      description: description || undefined,
      amount: Number(amount.replace(",", ".")),
      employee_id: employeeId,
      obra_id: obraId || undefined,
      issued_at: issuedAt,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos");
      return;
    }
    onSubmit(parsed.data);
  };

  return (
    <div className="surface space-y-4 p-6">
      <h3 className="text-lg font-semibold">Novo adiantamento</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="g-title">Título</Label>
          <Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="g-amount">Valor liberado (R$)</Label>
          <Input
            id="g-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Funcionário</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Obra (opcional)</Label>
          <Select value={obraId} onValueChange={setObraId}>
            <SelectTrigger>
              <SelectValue placeholder="Sem obra" />
            </SelectTrigger>
            <SelectContent>
              {obras.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {[o.codigo, o.nome].filter(Boolean).join(" · ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="g-date">Data</Label>
          <Input
            id="g-date"
            type="date"
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="g-desc">Descrição</Label>
          <Textarea
            id="g-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending}>
          Liberar adiantamento
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
