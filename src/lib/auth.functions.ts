import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateLoginInput = z.object({
  fullName: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(120),
  email: z.string().trim().email("E-mail inválido"),
  password: z
    .string()
    .min(8, "Senha deve ter ao menos 8 caracteres")
    .regex(/[A-Z]/, "Senha precisa ter letras maiúsculas")
    .regex(/[a-z]/, "Senha precisa ter letras minúsculas")
    .regex(/[0-9]/, "Senha precisa ter números")
    .regex(/[!@#$%^&*]/, "Senha precisa ter caracteres especiais (!@#$%^&*)"),
  cargoId: z.string().uuid().optional(),
  isAdmin: z.boolean().default(false),
});

const ResetPasswordInput = z.object({
  userId: z.string().uuid(),
  newPassword: z
    .string()
    .min(8, "Senha deve ter ao menos 8 caracteres")
    .regex(/[A-Z]/, "Senha precisa ter letras maiúsculas")
    .regex(/[a-z]/, "Senha precisa ter letras minúsculas")
    .regex(/[0-9]/, "Senha precisa ter números")
    .regex(/[!@#$%^&*]/, "Senha precisa ter caracteres especiais (!@#$%^&*)"),
});

export type CreateLoginResult = { ok: boolean; userId: string; message: string };
export type ResetPasswordResult = { ok: boolean; message: string };

export const createUserLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateLoginInput.parse(input))
  .handler(async ({ data, context }): Promise<CreateLoginResult> => {
    const { supabase, userId } = context;

    // Verificar se o usuário tem permissão para gerenciar acessos
    const { data: allowed } = await supabase.rpc("has_permission", {
      _user_id: userId,
      _permission: "gerenciar_acessos",
    });
    if (!allowed) throw new Error("Sem permissão para criar usuários");

    try {
      // Criar usuário no Auth (Supabase)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
      });

      if (authError) throw new Error(authError.message);

      const newUserId = authData.user.id;

      // Criar perfil do usuário
      const { error: profileError } = await supabase.from("profiles").insert({
        id: newUserId,
        full_name: data.fullName,
        email: data.email,
      });

      if (profileError) throw new Error(`Erro ao criar perfil: ${profileError.message}`);

      // Se for admin, adicionar role de admin
      if (data.isAdmin) {
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: newUserId,
          role: "admin",
        });
        if (roleError) throw new Error(`Erro ao adicionar role: ${roleError.message}`);
      }

      // Se houver cargo, atribuir
      if (data.cargoId) {
        const { error: cargoError } = await supabase.from("user_cargos").insert({
          user_id: newUserId,
          cargo_id: data.cargoId,
        });
        if (cargoError) throw new Error(`Erro ao atribuir cargo: ${cargoError.message}`);
      }

      return {
        ok: true,
        userId: newUserId,
        message: `Usuário ${data.fullName} criado com sucesso. Email de verificação enviado.`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar usuário";
      return { ok: false, userId: "", message };
    }
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResetPasswordInput.parse(input))
  .handler(async ({ data, context }): Promise<ResetPasswordResult> => {
    const { supabase, userId } = context;

    // Verificar se o usuário tem permissão para gerenciar acessos
    const { data: allowed } = await supabase.rpc("has_permission", {
      _user_id: userId,
      _permission: "gerenciar_acessos",
    });
    if (!allowed) throw new Error("Sem permissão para redefinir senhas");

    try {
      const { error } = await supabase.auth.admin.updateUserById(data.userId, {
        password: data.newPassword,
      });

      if (error) throw error;

      return {
        ok: true,
        message: "Senha redefinida com sucesso.",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao redefinir senha";
      return { ok: false, message };
    }
  });
