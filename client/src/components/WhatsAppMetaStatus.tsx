import { useEffect, useMemo, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";

const DEFAULT_SUBSCRIPTION_FIELDS = ["messages", "messaging_postbacks", "message_status", "message_reactions"];

export function WhatsAppMetaStatus() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastSync, setLastSync] = useState<string>("");
  const [status, setStatus] = useState("inactive");

  const [config, setConfig] = useState<any>({
    channel_type: "whatsapp",
    connection_mode: "qr_code",
    provider: "api_plus",
    business_manager_id: "",
    waba_id: "",
    phone_number_id: "",
    meta_app_id: "",
    meta_app_secret: "",
    access_token: "",
    verify_token: "",
    webhook_url: "",
    callback_url: "",
    api_version: "v18.0",
    instance_key: "",
    instance_name: "",
    whatsapp_number: "",
    id_numero_meta: "",
    id_conta_comercial: "",
    sandbox_mode: false,
    server_region: "sa-east-1",
    receive_messages: true,
    receive_status: true,
    receive_contacts: true,
    receive_chat_updates: true,
    subscription_fields: DEFAULT_SUBSCRIPTION_FIELDS,
  });

  const isMetaMode = useMemo(
    () => config.channel_type === "whatsapp" && config.connection_mode === "qr_code" && config.provider === "api_plus",
    [config.channel_type, config.connection_mode, config.provider]
  );

  const updateField = (key: string, value: any) => setConfig((prev: any) => ({ ...prev, [key]: value }));

  const fetchConfig = async () => {
    if (!user?.company_id || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${user.company_id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao carregar configuração");

      setConfig((prev: any) => ({
        ...prev,
        ...data,
        subscription_fields: Array.isArray(data.subscription_fields) && data.subscription_fields.length ? data.subscription_fields : DEFAULT_SUBSCRIPTION_FIELDS,
      }));
      setStatus(data.whatsapp_meta_status || "inactive");
      setLastSync(data.whatsapp_meta_last_sync || "");
    } catch (error: any) {
      toast.error(error?.message || "Falha ao carregar WhatsApp Meta");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [user?.company_id, token]);

  const validateClient = () => {
    if (!config.access_token) return "Access Token permanente é obrigatório.";
    if (!String(config.access_token).startsWith("EAA")) return "Access Token deve iniciar com EAA.";
    if (!config.phone_number_id) return "Phone Number ID é obrigatório.";
    if (!/^\d+$/.test(String(config.phone_number_id))) return "Phone Number ID deve ser numérico.";
    if (!config.verify_token) return "Verify Token é obrigatório.";
    if (!config.meta_app_id) return "App ID é obrigatório.";
    if (!config.meta_app_secret) return "App Secret é obrigatório.";
    if (!config.instance_key) return "instance_key é obrigatório.";
    return null;
  };

  const handleTestConnection = async () => {
    const error = validateClient();
    if (error) return toast.error(error);

    setTesting(true);
    try {
      const res = await fetch("/api/whatsapp/meta/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accessToken: config.access_token,
          apiVersion: config.api_version,
          wabaId: config.waba_id,
          phoneNumberId: config.phone_number_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.status || data?.error || "Falha no teste da Meta");
      toast.success("Conectado com sucesso à Meta!");
      setStatus("active");
      setLastSync(new Date().toISOString());
    } catch (error: any) {
      setStatus("inactive");
      toast.error(error?.message || "Falha ao testar conexão");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!user?.company_id || !token) return;
    const error = validateClient();
    if (error) return toast.error(error);

    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${user.company_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...config,
          name: (user as any)?.company?.name || "Empresa",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao salvar configuração WhatsApp Meta");
      toast.success("Configuração WhatsApp Meta salva com sucesso.");
      await fetchConfig();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded border p-3">
        <div className="flex items-center gap-2">
          {status === "active" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Unplug className="h-4 w-4 text-amber-600" />}
          <Badge variant={status === "active" ? "default" : "secondary"}>{status === "active" ? "Conectado" : "Desconectado"}</Badge>
        </div>
        <Button variant="outline" size="icon" onClick={fetchConfig}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input value={config.channel_type} onChange={(e) => updateField("channel_type", e.target.value)} placeholder="Tipo de Canal" />
            <Input value={config.connection_mode} onChange={(e) => updateField("connection_mode", e.target.value)} placeholder="Modo de Conexão" />
            <Input value={config.provider} onChange={(e) => updateField("provider", e.target.value)} placeholder="Provedor" />
          </div>

          {isMetaMode && (
            <>
              <div className="text-xs font-semibold text-muted-foreground">🔐 Credenciais Meta</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input value={config.business_manager_id || ""} onChange={(e) => updateField("business_manager_id", e.target.value)} placeholder="Business Manager ID" />
                <Input value={config.waba_id || ""} onChange={(e) => updateField("waba_id", e.target.value)} placeholder="WABA ID" />
                <Input value={config.phone_number_id || ""} onChange={(e) => updateField("phone_number_id", e.target.value)} placeholder="Phone Number ID" />
                <Input value={config.meta_app_id || ""} onChange={(e) => updateField("meta_app_id", e.target.value)} placeholder="App ID" />
                <Input type="password" value={config.meta_app_secret || ""} onChange={(e) => updateField("meta_app_secret", e.target.value)} placeholder="App Secret" />
                <Input type="password" value={config.access_token || ""} onChange={(e) => updateField("access_token", e.target.value)} placeholder="Access Token Permanente" />
                <Input value={config.verify_token || ""} onChange={(e) => updateField("verify_token", e.target.value)} placeholder="Verify Token" />
                <Input value={config.webhook_url || ""} onChange={(e) => updateField("webhook_url", e.target.value)} placeholder="Webhook URL (auto)" />
              </div>

              <div className="text-xs font-semibold text-muted-foreground">📱 Dados da Instância</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input value={config.instance_key || ""} onChange={(e) => updateField("instance_key", e.target.value)} placeholder="Nome da Instância (instance_key)" />
                <Input value={config.whatsapp_number || ""} onChange={(e) => updateField("whatsapp_number", e.target.value)} placeholder="Número do WhatsApp vinculado" />
                <Input value={config.id_numero_meta || ""} onChange={(e) => updateField("id_numero_meta", e.target.value)} placeholder="ID do Número" />
                <Input value={config.id_conta_comercial || ""} onChange={(e) => updateField("id_conta_comercial", e.target.value)} placeholder="ID da Conta Comercial" />
              </div>

              <div className="text-xs font-semibold text-muted-foreground">🌐 Webhook + Técnico</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input value={config.callback_url || ""} onChange={(e) => updateField("callback_url", e.target.value)} placeholder="URL de Callback (auto)" />
                <Input value={config.api_version || "v18.0"} onChange={(e) => updateField("api_version", e.target.value)} placeholder="Versionamento API" />
                <Input value={config.server_region || ""} onChange={(e) => updateField("server_region", e.target.value)} placeholder="Região do Servidor" />
                <Input value={config.instance_name || ""} onChange={(e) => updateField("instance_name", e.target.value)} placeholder="Nome amigável da instância" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <label className="flex items-center gap-2"><Switch checked={!!config.sandbox_mode} onCheckedChange={(v) => updateField("sandbox_mode", v)} /> Sandbox</label>
                <label className="flex items-center gap-2"><Switch checked={!!config.receive_messages} onCheckedChange={(v) => updateField("receive_messages", v)} /> Receber mensagens</label>
                <label className="flex items-center gap-2"><Switch checked={!!config.receive_status} onCheckedChange={(v) => updateField("receive_status", v)} /> Receber status (DELIVERY_ACK, READ)</label>
                <label className="flex items-center gap-2"><Switch checked={!!config.receive_contacts} onCheckedChange={(v) => updateField("receive_contacts", v)} /> Receber contatos</label>
                <label className="flex items-center gap-2"><Switch checked={!!config.receive_chat_updates} onCheckedChange={(v) => updateField("receive_chat_updates", v)} /> Atualizações de chat</label>
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-2"><ShieldCheck className="h-3 w-3" /> Subscription fields fixos: {DEFAULT_SUBSCRIPTION_FIELDS.join(", ")}</div>
            </>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTestConnection} disabled={testing}>{testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Testar Conexão</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar Configurações</Button>
          </div>
          <div className="text-xs text-muted-foreground">Última sincronização: {lastSync ? new Date(lastSync).toLocaleString("pt-BR") : "-"}</div>
        </CardContent>
      </Card>
    </div>
  );
}
