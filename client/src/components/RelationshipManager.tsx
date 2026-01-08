import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Badge } from "./ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Link2, Trash2, ExternalLink, Plus, FileText, MessageSquare, User, Building2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";

interface RelationshipManagerProps {
    entityType: string;
    entityId: string | number;
}

export default function RelationshipManager({ entityType, entityId }: RelationshipManagerProps) {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [links, setLinks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newLink, setNewLink] = useState({
        target_type: "task",
        target_id: ""
    });

    useEffect(() => {
        if (entityId) fetchLinks();
    }, [entityId, token]);

    const fetchLinks = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/links/${entityType}/${entityId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setLinks(await res.json());
        } catch (error) {
            console.error("Failed to fetch links");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLink = async () => {
        if (!newLink.target_id) return toast.error("ID do alvo é obrigatório");
        try {
            const res = await fetch('/api/admin/links', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source_type: entityType,
                    source_id: entityId.toString(),
                    ...newLink
                })
            });

            if (res.ok) {
                toast.success("Vínculo criado!");
                setIsModalOpen(false);
                fetchLinks();
            } else {
                const err = await res.json();
                toast.error(err.error || "Falha ao criar vínculo");
            }
        } catch (error) {
            toast.error("Erro na conexão");
        }
    };

    const handleDeleteLink = async (id: number) => {
        try {
            const res = await fetch(`/api/admin/links/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setLinks(links.filter(l => l.id !== id));
                toast.success("Vínculo removido");
            }
        } catch (error) {
            toast.error("Erro ao remover vínculo");
        }
    };

    const handleNavigate = (type: string, id: string | number) => {
        switch (type) {
            case 'task':
                navigate(`/app/tarefas?id=${id}`);
                break;
            case 'document':
                navigate(`/app/crm?id=${id}`);
                break;
            case 'conversation':
                navigate(`/app/atendimento?id=${id}`);
                break;
            case 'user':
                navigate(`/app/usuarios?id=${id}`);
                break;
            case 'contract':
                navigate(`/app/financeiro?id=${id}`);
                break;
            default:
                break;
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'task': return <Briefcase className="w-3 h-3" />;
            case 'document': return <FileText className="w-3 h-3" />;
            case 'conversation': return <MessageSquare className="w-3 h-3" />;
            case 'user': return <User className="w-3 h-3" />;
            case 'contract': return <Building2 className="w-3 h-3" />;
            default: return <Link2 className="w-3 h-3" />;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-primary" /> Entidades Relacionadas
                </h4>
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1">
                            <Plus className="w-3 h-3" /> Vincular
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[400px]">
                        <DialogHeader>
                            <DialogTitle>Vincular Nova Entidade</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium">Tipo de Entidade</label>
                                <Select value={newLink.target_type} onValueChange={(v) => setNewLink({ ...newLink, target_type: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="task">Tarefa</SelectItem>
                                        <SelectItem value="document">Documento</SelectItem>
                                        <SelectItem value="conversation">Conversa (WhatsApp)</SelectItem>
                                        <SelectItem value="user">Usuário</SelectItem>
                                        <SelectItem value="contract">Contrato/Empresa</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium">ID da Entidade (Ex: #123)</label>
                                <Input
                                    placeholder="Digite o código identificador"
                                    value={newLink.target_id}
                                    onChange={(e) => setNewLink({ ...newLink, target_id: e.target.value })}
                                />
                                <p className="text-[10px] text-muted-foreground italic">Dica: Você pode copiar o ID da entidade na barra de endereços ou detalhes do item.</p>
                            </div>
                            <Button className="w-full" onClick={handleCreateLink}>Confirmar Vínculo</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex flex-wrap gap-2">
                {links.map((link) => {
                    const isSource = link.source_type === entityType && link.source_id.toString() === entityId.toString();
                    const displayType = isSource ? link.target_type : link.source_type;
                    const displayId = isSource ? link.target_id : link.source_id;

                    return (
                        <div key={link.id} className="group flex items-center gap-2 bg-slate-50 border px-3 py-1.5 rounded-full text-xs hover:bg-slate-100 transition-colors">
                            <span className="flex items-center gap-1.5 font-medium">
                                {getIcon(displayType)}
                                <span className="capitalize">{displayType}</span>
                                <span className="text-muted-foreground">#{displayId}</span>
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-primary"
                                    onClick={() => handleNavigate(displayType, displayId)}
                                >
                                    <ExternalLink className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500" onClick={() => handleDeleteLink(link.id)}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    );
                })}

                {links.length === 0 && !loading && (
                    <p className="text-[10px] text-muted-foreground italic">Nenhum vínculo registrado para este item.</p>
                )}
            </div>
        </div>
    );
}
