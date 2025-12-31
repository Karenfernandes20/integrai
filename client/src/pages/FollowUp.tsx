import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    CalendarCheck,
    Search,
    Filter,
    Plus,
    MoreVertical,
    Clock,
    CheckCircle2,
    AlertCircle,
    Phone,
    MessageSquare,
    User,
    Calendar,
    ChevronRight,
    Play,
    XCircle,
    RotateCcw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { toast } from "sonner";

const FollowUpPage = () => {
    const { token, user } = useAuth();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Fetch Stats
    const { data: stats } = useQuery({
        queryKey: ["follow-up-stats"],
        queryFn: async () => {
            const res = await fetch("/api/crm/follow-ups/stats", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar estatísticas");
            return res.json();
        }
    });

    // Fetch Follow-ups
    const { data: followUps, isLoading } = useQuery({
        queryKey: ["follow-ups"],
        queryFn: async () => {
            const res = await fetch("/api/crm/follow-ups", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar follow-ups");
            return res.json();
        }
    });

    // Mutations
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number, data: any }) => {
            const res = await fetch(`/api/crm/follow-ups/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Erro ao atualizar follow-up");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
            queryClient.invalidateQueries({ queryKey: ["follow-up-stats"] });
            toast.success("Follow-up atualizado com sucesso");
        }
    });

    const filteredFollowUps = useMemo(() => {
        if (!followUps) return [];
        return followUps.filter((f: any) => {
            const matchesSearch =
                (f.title?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (f.lead_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (f.whatsapp_contact_name?.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesStatus = statusFilter === "all" || f.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [followUps, searchTerm, statusFilter]);

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'completed': return "bg-emerald-100 text-emerald-700 border-emerald-200";
            case 'overdue': return "bg-red-100 text-red-700 border-red-200";
            case 'pending': return "bg-blue-100 text-blue-700 border-blue-200";
            case 'in_progress': return "bg-amber-100 text-amber-700 border-amber-200";
            case 'cancelled': return "bg-gray-100 text-gray-600 border-gray-200";
            default: return "bg-gray-100 text-gray-700";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle2 className="h-4 w-4" />;
            case 'overdue': return <AlertCircle className="h-4 w-4" />;
            case 'pending': return <Clock className="h-4 w-4" />;
            case 'in_progress': return <Play className="h-4 w-4" />;
            case 'cancelled': return <XCircle className="h-4 w-4" />;
            default: return null;
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'whatsapp': return <MessageSquare className="h-4 w-4 text-emerald-600" />;
            case 'call': return <Phone className="h-4 w-4 text-blue-600" />;
            case 'wait_reply': return <Clock className="h-4 w-4 text-amber-600" />;
            case 'post_sale': return <CalendarCheck className="h-4 w-4 text-purple-600" />;
            default: return <ChevronRight className="h-4 w-4 text-gray-500" />;
        }
    };

    const handleAction = (id: number, action: string) => {
        if (action === 'complete') {
            updateMutation.mutate({ id, data: { status: 'completed', completed_at: new Date() } });
        } else if (action === 'cancel') {
            updateMutation.mutate({ id, data: { status: 'cancelled' } });
        }
    };

    return (
        <div className="p-1 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Follow-up</h1>
                    <p className="text-sm text-muted-foreground italic max-w-lg">
                        Organize suas ações futuras para nunca perder uma venda. Acompanhamento é a chave da conversão.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button className="bg-primary hover:bg-primary/90 shadow-md">
                        <Plus className="h-4 w-4 mr-2" /> Novo Follow-up
                    </Button>
                </div>
            </header>

            {/* Indicators */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-none shadow-sm bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div className="p-1.5 rounded-md bg-blue-500/10 w-fit mb-2">
                            <Clock className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                            <span className="text-2xl font-bold block">{stats?.pending || 0}</span>
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Pendentes</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-gradient-to-br from-red-50 to-white dark:from-red-950/20">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div className="p-1.5 rounded-md bg-red-500/10 w-fit mb-2">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                        </div>
                        <div>
                            <span className="text-2xl font-bold block text-red-600">{stats?.overdue || 0}</span>
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Atrasados</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div className="p-1.5 rounded-md bg-emerald-500/10 w-fit mb-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                            <span className="text-2xl font-bold block text-emerald-600">{stats?.completed_today || 0}</span>
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Concluídos Hoje</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div className="p-1.5 rounded-md bg-indigo-500/10 w-fit mb-2">
                            <RotateCcw className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                            <span className="text-2xl font-bold block">
                                {stats?.total > 0 ? ((stats.completed_today / stats.total) * 100).toFixed(0) : 0}%
                            </span>
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Taxa de Conclusão</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card className="border-none shadow-sm bg-background/50 backdrop-blur-sm">
                <CardContent className="p-4 flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por contato ou título..."
                            className="pl-9 h-9 border-none bg-muted/50 focus-visible:ring-primary/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            className={cn("cursor-pointer h-8 px-3 transition-colors", statusFilter === 'all' ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}
                            onClick={() => setStatusFilter("all")}
                        > Todos </Badge>
                        <Badge
                            variant="outline"
                            className={cn("cursor-pointer h-8 px-3 transition-colors", statusFilter === 'pending' ? "bg-blue-500 text-white border-blue-500" : "hover:bg-blue-50")}
                            onClick={() => setStatusFilter("pending")}
                        > Pendentes </Badge>
                        <Badge
                            variant="outline"
                            className={cn("cursor-pointer h-8 px-3 transition-colors", statusFilter === 'overdue' ? "bg-red-500 text-white border-red-500" : "hover:bg-red-50")}
                            onClick={() => setStatusFilter("overdue")}
                        > Atrasados </Badge>
                        <Badge
                            variant="outline"
                            className={cn("cursor-pointer h-8 px-3 transition-colors", statusFilter === 'completed' ? "bg-emerald-500 text-white border-emerald-500" : "hover:bg-emerald-50")}
                            onClick={() => setStatusFilter("completed")}
                        > Concluídos </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* List */}
            <section className="space-y-3">
                {isLoading ? (
                    <div className="flex flex-col gap-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 w-full bg-muted animate-pulse rounded-xl" />)}
                    </div>
                ) : filteredFollowUps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-muted">
                        <CalendarCheck className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold text-muted-foreground">Nenhum follow-up encontrado</h3>
                        <p className="text-sm text-muted-foreground max-w-xs px-4">
                            Você não possui ações agendadas para este filtro. Crie um novo follow-up para organizar seu atendimento.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {filteredFollowUps.map((f: any) => (
                            <Card key={f.id} className={cn(
                                "border-none shadow-sm transition-all hover:translate-x-1 group",
                                f.status === 'overdue' ? "bg-red-50/30 border-l-4 border-l-red-500" : "bg-background",
                                f.status === 'completed' && "opacity-60"
                            )}>
                                <CardContent className="p-4 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className={cn(
                                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-sm",
                                            getStatusStyles(f.status)
                                        )}>
                                            {getTypeIcon(f.type)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-semibold text-sm truncate">{f.title || "Follow-up s/ título"}</h4>
                                                <Badge className={cn("text-[10px] h-4 py-0", getStatusStyles(f.status))}>
                                                    <span className="flex items-center gap-1">
                                                        {getStatusIcon(f.status)}
                                                        {f.status === 'pending' ? 'Pendente' :
                                                            f.status === 'overdue' ? 'Atrasado' :
                                                                f.status === 'completed' ? 'Concluído' : 'Cancelado'}
                                                    </span>
                                                </Badge>
                                                {f.stage_name && (
                                                    <Badge variant="secondary" className="text-[10px] h-4 py-0 bg-blue-50 text-blue-600 border-none">
                                                        {f.stage_name}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-muted-foreground">
                                                <div className="flex items-center gap-1.5 min-w-[120px]">
                                                    <User className="h-3 w-3" />
                                                    <span className="font-medium text-foreground truncate">
                                                        {f.lead_name || f.whatsapp_contact_name || "Contato s/ nome"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="h-3 w-3" />
                                                    <span>{format(new Date(f.scheduled_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 hidden md:flex">
                                                    <Badge variant="outline" className="text-[9px] py-0 h-3 border-none bg-muted/50">
                                                        {f.origin}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {f.status !== 'completed' && f.status !== 'cancelled' && (
                                            <>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600 transition-colors" title="Concluir" onClick={() => handleAction(f.id, 'complete')}>
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </Button>
                                                {f.type === 'whatsapp' && (
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                                                        <MessageSquare className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="icon" variant="ghost" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-40">
                                                <DropdownMenuItem className="text-xs">Editar</DropdownMenuItem>
                                                <DropdownMenuItem className="text-xs">Reagendar</DropdownMenuItem>
                                                {f.status !== 'completed' && (
                                                    <DropdownMenuItem className="text-xs text-red-600" onClick={() => handleAction(f.id, 'cancel')}>Cancelar</DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default FollowUpPage;
