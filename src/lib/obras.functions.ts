import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { apiKey, baseUrl, friendlyError, normalizeObras } from "@/lib/obras.server";

const PushInput = z.object({ advanceId: z.string().uuid() });

export type SyncResult = { imported: number; message: string };
export type PushResult = { ok: boolean; message: string };

export const syncObras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncResult> => {
    const { supabase, userId } = context;

    const { data: allowed } = await supabase.rpc("has_permission", {
      _user_id: userId,
      _permission: "integrar_obras",
    });
    if (!allowed) throw new Error("Sem permissão para sincronizar obras");

    const key = apiKey();
    let response: Response;
    try {
      response = await fetch(`${baseUrl()}/api/public/obras`, {
        headers: { "x-api-key": key, Accept: "application/json" },
      });
    } catch {
      throw new Error("Não foi possível contatar o sistema de obras.");
    }

    if (!response.ok) {
      throw new Error(friendlyError(response.status, await response.text()));
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("O sistema de obras respondeu em formato inesperado.");
    }

    const rows = normalizeObras(payload);

    if (rows.length === 0) {
      return { imported: 0, message: "Nenhuma obra encontrada no sistema de obras." };
    }

    const { error } = await supabase.from("obras").upsert(rows, { onConflict: "external_id" });
    if (error) throw new Error(error.message);

    return { imported: rows.length, message: `${rows.length} obra(s) sincronizada(s).` };
  });

export const pushPrestacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PushInput.parse(input))
  .handler(async ({ data, context }): Promise<PushResult> => {
    const { supabase, userId } = context;

    const [integra, aprova] = await Promise.all([
      supabase.rpc("has_permission", { _user_id: userId, _permission: "integrar_obras" }),
      supabase.rpc("has_permission", { _user_id: userId, _permission: "aprovar_prestacao" }),
    ]);
    if (!integra.data && !aprova.data) throw new Error("Sem permissão para enviar a prestação");

    const { data: advance, error: advErr } = await supabase
      .from("advances")
      .select(
        "id, title, amount, issued_at, status, decision, reviewed_at, employee_id, obra_id, expenses(description, category, amount, spent_at), advance_topups(amount)",
      )
      .eq("id", data.advanceId)
      .maybeSingle();
    if (advErr) throw new Error(advErr.message);
    if (!advance) throw new Error("Adiantamento não encontrado");
    if (!advance.obra_id) throw new Error("Este adiantamento não está vinculado a uma obra.");

    const { data: obra } = await supabase
      .from("obras")
      .select("external_id, nome")
      .eq("id", advance.obra_id)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", advance.employee_id)
      .maybeSingle();

    const despesas = (advance.expenses ?? []).map((e) => ({
      descricao: e.description,
      categoria: e.category,
      valor: Number(e.amount),
      data: e.spent_at,
    }));
    const totalGasto = despesas.reduce((s, e) => s + e.valor, 0);
    const totalLiberado =
      Number(advance.amount) +
      (advance.advance_topups ?? []).reduce((s, t) => s + Number(t.amount), 0);

    const body = {
      obra_id: obra?.external_id ?? null,
      adiantamento_id: advance.id,
      titulo: advance.title,
      funcionario: profile?.full_name || profile?.email || "Funcionário",
      total_liberado: totalLiberado,
      total_gasto: totalGasto,
      saldo: totalLiberado - totalGasto,
      aprovado_em: advance.reviewed_at ?? new Date().toISOString(),
      despesas,
    };

    let message = "Prestação enviada para o sistema de obras.";
    let ok = false;
    try {
      const response = await fetch(`${baseUrl()}/api/public/prestacoes`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      ok = response.ok;
      if (!ok) message = friendlyError(response.status, await response.text());
    } catch (err) {
      ok = false;
      message = err instanceof Error ? err.message : "Não foi possível contatar o sistema de obras.";
    }

    await supabase.from("obra_sync_logs").insert({
      advance_id: advance.id,
      obra_id: advance.obra_id,
      success: ok,
      message,
      created_by: userId,
    });

    return { ok, message };
  });
