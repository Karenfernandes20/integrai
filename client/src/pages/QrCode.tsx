import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { QrCode as QrIcon, RefreshCcw, Instagram, MessageCircle, MessageSquare, Settings, Link2, Link2Off, ChevronRight, CheckCircle2, XCircle, AlertCircle, Info, ExternalLink, Activity } from "lucide-react";
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
  color: string;
  name?: string;
  default_queue_id?: number | null;
};

const DEFAULT_INSTAGRAM_COLOR = '#DD2A7B';

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
      webhook_token: token,
      color: (current.color || '').trim() || DEFAULT_INSTAGRAM_COLOR,
      name: (current.name || '').trim() || `Instagram ${index + 1}`,
      default_queue_id: current.default_queue_id || null
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
  const [errorDetails, setErrorDetails] = useState<any>(null);

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
  const [queues, setQueues] = useState<any[]>([]);

  const whatsappType = company?.whatsapp_type || "evolution";
  const isEvolutionChannel = whatsappType === "evolution" || whatsappType === "local" || whatsappType === "api_plus";
  const isInternalApi = whatsappType === "local" || whatsappType === "api_plus";
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
    if (!company?.whatsapp_enabled) return;

    try {
      if (company?.whatsapp_type === 'local' || company?.whatsapp_type === 'api_plus') {
        if (!selectedInstance?.instance_key) return;
        const url = `/api/instances/local/${selectedInstance.instance_key}/status`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'connected') setConnectionState('open');
          else if (data.status === 'disconnected') setConnectionState('close');
          else setConnectionState(data.status || 'unknown');
        }
        return;
      }

      if (company?.whatsapp_type !== 'evolution') return;

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

  // Sincroniza estado inicial rápido sem esperar o polling
  useEffect(() => {
    if (selectedInstance && isInternalApi) {
      if (selectedInstance.status === 'connected') {
        setConnectionState('open');
      } else if (selectedInstance.status === 'disconnected') {
        setConnectionState('close');
      }
    }
  }, [selectedInstance, isInternalApi]);

  useEffect(() => {
    const fetchQueues = async () => {
      if (!token) return;
      try {
        const targetId = selectedCompanyId || user?.company_id;
        if (!targetId) return;

        const res = await fetch(`/api/queues?companyId=${targetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setQueues(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("[QrCode] Error fetching queues:", e);
      }
    };

    fetchQueues();
  }, [token, selectedCompanyId, user?.company_id]);

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

      if ((company?.whatsapp_type === 'local' || company?.whatsapp_type === 'api_plus') && targetInstance) {
        try {
          // Conectar a API local (Mini-Evo)
          const initResponse = await fetch('/api/instances/local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              instanceId: targetInstance.instance_key,
              apiKey: targetInstance.api_key
            })
          });

          const initData = await initResponse.json().catch(() => ({}));
          if (!initResponse.ok) {
            throw new Error(initData.error || "Erro ao iniciar a API Interna.");
          }

          // Inicia a geração da checagem
          setConnectionState('scanning');

          // Polling para o QR Code (caso o socket demore ou falhe)
          const pollStart = Date.now();
          const pollInterval = setInterval(async () => {
            if (Date.now() - pollStart > 120000) { // 2 minutos de limite
              clearInterval(pollInterval);
              console.log("[QrCode] QR Code polling timeout after 2 minutes.");
              setError("Tempo limite atingido aguardando o QR Code.");
              return;
            }

            // Tenta buscar via API
            try {
              console.log(`[QrCode] Polling QR manual para ${targetInstance.instance_key}...`);
              const qrRes = await fetch(`/api/instances/local/${targetInstance.instance_key}/qrcode`, {
                headers: { Authorization: `Bearer ${token}` }
              });

              if (qrRes.ok) {
                const data = await qrRes.json();

                if (data.status === 'error') {
                  setError(data.error);
                  setErrorDetails(data.details);
                  // Not clearing interval yet, maybe it's a temporary connectivity issue?
                  // Actually, if it's a hard error, let's clear it.
                  if (data.error.includes('fora do ar')) clearInterval(pollInterval);
                } else if (data.qr) {
                  console.log("[QrCode] QR manual recebido com sucesso!");
                  setQrCode(data.qr);
                  setConnectionState('scanning');
                  setError(null);
                  setErrorDetails(null);
                  clearInterval(pollInterval);
                } else if (data.status === 'connected' || data.status === 'open') {
                  console.log("[QrCode] Instance already connected detected by polling.");
                  setConnectionState('open');
                  setQrCode(null);
                  setError(null);
                  setErrorDetails(null);
                  clearInterval(pollInterval);
                } else if (data.status === 'connecting') {
                  // Still waiting, message is in data.message if needed
                  console.log("[QrCode] Polling status: connecting...");
                }
              }
            } catch (e: any) {
              console.error("Erro no polling de qr code", e);
              setError("Erro de conexão com o servidor.");
            }
          }, 4000);

          return;

        } catch (error: any) {
          console.error(error);
          setError(error.message || "Houve um erro conectando à API Interna.");
          setIsLoading(false);
          return;
        }
      }

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
      let url = `/api/evolution/disconnect?${params.toString()}`;

      if (isInternalApi) {
        url = `/api/instances/local/${targetInstance.instance_key}/disconnect`;
      }

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
    const targetId = selectedCompanyId || user?.company_id;

    if (targetId) {
      socket.emit("join:company", targetId);
    }

    socket.on('instance:status', (data: any) => {
      console.log('[QrCode] Socket instance update (Real-Time):', data);

      const targetKey = data.instanceKey || data.instanceId || data.instance;
      const { status, state } = data;

      if (!targetKey) return;

      // Update global instances list
      setInstances(prev => prev.map(inst => {
        if (inst.instance_key === targetKey || inst.name === targetKey) {
          const newStatus = status; // 'connected' | 'disconnected'
          console.log(`[QrCode] TROPICAL UPDATING INSTANCE ${inst.instance_key} -> ${newStatus}`);
          return { ...inst, status: newStatus };
        }
        return inst;
      }));

      // Update active selected instance state if matches
      // Use callback to access current selectedInstance
      setSelectedInstance(current => {
        if (current && (current.instance_key === targetKey || current.name === targetKey)) {
          const newStatus = status;
          // Also update connectionState (visual state for scanning/etc)
          if (newStatus === 'connected' || newStatus === 'open') {
            setConnectionState('open');
            setQrCode(null); // Clear QR explicitly when connected
          }
          else if (newStatus === 'disconnected' || newStatus === 'close') setConnectionState('close');
          else setConnectionState(state || 'unknown');

          return { ...current, status: newStatus };
        }
        return current;
      });
    });

    socket.on('instance:qrcode', (data: any) => {
      console.log('[QrCode] Socket instance qrcode update:', data);
      const { instanceId, qr } = data;
      // We only want to set the QR code if this is the instance we show AND it's not connected
      setSelectedInstance(current => {
        if (current && (current.instance_key === instanceId || current.name === instanceId)) {
          if (current.status !== 'connected' && current.status !== 'open') {
            setQrCode(qr);
            setConnectionState('scanning');
          }
        }
        return current;
      });
    });

    return () => {
      socket.off('instance:status');
      socket.off('instance:qrcode');
      socket.disconnect();
    };
  }, [user?.company_id, selectedCompanyId]);

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
          webhook_token: token,
          color: DEFAULT_INSTAGRAM_COLOR,
          name: `Instagram ${index + 1}`,
          default_queue_id: null
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
      if ((company?.whatsapp_type === 'evolution' || company?.whatsapp_type === 'api_plus') && selectedInstance && isWaModalOpen) {
        if (!selectedInstance.name?.trim()) {
          alert("O nome amigável (Nome Comercial) é obrigatório.");
          return;
        }
        if (!selectedInstance.instance_key?.trim()) {
          alert("A Chave da Instância é obrigatória.");
          return;
        }
        if (company?.whatsapp_type !== 'api_plus' && company?.whatsapp_type !== 'local' && !selectedInstance.api_key?.trim()) {
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
        color: selectedInstance.color || "#3b82f6",
        type: company?.whatsapp_type === 'api_plus' ? 'local' : (company?.whatsapp_type || 'evolution')
      } : null;

      // Build a proper allInstances array that includes all current instances
      const allInstances: any[] = [];
      const waSlots = Number(company?.whatsapp_limit || 1);

      for (let i = 0; i < waSlots; i++) {
        const existingInst = instances.filter(inst => inst.type !== 'instagram')[i];
        // If we're editing this slot and it matches, use the updated version
        const isEditingThisSlot = trimmedInstance && (
          (!trimmedInstance.id && trimmedInstance.slot_index === i) ||
          (trimmedInstance.id && existingInst?.id === trimmedInstance.id)
        );

        if (isEditingThisSlot) {
          allInstances.push(trimmedInstance);
        } else if (existingInst) {
          allInstances.push(existingInst);
        }
      }

      // Add Instagram instances from config
      instagramInstanceConfigs.forEach((cfg, idx) => {
        allInstances.push({
          ...cfg,
          type: 'instagram',
          instance_key: cfg.webhook_token, // Unique enough
          slot_index: idx
        });
      });

      console.log("[QrCode] Building instanceDefinitions:", {
        waSlots,
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
        if ((company?.whatsapp_type === 'evolution' || company?.whatsapp_type === 'local' || company?.whatsapp_type === 'api_plus' || company?.whatsapp_type === 'official') && trimmedInstance) {
          const instancePayload = {
            name: trimmedInstance.name,
            instance_key: trimmedInstance.instance_key,
            api_key: trimmedInstance.api_key,
            color: trimmedInstance.color,
            default_queue_id: trimmedInstance.default_queue_id,
            type: trimmedInstance.type
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
          fetchCompany();
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

  const handleDeleteInstance = async (instance: any) => {
    if (!instance || !instance.id) return;
    const confirmName = window.prompt(`Isso APAGARÁ TODO O BANCO DE DADOS dessa instância (mensagens, conversas, configurações).\n\nDigite exatamente "${instance.instance_key}" para confirmar a exclusão:`);
    if (confirmName !== instance.instance_key) {
      if (confirmName !== null) alert("Nome incorreto. Exclusão cancelada.");
      return;
    }

    try {
      setIsLoading(true);
      const targetCompanyId = company?.id || selectedCompanyId || user?.company_id;
      const res = await fetch(`/api/companies/${targetCompanyId}/instances/${instance.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Instância Excluída: Todos os dados foram apagados com sucesso.");
        fetchCompany();
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao excluir instância");
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
    onDelete,
    statusText,
    color = '#3b82f6'
  }: any) => {
    if (!enabled) return null;

    return (
      <Card className="overflow-hidden border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-300 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm group relative">
        {/* Color Stripe */}
        {(type === 'whatsapp' || type === 'instagram') && (
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
              title="Desconectar"
            >
              <Link2Off className="h-3 w-3" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              className="px-3 h-9 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/30"
              onClick={onDelete}
              title="Excluir Instância Permanentemente"
            >
              Remover
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
                onDelete={instance?.id ? () => handleDeleteInstance(instance) : undefined}
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
              color={instagramInstanceConfigs[i]?.color || DEFAULT_INSTAGRAM_COLOR}
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

              {selectedInstance && (
                <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 animate-in slide-in-from-top-4 duration-500">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-zinc-500 flex items-center justify-between">
                      <span>Nome de Apresentação do Canal <span className="text-red-500">*</span></span>
                      <span className="text-[8px] font-normal lowercase opacity-70">(Ex: Comercial, Suporte)</span>
                    </Label>
                    <Input
                      value={selectedInstance.name || ""}
                      onChange={(e) => setSelectedInstance(prev => prev ? { ...prev, name: e.target.value } : null)}
                      required
                      className="h-10 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-primary/20 shadow-sm"
                      placeholder="Nome amigável para este canal..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-zinc-500">Fila padrão para novas mensagens</Label>
                    <Select
                      value={String(selectedInstance.default_queue_id || "none")}
                      onValueChange={(v) => setSelectedInstance(prev => prev ? { ...prev, default_queue_id: v === 'none' ? null : Number(v) } : null)}
                    >
                      <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <SelectValue placeholder="Sem fila (Conversas ficarão pendentes)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-zinc-400" />
                            <span>Sem fila</span>
                          </div>
                        </SelectItem>
                        {queues.map(q => (
                          <SelectItem key={q.id} value={String(q.id)}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: q.color || '#3b82f6' }} />
                              <span>{q.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[9px] text-zinc-400 pl-1">
                      Mensagens novas deste canal serão direcionadas automaticamente para esta fila.
                    </p>
                  </div>
                </div>
              )}

              {isEvolutionChannel && (
                <>
                  <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 animate-in slide-in-from-top-4 duration-500">
                    {selectedInstance && (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase text-zinc-500">
                            {whatsappType === 'api_plus' ? 'Nome da Instância (Mini-Evolution)' : 'Chave da Instância'} <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            value={selectedInstance.instance_key || ""}
                            onChange={(e) => setSelectedInstance(prev => prev ? { ...prev, instance_key: e.target.value } : null)}
                            className="h-10 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                            placeholder={whatsappType === 'api_plus' ? "Ex: instancia_001" : "Ex: comercial01"}
                          />
                        </div>
                      </div>
                    )}
                    {selectedInstance && (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                        {(!isInternalApi && (whatsappType === 'evolution' || whatsappType === 'api_plus')) && (
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-zinc-500">
                              API Key / Token {whatsappType === 'api_plus' ? '(Opcional/Auto)' : '*'}
                            </Label>
                            <div className="relative">
                              <Input
                                type="password"
                                value={selectedInstance.api_key || ""}
                                onChange={(e) => setSelectedInstance(prev => prev ? { ...prev, api_key: e.target.value } : null)}
                                className="h-10 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 pr-10"
                                placeholder={whatsappType === 'api_plus' ? "Vazio = Auto-gerar" : "Token gerado no painel"}
                              />
                            </div>
                          </div>
                        )}
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

                  {(whatsappType === 'evolution' || whatsappType === 'api_plus') && (
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 mt-4 animate-in slide-in-from-top-1 duration-300">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase text-zinc-500 flex items-center gap-1">
                            <Link2 className="h-3 w-3" />
                            {whatsappType === 'api_plus' ? 'URL do Servidor Mini-Evolution' : 'URL do Servidor Evolution'}
                          </Label>
                          <Input
                            value={company?.evolution_url || ""}
                            onChange={(e) => handleCompanyChange('evolution_url', e.target.value)}
                            className="h-10 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                            placeholder={whatsappType === 'api_plus' ? "Ex: https://minievo.meusistema.com" : "https://sua-api.com"}
                          />
                          {whatsappType === 'api_plus' && !company?.evolution_url && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-500 italic">
                              * Deixe em branco para usar o servidor padrão do sistema.
                            </p>
                          )}
                        </div>

                        {whatsappType === 'evolution' && (
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-zinc-500">Global API Key</Label>
                            <Input
                              type="password"
                              value={company?.evolution_apikey || ""}
                              onChange={(e) => handleCompanyChange('evolution_apikey', e.target.value)}
                              className="h-10 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                              placeholder="Key global da API Evolution"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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

                {/* EVOLUTION / API INTERNA VIEW - QR CODE SECTION */}
                {isEvolutionChannel && (
                  <div className="animate-in fade-in duration-500">
                    {/* VALIDATION: Only show QR section if instance is properly configured */}
                    {selectedInstance?.instance_key && (!isEvolutionChannel || isInternalApi || selectedInstance?.api_key) && (
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
                              <div className="text-center py-8 w-full">
                                {!error ? (
                                  <>
                                    <div className="relative h-16 w-16 mx-auto mb-6">
                                      <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                                      <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                      <RefreshCcw className="absolute inset-0 m-auto h-6 w-6 text-primary/40" />
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-base font-bold text-zinc-800 dark:text-white">Gerando QR Code...</p>
                                      <p className="text-[11px] text-zinc-500 max-w-[200px] mx-auto leading-relaxed">
                                        Isso pode levar até 30 segundos enquanto o serviço Baileys inicializa.
                                      </p>
                                    </div>

                                    <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 w-full">
                                      <div className="flex items-center justify-center gap-2 mb-3">
                                        <Activity className="h-3 w-3 text-green-500 animate-pulse" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Diagnóstico em Tempo Real</span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl text-center border border-zinc-100 dark:border-zinc-700/50">
                                          <p className="text-[8px] font-bold text-zinc-400 uppercase">Motor</p>
                                          <p className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">Mini-Evolution</p>
                                        </div>
                                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl text-center border border-zinc-100 dark:border-zinc-700/50">
                                          <p className="text-[8px] font-bold text-zinc-400 uppercase">Poll Status</p>
                                          <p className="text-[10px] font-bold text-blue-600">Ativo (4s)</p>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="p-6 bg-red-50 dark:bg-red-950/20 border-2 border-dashed border-red-200 dark:border-red-900/40 rounded-3xl animate-in zoom-in duration-300">
                                    <div className="h-12 w-12 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                                      <AlertCircle className="h-6 w-6 text-red-600" />
                                    </div>
                                    <h3 className="text-sm font-bold text-red-800 dark:text-red-400 uppercase tracking-wider mb-2">Erro na Geração</h3>
                                    <p className="text-sm text-red-700 dark:text-red-400 font-medium mb-4">{error}</p>

                                    {errorDetails && (
                                      <div className="mb-4">
                                        <p className="text-[9px] font-bold text-red-400 uppercase mb-1 text-left ml-1 italic tracking-widest">Detalhes do Erro:</p>
                                        <div className="p-3 bg-white/60 dark:bg-black/40 rounded-xl text-[10px] font-mono text-zinc-600 dark:text-zinc-300 text-left overflow-x-auto whitespace-pre-wrap border border-red-100 dark:border-red-900/20 max-h-[120px] custom-scrollbar">
                                          {typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2)}
                                        </div>
                                      </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-10 rounded-xl bg-white border-red-200 hover:bg-red-50 text-red-600 font-bold text-xs"
                                        onClick={() => handleGenerateQrKey(selectedInstance)}
                                      >
                                        Repetir
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-10 rounded-xl text-zinc-500 font-bold text-xs"
                                        onClick={() => { setError(null); setErrorDetails(null); }}
                                      >
                                        Limpar
                                      </Button>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-red-100 dark:border-red-900/30 text-left">
                                      <p className="text-[9px] font-black text-red-300 uppercase tracking-widest mb-1">Dica de Sucesso:</p>
                                      <p className="text-[10px] text-red-800/60 dark:text-red-400/60 leading-tight">
                                        Verifique se o terminal do Mini-Evolution está aberto e se o Token API da instância coincide com o cadastrado.
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* BUTTON TO GENERATE QR CODE - ONLY SHOWS IF SAVED AND NOT CONNECTED */}
                    {(selectedInstance?.instance_key && (!isEvolutionChannel || isInternalApi || selectedInstance?.api_key) && selectedInstance.id && !isConnected && connectionState !== 'connecting' && connectionState !== 'scanning' && !qrCode) && (
                      <div className="mt-4 flex justify-center animate-in fade-in duration-300">
                        <Button
                          className="w-full max-w-sm h-12 rounded-xl font-bold bg-green-600 hover:bg-green-700 shadow-xl shadow-green-100 dark:shadow-none flex items-center gap-2"
                          disabled={isLoading}
                          onClick={() => handleGenerateQrKey(selectedInstance, true)}
                        >
                          <QrIcon className="h-5 w-5" /> Digitalizar QR Code
                        </Button>
                      </div>
                    )}

                    {/* Instruction message if not configured yet */}
                    {(!selectedInstance?.instance_key || (!isInternalApi && !selectedInstance?.api_key)) && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl">
                        <div className="flex items-start gap-3">
                          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-blue-900 dark:text-blue-300">Configure a instância primeiro</p>
                            <p className="text-xs text-blue-700 dark:text-blue-400">
                              Preencha os campos obrigatórios acima:<br />
                              • <strong>Nome Amigável</strong> (Ex: Recepção, Comercial)<br />
                              • <strong>Chave da Instância</strong> (Nome único do robô)<br />
                              {whatsappType === 'evolution' && <>• <strong>API Key da Instância</strong><br /></>}
                              Depois clique em "Salvar Alterações" e em seguida em "Digitalizar QR Code" para gerar o QR Code.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isApiPlusChannel && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 animate-in fade-in duration-300">
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-2">
                      <Info className="h-4 w-4" /> Conexão Mini-Evolution API Plus
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500">
                      Você pode conectar <strong>quantas instâncias quiser</strong> nesta empresa!
                      Preencha o <strong>Nome Amigável</strong> e digite uma <strong>Chave da Instância</strong> única para cada número de WhatsApp. O sistema gerenciará todo o resto invisivelmente.
                    </p>
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
                  isConnected ? "bg-zinc-600 hover:bg-zinc-700 text-white shadow-zinc-200" : "bg-primary shadow-primary/20"
                )}
                onClick={() => {
                  if (isConnected) {
                    setIsWaModalOpen(false);
                  } else {
                    handleSaveCompany(false);
                  }
                }}
                disabled={isLoading}
              >
                {isLoading ? "Processando..." : (isConnected ? "Fechar" : "Salvar Alterações")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* IG MODAL - Placeholder for modern UI */}
        <Dialog open={isIgModalOpen} onOpenChange={setIsIgModalOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] p-0 overflow-hidden border-none shadow-2xl rounded-3xl flex flex-col">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-8 text-white">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <Instagram className="h-7 w-7" /> Instagram Business
              </DialogTitle>
              <p className="text-purple-50/80 mt-1">Conecte sua conta profissional para automação de directs.</p>
            </div>
            <div className="p-6 grid gap-4 overflow-y-auto">
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

              <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 animate-in slide-in-from-top-4 duration-500">
                <div className="space-y-2 border-b pb-4 mb-2">
                  <Label className="text-[11px] font-bold uppercase text-zinc-400">Instância do Instagram</Label>
                  <Select value={String(selectedInstagramIndex)} onValueChange={(value) => setSelectedInstagramIndex(Number(value))}>
                    <SelectTrigger className="rounded-xl h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
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

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-zinc-500 flex items-center justify-between">
                    <span>Nome de Apresentação <span className="text-red-500">*</span></span>
                    <span className="text-[8px] font-normal lowercase opacity-70">(Ex: Direct Vendas)</span>
                  </Label>
                  <Input
                    value={selectedInstagramConfig?.name || ""}
                    onChange={(e) => handleInstagramInstanceConfigChange(selectedInstagramIndex, 'name' as any, e.target.value)}
                    required
                    className="h-10 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-pink-500/20 shadow-sm"
                    placeholder="Nome para este canal..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-zinc-500">Fila padrão para novas diretas</Label>
                  <Select
                    value={String(selectedInstagramConfig?.default_queue_id || "none")}
                    onValueChange={(v) => {
                      const val = v === 'none' ? null : Number(v);
                      handleInstagramInstanceConfigChange(selectedInstagramIndex, 'default_queue_id' as any, val as any);
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
                      <SelectValue placeholder="Sem fila (Ficarão pendentes)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-zinc-400" />
                          <span>Sem fila</span>
                        </div>
                      </SelectItem>
                      {queues.map(q => (
                        <SelectItem key={q.id} value={String(q.id)}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: q.color || '#3b82f6' }} />
                            <span>{q.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[11px] font-bold uppercase text-zinc-400">Cor da Faixa (Instância {selectedInstagramIndex + 1})</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={selectedInstagramConfig?.color || DEFAULT_INSTAGRAM_COLOR}
                      onChange={(e) => handleInstagramInstanceConfigChange(selectedInstagramIndex, 'color', e.target.value)}
                      className="h-10 w-14 rounded-xl cursor-pointer p-1"
                    />
                    <Input
                      value={selectedInstagramConfig?.color || DEFAULT_INSTAGRAM_COLOR}
                      onChange={(e) => handleInstagramInstanceConfigChange(selectedInstagramIndex, 'color', e.target.value)}
                      className="rounded-xl h-10"
                      placeholder="#DD2A7B"
                    />
                  </div>
                </div>
              </div>

              <Button
                className="w-full h-11 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 border-none shadow-lg mt-2"
                disabled={isLoading}
                onClick={() => handleTestConnection('instagram')}
              >
                Testar Integração Instagram
              </Button>
              <DialogFooter className="pt-4 border-t mt-2 flex justify-between gap-2 px-0 sticky bottom-0 bg-background">
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
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] p-0 overflow-hidden border-none shadow-2xl rounded-3xl flex flex-col">
            <div className="bg-blue-600 p-8 text-white">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <MessageCircle className="h-7 w-7" /> Facebook Messenger
              </DialogTitle>
              <p className="text-blue-50/80 mt-1">Integre sua Fan Page para centralizar as mensagens do Messenger.</p>
            </div>
            <div className="p-6 grid gap-4 overflow-y-auto">
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
              <DialogFooter className="pt-4 border-t mt-2 flex justify-end gap-2 px-0 sticky bottom-0 bg-background">
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
