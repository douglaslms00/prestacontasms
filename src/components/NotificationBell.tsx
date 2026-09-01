import { Link } from "@tanstack/react-router";
import { Bell, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";

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

export function NotificationBell() {
  const { user } = useSession();
  const { items, unread, markRead, markAllRead, remove } = useNotifications(user?.id);

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
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
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
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação por enquanto.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`px-4 py-3 text-sm ${n.read_at ? "" : "bg-secondary/60"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {n.link ? (
                        <Link
                          to={n.link as string}
                          onClick={() => !n.read_at && markRead.mutate(n.id)}
                          className="font-medium hover:underline"
                        >
                          {n.title}
                        </Link>
                      ) : (
                        <p className="font-medium">{n.title}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{ago(n.created_at)}</p>
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
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
