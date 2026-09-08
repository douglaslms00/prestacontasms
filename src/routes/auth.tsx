import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | Prestação de Contas" },
      {
        name: "description",
        content:
          "Acesse o sistema de prestação de contas para gerenciar adiantamentos, despesas e cupons fiscais.",
      },
      { property: "og:title", content: "Entrar | Prestação de Contas" },
      {
        property: "og:description",
        content: "Login de gestores e funcionários do sistema de prestação de contas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  identifier: z.string().trim().min(1, "Informe CPF ou e-mail").max(255),
  password: z.string().min(6, "A senha precisa ter ao menos 6 caracteres").max(72),
  fullName: z.string().trim().max(120).optional(),
});

function normalizeCpf(input: string): string {
  return input.replace(/\D/g, "");
}

function looksLikeEmail(input: string): boolean {
  return /\S+@\S+\.\S+/.test(input);
}

async function findEmailByCpf(cpf: string): Promise<string | null> {
  // Tenta buscar em profiles (ajuste o nome da tabela caso seja diferente)
  try {
    const { data, error } = await supabase.from("profiles").select("email").eq("cpf", cpf).maybeSingle();
    if (!error && data?.email) return data.email as string;
  } catch {
    // ignore
  }
  // Fallback: tenta em tabela users (caso exista uma tabela de perfil separada)
  try {
    const { data, error } = await supabase.from("users").select("email").eq("cpf", cpf).maybeSingle();
    if (!error && data?.email) return data.email as string;
  } catch {
    // ignore
  }
  return null;
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetPassword, setResetPassword] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("reset") === "1",
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setResetPassword(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !resetPassword) navigate({ to: "/painel", replace: true });
    });
    return () => subscription.subscription.unsubscribe();
  }, [navigate, resetPassword]);

  const submit = async (mode: "login" | "signup") => {
    const parsed = schema.safeParse({ identifier, password, fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        // Se for e-mail, usa diretamente
        if (looksLikeEmail(identifier)) {
          const { error } = await supabase.auth.signInWithPassword({ email: identifier.trim().toLowerCase(), password });
          if (error) throw error;
          navigate({ to: "/painel", replace: true });
        } else {
          // Trata como CPF: normaliza e busca e-mail associado
          const cpf = normalizeCpf(identifier);
          if (cpf.length !== 11) {
            throw new Error("CPF inválido.");
          }
          const email = await findEmailByCpf(cpf);
          if (!email) {
            throw new Error("Não encontramos uma conta vinculada a esse CPF.");
          }
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          navigate({ to: "/painel", replace: true });
        }
      } else {
        // signup: mantemos comportamento por e-mail
        const { data, error } = await supabase.auth.signUp({
          email: identifier,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/painel", replace: true });
        else toast.success("Conta criada! Confirme o e-mail para acessar.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível continuar");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Falha ao entrar com Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/painel", replace: true });
  };

  const solicitarRedefinicao = async () => {
    // identifier pode ser CPF ou e-mail
    if (looksLikeEmail(identifier)) {
      const parsed = z.string().trim().email("Informe um e-mail válido").safeParse(identifier);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Informe um e-mail válido");
        return;
      }
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
          redirectTo: `${window.location.origin}/auth?reset=1`,
        });
        if (error) throw error;
        toast.success("Se houver uma conta com este e-mail, você receberá um link para redefinir a senha.");
        setForgotPassword(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível enviar o link de recuperação");
      } finally {
        setLoading(false);
      }
    } else {
      // Tratar como CPF: busca e-mail e solicita reset
      const cpf = normalizeCpf(identifier);
      if (cpf.length !== 11) {
        toast.error("CPF inválido.");
        return;
      }
      setLoading(true);
      try {
        const email = await findEmailByCpf(cpf);
        if (!email) {
          toast.success("Se houver uma conta vinculada a este CPF, será enviada uma instrução de recuperação."); // não vaza informação
          setForgotPassword(false);
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?reset=1`,
        });
        if (error) throw error;
        toast.success("Se houver uma conta com este e-mail, você receberá um link para redefinir a senha.");
        setForgotPassword(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível enviar o link de recuperação");
      } finally {
        setLoading(false);
      }
    }
  };

  const salvarNovaSenha = async () => {
    const parsed = z.string().min(6, "A senha precisa ter ao menos 6 caracteres").max(72).safeParse(newPassword);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Senha inválida");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso.");
      navigate({ to: "/painel", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar a senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary px-4 py-12">
      <div className="surface w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">Prestação de Contas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesse para gerenciar adiantamentos e despesas.
        </p>

        {resetPassword ? (
          <div className="mt-6 space-y-4">
            <div>
              <h2 className="font-semibold">Criar nova senha</h2>
              <p className="mt-1 text-sm text-muted-foreground">Escolha uma nova senha para recuperar o acesso.</p>
            </div>
            <Field label="Nova senha" value={newPassword} onChange={setNewPassword} type="password" />
            <Field label="Confirmar nova senha" value={confirmPassword} onChange={setConfirmPassword} type="password" />
            <Button className="w-full" disabled={loading} onClick={salvarNovaSenha}>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </div>
        ) : (
        <Tabs defaultValue="login" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-6 space-y-4">
            {forgotPassword ? (
              <>
                <div>
                  <h2 className="font-semibold">Recuperar acesso</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Informe seu e-mail ou CPF para receber o link de redefinição de senha.</p>
                </div>
                <Field label="CPF ou E-mail" value={identifier} onChange={setIdentifier} />
                <Button className="w-full" disabled={loading} onClick={solicitarRedefinicao}>
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </Button>
                <Button variant="link" className="w-full" disabled={loading} onClick={() => setForgotPassword(false)}>
                  Voltar para entrar
                </Button>
              </>
            ) : (
              <>
                <Field label="CPF ou E-mail" value={identifier} onChange={setIdentifier} />
                <Field label="Senha" value={password} onChange={setPassword} type="password" />
                <Button className="w-full" disabled={loading} onClick={() => submit("login")}>
                  Entrar
                </Button>
                <Button variant="link" className="w-full" disabled={loading} onClick={() => setForgotPassword(true)}>
                  Esqueceu sua senha?
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="signup" className="mt-6 space-y-4">
            <Field label="Nome completo" value={fullName} onChange={setFullName} />
            <Field label="E-mail" value={identifier} onChange={setIdentifier} type="email" />
            <Field label="Senha" value={password} onChange={setPassword} type="password" />
            <Button className="w-full" disabled={loading} onClick={() => submit("signup")}>
              Criar conta
            </Button>
          </TabsContent>
        </Tabs>
        )}

        {!resetPassword && <>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={google}>
            Continuar com Google
          </Button>
        </>}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default AuthPage;
