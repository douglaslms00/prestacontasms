import { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, HardHat, LayoutDashboard, LogOut, Receipt, Shield, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useAuth";
import { OBRAS_APP_URL } from "@/lib/obras";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfileBadge } from "@/components/ProfileBadge";

export function AppShell({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { can } = usePermissions(user?.id);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-secondary/50">
      <header className="bg-gradient-brand text-primary-foreground">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <Link to="/painel" className="flex min-w-0 items-center gap-2">
            <Receipt className="size-5 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold">Prestação de Contas</p>
              {subtitle ? <p className="truncate text-xs opacity-80">{subtitle}</p> : null}
            </div>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <ProfileBadge />
            <NotificationBell />
            {can("integrar_obras") ? (
              <Button variant="secondary" size="sm" asChild>
                <a
                  href={OBRAS_APP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Gestão de Obras"
                >
                  <HardHat className="size-4 sm:mr-2" />
                  <span className="hidden sm:inline">Gestão de Obras</span>
                </a>
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" asChild>
              <Link to="/relatorios" aria-label="Relatórios">
                <BarChart3 className="size-4 sm:mr-2" />
                <span className="hidden sm:inline">Relatórios</span>
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/gestao" aria-label="Gestão">
                <LayoutDashboard className="size-4 sm:mr-2" />
                <span className="hidden sm:inline">Gestão</span>
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/acessos" aria-label="Acesso">
                <Shield className="size-4 sm:mr-2" />
                <span className="hidden sm:inline">Acesso</span>
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/perfil" aria-label="Meu perfil">
                <UserCog className="size-4 sm:mr-2" />
                <span className="hidden sm:inline">Perfil</span>
              </Link>
            </Button>
            <Button variant="secondary" size="sm" onClick={signOut} aria-label="Sair">
              <LogOut className="size-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>

    </div>
  );
}

