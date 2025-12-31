import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { QrCode as QrIcon, RefreshCcw, Instagram, MessageCircle, MessageSquare } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const QrCodePage = () => {
  const { token } = useAuth();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>("unknown");
  const [instanceName, setInstanceName] = useState<string>("Carregando...");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<string>("whatsapp");

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
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Canais de Comunicação</h1>
        <p className="text-sm text-muted-foreground italic">
          Conecte e gerencie seus canais de atendimento oficial.
        </p>
      </header>

      <Tabs defaultValue="whatsapp" value={activePlatform} onValueChange={setActivePlatform} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex bg-muted/50 p-1 h-auto">
          <TabsTrigger value="whatsapp" className="flex items-center gap-2 py-2">
            <MessageSquare className="h-4 w-4" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="instagram" className="flex items-center gap-2 py-2">
            <Instagram className="h-4 w-4" /> Instagram
          </TabsTrigger>
          <TabsTrigger value="messenger" className="flex items-center gap-2 py-2">
            <MessageCircle className="h-4 w-4" /> Messenger
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Conexão WhatsApp: {instanceName}</h2>
              <p className="text-xs text-muted-foreground">
                Status atual: <span className={cn("font-bold px-2 py-0.5 rounded-full text-[10px]", isConnected ? "bg-black text-white" : "bg-zinc-100 text-zinc-900")}>
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
                <RefreshCcw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                {isLoading ? "Gerando..." : "Gerar novo QR Code"}
              </Button>
            )}
          </div>

          <section className="grid gap-4 md:grid-cols-[1fr_300px]">
            <Card className="border-none shadow-sm bg-background/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Painel de Conexão WhatsApp</CardTitle>
                <CardDescription className="text-xs text-[11px]">Digitalize o QR Code usando o aplicativo WhatsApp no seu celular.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex min-h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-muted bg-muted/40 p-4 transition-colors hover:bg-muted/50">

                  {isConnected ? (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center shadow-inner">
                        <MessageSquare className="h-10 w-10 text-black" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-lg text-black">WhatsApp Conectado!</p>
                        <p className="text-[11px] text-muted-foreground">Sua instância está pronta para enviar e receber mensagens.</p>
                      </div>
                      <Button
                        onClick={handleDisconnect}
                        variant="destructive"
                        size="sm"
                        className="mt-2 text-xs h-8 px-4"
                        disabled={isLoading}
                      >
                        Desconectar Instância
                      </Button>
                    </div>
                  ) : (
                    <>
                      {qrCode ? (
                        <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
                          <div className="bg-white p-4 rounded-2xl shadow-2xl border-2 border-black/5">
                            <img
                              src={qrCode}
                              alt="QR Code"
                              className="w-full max-w-[240px] rounded-lg"
                            />
                          </div>
                          <div className="space-y-1 text-center">
                            <p className="font-medium text-primary">Aguardando leitura...</p>
                            <p className="max-w-xs text-[11px] text-muted-foreground leading-relaxed">
                              Vá em Menu &gt; Dispositivos Conectados &gt; Conectar um Dispositivo no seu WhatsApp.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4 text-muted-foreground text-center">
                          <div className={cn("h-16 w-16 rounded-full bg-muted flex items-center justify-center", isLoading && "animate-pulse")}>
                            <QrIcon className="h-8 w-8" />
                          </div>
                          <div className="space-y-2">
                            <p className="max-w-xs font-medium">
                              {isLoading ? "Gerando credenciais..." : "Nenhuma conexão ativa"}
                            </p>
                            <p className="text-[10px] max-w-[200px]">
                              Clique no botão superior para iniciar o processo de vinculação.
                            </p>
                          </div>
                          {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-100 text-[10px] mt-2 max-w-xs">
                              {error}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-none shadow-sm h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Configuração Rápida</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
                      <p className="text-muted-foreground leading-normal">Mantenha seu celular carregado e com conexão ativa.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                      <p className="text-muted-foreground leading-normal">O tempo de expiração do QR Code é de 60 segundos.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</div>
                      <p className="text-muted-foreground leading-normal">Você pode conectar múltiplas instâncias (opcional).</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="font-semibold text-primary mb-2">Suporte Técnico</p>
                    <p className="text-[10px] text-muted-foreground">Em caso de falha persistente, tente reiniciar a conexão ou contate o administrador.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="instagram" className="space-y-4">
          <Card className="border-dashed bg-muted/20 min-h-[400px] flex items-center justify-center">
            <div className="flex flex-col items-center text-center p-8 space-y-4">
              <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center">
                <Instagram className="h-10 w-10 text-black" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Integração com Instagram</h3>
                <p className="text-muted-foreground max-w-sm">
                  Em breve você poderá conectar o chat do seu Instagram Business aqui para gerenciar directs e comentários diretamente pelo CRM.
                </p>
              </div>
              <Button disabled variant="outline" className="mt-4">
                Configurar em Breve
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="messenger" className="space-y-4">
          <Card className="border-dashed bg-muted/20 min-h-[400px] flex items-center justify-center">
            <div className="flex flex-col items-center text-center p-8 space-y-4">
              <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center">
                <MessageCircle className="h-10 w-10 text-black" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Integração com Messenger</h3>
                <p className="text-muted-foreground max-w-sm">
                  Estamos finalizando a integração oficial com as Fan Pages do Facebook. Atenda seus clientes Messenger pelo nosso multiatendimento.
                </p>
              </div>
              <Button disabled variant="outline" className="mt-4">
                Configurar em Breve
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default QrCodePage;
