import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
    Plus, KanbanSquare, MessageSquare, Link as LinkIcon, Calendar,
    MoreHorizontal, Trash2, CheckCircle2, Circle, Clock, AlertCircle
} from "lucide-react";
import { useToast } from "../hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Avatar, AvatarFallback } from "../components/ui/avatar";

interface RoadmapItem {
    id: number;
    title: string;
    description: string;
    status: 'planned' | 'in_development' | 'in_test' | 'completed';
    priority: 'low' | 'medium' | 'high' | 'critical';
    target_date: string | null;
    creator_name: string;
    comments_count: number;
    tasks_count: number;
    created_at: string;
}

interface Comment {
    id: number;
    user_name: string;
    content: string;
    created_at: string;
}

const COLUMNS = [
    { id: 'planned', label: 'Planejado', color: 'bg-slate-100 border-slate-200' },
    { id: 'in_development', label: 'Em Desenvolvimento', color: 'bg-blue-50 border-blue-200' },
    { id: 'in_test', label: 'Em Teste', color: 'bg-purple-50 border-purple-200' },
    { id: 'completed', label: 'Concluído', color: 'bg-green-50 border-green-200' },
];

const RoadmapPage = () => {
    const { token, user } = useAuth();
    const { toast } = useToast();
    const [items, setItems] = useState<RoadmapItem[]>([]);
    const [loading, setLoading] = useState(false);

    // Create/Edit
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        status: 'planned',
        priority: 'medium',
        target_date: ''
    });

    // Details/Comments Sidebar
    const [selectedItem, setSelectedItem] = useState<RoadmapItem | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/roadmap', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setItems(data);
            }
        } catch (e) {
            toast({ title: "Erro ao carregar roadmap", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchItems();
    }, [token]);

    const handleOpenDialog = (item?: RoadmapItem) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                title: item.title,
                description: item.description,
                status: item.status,
                priority: item.priority as any,
                target_date: item.target_date ? item.target_date.split('T')[0] : ''
            });
        } else {
            setEditingItem(null);
            setFormData({
                title: '',
                description: '',
                status: 'planned',
                priority: 'medium',
                target_date: ''
            });
        }
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.title) {
            toast({ title: "Título é obrigatório", variant: "destructive" });
            return;
        }

        try {
            const url = editingItem ? `/api/roadmap/${editingItem.id}` : '/api/roadmap';
            const method = editingItem ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error();

            toast({ title: editingItem ? "Item atualizado" : "Item criado" });
            setIsDialogOpen(false);
            fetchItems();
        } catch (e) {
            toast({ title: "Erro ao salvar item", variant: "destructive" });
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir?")) return;
        try {
            await fetch(`/api/roadmap/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            toast({ title: "Item excluído" });
            fetchItems();
        } catch (e) {
            toast({ title: "Erro ao excluir", variant: "destructive" });
        }
    };

    const handleMoveStatus = async (item: RoadmapItem, newStatus: string) => {
        try {
            const res = await fetch(`/api/roadmap/${item.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                fetchItems();
            }
        } catch (e) {
            toast({ title: "Erro ao mover item", variant: "destructive" });
        }
    };

    const openDetails = async (item: RoadmapItem) => {
        setSelectedItem(item);
        setComments([]);
        try {
            const res = await fetch(`/api/roadmap/${item.id}/comments`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setComments(await res.json());
            }
        } catch (e) { }
    };

    const submitComment = async () => {
        if (!newComment.trim() || !selectedItem) return;
        try {
            const res = await fetch(`/api/roadmap/${selectedItem.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ content: newComment })
            });
            if (res.ok) {
                const added = await res.json();
                setComments(prev => [...prev, added]);
                setNewComment('');
                // Update comment count in list locally or refetch
                setItems(prev => prev.map(i => i.id === selectedItem.id ? { ...i, comments_count: (parseInt(i.comments_count as any) + 1) } : i));
            }
        } catch (e) {
            toast({ title: "Erro ao comentar", variant: "destructive" });
        }
    };

    const getPriorityBadge = (p: string) => {
        const styles: Record<string, string> = {
            low: "bg-slate-200 text-slate-700",
            medium: "bg-blue-100 text-blue-700",
            high: "bg-orange-100 text-orange-700",
            critical: "bg-red-100 text-red-700"
        };
        return <Badge variant="outline" className={`${styles[p]} border-none`}>{p}</Badge>;
    };

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Roadmap do Produto</h1>
                    <p className="text-muted-foreground mt-1">
                        Visualize e gerencie o planejamento de desenvolvimento.
                    </p>
                </div>
                <Button onClick={() => handleOpenDialog()} className="gap-2">
                    <Plus className="h-4 w-4" /> Adicionar Item
                </Button>
            </div>

            <div className="flex-1 overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-[1000px] h-full">
                    {COLUMNS.map(col => (
                        <div key={col.id} className={`flex-1 min-w-[280px] flex flex-col rounded-lg border bg-opacity-50 ${col.color} bg-white`}>
                            <div className="p-3 font-semibold text-sm flex items-center justify-between border-b bg-white/50 rounded-t-lg">
                                {col.label}
                                <Badge variant="secondary" className="bg-white">
                                    {items.filter(i => i.status === col.id).length}
                                </Badge>
                            </div>
                            <ScrollArea className="flex-1 p-2">
                                <div className="space-y-3">
                                    {items.filter(i => i.status === col.id).map(item => (
                                        <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow bg-white" onClick={() => openDetails(item)}>
                                            <CardContent className="p-3 space-y-2">
                                                <div className="flex justify-between items-start">
                                                    <Badge variant="outline" className="text-[10px] px-1 h-5">{item.id}</Badge>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                                            <Button variant="ghost" className="h-6 w-6 p-0">
                                                                <MoreHorizontal className="h-3 w-3" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleOpenDialog(item)}>Editar</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            {COLUMNS.map(c => c.id !== item.status && (
                                                                <DropdownMenuItem key={c.id} onClick={() => handleMoveStatus(item, c.id)}>
                                                                    Mover para {c.label}
                                                                </DropdownMenuItem>
                                                            ))}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(item.id)}>Excluir</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                                <p className="font-medium text-sm leading-tight">{item.title}</p>
                                                <div className="flex items-center gap-2 pt-1">
                                                    {getPriorityBadge(item.priority)}
                                                    {item.target_date && (
                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-slate-50 px-1 rounded">
                                                            <Calendar className="h-3 w-3" />
                                                            {new Date(item.target_date).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between pt-2 border-t mt-2">
                                                    <div className="flex items-center gap-3 text-muted-foreground">
                                                        {parseInt(item.comments_count as any) > 0 && (
                                                            <div className="flex items-center gap-1 text-xs">
                                                                <MessageSquare className="h-3 w-3" /> {item.comments_count}
                                                            </div>
                                                        )}
                                                        {parseInt(item.tasks_count as any) > 0 && (
                                                            <div className="flex items-center gap-1 text-xs">
                                                                <LinkIcon className="h-3 w-3" /> {item.tasks_count}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Avatar className="h-5 w-5">
                                                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                                            {item.creator_name?.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    ))}
                </div>
            </div>

            {/* Create/Edit Modal */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item do Roadmap'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Título</label>
                            <Input
                                value={formData.title}
                                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Descrição</label>
                            <Textarea
                                value={formData.description}
                                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Status</label>
                                <select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.status}
                                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                                >
                                    {COLUMNS.map(c => (
                                        <option key={c.id} value={c.id}>{c.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Prioridade</label>
                                <select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.priority}
                                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                                >
                                    <option value="low">Baixa</option>
                                    <option value="medium">Média</option>
                                    <option value="high">Alta</option>
                                    <option value="critical">Crítica</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Data Alvo</label>
                            <Input
                                type="date"
                                value={formData.target_date}
                                onChange={e => setFormData(prev => ({ ...prev, target_date: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Details Modal (Slide Over style using Dialog) */}
            <Dialog open={!!selectedItem} onOpenChange={(o) => !o && setSelectedItem(null)}>
                <DialogContent className="max-w-md h-[90vh] flex flex-col p-0 gap-0 overflow-hidden absolute right-0 top-0 border-l border-l-border rounded-none sm:rounded-none data-[state=open]:slide-in-from-right-1/2">
                    {selectedItem && (
                        <>
                            <div className="p-6 border-b bg-muted/10">
                                <div className="flex items-center gap-2 mb-2">
                                    {getPriorityBadge(selectedItem.priority)}
                                    <Badge variant="secondary">{COLUMNS.find(c => c.id === selectedItem.status)?.label}</Badge>
                                </div>
                                <DialogTitle className="text-xl mb-2">{selectedItem.title}</DialogTitle>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedItem.description}</p>
                                {selectedItem.target_date && (
                                    <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                                        <Calendar className="h-4 w-4" />
                                        Alvo: {new Date(selectedItem.target_date).toLocaleDateString()}
                                    </div>
                                )}
                            </div>

                            <ScrollArea className="flex-1 p-6">
                                <h3 className="font-semibold mb-4 flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" /> Comentários
                                </h3>
                                <div className="space-y-4">
                                    {comments.map(comment => (
                                        <div key={comment.id} className="flex gap-3 text-sm">
                                            <Avatar className="h-8 w-8 mt-1">
                                                <AvatarFallback>{comment.user_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">{comment.user_name}</span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {new Date(comment.created_at).toLocaleString()}
                                                    </span>
                                                </div>
                                                <p className="text-muted-foreground bg-muted/30 p-2 rounded-md">{comment.content}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {comments.length === 0 && (
                                        <div className="text-center text-muted-foreground py-8 text-sm">
                                            Nenhum comentário.
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>

                            <div className="p-4 border-t bg-background">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Adicionar comentário..."
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && submitComment()}
                                    />
                                    <Button size="icon" onClick={submitComment} disabled={!newComment.trim()}>
                                        <MessageSquare className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default RoadmapPage;
