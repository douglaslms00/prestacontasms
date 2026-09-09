import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Camera, Trash2, User } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil | Prestação de Contas" },
      {
        name: "description",
        content:
          "Atualize seu nome, foto de perfil e senha de acesso ao sistema de prestação de contas.",
      },
      { property: "og:title", content: "Meu perfil | Prestação de Contas" },
      {
        property: "og:description",
        content: "Gerencie seus dados pessoais, foto de perfil e senha de acesso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PerfilPage,
});

const MAX_FILE = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

const strongPassword = z
  .string()
  .min(8, "A senha precisa ter no mínimo 8 caracteres")
  .max(72, "A senha pode ter no máximo 72 caracteres")
  .regex(/[A-Z]/, "A senha precisa conter ao menos uma letra maiúscula")
  .regex(/[a-z]/, "A senha precisa conter ao menos uma letra minúscula")
  .regex(/[0-9]/, "A senha precisa conter ao menos um número")
  .regex(/[^A-Za-z0-9]/, "A senha precisa conter ao menos um caractere especial");

async function cropToSquare(file: File, zoom: number, rotation: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível ler a imagem"));
      el.src = url;
    });
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    const base = size / Math.min(img.width, img.height);
    const scale = base * zoom;
    ctx.drawImage(
      img,
      (-img.width * scale) / 2,
      (-img.height * scale) / 2,
      img.width * scale,
      img.height * scale,
    );
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))), "image/jpeg", 0.9),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PerfilPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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

  useEffect(() => {
    if (profile.data?.full_name != null) setFullName(profile.data.full_name);
  }, [profile.data?.full_name]);

  const avatarUrl = useQuery({
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

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const pickFile = (selected: File | null) => {
    if (!selected) return;
    if (!TYPES.includes(selected.type)) {
      toast.error("Envie uma imagem JPG, PNG ou WEBP");
      return;
    }
    if (selected.size > MAX_FILE) {
      toast.error("A imagem deve ter no máximo 5 MB");
      return;
    }
    setFile(selected);
    setZoom(1);
    setRotation(0);
  };

  const saveProfile = async () => {
    const parsed = z
      .string()
      .trim()
      .min(2, "Informe seu nome completo")
      .max(120, "O nome pode ter no máximo 120 caracteres")
      .safeParse(fullName);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Nome inválido");
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: parsed.data })
        .eq("id", user!.id);
      if (error) throw error;
      await supabase.auth.updateUser({ data: { full_name: parsed.data } });
      toast.success("Perfil atualizado");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o perfil");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveAvatar = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const blob = await cropToSquare(file, zoom, rotation);
      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const old = profile.data?.avatar_path;
      const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
      if (error) throw error;
      if (old) await supabase.storage.from("avatars").remove([old]);
      setFile(null);
      toast.success("Foto de perfil atualizada");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a foto");
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    const path = profile.data?.avatar_path;
    if (!path || !user) return;
    setUploading(true);
    try {
      const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", user.id);
      if (error) throw error;
      await supabase.storage.from("avatars").remove([path]);
      toast.success("Foto removida");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível remover a foto");
    } finally {
      setUploading(false);
    }
  };

  const savePassword = async () => {
    const parsed = strongPassword.safeParse(newPassword);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Senha inválida");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha alterada com sucesso");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar a senha");
    } finally {
      setSavingPassword(false);
    }
  };

  const shownImage = previewUrl ?? avatarUrl.data ?? null;

  return (
    <AppShell subtitle="Meu perfil">
      <h1 className="font-display text-2xl font-bold">Meu perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Atualize seus dados, sua foto de perfil e a senha de acesso.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="surface space-y-4 p-6">
          <h2 className="font-semibold">Foto de perfil</h2>
          <div className="flex flex-wrap items-center gap-4">
            <div className="size-24 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
              {shownImage ? (
                <img
                  src={shownImage}
                  alt="Foto de perfil"
                  className="size-full object-cover"
                  style={file ? { transform: `scale(${zoom}) rotate(${rotation}deg)` } : undefined}
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <User className="size-8" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Camera className="mr-2 size-4" /> Escolher foto
              </Button>
              {profile.data?.avatar_path && !file ? (
                <Button variant="outline" size="sm" disabled={uploading} onClick={removeAvatar}>
                  <Trash2 className="mr-2 size-4" /> Remover
                </Button>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {file ? (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="space-y-1">
                <Label className="text-xs">Zoom ({zoom.toFixed(1)}x)</Label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rotação ({rotation}°)</Label>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={90}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={uploading} onClick={saveAvatar}>
                  {uploading ? "Enviando..." : "Salvar foto"}
                </Button>
                <Button size="sm" variant="ghost" disabled={uploading} onClick={() => setFile(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP de até 5 MB.</p>
          )}
        </section>

        <section className="surface space-y-4 p-6">
          <h2 className="font-semibold">Dados pessoais</h2>
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={profile.data?.email ?? user?.email ?? ""} disabled />
          </div>
          <Button disabled={savingProfile} onClick={saveProfile}>
            {savingProfile ? "Salvando..." : "Salvar alterações"}
          </Button>
        </section>

        <section className="surface space-y-4 p-6 lg:col-span-2">
          <h2 className="font-semibold">Alterar senha</h2>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Requisitos da senha</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>Mínimo de 8 e máximo de 72 caracteres</li>
              <li>Ao menos uma letra maiúscula (A-Z)</li>
              <li>Ao menos uma letra minúscula (a-z)</li>
              <li>Ao menos um número (0-9)</li>
              <li>Ao menos um caractere especial (!@#$%&amp;*)</li>
            </ul>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <Button disabled={savingPassword} onClick={savePassword}>
            {savingPassword ? "Salvando..." : "Alterar senha"}
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
