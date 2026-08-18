import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ReceiptText, Wallet, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prestação de Contas | Controle de adiantamentos e despesas" },
      {
        name: "description",
        content:
          "Controle adiantamentos de funcionários, lance despesas com cupom fiscal anexado e acompanhe saldo e valor a prestar em tempo real.",
      },
      { property: "og:title", content: "Prestação de Contas | Controle de adiantamentos e despesas" },
      {
        property: "og:description",
        content:
          "Controle adiantamentos de funcionários, lance despesas com cupom fiscal anexado e acompanhe saldo e valor a prestar em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Wallet,
    title: "Adiantamento liberado",
    text: "O gestor cria o adiantamento com valor, data e responsável.",
  },
  {
    icon: ReceiptText,
    title: "Despesa com cupom",
    text: "Cada lançamento aceita o anexo do cupom fiscal em foto ou PDF.",
  },
  {
    icon: ShieldCheck,
    title: "Saldo e prestação",
    text: "Total gasto, saldo restante e valor a devolver calculados na hora.",
  },
];

function Landing() {
  return (
    <main className="min-h-screen">
      <section className="bg-gradient-brand px-6 py-24 text-primary-foreground">
        <div className="mx-auto max-w-4xl">
          <span className="inline-flex rounded-full border border-primary-foreground/25 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            Controle de verbas
          </span>
          <h1 className="mt-6 text-4xl leading-tight font-bold sm:text-5xl">
            Prestação de contas sem planilha e sem cupom perdido
          </h1>
          <p className="mt-5 max-w-2xl text-lg opacity-90">
            Um valor é disponibilizado ao funcionário, ele lança cada despesa com o cupom fiscal
            anexado e o sistema mostra o saldo total e o valor a ser prestado.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/auth">
                Entrar no sistema <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="surface p-6">
              <f.icon className="size-6 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
