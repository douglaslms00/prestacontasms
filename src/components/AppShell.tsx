import { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { HardHat, LogOut, Receipt, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useAuth";
import { OBRAS_APP_URL } from "@/lib/obras.functions";

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
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <Link to="/painel" className="flex items-center gap-2">
            <Receipt className="size-5" />
            <div>
              <p className="font-display text-base font-semibold">Prestação de Contas</p>
              {subtitle ? <p className="text-xs opacity-80">{subtitle}</p> : null}
            </div>
          </Link>
          <div className="flex items-center gap-2">
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

