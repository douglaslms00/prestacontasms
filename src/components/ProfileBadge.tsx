import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";

export function ProfileBadge() {
  const { user } = useSession();

  const profile = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_path")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const avatar = useQuery({
    queryKey: ["my-avatar", profile.data?.avatar_path],
    enabled: !!profile.data?.avatar_path,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(profile.data!.avatar_path as string, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  if (!user) return null;

  const name = profile.data?.full_name?.trim() || user.email || "Usuário";
  const email = profile.data?.email ?? user.email ?? "";

  return (
    <Link
      to="/perfil"
      aria-label={`Conectado como ${name}`}
      title={`Conectado como ${name}${email ? ` (${email})` : ""}`}
      className="flex min-w-0 items-center gap-2 rounded-full bg-primary-foreground/10 py-1 pl-1 pr-3 transition hover:bg-primary-foreground/20"
    >
      <span className="size-8 shrink-0 overflow-hidden rounded-full border border-primary-foreground/30 bg-primary-foreground/20">
        {avatar.data ? (
          <img src={avatar.data} alt={`Foto de ${name}`} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <User className="size-4" />
          </span>
        )}
      </span>
      <span className="hidden min-w-0 flex-col leading-tight sm:flex">
        <span className="truncate text-xs font-semibold">{name}</span>
        {email ? <span className="truncate text-[10px] opacity-80">{email}</span> : null}
      </span>
    </Link>
  );
}
