import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
    Search,
    Filter,
    Clock,
    AlertCircle,
    CheckCircle2,
    Info,
    Terminal,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Bug,
    MessageSquare,
    Webhook,
    Cpu,
    Database,
    ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Log {
    id: number;
    event_type: string;
    origin: string;
    status: string;
    conversation_id?: number;
    phone?: string;
    message: string;
    details: any;
    created_at: string;
}

const LogsPage = () => {
    const { token } = useAuth();
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const limit = 50;

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [originFilter, setOriginFilter] = useState("all");

    const [selectedLog, setSelectedLog] = useState<Log | null>(null);

    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        fetchLogs();
    }, [page, statusFilter, typeFilter, originFilter]);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: (page * limit).toString()
            });
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (typeFilter !== 'all') params.append('event_type', typeFilter);
            if (originFilter !== 'all') params.append('origin', originFilter);
            if (search) params.append('search', search);

            const res = await fetch(`/api/admin/logs?${params.toString()}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs);
                setTotal(data.total);
            }
        } catch (e) {
            toast.error("Erro ao carregar logs");
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch("/api/admin/logs/stats", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                setStats(await res.json());
            }
        } catch (e) { }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'success': return <Badge className="bg-green-500/10 text-green-600 border-green-200">Sucesso</Badge>;
            case 'error': return <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200">Erro</Badge>;
            case 'warning': return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Aviso</Badge>;
            case 'info': return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">Info</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const getTypeIcon = (type: string) => {
        if (type.includes('message')) return <MessageSquare className="h-4 w-4 text-blue-500" />;
        if (type.includes('webhook')) return <Webhook className="h-4 w-4 text-purple-500" />;
        if (type.includes('error') || type.includes('fail')) return <Bug className="h-4 w-4 text-red-500" />;
        if (type.includes('ia')) return <Cpu className="h-4 w-4 text-indigo-500" />;
        if (type.includes('db')) return <Database className="h-4 w-4 text-slate-500" />;
        return <Terminal className="h-4 w-4 text-slate-400" />;
    };

    const formatJSON = (json: any) => {
        try {
            return JSON.stringify(json, null, 2);
        } catch {
            return String(json);
        }
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-full mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-background/60 backdrop-blur-md p-6 rounded-2xl border shadow-sm sticky top-0 z-10">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Terminal className="h-6 w-6 text-primary" />
                        Logs do Sistema
                    </h1>
                    <p className="text-muted-foreground text-sm">Monitoramento em tempo real e auditoria</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setPage(0); fetchLogs(); fetchStats(); }} className="gap-2">
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        Atualizar
                    </Button>
                </div>
            </div>

            {/* Stats Dashboard (Last 24h) */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-green-50/30 border-green-100">
                        <CardHeader className="py-3">
                            <CardTitle className="text-sm font-medium text-green-700">Sucessos (24h)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-700">
                                {stats.last24h.find((s: any) => s.status === 'success')?.count || 0}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-50/30 border-red-100">
                        <CardHeader className="py-3">
                            <CardTitle className="text-sm font-medium text-red-700">Erros (24h)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-700">
                                {stats.last24h.find((s: any) => s.status === 'error')?.count || 0}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-50/30 border-amber-100">
                        <CardHeader className="py-3">
                            <CardTitle className="text-sm font-medium text-amber-700">Avisos (24h)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-700">
                                {stats.last24h.find((s: any) => s.status === 'warning')?.count || 0}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-50/30 border-slate-100">
                        <CardHeader className="py-3">
                            <CardTitle className="text-sm font-medium text-slate-700">Total Eventos (24h)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-700">
                                {stats.last24h.reduce((acc: number, s: any) => acc + parseInt(s.count), 0)}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-background/40 p-4 rounded-xl border">
                <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar em mensagens ou detalhes..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                    />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos Status</SelectItem>
                        <SelectItem value="success">Sucesso</SelectItem>
                        <SelectItem value="error">Erro</SelectItem>
                        <SelectItem value="warning">Aviso</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="Tipo de Evento" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Tipos</SelectItem>
                        <SelectItem value="message_in">Msg Recebida</SelectItem>
                        <SelectItem value="message_out">Msg Enviada</SelectItem>
                        <SelectItem value="webhook_received">Webhook</SelectItem>
                        <SelectItem value="webhook_error">Erro de Webhook</SelectItem>
                        <SelectItem value="campaign_fail">Falha Campanha</SelectItem>
                        <SelectItem value="evolution_error">Erro Evolution</SelectItem>
                        <SelectItem value="ia_error">Erro IA</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={originFilter} onValueChange={setOriginFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="Origem" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas Origens</SelectItem>
                        <SelectItem value="webhook">Webhook</SelectItem>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="system">Sistema</SelectItem>
                        <SelectItem value="ia">IA</SelectItem>
                        <SelectItem value="evolution">Evolution</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <Card className="border-none shadow-strong overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b">
                            <tr>
                                <th className="text-left p-4 font-semibold text-slate-600">Evento</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Data/Hora (Brasília)</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Origem</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Status</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Mensagem</th>
                                <th className="text-right p-4 font-semibold text-slate-600">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="p-4 h-16 bg-slate-50/50"></td>
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-muted-foreground italic">
                                        Nenhum log encontrado para os filtros selecionados.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {getTypeIcon(log.event_type)}
                                                <span className="font-medium text-slate-700 uppercase text-[10px]">
                                                    {log.event_type.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-500 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span>{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}</span>
                                                <span className="text-[10px] text-slate-400">BRT</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-600">
                                            <Badge variant="outline" className="text-[10px] capitalize bg-slate-100 border-none font-normal">
                                                {log.origin}
                                            </Badge>
                                        </td>
                                        <td className="p-4">
                                            {getStatusBadge(log.status)}
                                        </td>
                                        <td className="p-4 max-w-xs xl:max-w-md">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium text-slate-800 line-clamp-1 truncate">
                                                    {log.message}
                                                </span>
                                                {log.phone && (
                                                    <span className="text-[11px] text-primary flex items-center gap-1">
                                                        <ExternalLink className="h-3 w-3" /> {log.phone}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelectedLog(log)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                Ver Detalhes
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t flex items-center justify-between bg-white">
                    <div className="text-xs text-muted-foreground">
                        Mostrando {logs.length} de {total} registros
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={page === 0}
                            onClick={() => setPage(p => p - 1)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="text-xs px-2 font-medium">
                            Página {page + 1} de {totalPages || 1}
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage(p => p + 1)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Details Modal */}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selectedLog && getTypeIcon(selectedLog.event_type)}
                            Detalhes do Evento #{selectedLog?.id}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedLog && (
                        <div className="space-y-4 overflow-y-auto pr-2 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-lg border space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Evento</span>
                                    <p className="font-semibold">{selectedLog.event_type}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg border space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Horário</span>
                                    <p className="font-semibold">{format(new Date(selectedLog.created_at), 'dd/MM/yyyy HH:mm:ss')}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg border space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Origem</span>
                                    <p className="font-semibold capitalize">{selectedLog.origin}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg border space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                                    <div>{getStatusBadge(selectedLog.status)}</div>
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-lg border space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Mensagem Principal</span>
                                <p className="text-sm italic">{selectedLog.message}</p>
                            </div>

                            <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Dados Técnicos (JSON)</span>
                                <div className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                                    <pre className="text-xs font-mono leading-relaxed">
                                        {formatJSON(selectedLog.details)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default LogsPage;
