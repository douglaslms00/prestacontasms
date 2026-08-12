import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, ArrowRight } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel de adiantamentos | Prestação de Contas" },
      {
        name: "description",
        content:
          "Acompanhe adiantamentos liberados, total gasto, saldo restante e valor a prestar por funcionário.",
      },
      { property: "og:title", content: "Painel de adiantamentos" },
      {
        property: "og:description",
        content: "Visão geral dos adiantamentos, despesas lançadas e saldo a devolver.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

type AdvanceRow = {
  id: string;
  title: string;
  amount: number;
  issued_at: string;
  status: string;
  employee_id: string;
  expenses: { amount: number }[];
  advance_topups: { amount: number }[];
};

const advanceSchema = z.object({
  title: z.string().trim().min(2, "Informe um título").max(120),
  description: z.string().trim().max(500).optional(),
  amount: z.number().positive("Valor deve ser maior que zero"),
  employee_id: z.string().uuid("Selecione o funcionário"),
  issued_at: z.string().min(1, "Informe a data"),
});

function Painel() {
  const { user } = useSession();
  const { isAdmin, can } = usePermissions(user?.id);
  const canCreate = can("criar_adiantamento");
  const canManage = canCreate || can("ver_todos") || can("aprovar_prestacao");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const advances = useQuery({
    queryKey: ["advances"],
    enabled: !!user,
    queryFn: async (): Promise<AdvanceRow[]> => {
      const { data, error } = await supabase
        .from("advances")
        .select("id, title, amount, issued_at, status, employee_id, expenses(amount), advance_topups(amount)")
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AdvanceRow[];
    },
  });

  const people = useQuery({
    queryKey: ["profiles"],
    enabled: !!canManage,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameOf = (id: string) => {
    const p = people.data?.find((x) => x.id === id);
    return p?.full_name || p?.email || (id === user?.id ? "Você" : "Funcionário");
  };

  const rows = advances.data ?? [];
  const liberadoDe = (a: AdvanceRow) =>
    Number(a.amount) + (a.advance_topups ?? []).reduce((t, v) => t + Number(v.amount), 0);
  const totalLiberado = rows.reduce((s, a) => s + liberadoDe(a), 0);
  const totalGasto = rows.reduce(
    (s, a) => s + a.expenses.reduce((t, e) => t + Number(e.amount), 0),
    0,
  );

  const create = useMutation({
    mutationFn: async (form: z.infer<typeof advanceSchema>) => {
      const { error } = await supabase.from("advances").insert({
        title: form.title,
        description: form.description ?? null,
        amount: form.amount,
        employee_id: form.employee_id,
        issued_at: form.issued_at,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adiantamento liberado");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["advances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell subtitle={isAdmin || canManage ? "Perfil gestor" : "Perfil funcionário"}>
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total liberado" value={brl(totalLiberado)} />
        <SummaryCard label="Total gasto" value={brl(totalGasto)} />
        <SummaryCard
          label="Saldo em aberto"
          value={brl(totalLiberado - totalGasto)}
          highlight
        />
      </div>

      {canCreate ? (
        <div className="mt-10">
          {open ? (
            <NewAdvanceForm
              people={people.data ?? []}
              onCancel={() => setOpen(false)}
              onSubmit={(form) => create.mutate(form)}
              pending={create.isPending}
            />
          ) : (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 size-4" /> Novo adiantamento
            </Button>
          )}
        </div>
      ) : null}

      <h2 className="mt-10 text-xl font-semibold">Adiantamentos</h2>
      <div className="mt-4 space-y-3">
        {advances.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
        {!advances.isLoading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum adiantamento por aqui ainda.</p>
        ) : null}
        {rows.map((a) => {
          const gasto = a.expenses.reduce((t, e) => t + Number(e.amount), 0);
          const liberado = liberadoDe(a);
          const saldo = liberado - gasto;
          return (
            <Link
              key={a.id}
              to="/adiantamento/$id"
              params={{ id: a.id }}
              className="surface flex flex-wrap items-center justify-between gap-4 p-5 transition-colors hover:border-primary/40"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{a.title}</p>
                  <Badge variant={a.status === "aberto" ? "default" : "secondary"}>
                    {statusLabel[a.status] ?? a.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {nameOf(a.employee_id)} · {dateBR(a.issued_at)}
                </p>
              </div>
              <div className="flex items-center gap-6 text-right">
                <Figure label="Liberado" value={brl(liberado)} />
                <Figure label="Gasto" value={brl(gasto)} />
                <Figure label="Saldo" value={brl(saldo)} accent />
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="surface p-5">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={`mt-2 font-display text-2xl font-bold ${highlight ? "text-primary" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function Figure({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase">{label}</p>
      <p className={`text-sm font-semibold ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function NewAdvanceForm({
  people,
  onCancel,
  onSubmit,
  pending,
}: {
  people: { id: string; full_name: string | null; email: string | null }[];
  onCancel: () => void;
  onSubmit: (form: z.infer<typeof advanceSchema>) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10));

  const submit = () => {
    const parsed = advanceSchema.safeParse({
      title,
      description,
      amount: Number(amount),
      employee_id: employeeId,
      issued_at: issuedAt,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    onSubmit(parsed.data);
  };

  return (
    <div className="surface space-y-4 p-6">
      <h3 className="font-semibold">Novo adiantamento</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Viagem São Paulo" />
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
                  {p.full_name || p.email || p.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Valor liberado (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending}>
          Liberar valor
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
