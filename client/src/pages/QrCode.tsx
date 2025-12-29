import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { QrCode as QrIcon, RefreshCcw } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";

const QrCodePage = () => {
  const { token } = useAuth();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>("unknown");
  const [instanceName, setInstanceName] = useState<string>("Carregando...");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll status only
  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/evolution/status", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Expected format: { instance: 'name', state: 'open' | 'close' | 'connecting' | ... }
        // Adjust based on verified Evolution response structure. Usually it's deep inside sometimes.
        // But our controller flattens or forwards. Let's assume forwarding exact Evolution response or normalized.
        // If our controller forwards: { instance: { state: 'open' , ... } } or just { state: 'open' }?
        // Let's safe check.

        if (data.instance) {
          if (typeof data.instance === 'string') {
            setInstanceName(data.instance);
            if (data.state) setConnectionState(data.state);
          } else if (typeof data.instance === 'object') {
            setInstanceName(data.instance.instanceName || "Instância");
            setConnectionState(data.instance.state || "unknown");
          }
        } else if (data.state) {
          setConnectionState(data.state);
        }
      }
    } catch (e) {
      console.error("Error polling status", e);
    }
  };

  // Only called on button click
  const handleGenerateQrKey = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setQrCode(null);

      const response = await fetch("/api/evolution/qrcode", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Erro ao gerar QR Code");
      }

      const data = await response.json();
      setQrCode(data.qrcode || null);
      if (data.instance) setInstanceName(data.instance);

      // If we got a QR code, the state is likely 'connecting' or waiting for scan
      setConnectionState("scanning");

    } catch (err: any) {
      setError(err?.message || "Erro ao buscar QR Code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (!confirm(`Tem certeza que deseja desconectar o WhatsApp da instância ${instanceName}? Isso irá parar o recebimento de mensagens na Evolution API.`)) return;

      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/evolution/disconnect", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Erro ao desconectar");

      setQrCode(null);
      setConnectionState("close");
      // fetchStatus will eventually pick up 'close' too

    } catch (err: any) {
      setError(err?.message || "Erro ao desconectar");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const isConnected = connectionState === 'open';

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Conexão da Instância: {instanceName}</h2>
          <p className="text-xs text-muted-foreground">
            Status atual: <span className={cn("font-bold", isConnected ? "text-green-600" : "text-amber-600")}>
              {isConnected ? "CONECTADO" : connectionState.toUpperCase()}
            </span>
          </p>
        </div>
        {!isConnected && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="inline-flex items-center gap-1.5 text-[11px]"
            onClick={handleGenerateQrKey}
            disabled={isLoading}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {isLoading ? "Gerando..." : "Gerar QR Code"}
          </Button>
        )}
      </header>

      <section className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm">QR Code / Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed bg-muted/40 p-4">

              {isConnected ? (
                <div className="flex flex-col items-center gap-2 text-green-600">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <QrIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="font-semibold text-sm">WhatsApp Conectado!</p>
                  <Button
                    onClick={handleDisconnect}
                    variant="destructive"
                    size="sm"
                    className="mt-2 text-xs"
                    disabled={isLoading}
                  >
                    Desconectar
                  </Button>
                </div>
              ) : (
                <>
                  {qrCode ? (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={qrCode}
                        alt="QR Code"
                        className="w-full max-w-[260px] rounded-lg border bg-white p-2 grayscale contrast-125"
                      />
                      <p className="max-w-xs text-center text-[11px] text-muted-foreground">
                        Aponte a câmera do WhatsApp para conectar.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      {isLoading ? (
                        <QrIcon className="h-10 w-10 animate-pulse" />
                      ) : (
                        <QrIcon className="h-10 w-10" />
                      )}
                      <p className="max-w-xs text-center text-[11px]">
                        {isLoading ? "Aguarde..." : "Desconectado. Clique em 'Gerar QR Code' para conectar."}
                      </p>
                      {error && <p className="text-red-500 font-medium">{error}</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/70">
          <CardContent className="pt-6 space-y-3 text-xs">
            <p className="text-muted-foreground">
              Dicas:
            </p>
            <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
              <li>Mantenha o celular conectado à internet.</li>
              <li>Se desconectar, clique em "Gerar QR Code" e leia-o novamente.</li>
              <li>Status 'open' indica funcionamento normal.</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default QrCodePage;
