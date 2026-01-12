import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { QrCode as QrIcon, RefreshCcw, Instagram, MessageCircle, MessageSquare } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const QrCodePage = () => {
  const { token, user } = useAuth();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>("unknown");
  const [instanceName, setInstanceName] = useState<string>("Carregando...");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<string>("whatsapp");

  // Multi-Company (Superadmin)
  const [availableCompanies, setAvailableCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Multi-Instance
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<any>(null);

  const getApiUrl = (endpoint: string) => {
    const params = new URLSearchParams();
    if (selectedCompanyId) params.append("companyId", selectedCompanyId);
    if (selectedInstance) params.append("instanceKey", selectedInstance.instance_key);

    const queryString = params.toString();
    return `${endpoint}${queryString ? `?${queryString}` : ""}`;
  };

  // Poll status only
  const fetchStatus = async () => {
    try {
      const url = getApiUrl("/api/evolution/status");
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();

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

      const url = getApiUrl("/api/evolution/qrcode");
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const body = await response.text();
        // Try parsing JSON error
        try {
          const errJson = JSON.parse(body);
          throw new Error(errJson.error || errJson.message || "Erro ao gerar QR Code");
        } catch (e: any) {
          throw new Error(body || "Erro ao gerar QR Code");
        }
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

      const url = getApiUrl("/api/evolution/disconnect");
      const response = await fetch(url, {
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

  const handleFixSync = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const url = getApiUrl("/api/evolution/webhook/set");
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        alert("Sincronização ajustada com sucesso! As mensagens agora devem chegar corretamente.");
      } else {
        const err = await response.json();
        throw new Error(err.error || "Erro ao ajustar sincronização");
      }
    } catch (err: any) {
      setError(err?.message || "Erro ao ajustar sincronização");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      if (user?.role === 'SUPERADMIN') {
        fetch('/api/companies', {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(r => r.json())
          .then(data => {
            if (Array.isArray(data)) setAvailableCompanies(data);
          })
          .catch(e => console.error("Error fetching companies", e));
      }
    }
  }, [token, user?.role]);

  // Load instances when company context changes
  useEffect(() => {
    if (!token) return;
    const targetId = selectedCompanyId || user?.company_id;
    if (!targetId) return;

    setIsLoading(true);
    fetch(`/api/companies/${targetId}/instances`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setInstances(data);
          if (data.length > 0) {
            // If previously selected instance exists in new list, keep it (by ID), else pick first
            setSelectedInstance(data[0]);
          } else {
            setInstances([]);
            setSelectedInstance(null);
          }
        }
      })
      .catch(e => {
        console.error("Failed to load instances", e);
        setInstances([]);
      })
      .finally(() => setIsLoading(false));

  }, [token, selectedCompanyId, user?.company_id]);

  useEffect(() => {
    if (token) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 10000); // 10s is enough for status
      return () => clearInterval(interval);
    }
  }, [token, selectedCompanyId, selectedInstance]);

  // Redefine data when instance changes
  useEffect(() => {
    setQrCode(null);
    setConnectionState("unknown");
    setInstanceName("Carregando...");
    setError(null);
  }, [selectedInstance]);

  const isConnected = connectionState === 'open';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Canais de Comunicação</h1>
          <p className="text-sm text-muted-foreground italic">
            Conecte e gerencie seus canais de atendimento oficial.
          </p>
        </div>

        {user?.role === 'SUPERADMIN' && availableCompanies.length > 0 && (
          <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900 p-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <span className="text-[11px] font-bold text-zinc-500 uppercase">Empresa:</span>
            <select
              className="text-xs bg-transparent border-none focus:ring-0 font-medium outline-none"
              value={selectedCompanyId || ""}
              onChange={(e) => setSelectedCompanyId(e.target.value || null)}
            >
              <option value="">Selecione para configurar</option>
              {availableCompanies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
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

          {/* Instance Selector */}
          {instances.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Selecione a Instância:</p>
              <div className="flex flex-wrap gap-2">
                {instances.map(inst => (
                  <Button
                    key={inst.id}
                    variant={selectedInstance?.id === inst.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedInstance(inst)}
                    className={cn(
                      "h-9 px-4 text-xs shadow-sm transition-all",
                      selectedInstance?.id === inst.id ? "ring-2 ring-primary ring-offset-2" : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {inst.name}
                    <span className={cn(
                      "ml-2 w-2 h-2 rounded-full",
                      inst.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                      // Note: 'status' in company_instances might not be real-time like 'connectionState'. 
                      // We rely on connectionState for standard display.
                    )} />
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Conexão WhatsApp: {selectedInstance ? selectedInstance.name : instanceName}</h2>
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
                        <p className="text-[11px] text-muted-foreground">Sua instância {instanceName} está pronta para enviar e receber mensagens.</p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Button
                          onClick={handleFixSync}
                          variant="outline"
                          size="sm"
                          className="mt-2 text-xs h-8 px-4 border-zinc-200 hover:bg-zinc-50"
                          disabled={isLoading}
                        >
                          <RefreshCcw className={cn("h-3 w-3 mr-1", isLoading && "animate-spin")} />
                          Corrigir Sincronização
                        </Button>
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
                      <p className="text-muted-foreground leading-normal">Selecione a instância desejada acima (se houver mais de uma).</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                      <p className="text-muted-foreground leading-normal">Mantenha seu celular carregado e com conexão ativa.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</div>
                      <p className="text-muted-foreground leading-normal">O tempo de expiração do QR Code é de 60 segundos.</p>
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
