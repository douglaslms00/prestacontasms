import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

export function InstallAppButton({ className }: { className?: string }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleClick = async () => {
    if (promptEvent) {
      try {
        await promptEvent.prompt();
      } finally {
        setPromptEvent(null);
      }
      return;
    }
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIOS) {
      toast("Instalar no iPhone/iPad", {
        description: "Toque no botão Compartilhar e depois em “Adicionar à Tela de Início”.",
        duration: 12000,
      });
    } else {
      toast("Instalar o app", {
        description: "Abra o menu do navegador (⋮) e toque em “Instalar app” ou “Adicionar à tela inicial”.",
        duration: 12000,
      });
    }
  };

  return (
    <Button type="button" variant="outline" className={className} onClick={() => void handleClick()}>
      <Smartphone className="mr-2 size-4" /> Baixar app
    </Button>
  );
}
