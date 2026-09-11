import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HardHat, KeyRound, Plus, RefreshCw, Save, Shield, Trash2, UserPlus } from "lucide-react";
import { HardHat, Plus, RefreshCw, Shield, Trash2, UserPlus, Lock, Eye, EyeOff } from "lucide-react";
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
  const createLogin = useServerFn(createUserLogin);
  const resetPassword = useServerFn(resetUserPassword);

  // Novo usuário
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserCargo, setNewUserCargo] = useState("");
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Reset senha
  const [resetUserId, setResetUserId] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetShowPassword, setResetShowPassword] = useState(false);
  const [resetingUserId, setResetingUserId] = useState<string | null>(null);

  // Cargo
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
    queryClient.invalidateQueries({ queryKey: ["profiles"] });
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

  const saveCargo = useMutation({
    mutationFn: async (id: string) => {
      const draft = edits[id];
      if (!draft) return;
      const trimmed = draft.name.trim();
      if (trimmed.length < 2) throw new Error("Informe o nome do cargo");
      const { error } = await supabase
        .from("cargos")
        .update({ name: trimmed.slice(0, 60), description: draft.description.trim().slice(0, 200) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cargo atualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createLogin = useMutation({
    mutationFn: async () =>
      runCreateUser({
        data: {
          email: newEmail.trim(),
          password: newPassword,
          fullName: newFullName.trim() || undefined,
          cargoId: newCargo || undefined,
          isAdmin: newAdmin,
        },
      }),
    onSuccess: () => {
      toast.success("Login criado com sucesso");
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setNewCargo("");
      setNewAdmin(false);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (!resetFor) throw new Error("Selecione o usuário");
      return runSetPassword({ data: { userId: resetFor, password: resetPassword } });
    },
    onSuccess: () => {
      toast.success("Senha alterada");
      setResetPassword("");
      setResetFor("");
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

  const createNewUser = useMutation({
    mutationFn: async () => {
      if (!newUserName.trim()) throw new Error("Informe o nome");
      if (!newUserEmail.trim()) throw new Error("Informe o e-mail");
      if (!newUserPassword.trim()) throw new Error("Informe a senha");
      return runCreateUser({
        data: {
          fullName: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword,
          cargoId: newUserCargo || undefined,
          isAdmin: newUserIsAdmin,
        },
      });
    },
    onSuccess: () => {
      toast.success("Login criado com sucesso");
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserCargo("");
      setNewUserIsAdmin(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doResetPassword = useMutation({
    mutationFn: async (userId: string) => {
      if (!resetNewPassword) throw new Error("Informe a nova senha");
      return runSetPassword({ data: { userId, password: resetNewPassword } });
    },
    onSuccess: () => {
      toast.success("Senha alterada");
      setResetNewPassword("");
      setResetingUserId(null);
    },
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
        <>
          {/* Criar novo login */}
          <div className="surface mt-6 space-y-4 p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <UserPlus className="size-4" /> Criar login de acesso
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="João Silva"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="joao@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Senha (forte)</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Mín. 8 caracteres, maiúsc, minúsc, número e caractere especial"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cargo (opcional)</Label>
                <Select value={newUserCargo} onValueChange={setNewUserCargo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cargos.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={newUserIsAdmin}
                onCheckedChange={(v) => setNewUserIsAdmin(v === true)}
              />
              Marcar como administrador
            </label>
            <Button onClick={() => createNewUser.mutate()} disabled={createNewUser.isPending}>
              <Plus className="mr-2 size-4" /> Criar usuário
            </Button>
          </div>
        </>
      ) : null}

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
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label>Nome do cargo</Label>
                <Input
                  value={edits[c.id]?.name ?? c.name}
                  onChange={(e) =>
                    setEdits((prev) => ({
                      ...prev,
                      [c.id]: {
                        name: e.target.value,
                        description: prev[c.id]?.description ?? c.description ?? "",
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={edits[c.id]?.description ?? c.description ?? ""}
                  onChange={(e) =>
                    setEdits((prev) => ({
                      ...prev,
                      [c.id]: {
                        name: prev[c.id]?.name ?? c.name,
                        description: e.target.value,
                      },
                    }))
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => saveCargo.mutate(c.id)}
                  disabled={saveCargo.isPending || !edits[c.id]}
                >
                  <Save className="mr-2 size-4" /> Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteCargo.mutate(c.id)}>
                  <Trash2 className="mr-2 size-4" /> Excluir
                </Button>
              </div>
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
              const isResettingThis = resetingUserId === p.id;
              return (
                <div
                  key={p.id}
                  className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setResetingUserId(isResettingThis ? null : p.id)}
                      title="Redefinir senha"
                    >
                      <Lock className="size-4" />
                    </Button>
                  </div>

                  {/* Reset senha inline */}
                  {isResettingThis ? (
                    <div className="col-span-full mt-2 flex flex-col gap-3 border-t pt-3 sm:flex-row">
                      <div className="relative flex-1">
                        <Input
                          type={resetShowPassword ? "text" : "password"}
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          placeholder="Nova senha (8+ caracteres, maiúsc, minúsc, número, especial)"
                        />
                        <button
                          type="button"
                          onClick={() => setResetShowPassword(!resetShowPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {resetShowPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      <Button
                        onClick={() => doResetPassword.mutate(p.id)}

                        disabled={doResetPassword.isPending || !resetNewPassword}
                        size="sm"
                      >
                        {doResetPassword.isPending ? "Alterando..." : "Alterar senha"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setResetingUserId(null);
                          setResetNewPassword("");
                        }}
                        size="sm"
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </AppShell>
  );
}