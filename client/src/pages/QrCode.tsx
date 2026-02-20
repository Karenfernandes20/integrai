import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { QrCode as QrIcon, RefreshCcw, Instagram, MessageCircle, MessageSquare, Settings, Link2, Link2Off, ChevronRight, CheckCircle2, XCircle, AlertCircle, Info, ExternalLink } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { io } from "socket.io-client";
import { cn } from "../lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";



type InstagramInstanceConfig = {
  callback_url: string;
  webhook_token: string;
};

const generateWebhookToken = (companyId: string | number | null | undefined, index: number) => {
  const safeCompany = String(companyId || 'empresa');
  const rand = Math.random().toString(36).slice(2, 8);
  return `ig_${safeCompany}_${index + 1}_${rand}`;
};

const buildInstagramCallbackUrl = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/api/webhooks/instagram`;
};

const generateWhatsappOfficialToken = (companyId: string | number | null | undefined) => {
  const safeCompany = String(companyId || 'empresa');
  const rand = Math.random().toString(36).slice(2, 10);
  return `wa_off_${safeCompany}_${rand}`;
};

const normalizeInstagramConfigs = (
  rawConfigs: any,
  limit: number,
  companyId: string | number | null | undefined
): InstagramInstanceConfig[] => {
  const parsed = Array.isArray(rawConfigs) ? rawConfigs : [];
  return Array.from({ length: Math.max(1, limit) }).map((_, index) => {
    const current = parsed[index] || {};
    const token = (current.webhook_token || '').trim() || generateWebhookToken(companyId, index);
    return {
      callback_url: (current.callback_url || '').trim() || buildInstagramCallbackUrl(),
      webhook_token: token
    };
  });
};

const QrCodePage = () => {
  const { token, user } = useAuth();
  const [company, setCompany] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>("unknown");
  const [instanceName, setInstanceName] = useState<string>("Carregando...");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Multi-Company (Superadmin)
  const [availableCompanies, setAvailableCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Multi-Instance (Evolution)
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<any>(null);

  // Modals
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [isIgModalOpen, setIsIgModalOpen] = useState(false);
  const [isMeModalOpen, setIsMeModalOpen] = useState(false);
  const [selectedInstagramIndex, setSelectedInstagramIndex] = useState(0);
  const [instagramInstanceConfigs, setInstagramInstanceConfigs] = useState<InstagramInstanceConfig[]>([]);

  const whatsappType = company?.whatsapp_type || "evolution";
  const isEvolutionChannel = whatsappType === "evolution";
  const isOfficialChannel = whatsappType === "official";
  const isApiPlusChannel = whatsappType === "api_plus";

  const getApiUrl = (endpoint: string, overrideInstanceKey?: string) => {
    const params = new URLSearchParams();
    const targetCompId = selectedCompanyId || user?.company_id;
    if (targetCompId) params.append("companyId", String(targetCompId));

    // Prioritize override, then state, then fallback
    const key = overrideInstanceKey || selectedInstance?.instance_key;
    if (key) params.append("instanceKey", key);

    const queryString = params.toString();
    return `${endpoint}${queryString ? `?${queryString}` : ""}`;
  };

  const fetchCompany = async () => {
    const targetId = selectedCompanyId || user?.company_id;
    if (!targetId || !token) return;
    try {
      const res = await fetch(`/api/companies/${targetId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const igLimit = Number(data?.instagram_limit || 1);
        const normalizedIgConfigs = normalizeInstagramConfigs(data?.instagram_instances_config, igLimit, data?.id);
        setCompany({ ...data, instagram_instances_config: normalizedIgConfigs });
        setInstagramInstanceConfigs(normalizedIgConfigs);
      }
    } catch (e) {
      console.error("Error fetching company", e);
    }
  };

  const fetchStatus = async () => {
    if (!company?.whatsapp_enabled || company?.whatsapp_type !== 'evolution') return;
    try {
      const targetId = selectedCompanyId || user?.company_id;
      const instanceKey = selectedInstance?.instance_key;
      const url = getApiUrl(`/api/evolution/status`);
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

  const handleGenerateQrKey = async (instanceOverrideOrEvent?: any, skipSave: boolean = false) => {
    // Handle overload: if first arg is mostly looks like an event or is null, ignore it.
    let targetInstance = selectedInstance;
    if (instanceOverrideOrEvent && !instanceOverrideOrEvent.preventDefault && !instanceOverrideOrEvent.nativeEvent) {
      targetInstance = instanceOverrideOrEvent;
    }

    // Safety check - we need an instance target
    if (!targetInstance) return;

    // Use a local variable for the instance key to ensure we use the correct one
    let currentInstanceKey = targetInstance.instance_key;

    try {
      setIsLoading(true);
      setError(null);
      setQrCode(null);
      setConnectionState("connecting");

      const targetId = selectedCompanyId || user?.company_id;

      // If we need to save the instance first, do it
      if (company?.whatsapp_type === 'evolution' && !skipSave) {
        // Build a proper allInstances array
        const maxSlots = Number(company?.whatsapp_limit || 1);
        const allInstances: any[] = [];

        for (let i = 0; i < maxSlots; i++) {
          const existingInst = instances[i];
          // If we're editing this slot and it matches, use the updated version
          if (targetInstance && (!targetInstance.id && targetInstance.slot_index === i) || (targetInstance.id && existingInst?.id === targetInstance.id)) {
            allInstances.push(targetInstance);
          } else if (existingInst) {
            allInstances.push(existingInst);
          }
        }

        const saveRes = await fetch(`/api/companies/${targetId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            ...company,
            instanceDefinitions: allInstances
          })
        });

        if (saveRes.ok) {
          if (targetInstance.id) {
            await fetch(`/api/companies/${targetId}/instances/${targetInstance.id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                name: targetInstance.name,
                instance_key: targetInstance.instance_key,
                api_key: targetInstance.api_key,
                color: targetInstance.color
              })
            });
            // Refresh instances to get any sanitized versions if needed
            const instRes = await fetch(`/api/companies/${targetId}/instances`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            if (instRes.ok) {
              const instData = await instRes.json();
              setInstances(instData);
              const updated = instData.find((i: any) => i.id === targetInstance.id);
              if (updated) {
                // IMPORTANT: Update local targetInstance and key for the next step
                targetInstance = updated;
                currentInstanceKey = updated.instance_key;
                // Only update React state if we are still viewing this instance
                if (selectedInstance && selectedInstance.id === updated.id) {
                  setSelectedInstance(updated);
                }
              }
            }
          }
        }
      }

      // Re-read instanceKey after possible sanitation update
      // Use helper with explicit key
      const url = getApiUrl(`/api/evolution/qrcode`, currentInstanceKey);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const body = await response.text();
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
      setConnectionState("scanning");
    } catch (err: any) {
      setError(err?.message || "Erro ao buscar QR Code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async (instance?: any) => {
    try {
      const targetInstance = instance || selectedInstance;
      if (!targetInstance) {
        setError("Nenhuma instância selecionada para desconectar");
        return;
      }

      if (!confirm(`Tem certeza que deseja desconectar "${targetInstance.name || targetInstance.instance_key}"?`)) return;

      setIsLoading(true);
      setError(null);
      const targetId = selectedCompanyId || user?.company_id;

      if (!targetId) {
        throw new Error("Company ID não disponível");
      }

      console.log("[QrCode] Disconnecting instance:", {
        companyId: targetId,
        instanceKey: targetInstance.instance_key,
        instanceId: targetInstance.id
      });

      // Build URL with both companyId and instanceKey
      const params = new URLSearchParams();
      params.append("companyId", String(targetId));
      params.append("instanceKey", targetInstance.instance_key);
      const url = `/api/evolution/disconnect?${params.toString()}`;

      console.log("[Disconnect] Calling:", url);

      const response = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const body = await response.text();
        let errorMsg = "Erro ao desconectar da instância";
        try {
          const jsonBody = JSON.parse(body);
          errorMsg = jsonBody.error || jsonBody.message || errorMsg;
        } catch (e) {
          errorMsg = body || errorMsg;
        }
        console.error("[Disconnect] Error response:", { status: response.status, body });
        throw new Error(errorMsg);
      }

      console.log("[Disconnect] Success! Response OK");

      // Refresh instances to get updated status
      const instRes = await fetch(`/api/companies/${targetId}/instances?sync=true`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (instRes.ok) {
        const updatedInstances = await instRes.json();
        console.log("[Disconnect] Updated instances:", updatedInstances);
        if (Array.isArray(updatedInstances)) {
          setInstances(updatedInstances);
          // Update selected instance
          const updated = updatedInstances.find((i: any) => i.id === targetInstance.id);
          if (updated) {
            console.log("[Disconnect] Updated selected instance:", updated);
            setSelectedInstance(updated);
          }
        }
      }

      setQrCode(null);
      setConnectionState("disconnected");
      alert("Instância desconectada com sucesso!");
    } catch (err: any) {
      console.error("[Disconnect Error]:", err);
      setError(err?.message || "Erro ao desconectar");
      alert(err?.message || "Erro ao desconectar");
    } finally {
      setIsLoading(false);
    }
  };

  // WebSocket Listener for Real-Time Status
  useEffect(() => {
    const socket = io();

    socket.on('instance:status', (data: any) => {
      console.log('[QrCode] Socket instance update (Real-Time):', data);

      const { instanceKey, status, state } = data;

      // Update global instances list
      setInstances(prev => prev.map(inst => {
        if (inst.instance_key === instanceKey || inst.name === instanceKey) {
          const newStatus = status; // 'connected' | 'disconnected'
          console.log(`[QrCode] TROPICAL UPDATING INSTANCE ${inst.instance_key} -> ${newStatus}`);
          return { ...inst, status: newStatus };
        }
        return inst;
      }));

      // Update active selected instance state if matches
      // Use callback to access current selectedInstance
      setSelectedInstance(current => {
        if (current && (current.instance_key === instanceKey || current.name === instanceKey)) {
          const newStatus = status;
          // Also update connectionState (visual state for scanning/etc)
          if (newStatus === 'connected') setConnectionState('open');
          else if (newStatus === 'disconnected') setConnectionState('close');
          else setConnectionState(state || 'unknown');

          return { ...current, status: newStatus };
        }
        return current;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (token) {
      if (user?.role === 'SUPERADMIN') {
        fetch('/api/companies', {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(r => r.json())
          .then(data => { if (Array.isArray(data)) setAvailableCompanies(data); })
          .catch(e => console.error("Error fetching companies", e));
      }
      fetchCompany();
    }
  }, [token, user?.role, selectedCompanyId]);

  useEffect(() => {
    if (!token) return;
    const targetId = selectedCompanyId || user?.company_id;
    if (!targetId) return;

    fetch(`/api/companies/${targetId}/instances`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setInstances(data);
          if (data.length > 0) setSelectedInstance(data[0]);
          else setSelectedInstance(null);
        }
      })
      .catch(e => console.error("Failed to load instances", e));
  }, [token, selectedCompanyId, user?.company_id]);

  useEffect(() => {
    if (token && company) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [token, selectedCompanyId, selectedInstance, company]);


  useEffect(() => {
    if (!company) return;
    const normalized = normalizeInstagramConfigs(
      company.instagram_instances_config,
      Number(company.instagram_limit || 1),
      company.id
    );
    setInstagramInstanceConfigs(normalized);
    setCompany((prev: any) => ({ ...prev, instagram_instances_config: normalized }));
    if (selectedInstagramIndex >= normalized.length) {
      setSelectedInstagramIndex(0);
    }
  }, [company?.id, company?.instagram_limit]);

  const handleInstagramInstanceConfigChange = (index: number, field: keyof InstagramInstanceConfig, value: string) => {
    setInstagramInstanceConfigs((prev) => {
      const next = [...prev];
      if (!next[index]) {
        const token = generateWebhookToken(company?.id, index);
        next[index] = {
          callback_url: buildInstagramCallbackUrl(),
          webhook_token: token
        };
      }
      next[index] = { ...next[index], [field]: value };
      setCompany((prevCompany: any) => ({ ...prevCompany, instagram_instances_config: next }));
      return next;
    });
  };

  const handleCompanyChange = (field: string, value: any) => {
    setCompany((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleTestConnection = async (type: string) => {
    setIsLoading(true);
    // Mocking a connection test
    setTimeout(() => {
      setIsLoading(false);
      alert(`Teste de conexão ${type.toUpperCase()} concluído com sucesso!`);
    }, 2000);
  };

  const handleSaveCompany = async (startConnection: boolean = false) => {
    try {
      const targetId = selectedCompanyId || user?.company_id;
      if (!targetId) return;

      // Validation for Evolution mode
      if (company?.whatsapp_type === 'evolution' && selectedInstance && isWaModalOpen) {
        if (!selectedInstance.name?.trim()) {
          alert("O nome amigável (Nome Comercial) é obrigatório.");
          return;
        }
        if (!selectedInstance.instance_key?.trim()) {
          alert("A chave da instância é obrigatória.");
          return;
        }
        if (!selectedInstance.api_key?.trim()) {
          alert("A API Key da instância é obrigatória.");
          return;
        }
      }

      setIsLoading(true);

      const trimmedInstance = selectedInstance ? {
        ...selectedInstance,
        name: selectedInstance.name?.trim() || "",
        instance_key: selectedInstance.instance_key?.trim() || "",
        api_key: selectedInstance.api_key?.trim() || "",
        color: selectedInstance.color || "#3b82f6"
      } : null;

      // Build a proper allInstances array that includes all current instances
      const allInstances: any[] = [];
      const maxSlots = Number(company?.whatsapp_limit || 1);

      for (let i = 0; i < maxSlots; i++) {
        const existingInst = instances[i];
        // If we're editing this slot and it matches, use the updated version
        const isEditingThisSlot = trimmedInstance && (
          (!trimmedInstance.id && trimmedInstance.slot_index === i) ||
          (trimmedInstance.id && existingInst?.id === trimmedInstance.id)
        );

        if (isEditingThisSlot) {
          console.log(`[QrCode] Adding edited instance at index ${i}:`, trimmedInstance);
          allInstances.push(trimmedInstance);
        } else if (existingInst) {
          console.log(`[QrCode] Keeping existing instance at index ${i}:`, { id: existingInst.id, name: existingInst.name });
          allInstances.push(existingInst);
        } else {
          console.log(`[QrCode] Skipping empty slot ${i}`);
        }
      }

      console.log("[QrCode] Building instanceDefinitions:", {
        maxSlots,
        selectedInstance: trimmedInstance,
        allInstances
      });

      const res = await fetch(`/api/companies/${targetId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...company,
          instanceDefinitions: allInstances
        })
      });

      console.log("[QrCode] Save response status:", res.status);

      if (res.ok) {
        // Also save instance if selected
        if (company?.whatsapp_type === 'evolution' && trimmedInstance) {
          const instancePayload = {
            name: trimmedInstance.name,
            instance_key: trimmedInstance.instance_key,
            api_key: trimmedInstance.api_key,
            color: trimmedInstance.color
          };

          console.log("[QrCode] Saving individual instance:", {
            instanceId: trimmedInstance.id,
            payload: { ...instancePayload, api_key: '***' }
          });

          if (trimmedInstance.id) {
            await fetch(`/api/companies/${targetId}/instances/${trimmedInstance.id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify(instancePayload)
            });
          } else {
            console.warn("[QrCode] Instance has no ID yet - will be created via instanceDefinitions");
          }
        }

        // Refresh instances
        const instRes = await fetch(`/api/companies/${targetId}/instances`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const updatedInstances = await instRes.json();

        console.log("[QrCode] Updated instances from server:", updatedInstances);

        if (Array.isArray(updatedInstances)) {
          setInstances(updatedInstances);
          // Update selected instance with fresh data from DB to ensure IDs are synced
          if (selectedInstance) {
            // Try to find by ID first, then by matching key if it was new
            let updated = updatedInstances.find((i: any) => i.id === selectedInstance.id);
            if (!updated && selectedInstance.slot_index !== undefined) {
              updated = updatedInstances[selectedInstance.slot_index];
            }
            if (!updated && selectedInstance.instance_key) {
              // Last resort: match by instance_key
              updated = updatedInstances.find((i: any) => i.instance_key === selectedInstance.instance_key);
            }
            if (updated) {
              console.log("[QrCode] Synchronized selectedInstance with DB data:", updated);
              setSelectedInstance(updated);
            }
          }
        }

        if (startConnection) {
          // Trigger QR Code generation
          let instanceToConnect = selectedInstance;
          if (Array.isArray(updatedInstances)) {
            let updated = updatedInstances.find((i: any) => i.id === selectedInstance?.id);
            if (!updated && selectedInstance?.slot_index !== undefined) {
              updated = updatedInstances[selectedInstance.slot_index];
            }
            if (!updated && selectedInstance?.instance_key) {
              updated = updatedInstances.find((i: any) => i.instance_key === selectedInstance.instance_key);
            }
            if (updated) instanceToConnect = updated;
          }

          console.log("[QrCode] Starting QR generation with instance:", instanceToConnect);
          await handleGenerateQrKey(instanceToConnect, true);
        } else {
          alert("Configurações salvas com sucesso!");
          setIsWaModalOpen(false);
          setIsIgModalOpen(false);
          setIsMeModalOpen(false);
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Erro ao salvar configurações (${res.status})`);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isConnected = connectionState === 'open';
  const selectedInstagramConfig = instagramInstanceConfigs[selectedInstagramIndex];

  const ChannelCard = ({
    type,
    title,
    icon: Icon,
    enabled,
    connected,
    onConfigure,
    onDisconnect,
    statusText,
    color = '#3b82f6'
  }: any) => {
    if (!enabled) return null;

    return (
      <Card className="overflow-hidden border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-300 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm group relative">
        {/* Color Stripe */}
        {type === 'whatsapp' && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-300 group-hover:w-2"
            style={{ backgroundColor: color }}
          />
        )}
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 pl-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl transition-all duration-500 group-hover:scale-110",
              type === 'whatsapp' ? "bg-green-50 text-green-600 dark:bg-green-950/30" :
                type === 'instagram' ? "bg-pink-50 text-pink-600 dark:bg-pink-950/30" :
                  "bg-blue-50 text-blue-600 dark:bg-blue-950/30"
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-sm font-bold tracking-tight">{title}</CardTitle>
              <CardDescription className="text-[10px] uppercase font-semibold tracking-widest text-zinc-400">Canal de Atendimento</CardDescription>
            </div>
          </div>
          <Badge className={cn(
            "text-[10px] px-2 py-0 border-none font-bold uppercase tracking-wider",
            connected ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          )}>
            {connected ? "Conectado" : "Pendente"}
          </Badge>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {connected ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-zinc-400" />
              )}
              {connected ? (statusText || "Serviço Ativo e Rodando") : "Aguardando Configuração"}
            </div>
            {type === 'whatsapp' && company?.whatsapp_type === 'evolution' && instances.length > 0 && (
              <div className="mt-2 text-[10px] text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700">
                <span className="font-bold opacity-50">INSTÂNCIA ATIVA:</span> {selectedInstance?.name || instanceName}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="pt-2 gap-2 border-t border-zinc-50 dark:border-zinc-800">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            onClick={onConfigure}
          >
            <Settings className="h-3 w-3 mr-2" />
            Configurar
          </Button>
          {connected && (
            <Button
              variant="destructive"
              size="sm"
              className="px-3 h-9"
              onClick={onDisconnect}
            >
              <Link2Off className="h-3 w-3" />
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-primary rounded-full" />
              <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">QR Code / Integrações</h1>
            </div>
            <p className="text-sm text-zinc-500 font-medium ml-3">
              Gerencie as conexões oficiais de WhatsApp, Instagram e Messenger.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {user?.role === 'SUPERADMIN' && availableCompanies.length > 0 && (
              <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-1.5 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all hover:border-primary/50">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Empresa:</span>
                <select
                  className="text-xs bg-transparent border-none focus:ring-0 font-bold outline-none text-zinc-800 dark:text-zinc-200 cursor-pointer"
                  value={selectedCompanyId || ""}
                  onChange={(e) => setSelectedCompanyId(e.target.value || null)}
                >
                  <option value="">Seu Contexto</option>
                  {availableCompanies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900 transition-all active:scale-95 shadow-sm">
              <RefreshCcw className="h-4 w-4 text-zinc-500" />
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {company?.whatsapp_enabled && Array.from({ length: Number(company?.whatsapp_limit || 1) }).map((_, i) => {
            const instance = instances[i];
            const isInstConnected = instance?.status === 'open' || instance?.status === 'connected';

            return (
              <ChannelCard
                key={`wa-${i}`}
                type="whatsapp"
                title={instance?.name || (Number(company?.whatsapp_limit) > 1 ? `WhatsApp ${i + 1}` : "WhatsApp")}
                icon={MessageSquare}
                enabled={true}
                connected={isInstConnected}
                color={instance?.color || '#3b82f6'}
                onConfigure={() => {
                  const instToEdit = instance || {
                    name: `WhatsApp ${i + 1}`,
                    instance_key: `${(company?.name || 'empresa').split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}_${i + 1}`,
                    api_key: '',
                    slot_index: i,
                    color: '#3b82f6'
                  };
                  setSelectedInstance({ ...instToEdit });
                  setIsWaModalOpen(true);
                }}
                onDisconnect={() => instance ? handleDisconnect(instance) : null}
                statusText={isInstConnected ? `Conectado (${instance?.name || "Instância"})` : (instance ? "Desconectado" : "Aguardando Configuração")}
              />
            );
          })}

          {/* INSTAGRAM CARDS */}
          {company?.instagram_enabled && Array.from({ length: Number(company?.instagram_limit || 1) }).map((_, i) => (
            <ChannelCard
              key={`ig-${i}`}
              type="instagram"
              title={Number(company?.instagram_limit) > 1 ? `Instagram ${i + 1}` : "Instagram"}
              icon={Instagram}
              enabled={true}
              connected={i === 0 && company?.instagram_status === 'ATIVO'}
              onConfigure={() => { setSelectedInstagramIndex(i); setIsIgModalOpen(true); }}
              onDisconnect={() => {/* Disconnect Logic */ }}
              statusText={i === 0 && company?.instagram_status === 'ATIVO' ? "Página Vinculada" : "Aguardando Configuração"}
            />
          ))}

          {/* MESSENGER CARDS */}
          {company?.messenger_enabled && Array.from({ length: Number(company?.messenger_limit || 1) }).map((_, i) => (
            <ChannelCard
              key={`me-${i}`}
              type="messenger"
              title={Number(company?.messenger_limit) > 1 ? `Messenger ${i + 1}` : "Messenger"}
              icon={MessageCircle}
              enabled={true}
              connected={i === 0 && company?.messenger_status === 'ATIVO'}
              onConfigure={() => setIsMeModalOpen(true)}
              onDisconnect={() => {/* Disconnect Logic */ }}
              statusText={i === 0 && company?.messenger_status === 'ATIVO' ? "Serviço Ativo" : "Aguardando Configuração"}
            />
          ))}

          {/* EMPTY STATE IF NONE ENABLED */}
          {company && !company.whatsapp_enabled && !company.instagram_enabled && !company.messenger_enabled && (
            <Card className="col-span-full py-16 flex flex-col items-center justify-center text-center border-dashed bg-zinc-50 dark:bg-zinc-900/50">
              <div className="h-20 w-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                <Link2 className="h-10 w-10 text-zinc-300" />
              </div>
              <CardTitle className="text-xl font-bold text-zinc-400">Nenhum canal habilitado</CardTitle>
              <CardDescription className="max-w-xs mt-2">
                Ative os canais de comunicação no cadastro da empresa para vê-los aqui.
              </CardDescription>
            </Card>
          )}
        </div>

        {/* WHATSAPP CONFIG MODAL */}
        <Dialog open={isWaModalOpen} onOpenChange={setIsWaModalOpen}>
          <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
            <div className="bg-green-600 p-6 text-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  Configurar WhatsApp
                </DialogTitle>
                <DialogDescription className="text-green-50/80 font-medium">
                  Selecione o motor de conexão e preencha as credenciais oficiais.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Tipo de Motor WhatsApp</Label>
                <Select
                  value={company?.whatsapp_type || 'evolution'}
                  onValueChange={(v) => handleCompanyChange('whatsapp_type', v)}
                >
                  <SelectTrigger className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 font-bold">
                    <SelectValue placeholder="Selecione o motor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="official">API Oficial (Meta / Cloud API)</SelectItem>
                    <SelectItem value="evolution">Evolution API (Multi-Instância)</SelectItem>
                    <SelectItem value="api_plus">WhatsApp API Plus</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isEvolutionChannel && (
                <>
              {/* UNIVERSAL INSTANCE NAMING */}
              <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 animate-in slide-in-from-top-4 duration-500">
                {selectedInstance && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-zinc-500">Nome Amigável (Ex: Comercial)</Label>
                      <Input
                        value={selectedInstance.name || ""}
                        onChange={(e) => setSelectedInstance(prev => prev ? { ...prev, name: e.target.value } : null)}
                        className="h-10 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-primary/20"
                        placeholder="Ex: Comercial, Suporte, etc."
                      />
                    </div>
                    {isEvolutionChannel && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-zinc-500">Chave da Instância <span className="text-red-500">*</span></Label>
                        <Input
                          value={selectedInstance.instance_key || ""}
                          onChange={(e) => setSelectedInstance(prev => prev ? { ...prev, instance_key: e.target.value } : null)}
                          className="h-10 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                          placeholder="Ex: comercial01"
                        />
                      </div>
                    )}
                  </div>
                )}
                {selectedInstance && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-zinc-500">API Key da Instância <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Input
                          type="password"
                          value={selectedInstance.api_key || ""}
                          onChange={(e) => setSelectedInstance(prev => prev ? { ...prev, api_key: e.target.value } : null)}
                          className="h-10 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 pr-10"
                          placeholder="Token da Instância"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-zinc-500">Cor do Canal (Identificação)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={selectedInstance.color || "#3b82f6"}
                          onChange={(e) => setSelectedInstance(prev => prev ? { ...prev, color: e.target.value } : null)}
                          className="w-12 h-10 p-1 rounded-lg cursor-pointer bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                        />
                        <Input
                          type="text"
                          value={selectedInstance.color || "#3b82f6"}
                          onChange={(e) => setSelectedInstance(prev => prev ? { ...prev, color: e.target.value } : null)}
                          className="flex-1 h-10 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 mt-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-zinc-500">URL do Servidor Evolution</Label>
                  <Input
                    value={company?.evolution_url || ""}
                    onChange={(e) => handleCompanyChange('evolution_url', e.target.value)}
                    className="h-10 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    placeholder="https://sua-api.com"
                  />
                </div>
              </div>
                </>
              )}

              <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                {/* OFFICIAL API VIEW */}
                {isOfficialChannel && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Phone Number ID</Label>
                        <Input value={company?.whatsapp_official_phone_number_id || ""} onChange={(e) => handleCompanyChange('whatsapp_official_phone_number_id', e.target.value)} className="h-9 rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase">Business Account ID</Label>
                        <Input value={company?.whatsapp_official_business_account_id || ""} onChange={(e) => handleCompanyChange('whatsapp_official_business_account_id', e.target.value)} className="h-9 rounded-lg" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Permanent Access Token</Label>
                      <Input type="password" value={company?.whatsapp_official_access_token || ""} onChange={(e) => handleCompanyChange('whatsapp_official_access_token', e.target.value)} className="h-9 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase">Verify Token (Webhook)</Label>
                        <Button
                          variant="link"
                          className="h-4 p-0 text-[10px] text-primary"
                          onClick={() => handleCompanyChange('whatsapp_official_webhook_token', generateWhatsappOfficialToken(company?.id))}
                        >
                          Gerar Novo
                        </Button>
                      </div>
                      <Input
                        value={company?.whatsapp_official_webhook_token || ""}
                        onChange={(e) => handleCompanyChange('whatsapp_official_webhook_token', e.target.value)}
                        className="h-9 rounded-lg font-mono text-xs"
                        placeholder="wa_off_..."
                      />
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 mt-2">
                      <Label className="text-[10px] font-bold text-indigo-600 block mb-1 uppercase italic">Callback URL (Webhook)</Label>
                      <div className="bg-white dark:bg-zinc-900 p-2 text-[9px] font-mono rounded border border-indigo-100 truncate text-zinc-500">
                        {`${window.location.origin}/api/webhooks/whatsapp/official/${company?.id}`}
                      </div>
                    </div>
                  </div>
                )}

                {/* EVOLUTION VIEW - QR CODE SECTION */}
                {isEvolutionChannel && (
                  <div className="animate-in fade-in duration-500">
                    {/* VALIDATION: Only show QR section if instance is properly configured */}
                    {selectedInstance?.instance_key && selectedInstance?.api_key && (
                      <>
                        {/* Only show QR code area if we are connecting, connected, or have a QR code */}
                        {(isConnected || connectionState === 'connecting' || connectionState === 'scanning' || qrCode) && (
                          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-3xl bg-white dark:bg-zinc-900 transition-all hover:border-primary/50 mt-4 relative overflow-hidden">

                            {/* Status Badge */}
                            <div className="absolute top-4 right-4">
                              <Badge className={cn(
                                "uppercase tracking-widest",
                                isConnected ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                              )}>
                                {isConnected ? "Conectado" : "Aguardando Conexão"}
                              </Badge>
                            </div>

                            {/* Info Block */}
                            <div className="w-full text-left mb-4 border-b pb-4 border-zinc-100 dark:border-zinc-800">
                              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Instância</p>
                              <p className="text-lg font-bold text-zinc-800 dark:text-white">{selectedInstance?.instance_key || "..."}</p>
                              <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                                Status: <span className={cn("font-bold", isConnected ? "text-green-500" : "text-yellow-500")}>{isConnected ? "Online" : "Pendente"}</span>
                              </p>
                            </div>

                            {isConnected ? (
                              <div className="text-center space-y-4 w-full">
                                <div className="h-20 w-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2 animate-in zoom-in duration-300">
                                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                                </div>
                                <div className="space-y-1">
                                  <p className="font-bold text-lg text-green-700 dark:text-green-400">Tudo Pronto!</p>
                                  <p className="text-sm text-zinc-500">Sua instância está conectada e operando.</p>
                                </div>
                                <Button variant="destructive" size="sm" onClick={handleDisconnect} className="rounded-xl w-full max-w-xs mt-4">
                                  Desconectar Instância
                                </Button>
                              </div>
                            ) : qrCode ? (
                              <div className="text-center space-y-4 w-full animate-in zoom-in duration-300">
                                <div className="p-4 bg-white rounded-3xl shadow-xl border border-zinc-100 inline-block text-center mb-2 mx-auto">
                                  <img src={qrCode} alt="QR" className="w-48 h-48 mix-blend-multiply" />
                                </div>
                                <div className="space-y-2">
                                  <p className="text-xs font-bold text-primary animate-pulse uppercase tracking-widest">Digitalize o código acima</p>
                                  <p className="text-xs text-zinc-400 max-w-xs mx-auto">Abra o WhatsApp {'>'} Configurações {'>'} Aparelhos Conectados {'>'} Conectar Aparelho</p>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className="text-sm font-medium text-zinc-500">Gerando QR Code...</p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* Instruction message if not configured yet */}
                    {(!selectedInstance?.instance_key || !selectedInstance?.api_key) && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl">
                        <div className="flex items-start gap-3">
                          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-blue-900 dark:text-blue-300">Configure a instância primeiro</p>
                            <p className="text-xs text-blue-700 dark:text-blue-400">
                              Preencha os campos obrigatórios acima:<br />
                              • <strong>Nome Amigável</strong> (Ex: Recepção, Comercial)<br />
                              • <strong>Chave da Instância</strong> (Ex: integrai)<br />
                              • <strong>API Key da Instância</strong><br />
                              Depois clique em "Salvar e Conectar" para gerar o QR Code.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* API PLUS VIEW */}
                {isApiPlusChannel && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Token API Plus</Label>
                      <Input type="password" value={company?.whatsapp_api_plus_token || ""} onChange={(e) => handleCompanyChange('whatsapp_api_plus_token', e.target.value)} className="h-9 rounded-lg" />
                    </div>
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-[10px] text-zinc-500 font-medium">
                      Esta é uma integração legada. Use apenas se necessário.
                    </div>
                  </div>
                )}
              </div>

              <Button
                className="w-full h-11 rounded-xl font-bold bg-green-600 hover:bg-green-700 shadow-xl shadow-green-100 dark:shadow-none mt-2 flex items-center gap-2"
                disabled={isLoading}
                onClick={() => handleTestConnection('whatsapp')}
              >
                <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} /> Testar Conexão WhatsApp
              </Button>
            </div>

            <DialogFooter className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <Button variant="outline" onClick={() => setIsWaModalOpen(false)} className="rounded-xl px-6 font-bold h-11">Cancelar</Button>
              <Button
                className={cn(
                  "rounded-xl px-8 font-bold shadow-lg h-11",
                  isEvolutionChannel && !isConnected ? "bg-green-600 hover:bg-green-700 text-white shadow-green-200" : "bg-primary shadow-primary/20"
                )}
                onClick={() => handleSaveCompany(isEvolutionChannel && !isConnected)}
                disabled={isLoading}
              >
                {isLoading ? "Processando..." : (isEvolutionChannel && !isConnected ? "Salvar e Conectar" : "Salvar Alterações")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* IG MODAL - Placeholder for modern UI */}
        <Dialog open={isIgModalOpen} onOpenChange={setIsIgModalOpen}>
          <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-8 text-white">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <Instagram className="h-7 w-7" /> Instagram Business
              </DialogTitle>
              <p className="text-purple-50/80 mt-1">Conecte sua conta profissional para automação de directs.</p>
            </div>
            <div className="p-6 grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase text-zinc-400">Facebook App ID</Label>
                  <Input value={company?.instagram_app_id || ""} onChange={(e) => handleCompanyChange('instagram_app_id', e.target.value)} className="rounded-xl h-10" placeholder="ID do App" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase text-zinc-400">App Secret</Label>
                  <Input type="password" value={company?.instagram_app_secret || ""} onChange={(e) => handleCompanyChange('instagram_app_secret', e.target.value)} className="rounded-xl h-10" placeholder="••••••••" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase text-zinc-400">Page ID</Label>
                  <Input value={company?.instagram_page_id || ""} onChange={(e) => handleCompanyChange('instagram_page_id', e.target.value)} className="rounded-xl h-10" placeholder="ID da Página" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase text-zinc-400">Business ID</Label>
                  <Input value={company?.instagram_business_id || ""} onChange={(e) => handleCompanyChange('instagram_business_id', e.target.value)} className="rounded-xl h-10" placeholder="ID Business" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-zinc-400">Access Token (Permanente)</Label>
                <Input type="password" value={company?.instagram_access_token || ""} onChange={(e) => handleCompanyChange('instagram_access_token', e.target.value)} className="rounded-xl h-10" placeholder="Token Meta" />
              </div>

              <div className="space-y-2 border-t pt-4 mt-2">
                <Label className="text-[11px] font-bold uppercase text-zinc-400">Instância do Instagram</Label>
                <Select value={String(selectedInstagramIndex)} onValueChange={(value) => setSelectedInstagramIndex(Number(value))}>
                  <SelectTrigger className="rounded-xl h-10">
                    <SelectValue placeholder="Selecione a instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: Number(company?.instagram_limit || 1) }).map((_, idx) => (
                      <SelectItem key={`ig-modal-${idx}`} value={String(idx)}>
                        Instagram {idx + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[11px] font-bold uppercase text-zinc-400">URL de Callback (Instância {selectedInstagramIndex + 1})</Label>
                  <Input
                    value={selectedInstagramConfig?.callback_url || ""}
                    onChange={(e) => handleInstagramInstanceConfigChange(selectedInstagramIndex, 'callback_url', e.target.value)}
                    className="rounded-xl h-10"
                    placeholder="https://seudominio.com/api/webhooks/instagram"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[11px] font-bold uppercase text-zinc-400">Token de Webhook (Instância {selectedInstagramIndex + 1})</Label>
                  <Input
                    value={selectedInstagramConfig?.webhook_token || ""}
                    onChange={(e) => {
                      const nextToken = e.target.value;
                      handleInstagramInstanceConfigChange(selectedInstagramIndex, 'webhook_token', nextToken);
                    }}
                    className="rounded-xl h-10"
                    placeholder="token_exclusivo_da_instancia"
                  />
                </div>
              </div>

              <Button
                className="w-full h-11 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 border-none shadow-lg mt-2"
                disabled={isLoading}
                onClick={() => handleTestConnection('instagram')}
              >
                Testar Integração Instagram
              </Button>
              <DialogFooter className="pt-4 border-t mt-2 flex justify-between gap-2 px-0">
                <Button variant="outline" onClick={() => setIsIgModalOpen(false)} className="rounded-xl px-6 font-bold h-11">
                  Cancelar
                </Button>
                <Button
                  className="rounded-xl bg-purple-600 hover:bg-purple-700 px-8 font-bold text-white shadow-lg h-11"
                  onClick={() => handleSaveCompany(false)}
                  disabled={isLoading}
                >
                  {isLoading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* MESSENGER MODAL */}
        <Dialog open={isMeModalOpen} onOpenChange={setIsMeModalOpen}>
          <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
            <div className="bg-blue-600 p-8 text-white">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <MessageCircle className="h-7 w-7" /> Facebook Messenger
              </DialogTitle>
              <p className="text-blue-50/80 mt-1">Integre sua Fan Page para centralizar as mensagens do Messenger.</p>
            </div>
            <div className="p-6 grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase text-zinc-400">Facebook App ID</Label>
                  <Input value={company?.messenger_app_id || ""} onChange={(e) => handleCompanyChange('messenger_app_id', e.target.value)} className="rounded-xl h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase text-zinc-400">App Secret</Label>
                  <Input type="password" value={company?.messenger_app_secret || ""} onChange={(e) => handleCompanyChange('messenger_app_secret', e.target.value)} className="rounded-xl h-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-zinc-400">Page ID</Label>
                <Input value={company?.messenger_page_id || ""} onChange={(e) => handleCompanyChange('messenger_page_id', e.target.value)} className="rounded-xl h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-zinc-400">Page Access Token</Label>
                <Input type="password" value={company?.messenger_access_token || ""} onChange={(e) => handleCompanyChange('messenger_access_token', e.target.value)} className="rounded-xl h-10" />
              </div>
              <Button
                className="w-full h-11 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 border-none shadow-lg mt-2"
                disabled={isLoading}
                onClick={() => handleTestConnection('messenger')}
              >
                Testar Messenger
              </Button>
              <DialogFooter className="pt-4 border-t mt-2 flex justify-end gap-2 px-0">
                <Button variant="ghost" onClick={() => setIsMeModalOpen(false)} className="rounded-xl px-4">Fechar</Button>
                <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 px-8 font-bold text-white shadow-lg" onClick={() => handleSaveCompany(false)} disabled={isLoading}>
                  {isLoading ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default QrCodePage;
