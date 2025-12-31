import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Plus, Play, Pause, Trash2, Eye, Upload } from "lucide-react";
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

    // Form states
    const [name, setName] = useState("");
    const [messageTemplate, setMessageTemplate] = useState("");
    const [scheduledAt, setScheduledAt] = useState("");
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("18:00");
    const [delayMin, setDelayMin] = useState(5);
    const [delayMax, setDelayMax] = useState(15);
    const [contactsText, setContactsText] = useState("");

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

    const handleCreateCampaign = async () => {
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

            if (contacts.length === 0) {
                toast.error("Adicione pelo menos um contato");
                return;
            }

            const res = await fetch("/api/campaigns", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    message_template: messageTemplate,
                    scheduled_at: scheduledAt || null,
                    start_time: startTime,
                    end_time: endTime,
                    delay_min: delayMin,
                    delay_max: delayMax,
                    contacts
                })
            });

            if (res.ok) {
                toast.success("Campanha criada com sucesso!");
                setShowCreateForm(false);
                resetForm();
                fetchCampaigns();
            } else {
                const error = await res.json();
                toast.error(error.error || "Erro ao criar campanha");
            }
        } catch (error) {
            toast.error("Erro ao conectar com o servidor");
        }
    };

    const resetForm = () => {
        setName("");
        setMessageTemplate("");
        setScheduledAt("");
        setStartTime("09:00");
        setEndTime("18:00");
        setDelayMin(5);
        setDelayMax(15);
        setContactsText("");
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
                        <CardTitle>Nova Campanha</CardTitle>
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
                            </p>
                            <Textarea
                                value={contactsText}
                                onChange={(e) => setContactsText(e.target.value)}
                                placeholder="5538999540230&#10;5538998969286"
                                rows={6}
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={handleCreateCampaign}>
                                Criar Campanha
                            </Button>
                            <Button variant="outline" onClick={() => { setShowCreateForm(false); resetForm(); }}>
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
                                                <span className="text-red-600">Falhas: {campaign.failed_count}</span>
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
