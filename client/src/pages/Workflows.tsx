import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import {
    GitBranch,
    Plus,
    Play,
    History,
    Settings,
    Trash2,
    Zap,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    MessageSquare,
    FileEdit
} from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "../components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function WorkflowsPage() {
    const { token } = useAuth();
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [openModal, setOpenModal] = useState(false);
    const [newWf, setNewWf] = useState({
        name: "",
        event_type: "message_received",
        is_test_mode: false,
        actions: [{ type: "send_alert", params: { message: "" } }]
    });

    useEffect(() => {
        fetchWorkflows();
    }, [token]);

    const fetchWorkflows = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/workflows', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setWorkflows(await res.json());
        } catch (error) {
            toast.error("Erro ao carregar workflows");
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (id: number, currentStatus: string) => {
        const status = currentStatus === 'active' ? 'inactive' : 'active';
        try {
            const res = await fetch(`/api/admin/workflows/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });

            if (res.ok) {
                setWorkflows(workflows.map(w => w.id === id ? { ...w, status } : w));
                toast.success(`Workflow ${status === 'active' ? 'ativado' : 'desativado'}`);
            }
        } catch (error) {
            toast.error("Falha ao atualizar status");
        }
    };

    const saveWorkflow = async () => {
        try {
            const res = await fetch('/api/admin/workflows', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newWf)
            });

            if (res.ok) {
                toast.success("Workflow criado com sucesso!");
                setOpenModal(false);
                fetchWorkflows();
            }
        } catch (error) {
            toast.error("Erro ao salvar workflow");
        }
    };

    const deleteWf = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir este workflow?")) return;
        try {
            const res = await fetch(`/api/admin/workflows/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setWorkflows(workflows.filter(w => w.id !== id));
                toast.success("Workflow removido");
            }
        } catch (error) {
            toast.error("Erro ao excluir workflow");
        }
    };

    const getEventBadge = (type: string) => {
        switch (type) {
            case 'message_received': return <Badge variant="outline" className="gap-1"><MessageSquare className="w-3 h-3" /> Mensagem</Badge>;
            case 'error_detected': return <Badge variant="outline" className="gap-1 border-red-200 text-red-600"><AlertTriangle className="w-3 h-3" /> Erro</Badge>;
            case 'task_created': return <Badge variant="outline" className="gap-1"><FileEdit className="w-3 h-3" /> Tarefa</Badge>;
            default: return <Badge variant="outline">{type}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Central de Workflows</h2>
                    <p className="text-muted-foreground">Automatize ações baseadas em eventos do sistema.</p>
                </div>
                <Dialog open={openModal} onOpenChange={setOpenModal}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 bg-primary hover:bg-primary/90">
                            <Plus className="h-4 w-4" /> Novo Workflow
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Criar Fluxo de Automação</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4 text-sm">
                            <div className="space-y-2">
                                <label className="font-medium">Nome do Workflow</label>
                                <Input
                                    placeholder="Ex: Alerta de Erro Crítico"
                                    value={newWf.name}
                                    onChange={(e) => setNewWf({ ...newWf, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="font-medium">Evento de Gatilho (Trigger)</label>
                                <Select value={newWf.event_type} onValueChange={(v) => setNewWf({ ...newWf, event_type: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="message_received">Mensagem Recebida</SelectItem>
                                        <SelectItem value="error_detected">Erro Detectado</SelectItem>
                                        <SelectItem value="task_created">Tarefa Criada</SelectItem>
                                        <SelectItem value="document_updated">Documento Atualizado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-dashed text-center">
                                <Zap className="w-8 h-8 text-primary mx-auto mb-2 opacity-30" />
                                <p className="text-muted-foreground">Nesta versão do protótipo, os Workflows são pré-configurados para enviar Alertas Administrativos e criar Tarefas de Follow-up.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={newWf.is_test_mode}
                                    onCheckedChange={(v) => setNewWf({ ...newWf, is_test_mode: v })}
                                />
                                <span className="font-medium">Modo de Teste (Sandbox)</span>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpenModal(false)}>Cancelar</Button>
                            <Button onClick={saveWorkflow}>Salvar Automação</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workflows.map(wf => (
                    <Card key={wf.id} className={wf.status === 'inactive' ? 'opacity-60' : ''}>
                        <CardHeader className="flex flex-row items-start justify-between pb-2">
                            <div className="space-y-1">
                                <CardTitle className="text-lg font-bold">{wf.name}</CardTitle>
                                <div className="flex gap-2">
                                    {getEventBadge(wf.event_type)}
                                    {wf.is_test_mode && <Badge variant="secondary" className="bg-amber-100 text-amber-700">Sandbox</Badge>}
                                </div>
                            </div>
                            <Switch
                                checked={wf.status === 'active'}
                                onCheckedChange={() => toggleStatus(wf.id, wf.status)}
                            />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-slate-50 p-3 rounded-md text-xs space-y-2">
                                <p className="font-semibold flex items-center gap-2">
                                    <Zap className="w-3 h-3 text-primary" /> Ações Automáticas:
                                </p>
                                <ul className="list-disc list-inside text-muted-foreground">
                                    {wf.actions.map((act: any, idx: number) => (
                                        <li key={idx} className="capitalize">{act.type.replace('_', ' ')}</li>
                                    ))}
                                    {wf.actions.length === 0 && <li>Sem ações configuradas</li>}
                                </ul>
                            </div>
                            <div className="flex justify-between items-center border-t pt-3">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Criado em {format(new Date(wf.created_at), "dd/MM/yy")}
                                </span>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteWf(wf.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 gap-1">
                                        <History className="h-3 w-3" /> Logs
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {workflows.length === 0 && !loading && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl">
                        <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                        <h3 className="text-lg font-semibold">Nenhum Workflow Criado</h3>
                        <p className="text-muted-foreground">Crie seu primeiro fluxo de automação para começar.</p>
                    </div>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <History className="w-5 h-5 text-primary" /> Execuções Recentes
                    </CardTitle>
                    <CardDescription>Histórico global de disparos de workflows.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative border rounded-lg overflow-hidden">
                        <ScrollArea className="h-[300px]">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Data/Hora</th>
                                        <th className="px-4 py-3 text-left">Workflow</th>
                                        <th className="px-4 py-3 text-left">Status</th>
                                        <th className="px-4 py-3 text-left">Ações Realizadas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b">
                                        <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                                            Aguardando as primeiras automações serem disparadas...
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
