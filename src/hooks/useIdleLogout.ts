import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const IDLE_MS = 30 * 60 * 1000; // 30 minutos
const STORAGE_KEY = "last-activity-at";
const EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "click", "focus"] as const;

export function useIdleLogout(enabled: boolean) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firing = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const logout = async () => {
      if (firing.current) return;
      firing.current = true;
      try {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
      } finally {
        localStorage.removeItem(STORAGE_KEY);
        toast("Sessão encerrada", {
          description: "Você ficou 30 minutos sem atividade e precisa entrar novamente.",
        });
        navigate({ to: "/auth", replace: true });
      }
    };

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      const last = Number(localStorage.getItem(STORAGE_KEY) ?? Date.now());
      const remaining = IDLE_MS - (Date.now() - last);
      if (remaining <= 0) {
        void logout();
        return;
      }
      timer.current = setTimeout(() => void logout(), remaining);
    };

    const touch = () => {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      schedule();
    };

    touch();

    for (const ev of EVENTS) window.addEventListener(ev, touch, { passive: true });
    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const ev of EVENTS) window.removeEventListener(ev, touch);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, navigate, queryClient]);
}
