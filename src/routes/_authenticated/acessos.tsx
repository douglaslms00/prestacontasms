import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HardHat, KeyRound, Plus, RefreshCw, Save, Shield, Trash2, UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { syncObras } from "@/lib/obras.functions";
import { createUserAccount, setUserPassword } from "@/lib/admin-users.functions";
import { OBRAS_APP_URL } from "@/lib/obras";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  useSession,
  usePermissions,
  type AppPermission,
} from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/acessos")({
  head: () => ({
    meta: [
      { title: "Cargos e permissões | Prestação de Contas" },
      {
        name: "description",
        content:
          "Crie cargos, defina quais permissões cada cargo tem e atribua cargos aos usuários do sistema.",
      },
      { property: "og:title", content: "Cargos e permissões" },
      {
        property: "og:description",
        content: "Controle de acessos: cargos personalizados e permissões por usuário.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Acessos,
});

type Cargo = { id: string; name: string; description: string };

function Acessos() {
  const { user } = useSession();
  const { can, isLoading } = usePermissions(user?.id);
  const queryClient = useQueryClient();
  const allowed = can("gerenciar_acessos");
  const canIntegrar = can("integrar_obras");
  const runSync = useServerFn(syncObras);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pickUser, setPickUser] = useState("");
  const [pickCargo, setPickCargo] = useState("");
  const [edits, setEdits] = useState<Record<string, { name: string; description: string }>>({});

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newCargo, setNewCargo] = useState("");
  const [newAdmin, setNewAdmin] = useState(false);
  const [resetFor, setResetFor] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  const runCreateUser = useServerFn(createUserAccount);
  const runSetPassword = useServerFn(setUserPassword);

  const cargos = useQuery({
    queryKey: ["cargos"],
    enabled: !!user,
    queryFn: async (): Promise<Cargo[]> => {
      const { data, error } = await supabase
        .from("cargos")
        .select("id, name, description")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const perms = useQuery({
    queryKey: ["cargo-permissions"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargo_permissions")
        .select("id, cargo_id, permission");
      if (error) throw error;
      return data ?? [];
    },
  });

  const people = useQuery({
    queryKey: ["profiles"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const assignments = useQuery({
    queryKey: ["user-cargos"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_cargos").select("id, user_id, cargo_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const obras = useQuery({
    queryKey: ["obras"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, nome, codigo, cliente, status")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const sync = useMutation({
    mutationFn: async () => runSync({}),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ["obras"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cargos"] });
    queryClient.invalidateQueries({ queryKey: ["cargo-permissions"] });
    queryClient.invalidateQueries({ queryKey: ["user-cargos"] });
    queryClient.invalidateQueries({ queryKey: ["permissions"] });
  };

  const createCargo = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (trimmed.length < 2) throw new Error("Informe o nome do cargo");
      const { error } = await supabase
        .from("cargos")
        .insert({ name: trimmed.slice(0, 60), description: description.trim().slice(0, 200) });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cargo criado");
      setName("");
      setDescription("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCargo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cargos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cargo removido");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePerm = useMutation({
    mutationFn: async (input: { cargoId: string; permission: AppPermission; on: boolean }) => {
      if (input.on) {
        const { error } = await supabase
          .from("cargo_permissions")
          .insert({ cargo_id: input.cargoId, permission: input.permission });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cargo_permissions")
          .delete()
          .eq("cargo_id", input.cargoId)
          .eq("permission", input.permission);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: async () => {
      if (!pickUser || !pickCargo) throw new Error("Selecione o usuário e o cargo");
      const { error } = await supabase
        .from("user_cargos")
        .insert({ user_id: pickUser, cargo_id: pickCargo });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cargo atribuído");
      setPickCargo("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unassign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_cargos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AppShell subtitle="Cargos e permissões">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </AppShell>
    );
  }

  if (!allowed && !canIntegrar) {
    return (
      <AppShell subtitle="Cargos e permissões">
        <div className="surface p-6">
          <h1 className="text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você não tem permissão para gerenciar cargos e usuários.
          </p>
        </div>
      </AppShell>
    );
  }

  const hasPerm = (cargoId: string, permission: AppPermission) =>
    (perms.data ?? []).some((p) => p.cargo_id === cargoId && p.permission === permission);

  const cargoName = (id: string) => cargos.data?.find((c) => c.id === id)?.name ?? "Cargo";

  return (
    <AppShell subtitle="Cargos e permissões">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Shield className="size-5 text-primary" /> Cargos e permissões
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Crie cargos, marque o que cada um pode fazer e atribua aos usuários. Administradores têm
        acesso total.
      </p>

      {allowed ? (
      <div className="surface mt-6 space-y-4 p-6">
        <h2 className="font-semibold">Novo cargo</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Financeiro"
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Responsável por liberar verbas"
            />
          </div>
        </div>
        <Button onClick={() => createCargo.mutate()} disabled={createCargo.isPending}>
          <Plus className="mr-2 size-4" /> Criar cargo
        </Button>
      </div>
      ) : null}

      {allowed ? (
      <>
      <h2 className="mt-10 text-xl font-semibold">Permissões por cargo</h2>
      <div className="mt-4 space-y-4">
        {(cargos.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cargo criado ainda.</p>
        ) : null}
        {(cargos.data ?? []).map((c) => (
          <div key={c.id} className="surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{c.name}</p>
                {c.description ? (
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                ) : null}
              </div>
              <Button variant="ghost" size="sm" onClick={() => deleteCargo.mutate(c.id)}>
                <Trash2 className="mr-2 size-4" /> Excluir
              </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={hasPerm(c.id, p)}
                    onCheckedChange={(v) =>
                      togglePerm.mutate({ cargoId: c.id, permission: p, on: v === true })
                    }
                  />
                  {PERMISSION_LABELS[p]}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      </>
      ) : null}

      {canIntegrar ? (
        <>
          <h2 className="mt-10 flex items-center gap-2 text-xl font-semibold">
            <HardHat className="size-5 text-primary" /> Integração com Gestão de Obras
          </h2>
          <div className="surface mt-4 space-y-4 p-5">
            <p className="text-sm text-muted-foreground">
              Importe as obras de{" "}
              <a
                className="underline"
                href={OBRAS_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {OBRAS_APP_URL.replace("https://", "")}
              </a>{" "}
              para vincular adiantamentos a uma obra e enviar a prestação aprovada de volta.
            </p>
            <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
              <RefreshCw className="mr-2 size-4" />
              {sync.isPending ? "Sincronizando…" : "Sincronizar obras"}
            </Button>
            <div className="space-y-2">
              {(obras.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma obra sincronizada ainda.</p>
              ) : null}
              {(obras.data ?? []).map((o) => (
                <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{[o.codigo, o.nome].filter(Boolean).join(" · ")}</span>
                  <span className="text-xs text-muted-foreground">
                    {o.cliente ? `${o.cliente} · ` : ""}
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {allowed ? (
      <>
      <h2 className="mt-10 text-xl font-semibold">Usuários</h2>
      <div className="surface mt-4 space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select value={pickUser} onValueChange={setPickUser}>
            <SelectTrigger>
              <SelectValue placeholder="Usuário" />
            </SelectTrigger>
            <SelectContent>
              {(people.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email || p.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={pickCargo} onValueChange={setPickCargo}>
            <SelectTrigger>
              <SelectValue placeholder="Cargo" />
            </SelectTrigger>
            <SelectContent>
              {(cargos.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => assign.mutate()} disabled={assign.isPending}>
            <UserPlus className="mr-2 size-4" /> Atribuir cargo
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {(people.data ?? []).map((p) => {
          const mine = (assignments.data ?? []).filter((a) => a.user_id === p.id);
          return (
            <div
              key={p.id}
              className="surface flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="font-medium">{p.full_name || p.email || p.id}</p>
                <p className="text-xs text-muted-foreground">{p.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {mine.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Sem cargo</span>
                ) : null}
                {mine.map((a) => (
                  <Badge
                    key={a.id}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => unassign.mutate(a.id)}
                    title="Clique para remover"
                  >
                    {cargoName(a.cargo_id)} ✕
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      </>
      ) : null}
    </AppShell>
  );
}
