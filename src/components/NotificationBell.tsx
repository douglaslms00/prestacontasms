import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check, CheckCircle2, Clock, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession, usePermissions } from "@/hooks/useAuth";
import { useNotifications, type Notification } from "@/hooks/useNotifications";

function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

type Kind = "pendente" | "verba" | "aprovacao" | "outro";

function kindOf(n: Notification): Kind {
  const t = `${n.title} ${n.body}`.toLowerCase();
  if (t.includes("análise") || t.includes("analise") || t.includes("aguarda aprovação")) return "pendente";
  if (t.includes("verba")) return "verba";
  if (t.includes("aprovad") || t.includes("rejeitad")) return "aprovacao";
  return "outro";
}

const FILTERS: { id: "todas" | Kind; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "pendente", label: "Pendentes" },
  { id: "verba", label: "Verbas" },
  { id: "aprovacao", label: "Aprovações" },
];

const ICONS: Record<Kind, typeof Clock> = {
  pendente: Clock,
  verba: Wallet,
  aprovacao: CheckCircle2,
  outro: Bell,
};

export function NotificationBell() {
  const { user } = useSession();
  const { can } = usePermissions(user?.id);
  const { items, unread, markRead, markAllRead, remove } = useNotifications(user?.id);
  const [filter, setFilter] = useState<"todas" | Kind>("todas");

  const canReview = can("aprovar_prestacao");

  const visible = useMemo(
    () => (filter === "todas" ? items : items.filter((n) => kindOf(n) === filter)),
    [items, filter],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="relative" aria-label="Notificações">
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          {unread > 0 ? (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => markAllRead.mutate()}
            >
              Marcar todas como lidas
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1 border-b px-3 py-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-2.5 py-1 text-xs transition ${
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <ScrollArea className="max-h-80">
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação por enquanto.
            </p>
          ) : (
            <ul className="divide-y">
              {visible.map((n) => {
                const kind = kindOf(n);
                const Icon = ICONS[kind];
                return (
                  <li
                    key={n.id}
                    className={`px-4 py-3 text-sm ${n.read_at ? "" : "bg-secondary/60"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 gap-2">
                        <Icon
                          className={`mt-0.5 size-4 shrink-0 ${
                            kind === "pendente"
                              ? "text-amber-600"
                              : kind === "verba"
                                ? "text-primary"
                                : kind === "aprovacao"
                                  ? "text-emerald-600"
                                  : "text-muted-foreground"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-medium">{n.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{ago(n.created_at)}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {n.advance_id ? (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" asChild>
                                <Link
                                  to="/adiantamento/$id"
                                  params={{ id: n.advance_id }}
                                  onClick={() => !n.read_at && markRead.mutate(n.id)}
                                >
                                  Abrir adiantamento
                                </Link>
                              </Button>
                            ) : n.link ? (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" asChild>
                                <Link
                                  to={n.link as string}
                                  onClick={() => !n.read_at && markRead.mutate(n.id)}
                                >
                                  Abrir
                                </Link>
                              </Button>
                            ) : null}
                            {kind === "pendente" && canReview ? (
                              <Button size="sm" className="h-7 px-2 text-xs" asChild>
                                <Link
                                  to="/gestao"
                                  onClick={() => !n.read_at && markRead.mutate(n.id)}
                                >
                                  Analisar no painel
                                </Link>
                              </Button>
                            ) : null}
                            {kind === "aprovacao" ? (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
                                <Link to="/relatorios">Ver relatórios</Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {!n.read_at ? (
                          <button
                            aria-label="Marcar como lida"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => markRead.mutate(n.id)}
                          >
                            <Check className="size-4" />
                          </button>
                        ) : null}
                        <button
                          aria-label="Excluir notificação"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => remove.mutate(n.id)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
