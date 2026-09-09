import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createInput = z.object({
  email: z.string().email("Informe um e-mail válido"),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres")
    .max(72, "A senha deve ter no máximo 72 caracteres")
    .regex(/[A-Z]/, "A senha deve conter letra maiúscula")
    .regex(/[a-z]/, "A senha deve conter letra minúscula")
    .regex(/[0-9]/, "A senha deve conter número")
    .regex(/[^A-Za-z0-9]/, "A senha deve conter caractere especial"),
  fullName: z.string().trim().max(120).optional(),
  cargoId: z.string().uuid().optional(),
  isAdmin: z.boolean().optional(),
});

async function assertCanManage(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if ((roles ?? []).some((r: { role: string }) => r.role === "admin")) return;

  const { data: cargos } = await supabase.from("user_cargos").select("cargo_id").eq("user_id", userId);
  const ids = (cargos ?? []).map((c: { cargo_id: string }) => c.cargo_id);
  if (ids.length > 0) {
    const { data: perms } = await supabase
      .from("cargo_permissions")
      .select("permission")
      .in("cargo_id", ids);
    if ((perms ?? []).some((p: { permission: string }) => p.permission === "gerenciar_acessos")) return;
  }
  throw new Error("Você não tem permissão para criar logins de acesso.");
}

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName ?? "" },
    });
    if (error) throw new Error(error.message);
    const newId = created.user?.id;
    if (!newId) throw new Error("Não foi possível criar o usuário.");

    if (data.fullName) {
      await supabaseAdmin
        .from("profiles")
        .update({ full_name: data.fullName, email: data.email })
        .eq("id", newId);
    }

    if (data.cargoId) {
      await supabaseAdmin
        .from("user_cargos")
        .insert({ user_id: newId, cargo_id: data.cargoId })
        .select();
    }

    if (data.isAdmin) {
      await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: "admin" }).select();
    }

    return { id: newId, email: data.email };
  });

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        password: createInput.shape.password,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
