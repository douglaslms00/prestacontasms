import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Receipt, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppShell({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
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
            <Button variant="secondary" size="sm" asChild>
              <Link to="/acessos">
                <Shield className="mr-2 size-4" /> Cadastros
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
