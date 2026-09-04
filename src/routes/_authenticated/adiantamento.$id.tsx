import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  HardHat,
  Lock,
  Pencil,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useAuth";
import { brl, dateBR, statusLabel } from "@/lib/format";
import { generateReport } from "@/lib/report";
import { readReceipt } from "@/lib/ocr.functions";
import { pushPrestacao } from "@/lib/obras.functions";


export const Route = createFileRoute("/_authenticated/adiantamento/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do adiantamento | Prestação de Contas" },
      {
        name: "description",
        content:
          "Lance despesas com cupom fiscal anexado, envie a prestação final e acompanhe a aprovação do gestor.",
      },
      { property: "og:title", content: "Detalhe do adiantamento" },
      {
        property: "og:description",
        content: "Despesas, cupons fiscais, aprovação e relatório em PDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Detalhe,
});

const CATEGORIES = ["Alimentação", "Transporte", "Hospedagem", "Combustível", "Material", "Outros"];
const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

const expenseSchema = z.object({
  description: z.string().trim().min(2, "Descreva a despesa").max(200),
  category: z.string().min(1),
  amount: z.number().positive("Valor deve ser maior que zero"),
  spent_at: z.string().min(1, "Informe a data"),
});

function Detalhe() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { isAdmin, can } = usePermissions(user?.id);
  const canReview = can("aprovar_prestacao");
  const canTopup = can("adicionar_verba");
  const queryClient = useQueryClient();

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [amount, setAmount] = useState("");
  const [spentAt, setSpentAt] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState("");
  const [exporting, setExporting] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupNote, setTopupNote] = useState("");
  const [topupDate, setTopupDate] = useState(new Date().toISOString().slice(0, 10));
  const [reading, setReading] = useState(false);
  const [ocrFilled, setOcrFilled] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editIssuedAt, setEditIssuedAt] = useState("");
  const navigate = useNavigate();
  const runOcr = useServerFn(readReceipt);
  const runPush = useServerFn(pushPrestacao);


  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const advance = useQuery({
    queryKey: ["advance", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advances")
        .select(
          "id, title, description, amount, issued_at, status, employee_id, obra_id, submitted_at, reviewed_at, review_comment, decision",
        )
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

  const topups = useQuery({
    queryKey: ["topups", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advance_topups")
        .select("id, amount, note, issued_at, created_by, created_at")
        .eq("advance_id", id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const employee = useQuery({
    queryKey: ["profile", advance.data?.employee_id],
    enabled: !!advance.data?.employee_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", advance.data!.employee_id)
        .maybeSingle();
      return data;
    },
  });

  const list = expenses.data ?? [];
  const topupList = topups.data ?? [];
  const totalTopups = topupList.reduce((s, t) => s + Number(t.amount), 0);
  const valorInicial = Number(advance.data?.amount ?? 0);
  const liberado = valorInicial + totalTopups;
  const gasto = list.reduce((s, e) => s + Number(e.amount), 0);
  const saldo = liberado - gasto;
  const isOwner = advance.data?.employee_id === user?.id;
  const isOpen = advance.data?.status === "aberto";
  const isReview = advance.data?.status === "em_analise";
  const isClosed = advance.data?.status === "fechado";
  const canManage = isAdmin || canReview;

  const startEdit = () => {
    if (!advance.data) return;
    setEditTitle(advance.data.title ?? "");
    setEditDescription(advance.data.description ?? "");
    setEditAmount(String(advance.data.amount ?? ""));
    setEditIssuedAt(advance.data.issued_at ?? "");
    setEditing(true);
  };

  const toDataUrl = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
      reader.readAsDataURL(f);
    });

  const extractFromReceipt = async (f: File) => {
    setReading(true);
    setOcrFilled([]);
    try {
      const dataUrl = await toDataUrl(f);
      const result = await runOcr({
        data: { dataUrl, mimeType: f.type, fileName: f.name },
      });
      const filled: string[] = [];
      if (result.merchant) {
        setDescription(result.merchant.slice(0, 200));
        filled.push("estabelecimento");
      }
      if (result.date) {
        setSpentAt(result.date);
        filled.push("data");
      }
      if (result.amount) {
        setAmount(result.amount.toFixed(2));
        filled.push("valor");
      }
      if (result.category && CATEGORIES.includes(result.category)) {
        setCategory(result.category);
        filled.push("categoria");
      }
      setOcrFilled(filled);
      if (filled.length === 0) {
        toast.info("Não foi possível ler os dados do cupom. Preencha manualmente.");
      } else {
        toast.success("Dados do cupom preenchidos. Confira antes de confirmar.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na leitura do cupom");
    } finally {
      setReading(false);
    }
  };

  const pickFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      setOcrFilled([]);
      return;
    }
    if (!ACCEPTED.includes(f.type)) {
      toast.error("Formato inválido. Envie imagem (JPG, PNG, WEBP) ou PDF.");
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error("Arquivo maior que 10MB.");
      return;
    }
    setFile(f);
    void extractFromReceipt(f);
  };


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
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user!.id}/${id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("cupons")
          .upload(path, file, { contentType: file.type });
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
      setOcrFilled([]);

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

  const obra = useQuery({
    queryKey: ["obra", advance.data?.obra_id],
    enabled: !!advance.data?.obra_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, nome, codigo")
        .eq("id", advance.data!.obra_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const syncLog = useQuery({
    queryKey: ["obra_sync_logs", id],
    enabled: !!user && !!advance.data?.obra_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_sync_logs")
        .select("id, success, message, created_at")
        .eq("advance_id", id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const push = useMutation({
    mutationFn: async () => runPush({ data: { advanceId: id } }),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      queryClient.invalidateQueries({ queryKey: ["obra_sync_logs", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitReport = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("advances")
        .update({ status: "em_analise" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prestação enviada para aprovação");
      queryClient.invalidateQueries({ queryKey: ["advance", id] });
      queryClient.invalidateQueries({ queryKey: ["advances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async (decision: "aprovado" | "rejeitado") => {
      const { error } = await supabase
        .from("advances")
        .update({
          status: decision === "aprovado" ? "fechado" : "aberto",
          decision,
          review_comment: comment.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, decision) => {
      toast.success("Decisão registrada");
      setComment("");
      if (decision === "aprovado" && advance.data?.obra_id) push.mutate();
      queryClient.invalidateQueries({ queryKey: ["advance", id] });
      queryClient.invalidateQueries({ queryKey: ["advances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTopup = useMutation({
    mutationFn: async () => {
      const value = Number(topupAmount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Informe um valor válido");
      const { error } = await supabase.from("advance_topups").insert({
        advance_id: id,
        amount: value,
        note: topupNote.trim() ? topupNote.trim().slice(0, 300) : null,
        issued_at: topupDate,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Verba adicionada ao adiantamento");
      setTopupAmount("");
      setTopupNote("");
      queryClient.invalidateQueries({ queryKey: ["topups", id] });
      queryClient.invalidateQueries({ queryKey: ["advances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTopup = useMutation({
    mutationFn: async (topupId: string) => {
      const { error } = await supabase.from("advance_topups").delete().eq("id", topupId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topups", id] });
      queryClient.invalidateQueries({ queryKey: ["advances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAdvance = useMutation({
    mutationFn: async () => {
      const title = editTitle.trim();
      const value = Number(editAmount);
      if (title.length < 2) throw new Error("Informe um título válido");
      if (!Number.isFinite(value) || value <= 0) throw new Error("Informe um valor válido");
      if (!editIssuedAt) throw new Error("Informe a data de liberação");
      const { error } = await supabase
        .from("advances")
        .update({
          title: title.slice(0, 200),
          description: editDescription.trim() ? editDescription.trim().slice(0, 1000) : null,
          amount: value,
          issued_at: editIssuedAt,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adiantamento atualizado");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["advance", id] });
      queryClient.invalidateQueries({ queryKey: ["advances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAdvance = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("advances").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adiantamento excluído");
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      void navigate({ to: "/painel" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openReceipt = async (path: string, download?: boolean) => {
    const { data, error } = await supabase.storage
      .from("cupons")
      .createSignedUrl(path, 60, download ? { download: true } : undefined);
    if (error || !data) {
      toast.error("Não foi possível abrir o cupom");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const exportPdf = async () => {
    if (!advance.data) return;
    setExporting(true);
    try {
      await generateReport(
        advance.data,
        list.map((e) => ({
          description: e.description,
          category: e.category,
          amount: Number(e.amount),
          spent_at: e.spent_at,
          receipt_path: e.receipt_path,
        })),
        employee.data?.full_name || employee.data?.email || "Funcionário",
        topupList.map((t) => ({
          amount: Number(t.amount),
          note: t.note,
          issued_at: t.issued_at,
        })),
      );
    } catch {
      toast.error("Não foi possível gerar o PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell subtitle={advance.data?.title ?? ""}>
      <Link to="/painel" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="mr-1 size-4" /> Voltar
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{advance.data?.title ?? "Adiantamento"}</h1>
          {advance.data ? (
            <Badge variant={isOpen ? "default" : "secondary"}>
              {statusLabel[advance.data.status] ?? advance.data.status}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportPdf} disabled={exporting || !advance.data}>
            <FileText className="mr-2 size-4" /> {exporting ? "Gerando…" : "Relatório PDF"}
          </Button>
          {canManage && advance.data ? (
            <>
              <Button variant="outline" onClick={startEdit}>
                <Pencil className="mr-2 size-4" /> Editar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={removeAdvance.isPending}>
                    <Trash2 className="mr-2 size-4" /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir adiantamento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Todas as despesas, cupons vinculados e verbas adicionais deste adiantamento
                      serão removidos. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => removeAdvance.mutate()}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : null}
        </div>
      </div>

      {canManage && editing ? (
        <div className="surface mt-6 space-y-4 p-6">
          <h2 className="font-semibold">Editar adiantamento</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Valor inicial (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de liberação</Label>
              <Input
                type="date"
                value={editIssuedAt}
                onChange={(e) => setEditIssuedAt(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveAdvance.mutate()} disabled={saveAdvance.isPending}>
              {saveAdvance.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
      {advance.data?.description ? (
        <p className="mt-1 text-sm text-muted-foreground">{advance.data.description}</p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        Liberado em {dateBR(advance.data?.issued_at)}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Card
          label="Valor disponibilizado"
          value={brl(liberado)}
          {...(totalTopups > 0
            ? { hint: `inicial ${brl(valorInicial)} + verbas ${brl(totalTopups)}` }
            : {})}
        />
        <Card label="Total de despesas" value={brl(gasto)} />
        <Card label="Saldo restante" value={brl(Math.max(saldo, 0))} accent />
        <Card
          label={saldo >= 0 ? "A devolver" : "A reembolsar"}
          value={brl(Math.abs(saldo))}
          accent
        />
      </div>

      {advance.data?.obra_id ? (
        <div className="surface mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <HardHat className="size-4 text-primary" />
              Obra: {[obra.data?.codigo, obra.data?.nome].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {syncLog.data
                ? `Último envio à Gestão de Obras: ${syncLog.data.success ? "sucesso" : "falha"} — ${syncLog.data.message ?? ""}`
                : "Prestação ainda não enviada ao sistema de obras."}
            </p>
          </div>
          {canReview ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => push.mutate()}
              disabled={push.isPending || advance.data.decision !== "aprovado"}
            >
              <Send className="mr-2 size-4" />
              {push.isPending ? "Enviando…" : "Enviar prestação à obra"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {advance.data?.decision ? (
        <div className="surface mt-6 flex items-start gap-3 p-5">
          {advance.data.decision === "aprovado" ? (
            <CheckCircle2 className="mt-0.5 size-5 text-primary" />
          ) : (
            <XCircle className="text-destructive mt-0.5 size-5" />
          )}
          <div>
            <p className="font-semibold">
              Prestação {advance.data.decision === "aprovado" ? "aprovada" : "rejeitada"} pelo gestor
            </p>
            {advance.data.reviewed_at ? (
              <p className="text-xs text-muted-foreground">
                em {new Date(advance.data.reviewed_at).toLocaleString("pt-BR")}
              </p>
            ) : null}
            {advance.data.review_comment ? (
              <p className="mt-2 text-sm">{advance.data.review_comment}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {isClosed ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4" /> Adiantamento encerrado — não é possível alterar despesas.
        </p>
      ) : null}

      {isOwner && isReview ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4" /> Prestação enviada em{" "}
          {advance.data?.submitted_at
            ? new Date(advance.data.submitted_at).toLocaleString("pt-BR")
            : "—"}
          . Aguardando decisão do gestor.
        </p>
      ) : null}

      {canReview && isReview ? (
        <div className="surface mt-6 space-y-4 p-6">
          <h2 className="font-semibold">Analisar prestação</h2>
          <div className="space-y-2">
            <Label>Comentário</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 1000))}
              placeholder="Observações sobre a prestação de contas"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => decide.mutate("aprovado")} disabled={decide.isPending}>
              <CheckCircle2 className="mr-2 size-4" /> Aprovar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!comment.trim()) {
                  toast.error("Informe o motivo da rejeição");
                  return;
                }
                decide.mutate("rejeitado");
              }}
              disabled={decide.isPending}
            >
              <XCircle className="mr-2 size-4" /> Rejeitar
            </Button>
          </div>
        </div>
      ) : null}

      {canReview && !isReview ? (
        <div className="mt-6 flex items-center gap-3">
          <Label className="text-xs uppercase">Situação</Label>
          <Select
            value={advance.data?.status ?? "aberto"}
            onValueChange={(v) =>
              supabase
                .from("advances")
                .update({ status: v as "aberto" | "em_analise" | "fechado" })
                .eq("id", id)
                .then(({ error }) => {
                  if (error) toast.error(error.message);
                  else {
                    toast.success("Situação atualizada");
                    queryClient.invalidateQueries({ queryKey: ["advance", id] });
                    queryClient.invalidateQueries({ queryKey: ["advances"] });
                  }
                })
            }
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

      {canTopup && isOpen ? (
        <div className="surface mt-8 space-y-4 p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <Wallet className="size-4 text-primary" /> Adicionar verba ao adiantamento
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={topupDate}
                onChange={(e) => setTopupDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input
                value={topupNote}
                onChange={(e) => setTopupNote(e.target.value)}
                placeholder="Complemento de diária"
              />
            </div>
          </div>
          <Button onClick={() => addTopup.mutate()} disabled={addTopup.isPending}>
            <Wallet className="mr-2 size-4" /> Liberar verba adicional
          </Button>
        </div>
      ) : null}

      {topupList.length > 0 ? (
        <>
          <h2 className="mt-10 text-xl font-semibold">Verbas adicionais</h2>
          <div className="mt-4 space-y-3">
            {topupList.map((t) => (
              <div
                key={t.id}
                className="surface flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="font-medium">{t.note || "Verba adicional"}</p>
                  <p className="text-xs text-muted-foreground">{dateBR(t.issued_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display font-semibold">{brl(Number(t.amount))}</span>
                  {canTopup && isOpen ? (
                    <Button variant="ghost" size="icon" onClick={() => removeTopup.mutate(t.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {(isOwner || canManage) && isOpen ? (
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
              <Label>Cupom fiscal (JPG, PNG, WEBP ou PDF · até 10MB)</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center gap-3 rounded-md border p-3">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={`Pré-visualização do cupom ${file.name}`}
                      className="size-20 rounded object-cover"
                    />
                  ) : (
                    <FileText className="size-8 text-muted-foreground" />
                  )}
                  <div className="text-xs">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => {
                      setFile(null);
                      setOcrFilled([]);
                    }}
                  >
                    Remover
                  </Button>
                </div>
              ) : null}
              {reading ? (
                <p className="inline-flex items-center gap-2 text-sm text-primary">
                  <Sparkles className="size-4 animate-pulse" /> Lendo o cupom com IA…
                </p>
              ) : null}
              {!reading && ocrFilled.length > 0 ? (
                <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="size-4 text-primary" /> Preenchemos {ocrFilled.join(", ")} a
                  partir do cupom. Confira antes de confirmar.
                </p>
              ) : null}
              {file && !reading ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void extractFromReceipt(file)}
                >
                  <Sparkles className="mr-2 size-4" /> Ler cupom novamente
                </Button>
              ) : null}
            </div>
          </div>
          <Button onClick={addExpense} disabled={saving || reading}>
            {saving ? "Salvando…" : "Adicionar despesa"}

          </Button>
        </div>
      ) : null}

      {(isOwner || canManage) && isOpen ? (
        <div className="surface mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-semibold">Enviar prestação final</p>
            <p className="text-sm text-muted-foreground">
              Após o envio as despesas ficam bloqueadas até a decisão do gestor.
            </p>
          </div>
          <Button
            onClick={() => submitReport.mutate()}
            disabled={submitReport.isPending || list.length === 0}
          >
            <Send className="mr-2 size-4" /> Enviar para aprovação
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
            <div className="flex items-center gap-3">
              {e.receipt_path ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => openReceipt(e.receipt_path!)}>
                    <Paperclip className="mr-2 size-4" /> Ver cupom
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openReceipt(e.receipt_path!, true)}
                  >
                    <Download className="mr-2 size-4" /> Baixar
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Sem cupom</span>
              )}
              <span className="font-display font-semibold">{brl(Number(e.amount))}</span>
              {(isAdmin || canReview || (e.user_id === user?.id && isOpen)) && (
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

function Card({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className="surface p-5">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`mt-2 font-display text-xl font-bold ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
