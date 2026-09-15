import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectIos() {
  const ua = window.navigator.userAgent;
  const isIosDevice = /iPad|iPhone|iPod/.test(ua);
  const isIpadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isIosDevice || isIpadOs;
}

export function PwaInstallButton({ className, variant = "default", size = "default" }: ButtonProps) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [isIos, setIsIos] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    setInstalled(false);
    setIsIos(detectIos());

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPromptEvent);
    };
    const onAppInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (installed) return null;

  const handleClick = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") setInstalled(true);
      return;
    }
    setDialogOpen(true);
  };

  const label = promptEvent || isIos ? "Baixar app" : "Baixar app";

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => void handleClick()}>
        <Download className="mr-2 size-4" /> {label}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="size-5" /> Instalar o app
            </DialogTitle>
            <DialogDescription>
              Adicione o Prestação de Contas à tela inicial e use como um aplicativo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {isIos ? (
              <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                <p className="font-medium">iPhone / iPad (Safari)</p>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>Toque no botão Compartilhar <Share2 className="inline size-3.5" /></li>
                  <li>Escolha "Adicionar à Tela de Início"</li>
                  <li>Confirme em "Adicionar"</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                <p className="font-medium">Android (Chrome)</p>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>Toque no menu ⋮ no canto do navegador</li>
                  <li>Escolha "Instalar app" ou "Adicionar à tela inicial"</li>
                </ol>
                <p className="pt-1 font-medium">Computador (Chrome / Edge)</p>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>Clique no ícone de instalação na barra de endereço</li>
                  <li>Confirme em "Instalar"</li>
                </ol>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              A instalação funciona pelo endereço publicado do sistema, não pelo preview do editor.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
