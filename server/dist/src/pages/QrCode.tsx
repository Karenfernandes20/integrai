import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { QrCode as QrIcon, Upload } from "lucide-react";

const QrCodePage = () => {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Leitura de QR Code</h2>
          <p className="text-xs text-muted-foreground">
            Módulo para leitura via câmera ou upload de imagem, usado para login, validação e ações administrativas.
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Leitura via câmera</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed bg-muted/40">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <QrIcon className="h-10 w-10" />
                <p className="max-w-xs text-center text-[11px]">
                  Aqui será exibido o vídeo da câmera com o leitor de QR Code em tempo real.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Nesta etapa a interface é apenas visual. A leitura real do QR Code e a associação com login/validação
              serão feitas na integração com backend.
            </p>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Upload de imagem com QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex flex-col gap-2">
              <Input type="file" accept="image/*" className="h-9 cursor-pointer text-xs" />
              <Button type="button" size="sm" className="inline-flex items-center gap-2 text-[11px]">
                <Upload className="h-3.5 w-3.5" />
                Simular leitura de QR Code
              </Button>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground">Resultado (exemplo):</p>
              <p className="mt-1">Conteúdo do QR Code será exibido aqui para acionar fluxos como login ou atendimento.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default QrCodePage;
