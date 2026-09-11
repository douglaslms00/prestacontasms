import { useEffect, useState, type KeyboardEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff } from "lucide-react";

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

const PASSWORD_HINT =
  "A senha deve ter de 8 a 72 caracteres e conter letras maiúsculas, letras minúsculas, números e ao menos um caractere especial (ex.: !@#$%).";

const strongPassword = z
  .string()
  .min(8, "A senha precisa ter no mínimo 8 caracteres")
  .max(72, "A senha pode ter no máximo 72 caracteres")
  .regex(/[A-Z]/, "A senha precisa conter ao menos uma letra maiúscula")
  .regex(/[a-z]/, "A senha precisa conter ao menos uma letra minúscula")
  .regex(/[0-9]/, "A senha precisa conter ao menos um número")
  .regex(/[^A-Za-z0-9]/, "A senha precisa conter ao menos um caractere especial");

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(1, "Informe sua senha").max(72),
  fullName: z.string().trim().max(120).optional(),
});

const signupSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: strongPassword,
  fullName: z.string().trim().max(120).optional(),
});

function PasswordRules() {
  return (
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
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetPassword, setResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const isRecoveryLink = new URLSearchParams(window.location.search).get("reset") === "1";
    if (isRecoveryLink) setResetPassword(true);
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setResetPassword(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !isRecoveryLink) navigate({ to: "/painel", replace: true });
    });
    return () => subscription.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (mode: "login" | "signup") => {
    const parsed = (mode === "signup" ? signupSchema : loginSchema).safeParse({ email, password, fullName });
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
    const parsed = strongPassword.safeParse(newPassword);
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
            <PasswordRules />
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
                <Field label="E-mail" value={identifier} onChange={setIdentifier} type="email" />
                <Field
                  label="Senha"
                  value={password}
                  onChange={setPassword}
                  type="password"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submit("login");
                    }
                  }}
                />
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
            <PasswordRules />
            <p className="sr-only">{PASSWORD_HINT}</p>
            <Button className="w-full" disabled={loading} onClick={() => submit("signup")}>
              Criar conta
            </Button>
          </TabsContent>
        </Tabs>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  onKeyDown,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type={isPassword && showPassword ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          className={isPassword ? "pr-10" : undefined}
        />
        {isPassword && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            title={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

export default AuthPage;
