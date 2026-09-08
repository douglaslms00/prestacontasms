import { ReactNode, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, HardHat, LayoutDashboard, LogOut, Menu, Receipt, Shield, UserCog } from "lucide-react";
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
import { OBRAS_APP_URL } from "@/lib/obras";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfileBadge } from "@/components/ProfileBadge";

export function AppShell({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { can } = usePermissions(user?.id);
  const [menuOpen, setMenuOpen] = useState(false);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const links = [
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

          {/* Desktop */}
          <div className="hidden items-center gap-2 md:flex">
            <ProfileBadge />
            {can("integrar_obras") ? (
              <Button variant="secondary" size="sm" asChild>
                <a href={OBRAS_APP_URL} target="_blank" rel="noopener noreferrer">
                  <HardHat className="mr-2 size-4" /> Gestão de Obras
                </a>
              </Button>
            ) : null}
            {links.map(({ to, label, icon: Icon }) => (
              <Button key={to} variant="secondary" size="sm" asChild>
                <Link to={to}>
                  <Icon className="mr-2 size-4" /> {label}
                </Link>
              </Button>
            ))}
            <Button variant="secondary" size="sm" onClick={signOut}>
              <LogOut className="mr-2 size-4" /> Sair
            </Button>
          </div>

          {/* Mobile */}
          <div className="flex items-center gap-2 md:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Abrir menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="mt-4 border-b pb-4">
                  <ProfileBadge />
                </div>
                <nav className="mt-4 flex flex-col gap-1">
                  {can("integrar_obras") ? (
                    <a
                      href={OBRAS_APP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
                      onClick={() => setMenuOpen(false)}
                    >
                      <HardHat className="size-4" /> Gestão de Obras
                    </a>
                  ) : null}
                  {links.map(({ to, label, icon: Icon }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
                      activeProps={{ className: "bg-accent text-primary" }}
                    >
                      <Icon className="size-4" /> {label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void signOut();
                    }}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-accent"
                  >
                    <LogOut className="size-4" /> Sair
                  </button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}

