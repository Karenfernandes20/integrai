import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
    Fingerprint,
    Calendar,
    User,
    FileText,
    ArrowRight,
    Search,
    History,
    Building2,
    Settings,
    ShieldCheck
} from "lucide-react";
import { ScrollArea } from "../components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

export default function AuditoriaPage() {
    const { token } = useAuth();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ resourceType: "all", action: "all" });

    useEffect(() => {
        fetchLogs();
    }, [filter, token]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            let url = `/api/admin/audit/logs?limit=100`;
            if (filter.resourceType !== "all") url += `&resourceType=${filter.resourceType}`;
            if (filter.action !== "all") url += `&action=${filter.action}`;

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setLogs(await res.json());
        } catch (error) {
            console.error("Failed to fetch audit logs");
        } finally {
            setLoading(false);
        }
    };

    const getActionBadge = (action: string) => {
        switch (action) {
            case 'create': return <Badge className="bg-green-500">Criação</Badge>;
            case 'update': return <Badge className="bg-blue-500">Edição</Badge>;
            case 'delete': return <Badge variant="destructive">Exclusão</Badge>;
            default: return <Badge variant="secondary">{action}</Badge>;
        }
    };

    const getResourceIcon = (type: string) => {
        switch (type) {
            case 'user': return <User className="h-4 w-4" />;
            case 'task': return <FileText className="h-4 w-4" />;
            case 'company': return <Building2 className="h-4 w-4" />;
            case 'ai_agent': return <ShieldCheck className="h-4 w-4" />;
            default: return <Settings className="h-4 w-4" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Auditoria do Sistema</h2>
                    <p className="text-muted-foreground">Rastreabilidade completa de todas as ações administrativas realizadas.</p>
                </div>
                <div className="flex gap-2 text-primary font-medium items-center bg-primary-soft/20 px-4 py-2 rounded-full">
                    <Fingerprint className="w-5 h-5 mr-1" />
                    <span>Logs Imutáveis</span>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                        <div className="flex flex-wrap gap-2">
                            <Select value={filter.resourceType} onValueChange={(v) => setFilter({ ...filter, resourceType: v })}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Tipo de Recurso" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os Recursos</SelectItem>
                                    <SelectItem value="user">Usuários</SelectItem>
                                    <SelectItem value="task">Tarefas</SelectItem>
                                    <SelectItem value="company">Empresas</SelectItem>
                                    <SelectItem value="document">Documentos</SelectItem>
                                    <SelectItem value="ai_agent">Agentes IA</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={filter.action} onValueChange={(v) => setFilter({ ...filter, action: v })}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Ação" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as Ações</SelectItem>
                                    <SelectItem value="create">Criações</SelectItem>
                                    <SelectItem value="update">Edições</SelectItem>
                                    <SelectItem value="delete">Exclusões</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar por ID ou Detalhes..." className="pl-8" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <ScrollArea className="h-[600px]">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Data/Hora</th>
                                        <th className="px-4 py-3 text-left font-medium">Usuário</th>
                                        <th className="px-4 py-3 text-left font-medium">Empresa</th>
                                        <th className="px-4 py-3 text-left font-medium">Ação</th>
                                        <th className="px-4 py-3 text-left font-medium">Recurso</th>
                                        <th className="px-4 py-3 text-left font-medium">Detalhes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-b hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-3 w-3" />
                                                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-medium">
                                                {log.user_name || 'Sistema'}
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                {log.company_name || <Badge variant="outline">Global</Badge>}
                                            </td>
                                            <td className="px-4 py-3">
                                                {getActionBadge(log.action)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5 font-medium">
                                                    {getResourceIcon(log.resource_type)}
                                                    <span className="capitalize">{log.resource_type}</span>
                                                    <span className="text-[10px] text-muted-foreground">#{log.resource_id}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                                {log.details}
                                                {log.action === 'update' && (
                                                    <div className="mt-1 flex items-center gap-1 text-[9px] text-blue-500 font-bold uppercase">
                                                        <History className="h-2 w-2" /> Alterações Registradas
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {logs.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-20 text-center text-muted-foreground">
                                                Nenhum registro de auditoria encontrado nos filtros selecionados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
