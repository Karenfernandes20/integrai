import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
    Plus,
    Search,
    Filter,
    Clock,
    AlertCircle,
    CheckCircle2,
    MoreVertical,
    Pencil,
    Trash2,
    History,
    CheckSquare,
    Calendar,
    User
} from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import RelationshipManager from "../components/RelationshipManager";

interface Task {
    id: number;
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
    priority: 'low' | 'medium' | 'high';
    due_date?: string;
    responsible_id?: number;
    responsible_name?: string;
    creator_name?: string;
    created_at: string;
    updated_at: string;
    completed_at?: string;
}

interface TaskHistory {
    id: number;
    action: string;
    user_name: string;
    created_at: string;
}

const TasksPage = () => {
    const { token, user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [showCompleted, setShowCompleted] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        priority: "medium",
        status: "pending",
        due_date: "",
        due_time: "10:00",
        responsible_id: ""
    });

    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<TaskHistory[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyTaskTitle, setHistoryTaskTitle] = useState("");

    const [users, setUsers] = useState<any[]>([]);
    const [searchParams] = useSearchParams();

    const handleOpenTask = (task: Task) => {
        setEditingTask(task);
        setFormData({
            title: task.title,
            description: task.description || "",
            priority: task.priority,
            status: task.status,
            due_date: task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : "",
            due_time: task.due_date ? format(new Date(task.due_date), 'HH:mm') : "10:00",
            responsible_id: task.responsible_id ? task.responsible_id.toString() : ""
        });
        setShowModal(true);
    };

    useEffect(() => {
        fetchTasks();
        fetchUsers();
    }, [statusFilter, priorityFilter, filter]);

    useEffect(() => {
        const taskId = searchParams.get('id');
        if (taskId && tasks.length > 0) {
            const task = tasks.find(t => t.id.toString() === taskId);
            if (task) {
                handleOpenTask(task);
            }
        }
    }, [searchParams, tasks]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (priorityFilter !== 'all') params.append('priority', priorityFilter);
            if (filter !== 'all') params.append('filter', filter);
            if (search) params.append('search', search);

            const res = await fetch(`/api/admin/tasks?${params.toString()}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (e) {
            toast.error("Erro ao carregar tarefas");
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/users", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (e) { }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title) return toast.error("Título é obrigatório");

        const payload = {
            ...formData,
            due_date: formData.due_date ? `${formData.due_date}T${formData.due_time}:00` : null,
            responsible_id: formData.responsible_id ? parseInt(formData.responsible_id) : null
        };

        try {
            const url = editingTask ? `/api/admin/tasks/${editingTask.id}` : "/api/admin/tasks";
            const method = editingTask ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success(editingTask ? "Tarefa atualizada" : "Tarefa criada");
                setShowModal(false);
                setEditingTask(null);
                fetchTasks();
                // If the sidebar uses a global state or context for the badge, it should be updated here.
                // For now we assume a simple refresh or polling.
            } else {
                toast.error("Erro ao salvar tarefa");
            }
        } catch (e) {
            toast.error("Erro na requisição");
        }
    };

    const handleToggleComplete = async (task: Task) => {
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        try {
            const res = await fetch(`/api/admin/tasks/${task.id}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                toast.success(newStatus === 'completed' ? "Tarefa concluída" : "Tarefa reaberta");
                fetchTasks();
            }
        } catch (e) {
            toast.error("Erro ao atualizar tarefa");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Deseja realmente excluir esta tarefa?")) return;

        try {
            const res = await fetch(`/api/admin/tasks/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success("Tarefa excluída");
                fetchTasks();
            }
        } catch (e) {
            toast.error("Erro ao excluir");
        }
    };

    const handleOpenHistory = async (task: Task) => {
        setHistoryTaskTitle(task.title);
        setShowHistory(true);
        setHistoryLoading(true);
        setHistory([]);
        try {
            const res = await fetch(`/api/admin/tasks/${task.id}/history`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch (e) {
            toast.error("Erro ao carregar histórico");
        } finally {
            setHistoryLoading(false);
        }
    };

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'high': return 'bg-red-500/10 text-red-600 border-red-200';
            case 'medium': return 'bg-amber-500/10 text-amber-600 border-amber-200';
            case 'low': return 'bg-blue-500/10 text-blue-600 border-blue-200';
            default: return 'bg-slate-500/10 text-slate-600 border-slate-200';
        }
    };

    const getPriorityLabel = (p: string) => {
        switch (p) {
            case 'high': return 'Alta';
            case 'medium': return 'Média';
            case 'low': return 'Baixa';
            default: return p;
        }
    };

    const getStatusLabel = (s: string) => {
        switch (s) {
            case 'pending': return 'Pendente';
            case 'in_progress': return 'Em Progresso';
            case 'completed': return 'Concluída';
            default: return s;
        }
    };

    const filterTasks = tasks.filter(t => {
        if (!showCompleted && t.status === 'completed') return false;
        return true;
    });

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-background/60 backdrop-blur-md p-6 rounded-2xl border shadow-sm sticky top-0 z-10">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <CheckSquare className="h-6 w-6 text-primary" />
                        Tarefas Operacionais
                    </h1>
                    <p className="text-muted-foreground text-sm">Organização e pendências do sistema</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={showCompleted ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="text-xs"
                    >
                        {showCompleted ? "Ocultar Concluídas" : "Mostrar Concluídas"}
                    </Button>
                    <Button onClick={() => {
                        setEditingTask(null);
                        setFormData({
                            title: "", description: "", priority: "medium", status: "pending",
                            due_date: "", due_time: "10:00", responsible_id: ""
                        });
                        setShowModal(true);
                    }} className="gap-2 shadow-strong">
                        <Plus className="h-4 w-4" /> Nova Tarefa
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-background/40 p-4 rounded-xl border">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar tarefas..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchTasks()}
                    />
                </div>

                <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas as Datas</SelectItem>
                        <SelectItem value="today">Hoje</SelectItem>
                        <SelectItem value="week">Esta Semana</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos Status</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="in_progress">Em Progresso</SelectItem>
                        <SelectItem value="completed">Concluída</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="Prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas Prioridades</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Task List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-muted-foreground animate-pulse">Carregando tarefas...</p>
                </div>
            ) : filterTasks.length === 0 ? (
                <Card className="border-dashed py-20">
                    <CardContent className="flex flex-col items-center justify-center text-center space-y-3">
                        <div className="bg-muted p-4 rounded-full">
                            <CheckSquare className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-lg">Nenhuma tarefa encontrada</h3>
                            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                                Você está em dia! Ou ajuste os filtros para ver outras tarefas.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filterTasks.map((task) => {
                        const overdue = task.status !== 'completed' && task.due_date && isPast(new Date(task.due_date));
                        const nearDue = task.status !== 'completed' && task.due_date && !overdue && isToday(new Date(task.due_date));

                        return (
                            <Card
                                key={task.id}
                                className={cn(
                                    "group transition-all hover:shadow-md border-l-4",
                                    task.status === 'completed' ? "opacity-60 border-l-slate-400" :
                                        task.priority === 'high' ? "border-l-red-500" :
                                            task.priority === 'medium' ? "border-l-amber-500" : "border-l-blue-500"
                                )}
                            >
                                <div className="flex items-start gap-4 p-4">
                                    <button
                                        onClick={() => handleToggleComplete(task)}
                                        className={cn(
                                            "mt-1 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-colors",
                                            task.status === 'completed'
                                                ? "bg-green-500 border-green-500 text-white"
                                                : "border-slate-300 hover:border-primary"
                                        )}
                                    >
                                        {task.status === 'completed' && <CheckCircle2 className="h-4 w-4" />}
                                    </button>

                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-1">
                                                <h3 className={cn(
                                                    "font-bold text-base leading-tight decoration-2",
                                                    task.status === 'completed' && "line-through text-muted-foreground"
                                                )}>
                                                    {task.title}
                                                </h3>
                                                {task.description && (
                                                    <p className="text-sm text-muted-foreground line-clamp-2 italic">
                                                        {task.description}
                                                    </p>
                                                )}
                                            </div>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => {
                                                        setEditingTask(task);
                                                        setFormData({
                                                            title: task.title,
                                                            description: task.description || "",
                                                            priority: task.priority,
                                                            status: task.status,
                                                            due_date: task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : "",
                                                            due_time: task.due_date ? format(new Date(task.due_date), 'HH:mm') : "10:00",
                                                            responsible_id: task.responsible_id ? task.responsible_id.toString() : ""
                                                        });
                                                        setShowModal(true);
                                                    }} className="gap-2">
                                                        <Pencil className="h-4 w-4" /> Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleOpenHistory(task)} className="gap-2">
                                                        <History className="h-4 w-4" /> Histórico
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDelete(task.id)} className="gap-2 text-destructive">
                                                        <Trash2 className="h-4 w-4" /> Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 text-[11px] md:text-xs">
                                            <Badge variant="outline" className={cn("px-2 py-0 h-5 font-medium", getPriorityColor(task.priority))}>
                                                {getPriorityLabel(task.priority)}
                                            </Badge>

                                            {task.due_date && (
                                                <div className={cn(
                                                    "flex items-center gap-1.5 font-medium px-2 py-0.5 rounded-full border",
                                                    overdue ? "bg-red-50 text-red-600 border-red-100" :
                                                        nearDue ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-slate-50 text-slate-600"
                                                )}>
                                                    {overdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                    <span>
                                                        {format(new Date(task.due_date), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                                                        {overdue && " (Vencida)"}
                                                        {nearDue && " (Hoje)"}
                                                    </span>
                                                </div>
                                            )}

                                            {task.responsible_name && (
                                                <div className="flex items-center gap-1.5 text-muted-foreground bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                                    <User className="h-3 w-3" />
                                                    <span>{task.responsible_name}</span>
                                                </div>
                                            )}

                                            <div className="text-muted-foreground/60 ml-auto">
                                                Criada em {format(new Date(task.created_at), 'dd/MM/yy')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Create/Edit Modal */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingTask ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Título (Obrigatório)</label>
                            <Input
                                placeholder="O que precisa ser feito?"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Descrição</label>
                            <Textarea
                                placeholder="Detalhes da pendência..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Prioridade</label>
                                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Baixa</SelectItem>
                                        <SelectItem value="medium">Média</SelectItem>
                                        <SelectItem value="high">Alta</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Responsável</label>
                                <Select value={formData.responsible_id} onValueChange={(v) => setFormData({ ...formData, responsible_id: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Opcional" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Sem responsável</SelectItem>
                                        {users.map(u => (
                                            <SelectItem key={u.id} value={u.id.toString()}>{u.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Prazo (Data)</label>
                                <Input
                                    type="date"
                                    value={formData.due_date}
                                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Horário</label>
                                <Input
                                    type="time"
                                    value={formData.due_time}
                                    onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                                />
                            </div>
                        </div>

                        {editingTask && (
                            <div className="pt-4 border-t">
                                <RelationshipManager entityType="task" entityId={editingTask.id} />
                            </div>
                        )}

                        {editingTask && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Status</label>
                                <Select value={formData.status} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pendente</SelectItem>
                                        <SelectItem value="in_progress">Em Progresso</SelectItem>
                                        <SelectItem value="completed">Concluída</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button type="submit" className="shadow-strong">Salvar Alterações</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* History Modal */}
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-muted-foreground" />
                            Histórico: {historyTaskTitle}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 max-h-[400px] overflow-y-auto pr-2">
                        {historyLoading ? (
                            <p className="text-center text-muted-foreground py-8">Carregando histórico...</p>
                        ) : history.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado.</p>
                        ) : (
                            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                                {history.map((h, i) => (
                                    <div key={h.id} className="relative flex items-start gap-4">
                                        <div className="absolute left-0 mt-1.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-white shadow-sm ring-2 ring-slate-100" />
                                        <div className="flex-1 ml-6 space-y-1">
                                            <p className="text-sm font-medium leading-none">{h.action}</p>
                                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                                <span>Por {h.user_name}</span>
                                                <span>{format(new Date(h.created_at), "dd/MM/yy HH:mm")}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default TasksPage;
