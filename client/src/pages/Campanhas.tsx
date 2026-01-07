import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Plus, Play, Pause, Trash2, Eye, Upload, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Campaign {
    id: number;
    name: string;
    message_template: string;
    status: string;
    total_contacts: number;
    sent_count: number;
    failed_count: number;
    scheduled_at?: string;
    start_time: string;
    end_time: string;
    delay_min: number;
    delay_max: number;
    created_at: string;
}

const CampanhasPage = () => {
    const { token } = useAuth();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);

    const [showFailuresModal, setShowFailuresModal] = useState(false);
    const [isLoadingFailures, setIsLoadingFailures] = useState(false);
    const [failuresError, setFailuresError] = useState<string | null>(null);
    const [failures, setFailures] = useState<any[]>([]);

    const handleShowFailures = async (id: number) => {
        setShowFailuresModal(true);
        setFailures([]);
        setFailuresError(null);
        setIsLoadingFailures(true);

        try {
            const res = await fetch(`/api/campaigns/${id}/failures`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            // O endpoint SEMPRE retorna 200 agora
            if (res.ok) {
                const data = await res.json();

                // Validar estrutura da resposta
                if (data && typeof data === 'object') {
                    // Novo formato: { failures: [], hasError: false }
                    if (Array.isArray(data.failures)) {
                        setFailures(data.failures);

                        // Se hasError for true, avisar mas ainda mostrar dados
                        if (data.hasError) {
                            toast.warning("Relatório carregado com avisos");
                        }
                    }
                    // Formato antigo (array direto) - compatibilidade
                    else if (Array.isArray(data)) {
                        setFailures(data);
                    }
                    // Nenhum formato reconhecido
                    else {
                        setFailures([]);
                        console.warn('Formato de resposta inesperado:', data);
                    }
                } else {
                    setFailures([]);
                    console.warn('Resposta não é um objeto válido:', data);
                }
            } else {
                // Mesmo com status não-ok, tentar extrair dados
                try {
                    const errorData = await res.json();
                    setFailuresError(errorData.message || "Não foi possível carregar os detalhes.");
                } catch {
                    setFailuresError("Erro no servidor ao buscar falhas.");
                }
                toast.error("Erro ao buscar falhas");
            }
        } catch (e) {
            // Erro de rede/conexão
            setFailuresError("Erro de conexão ao buscar falhas.");
            toast.error("Erro de conexão");
            console.error('Erro ao buscar falhas:', e);
        } finally {
            setIsLoadingFailures(false);
        }
    };




    const [editingCampaignId, setEditingCampaignId] = useState<number | null>(null);

    // Form states
    const [name, setName] = useState("");
    const [messageTemplate, setMessageTemplate] = useState("");
    const [scheduledAt, setScheduledAt] = useState("");
    const [startTime, setStartTime] = useState("00:00");
    const [endTime, setEndTime] = useState("23:59");
    const [delayMin, setDelayMin] = useState(5);
    const [delayMax, setDelayMax] = useState(15);
    const [contactsText, setContactsText] = useState("");
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const fetchCampaigns = async () => {
        try {
            const res = await fetch("/api/campaigns", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCampaigns(data);
            }
        } catch (error) {
            console.error("Error fetching campaigns:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaigns();
        const interval = setInterval(fetchCampaigns, 5000); // Refresh every 5s
        return () => clearInterval(interval);
    }, [token]);

    const handleSaveCampaign = async () => {
        try {
            // Parse contacts from text
            const contacts = contactsText
                .split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const parts = line.split(',');
                    const rawPhone = parts[0]?.trim() || "";
                    const rawName = parts[1]?.trim() || "";

                    // Limpa o telefone removendo caracteres não numéricos
                    const phone = rawPhone.replace(/\D/g, "");
                    // Usa o nome se fornecido, senão usa "Cliente"
                    const contactName = rawName || "Cliente";

                    return { phone, name: contactName, variables: { nome: contactName } };
                });

            if (contacts.length === 0 && !editingCampaignId) {
                toast.error("Adicione pelo menos um contato");
                return;
            }

            const url = editingCampaignId ? `/api/campaigns/${editingCampaignId}` : "/api/campaigns";
            const method = editingCampaignId ? "PUT" : "POST";

            const payload: any = {
                name,
                message_template: messageTemplate,
                scheduled_at: scheduledAt || null,
                start_time: startTime,
                end_time: endTime,
                delay_min: delayMin,
                delay_max: delayMax,
                media_url: mediaUrl,
                media_type: mediaType
            };

            if (contacts.length > 0) {
                payload.contacts = contacts;
            }

            const res = await fetch(url, {
                method,
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success(editingCampaignId ? "Campanha atualizada!" : "Campanha criada!");
                setShowCreateForm(false);
                setEditingCampaignId(null);
                resetForm();
                fetchCampaigns();
            } else {
                const error = await res.json();
                toast.error(error.error || "Erro ao salvar campanha");
            }
        } catch (error) {
            toast.error("Erro ao conectar com o servidor");
        }
    };

    const handleEditCampaign = async (campaign: Campaign) => {
        setEditingCampaignId(campaign.id);
        setName(campaign.name);
        setMessageTemplate(campaign.message_template);
        setStartTime(campaign.start_time);
        setEndTime(campaign.end_time);
        setDelayMin(campaign.delay_min);
        setDelayMax(campaign.delay_max);
        setScheduledAt(campaign.scheduled_at ? new Date(campaign.scheduled_at).toISOString().slice(0, 16) : "");
        setMediaUrl((campaign as any).media_url || null);
        setMediaType((campaign as any).media_type || null);

        // Fetch contacts for this campaign
        try {
            const res = await fetch(`/api/campaigns/${campaign.id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.contacts) {
                    const text = data.contacts.map((c: any) => `${c.phone},${c.name}`).join('\n');
                    setContactsText(text);
                }
            }
        } catch (e) {
            console.error("Error fetching campaign contacts:", e);
        }

        setShowCreateForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setName("");
        setMessageTemplate("");
        setScheduledAt("");
        setStartTime("00:00");
        setEndTime("23:59");
        setDelayMin(5);
        setDelayMax(15);
        setContactsText("");
        setMediaUrl(null);
        setMediaType(null);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/campaigns/upload", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                setMediaUrl(data.url);

                // Determine type
                const mime = file.type;
                if (mime.startsWith('image/')) setMediaType('image');
                else if (mime.startsWith('video/')) setMediaType('video');
                else if (mime.startsWith('audio/')) setMediaType('audio');
                else if (mime === 'application/pdf') setMediaType('document');
                else setMediaType('document'); // fallback

                toast.success("Arquivo anexado!");
            } else {
                toast.error("Erro ao fazer upload");
            }
        } catch (error) {
            toast.error("Erro ao enviar arquivo");
        } finally {
            setIsUploading(false);
        }
    };

    const handleStartCampaign = async (id: number) => {
        try {
            const res = await fetch(`/api/campaigns/${id}/start`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success("Campanha iniciada!");
                fetchCampaigns();
            }
        } catch (error) {
            toast.error("Erro ao iniciar campanha");
        }
    };

    const handlePauseCampaign = async (id: number) => {
        try {
            const res = await fetch(`/api/campaigns/${id}/pause`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success("Campanha pausada!");
                fetchCampaigns();
            }
        } catch (error) {
            toast.error("Erro ao pausar campanha");
        }
    };

    const handleDeleteCampaign = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir esta campanha?")) return;

        try {
            const res = await fetch(`/api/campaigns/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success("Campanha excluída!");
                fetchCampaigns();
            }
        } catch (error) {
            toast.error("Erro ao excluir campanha");
        }
    };

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            draft: "bg-gray-200 text-gray-700",
            scheduled: "bg-blue-200 text-blue-700",
            running: "bg-green-200 text-green-700 animate-pulse",
            paused: "bg-yellow-200 text-yellow-700",
            completed: "bg-purple-200 text-purple-700",
            cancelled: "bg-red-200 text-red-700"
        };

        const labels: Record<string, string> = {
            draft: "Rascunho",
            scheduled: "Agendada",
            running: "Em Execução",
            paused: "Pausada",
            completed: "Concluída",
            cancelled: "Cancelada"
        };

        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[status] || colors.draft}`}>
                {labels[status] || status}
            </span>
        );
    };

    if (showCreateForm) {
        return (
            <div className="container mx-auto p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{editingCampaignId ? "Editar Campanha" : "Nova Campanha"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Nome da Campanha</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: Promoção Black Friday"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Mensagem</label>
                            <Textarea
                                value={messageTemplate}
                                onChange={(e) => setMessageTemplate(e.target.value)}
                                placeholder="Olá {nome}! Temos uma oferta especial..."
                                rows={4}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Use {"{nome}"} para personalizar
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Anexo (Opcional)</label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="file"
                                    className="hidden"
                                    id="campaign-file"
                                    onChange={handleFileUpload}
                                    disabled={isUploading}
                                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                                />
                                <label
                                    htmlFor="campaign-file"
                                    className={`flex items-center gap-2 px-4 py-2 border rounded cursor-pointer hover:bg-zinc-50 transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                                >
                                    <Upload className="h-4 w-4" />
                                    {isUploading ? "Enviando..." : "Escolher arquivo"}
                                </label>
                                {mediaUrl && (
                                    <div className="flex items-center gap-2 bg-zinc-100 px-3 py-1.5 rounded text-sm group">
                                        <span className="max-w-[200px] truncate text-blue-600 underline" title={mediaUrl}>
                                            <a href={mediaUrl} target="_blank" rel="noreferrer">Ver anexo ({mediaType})</a>
                                        </span>
                                        <button onClick={() => { setMediaUrl(null); setMediaType(null); }} className="text-red-500 hover:text-red-700">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Horário Início</label>
                                <Input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Horário Fim</label>
                                <Input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Delay Mínimo (s)</label>
                                <Input
                                    type="number"
                                    value={delayMin}
                                    onChange={(e) => setDelayMin(parseInt(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Delay Máximo (s)</label>
                                <Input
                                    type="number"
                                    value={delayMax}
                                    onChange={(e) => setDelayMax(parseInt(e.target.value))}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Contatos (Um por linha)
                            </label>
                            <p className="text-[10px] text-muted-foreground mb-2">
                                Formatos aceitos: <b>5538999999999</b> ou <b>5538999999999,Nome</b>
                                {editingCampaignId && " (Deixe vazio para manter os atuais)"}
                            </p>
                            <Textarea
                                value={contactsText}
                                onChange={(e) => setContactsText(e.target.value)}
                                placeholder="5539999999999"
                                rows={6}
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={handleSaveCampaign}>
                                {editingCampaignId ? "Salvar Alterações" : "Criar Campanha"}
                            </Button>
                            <Button variant="outline" onClick={() => { setShowCreateForm(false); setEditingCampaignId(null); resetForm(); }}>
                                Cancelar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <Dialog open={showFailuresModal} onOpenChange={setShowFailuresModal}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Relatório de Falhas</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pr-2">
                        {isLoadingFailures ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600" />
                                <p>Carregando relatórios...</p>
                            </div>
                        ) : failuresError ? (
                            <div className="flex flex-col items-center justify-center py-8 text-red-500 gap-2">
                                <span className="text-3xl">⚠️</span>
                                <p>{failuresError}</p>
                                <Button variant="outline" size="sm" onClick={() => handleShowFailures(campaigns.find(c => c.failed_count > 0)?.id || 0)}>Tentar Novamente</Button>
                            </div>
                        ) : failures.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                                <span className="text-4xl">🤷‍♂️</span>
                                <p>Nenhuma falha registrada no banco de dados.</p>
                            </div>
                        ) : (
                            failures.map((f, i) => (
                                <div key={i} className="flex gap-4 p-4 border rounded-xl bg-red-50/50 hover:bg-red-50 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-sm text-zinc-900">{f.name || "Sem Nome"}</span>
                                            <span className="text-xs text-zinc-500 font-mono bg-zinc-100 px-2 py-0.5 rounded-full">{f.phone}</span>
                                        </div>
                                        <div className="text-sm bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                                            <span className="font-bold text-red-600 text-xs uppercase block mb-1">Motivo do Erro:</span>
                                            <span className="text-zinc-700 font-medium break-words leading-relaxed">
                                                {f.error_message || "Erro desconhecido"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Ocorreu em</span>
                                        <span className="text-xs font-mono text-zinc-600">
                                            {f.created_at ? new Date(f.created_at).toLocaleString('pt-BR') : '--/--/-- --:--'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Campanhas de WhatsApp</CardTitle>
                    <Button onClick={() => setShowCreateForm(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Campanha
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8">Carregando...</div>
                    ) : campaigns.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Nenhuma campanha criada ainda
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {campaigns.map((campaign) => (
                                <div key={campaign.id} className="border rounded-lg p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="font-semibold">{campaign.name}</h3>
                                                {getStatusBadge(campaign.status)}
                                            </div>
                                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                                {campaign.message_template}
                                            </p>
                                            <div className="flex gap-4 text-xs text-muted-foreground">
                                                <span>Total: {campaign.total_contacts}</span>
                                                <span className="text-green-600">Enviados: {campaign.sent_count}</span>
                                                <span
                                                    className="text-red-600 cursor-pointer hover:underline font-bold hover:text-red-800 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleShowFailures(campaign.id);
                                                    }}
                                                    title="Clique para ver detalhes das falhas"
                                                >
                                                    Falhas: {campaign.failed_count}
                                                </span>
                                                <span>⏰ {campaign.start_time} - {campaign.end_time}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {campaign.status === 'draft' || campaign.status === 'paused' ? (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleStartCampaign(campaign.id)}
                                                >
                                                    <Play className="h-4 w-4" />
                                                </Button>
                                            ) : campaign.status === 'running' ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handlePauseCampaign(campaign.id)}
                                                >
                                                    <Pause className="h-4 w-4" />
                                                </Button>
                                            ) : null}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleEditCampaign(campaign)}
                                                title="Editar Campanha"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleDeleteCampaign(campaign.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default CampanhasPage;
