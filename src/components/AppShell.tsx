import { ReactNode, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, ClipboardCheck, HardHat, LayoutDashboard, LogOut, Menu, Receipt, Shield, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useAuth";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { OBRAS_APP_URL } from "@/lib/obras";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfileBadge } from "@/components/ProfileBadge";

export function AppShell({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { can } = usePermissions(user?.id);
  const [menuOpen, setMenuOpen] = useState(false);
  useIdleLogout(!!user);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const links = [
    { to: "/aprovacoes", label: "Aprovações", icon: ClipboardCheck },
    { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/gestao", label: "Gestão", icon: LayoutDashboard },
    { to: "/acessos", label: "Acesso", icon: Shield },
    { to: "/perfil", label: "Perfil", icon: UserCog },
  ] as const;

  return (
    <div className="min-h-screen bg-secondary/50">
      <header className="bg-gradient-brand text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <Link to="/painel" className="flex min-w-0 items-center gap-2">
            <Receipt className="size-5 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold">Prestação de Contas</p>
              {subtitle ? <p className="truncate text-xs opacity-80">{subtitle}</p> : null}
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <ProfileBadge />

            {/* Menu Lateral (Desktop & Mobile) */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/20"
                  aria-label="Abrir menu de módulos"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 flex flex-col justify-between">
                <div>
                  <SheetHeader className="border-b pb-4 text-left">
                    <SheetTitle className="flex items-center gap-2 text-base font-semibold">
                      <Receipt className="size-5 text-primary" />
                      Navegação
                    </SheetTitle>
                  </SheetHeader>

                  <div className="mt-4 border-b pb-4">
                    <ProfileBadge />
                    <div className="mt-3">
                      <PwaInstallButton variant="outline" size="sm" className="w-full" />
                    </div>
                  </div>

                  <nav className="mt-5 flex flex-col gap-1.5">
                    <Link
                      to="/painel"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground"
                      activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}
                    >
                      <Receipt className="size-4 shrink-0" /> Painel de Adiantamentos
                    </Link>

                    {can("integrar_obras") ? (
                      <a
                        href={OBRAS_APP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground"
                        onClick={() => setMenuOpen(false)}
                      >
                        <HardHat className="size-4 shrink-0" /> Gestão de Obras
                      </a>
                    ) : null}

                    {links.map(({ to, label, icon: Icon }) => (
                      <Link
                        key={to}
                        to={to}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground"
                        activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}
                      >
                        <Icon className="size-4 shrink-0" /> {label}
                      </Link>
                    ))}
                  </nav>
                </div>

                <div className="border-t pt-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setMenuOpen(false);
                      void signOut();
                    }}
                  >
                    <LogOut className="mr-2 size-4" /> Sair da conta
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}

