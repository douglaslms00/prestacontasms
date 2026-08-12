import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useIsAdmin(userId?: string) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export const PERMISSIONS = [
  "criar_adiantamento",
  "adicionar_verba",
  "aprovar_prestacao",
  "ver_todos",
  "lancar_despesa",
  "gerenciar_acessos",
] as const;

export type AppPermission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<AppPermission, string> = {
  criar_adiantamento: "Criar adiantamentos",
  adicionar_verba: "Adicionar verbas em adiantamentos",
  aprovar_prestacao: "Aprovar ou rejeitar prestações",
  ver_todos: "Ver todos os adiantamentos",
  lancar_despesa: "Lançar e editar despesas",
  gerenciar_acessos: "Gerenciar cargos e usuários",
};

export function usePermissions(userId?: string) {
  const query = useQuery({
    queryKey: ["permissions", userId],
    enabled: !!userId,
    queryFn: async (): Promise<{ isAdmin: boolean; permissions: AppPermission[] }> => {
      const [roles, cargos] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId!),
        supabase
          .from("user_cargos")
          .select("cargo_id")
          .eq("user_id", userId!),
      ]);
      if (roles.error) throw roles.error;
      const isAdmin = (roles.data ?? []).some((r) => r.role === "admin");

      const cargoIds = (cargos.data ?? []).map((c) => c.cargo_id);
      let permissions: AppPermission[] = [];
      if (cargoIds.length > 0) {
        const { data } = await supabase
          .from("cargo_permissions")
          .select("permission")
          .in("cargo_id", cargoIds);
        permissions = [...new Set((data ?? []).map((p) => p.permission as AppPermission))];
      }
      return { isAdmin, permissions };
    },
  });

  const isAdmin = query.data?.isAdmin ?? false;
  const permissions = query.data?.permissions ?? [];
  const can = (p: AppPermission) => isAdmin || permissions.includes(p);

  return { ...query, isAdmin, permissions, can };
}
