import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { QrCode as QrIcon, RefreshCcw } from "lucide-react";


const QrCodePage = () => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [debugData, setDebugData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQrCode = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Chama diretamente o backend Node/Express no Render
      const response = await fetch("/api/evolution/qrcode");
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(body || `Erro ${response.status} ao buscar QR Code`);
      }

      const text = await response.text();
      const isHtmlResponse = /^;?\s*<!doctype/i.test(text) || /^;?\s*<html/i.test(text);
      // Se o backend devolver HTML (ex.: erro de configuração ou proxy redirecionando), evita quebrar no JSON.parse
      if (isHtmlResponse) {
        throw new Error(
          "Resposta do servidor não é JSON, e sim HTML. Verifique se o serviço backend está respondendo em /api/evolution/qrcode."
        );
      }

      const data = JSON.parse(text);
      setQrCode(data.qrcode || null);
      setDebugData(data.raw || data);
    } catch (err: any) {
      setError(err?.message || "Erro ao buscar QR Code");
      setQrCode(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (!confirm("Tem certeza que deseja desconectar o WhatsApp?")) return;

      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/evolution/disconnect", {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(body || `Erro ${response.status} ao desconectar`);
      }

      // Após desconectar, recarrega o QR code
      setQrCode(null);
      setDebugData(null);
      fetchQrCode();

    } catch (err: any) {
      setError(err?.message || "Erro ao desconectar");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQrCode();

    // Polling para verificar conexão a cada 3 segundos
    const interval = setInterval(() => {
      // Só faz polling se não estiver carregando e se ainda não estiver conectado (state !== open)
      // Como não temos o state salvo fora do debugData, vamos checar simples:
      fetchQrCode();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Conexão via QR Code</h2>
          <p className="text-xs text-muted-foreground">
            Use este QR Code para conectar a instância Evolution (integrai) ao WhatsApp.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="inline-flex items-center gap-1.5 text-[11px]"
          onClick={fetchQrCode}
          disabled={isLoading}
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          {isLoading ? "Gerando QR..." : "Gerar QR Code"}
        </Button>
      </header>

      <section className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm">QR Code Evolution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed bg-muted/40 p-4">
              {isLoading && (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <QrIcon className="h-10 w-10 animate-pulse" />
                  <p className="max-w-xs text-center text-[11px]">
                    Gerando QR Code com a Evolution API. Aguarde alguns segundos…
                  </p>
                </div>
              )}

              {!isLoading && error && (
                <div className="flex flex-col items-center gap-2 text-red-500">
                  <p className="text-[11px] font-medium">Erro ao carregar QR Code</p>
                  <p className="max-w-xs text-center text-[11px] text-muted-foreground">
                    {error}
                  </p>
                </div>
              )}

              {!isLoading && !error && qrCode && (
                <div className="flex flex-col items-center gap-2">
                  {/* QR code retornado em base64: data:image/png;base64,... */}
                  <img
                    src={qrCode}
                    alt="QR Code para conexão Evolution via WhatsApp"
                    className="w-full max-w-[260px] rounded-lg border bg-white p-2"
                  />
                  <p className="max-w-xs text-center text-[11px] text-muted-foreground">
                    Aponte a câmera do dispositivo conectado ao WhatsApp para este código para finalizar a conexão.
                  </p>
                </div>
              )}

              {!isLoading && !error && !qrCode && debugData?.instance?.state === 'open' && (
                <div className="flex flex-col items-center gap-2 text-green-600">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <QrIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="font-semibold text-sm">WhatsApp Conectado!</p>
                  <p className="max-w-xs text-center text-[11px] text-muted-foreground">
                    A instância <strong>{debugData.instance.instanceName}</strong> já está ativa (state: open).
                    Você não precisa escanear o QR Code novamente.
                  </p>
                  <Button
                    onClick={handleDisconnect}
                    variant="destructive"
                    size="sm"
                    className="mt-2 text-xs"
                    disabled={isLoading}
                  >
                    Desconectar WhatsApp
                  </Button>
                </div>
              )}

              {!isLoading && !error && !qrCode && debugData?.instance?.state !== 'open' && (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <QrIcon className="h-10 w-10" />
                  <p className="max-w-xs text-center text-[11px]">
                    Nenhum QR Code disponível no momento (Estado: {debugData?.instance?.state || 'Desconhecido'}).
                    Clique em “Atualizar QR” para tentar novamente.
                  </p>
                  <div className="w-full max-w-xs mt-4">
                    <p className="text-[10px] font-mono mb-1">Debug: Resposta da API</p>
                    <pre className="text-[10px] bg-muted/60 p-2 rounded overflow-auto max-h-32 text-left">
                      {JSON.stringify(debugData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Como funciona a conexão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <p className="text-muted-foreground">
              Este módulo consome o endpoint seguro do backend (<code>/api/evolution/qrcode</code>), que por sua vez chama
              a Evolution API usando as credenciais configuradas no servidor Node.
            </p>
            <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
              <li>O QR Code é gerado pela instância <span className="font-medium">integrai</span> da Evolution.</li>
              <li>Nenhuma chave sensível é exposta no frontend, apenas a imagem do QR.</li>
              <li>Use o botão “Atualizar QR” caso o código expire ou a leitura falhe.</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default QrCodePage;
