import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Paperclip, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/hooks/useAuth";
import { brl, dateBR, statusLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/adiantamento/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do adiantamento | Prestação de Contas" },
      {
        name: "description",
        content:
          "Lance despesas com cupom fiscal anexado e acompanhe o saldo e o valor a ser prestado deste adiantamento.",
      },
      { property: "og:title", content: "Detalhe do adiantamento" },
      {
        property: "og:description",
        content: "Despesas, cupons fiscais e saldo do adiantamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Detalhe,
});

const CATEGORIES = ["Alimentação", "Transporte", "Hospedagem", "Combustível", "Material", "Outros"];

const expenseSchema = z.object({
  description: z.string().trim().min(2, "Descreva a despesa").max(200),
  category: z.string().min(1),
  amount: z.number().positive("Valor deve ser maior que zero"),
  spent_at: z.string().min(1, "Informe a data"),
});

function Detalhe() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin(user?.id);
  const queryClient = useQueryClient();

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [amount, setAmount] = useState("");
  const [spentAt, setSpentAt] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const advance = useQuery({
    queryKey: ["advance", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advances")
        .select("id, title, description, amount, issued_at, status, employee_id")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const expenses = useQuery({
    queryKey: ["expenses", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, description, category, amount, spent_at, receipt_path, user_id")
        .eq("advance_id", id)
        .order("spent_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = expenses.data ?? [];
  const liberado = Number(advance.data?.amount ?? 0);
  const gasto = list.reduce((s, e) => s + Number(e.amount), 0);
  const saldo = liberado - gasto;
  const isOwner = advance.data?.employee_id === user?.id;
  const isOpen = advance.data?.status === "aberto";

  const addExpense = async () => {
    const parsed = expenseSchema.safeParse({
      description,
      category,
      amount: Number(amount),
      spent_at: spentAt,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setSaving(true);
    try {
      let receiptPath: string | null = null;
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10MB");
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user!.id}/${id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("cupons").upload(path, file);
        if (upErr) throw upErr;
        receiptPath = path;
      }
      const { error } = await supabase.from("expenses").insert({
        advance_id: id,
        user_id: user!.id,
        description: parsed.data.description,
        category: parsed.data.category,
        amount: parsed.data.amount,
        spent_at: parsed.data.spent_at,
        receipt_path: receiptPath,
      });
      if (error) throw error;
      toast.success("Despesa lançada");
      setDescription("");
      setAmount("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["expenses", id] });
      queryClient.invalidateQueries({ queryKey: ["advances"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível lançar");
    } finally {
      setSaving(false);
    }
  };

  const remove = useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", id] });
      queryClient.invalidateQueries({ queryKey: ["advances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (status: "aberto" | "em_analise" | "fechado") => {
      const { error } = await supabase.from("advances").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Situação atualizada");
      queryClient.invalidateQueries({ queryKey: ["advance", id] });
      queryClient.invalidateQueries({ queryKey: ["advances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from("cupons").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Não foi possível abrir o cupom");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <AppShell subtitle={advance.data?.title ?? ""}>
      <Link to="/painel" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="mr-1 size-4" /> Voltar
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{advance.data?.title ?? "Adiantamento"}</h1>
        {advance.data ? (
          <Badge variant={isOpen ? "default" : "secondary"}>
            {statusLabel[advance.data.status] ?? advance.data.status}
          </Badge>
        ) : null}
      </div>
      {advance.data?.description ? (
        <p className="mt-1 text-sm text-muted-foreground">{advance.data.description}</p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        Liberado em {dateBR(advance.data?.issued_at)}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Card label="Valor disponibilizado" value={brl(liberado)} />
        <Card label="Total de despesas" value={brl(gasto)} />
        <Card label="Saldo restante" value={brl(Math.max(saldo, 0))} accent />
        <Card
          label={saldo >= 0 ? "A devolver" : "A reembolsar"}
          value={brl(Math.abs(saldo))}
          accent
        />
      </div>

      {isAdmin ? (
        <div className="mt-6 flex items-center gap-3">
          <Label className="text-xs uppercase">Situação</Label>
          <Select
            value={advance.data?.status ?? "aberto"}
            onValueChange={(v) => setStatus.mutate(v as "aberto" | "em_analise" | "fechado")}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="em_analise">Em análise</SelectItem>
              <SelectItem value="fechado">Fechado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {isOwner && isOpen ? (
        <div className="surface mt-8 space-y-4 p-6">
          <h2 className="font-semibold">Lançar despesa</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Almoço com cliente"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Cupom fiscal (imagem ou PDF)</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <Button onClick={addExpense} disabled={saving}>
            {saving ? "Salvando…" : "Adicionar despesa"}
          </Button>
        </div>
      ) : null}

      <h2 className="mt-10 text-xl font-semibold">Despesas lançadas</h2>
      <div className="mt-4 space-y-3">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma despesa lançada ainda.</p>
        ) : null}
        {list.map((e) => (
          <div
            key={e.id}
            className="surface flex flex-wrap items-center justify-between gap-4 p-4"
          >
            <div>
              <p className="font-medium">{e.description}</p>
              <p className="text-xs text-muted-foreground">
                {e.category} · {dateBR(e.spent_at)}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {e.receipt_path ? (
                <Button variant="outline" size="sm" onClick={() => openReceipt(e.receipt_path!)}>
                  <Paperclip className="mr-2 size-4" /> Cupom
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Sem cupom</span>
              )}
              <span className="font-display font-semibold">{brl(Number(e.amount))}</span>
              {(isAdmin || (e.user_id === user?.id && isOpen)) && (
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(e.id)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="surface p-5">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`mt-2 font-display text-xl font-bold ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
    </div>
  );
}
