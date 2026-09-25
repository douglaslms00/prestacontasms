import { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { HardHat, LogOut, Receipt, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions, useProfile, useUserCargos } from "@/hooks/useAuth";
import { OBRAS_APP_URL } from "@/lib/obras";

export function AppShell({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { can, isAdmin } = usePermissions(user?.id);
  const { data: profile } = useProfile(user?.id);
  const { data: cargos = [] } = useUserCargos(user?.id);

  const email = profile?.email ?? user?.email ?? null;
  const cargoLabel = [
    ...(isAdmin ? ["Administrador"] : []),
    ...cargos.filter((c) => c !== "Administrador"),
  ].join(" · ");

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-secondary/50">
      <header className="bg-gradient-brand text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <Link to="/painel" className="flex items-center gap-2">
            <Receipt className="size-5" />
            <div>
              <p className="font-display text-base font-semibold">Prestação de Contas</p>
              {subtitle ? <p className="text-xs opacity-80">{subtitle}</p> : null}
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="mr-1 hidden text-right leading-tight sm:block">
                {profile?.full_name ? (
                  <p className="text-sm font-semibold">{profile.full_name}</p>
                ) : null}
                {email ? (
                  <p className={profile?.full_name ? "text-xs opacity-80" : "text-sm font-medium"}>
                    {email}
                  </p>
                ) : null}
                <p className="text-xs opacity-70">{cargoLabel || "Sem cargo"}</p>
              </div>
            ) : null}
            {can("integrar_obras") ? (
              <Button variant="secondary" size="sm" asChild>
                <a href={OBRAS_APP_URL} target="_blank" rel="noopener noreferrer">
                  <HardHat className="mr-2 size-4" /> Gestão de Obras
                </a>
              </Button>
            ) : null}
            {can("gerenciar_acessos") ? (
              <Button variant="secondary" size="sm" asChild>
                <Link to="/acessos">
                  <Shield className="mr-2 size-4" /> Acessos
                </Link>
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={signOut}>
              <LogOut className="mr-2 size-4" /> Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}

