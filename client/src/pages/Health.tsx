import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
    Activity,
    Database,
    Cpu,
    Webhook,
    MessageSquare,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    XCircle,
    Play,
    Clock,
    History
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface HealthData {
    services: {
        database: { status: string; latency?: string };
        webhook: { status: string };
        evolution: { status: string };
        ia: { status: string };
    };
    incidents: any[];
}

const HealthPage = () => {
    const { token } = useAuth();
    const [data, setData] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState<string | null>(null);

    useEffect(() => {
        fetchHealth();
    }, []);

    const fetchHealth = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/health", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                setData(await res.json());
            }
        } catch (e) {
            toast.error("Erro ao carregar dados de saúde");
        } finally {
            setLoading(false);
        }
    };

    const runTest = async (service: string) => {
        setTesting(service);
        try {
            const res = await fetch("/api/admin/health/test", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ service })
            });
            const result = await res.json();
            if (result.success) {
                toast.success(result.message);
            } else {
                toast.error(result.error || "Teste falhou");
            }
        } catch (e) {
            toast.error("Erro ao executar teste");
        } finally {
            setTesting(null);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'operational': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
            case 'unstable': return <AlertCircle className="h-5 w-5 text-amber-500" />;
            case 'down': return <XCircle className="h-5 w-5 text-red-500" />;
            default: return <RefreshCw className="h-5 w-5 text-slate-400" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'operational': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Operacional</Badge>;
            case 'unstable': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">Instável</Badge>;
            case 'down': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Indisponível</Badge>;
            default: return <Badge variant="secondary">Desconhecido</Badge>;
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-background/60 backdrop-blur-md p-6 rounded-2xl border shadow-sm sticky top-0 z-10">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="h-6 w-6 text-primary" />
                        Saúde do Sistema
                    </h1>
                    <p className="text-muted-foreground text-sm">Status operacional do Integrai em tempo real</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading} className="gap-2">
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    Atualizar Status
                </Button>
            </div>

            {/* Service Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Database */}
                <Card className="overflow-hidden border-none shadow-strong">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-50 rounded-lg"><Database className="h-4 w-4 text-blue-500" /></div>
                            <span className="font-semibold">Banco de Dados</span>
                        </div>
                        {data && getStatusIcon(data.services.database.status)}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-1">
                            {data && getStatusBadge(data.services.database.status)}
                            {data?.services.database.latency && <span className="text-[10px] text-muted-foreground">Latência: {data.services.database.latency}</span>}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between h-8 text-[11px] font-bold"
                            onClick={() => runTest('database')}
                            disabled={!!testing}
                        >
                            {testing === 'database' ? "Testando..." : "Realizar Teste"}
                            <Play className="h-3 w-3" />
                        </Button>
                    </CardContent>
                </Card>

                {/* Webhook */}
                <Card className="overflow-hidden border-none shadow-strong">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-purple-50 rounded-lg"><Webhook className="h-4 w-4 text-purple-500" /></div>
                            <span className="font-semibold">Webhook</span>
                        </div>
                        {data && getStatusIcon(data.services.webhook.status)}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-1">
                            {data && getStatusBadge(data.services.webhook.status)}
                        </div>
                        <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-[11px] font-bold" disabled>
                            Monitoramento Passivo
                            <Activity className="h-3 w-3" />
                        </Button>
                    </CardContent>
                </Card>

                {/* Evolution */}
                <Card className="overflow-hidden border-none shadow-strong">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-green-50 rounded-lg"><MessageSquare className="h-4 w-4 text-green-500" /></div>
                            <span className="font-semibold">Evolution API</span>
                        </div>
                        {data && getStatusIcon(data.services.evolution.status)}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-1">
                            {data && getStatusBadge(data.services.evolution.status)}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between h-8 text-[11px] font-bold"
                            onClick={() => runTest('evolution')}
                            disabled={!!testing}
                        >
                            {testing === 'evolution' ? "Testando API..." : "Verificar Instâncias"}
                            <Play className="h-3 w-3" />
                        </Button>
                    </CardContent>
                </Card>

                {/* IA */}
                <Card className="overflow-hidden border-none shadow-strong">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-50 rounded-lg"><Cpu className="h-4 w-4 text-indigo-500" /></div>
                            <span className="font-semibold">Inteligência Artif.</span>
                        </div>
                        {data && getStatusIcon(data.services.ia.status)}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-1">
                            {data && getStatusBadge(data.services.ia.status)}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between h-8 text-[11px] font-bold"
                            onClick={() => runTest('ia')}
                            disabled={!!testing}
                        >
                            {testing === 'ia' ? "Processando..." : "Testar Resposta"}
                            <Play className="h-3 w-3" />
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Evolution Specific Debug */}
                <Card className="lg:col-span-1 border-none shadow-strong bg-slate-900 text-slate-100">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Activity className="h-5 w-5 text-green-400" />
                            Live Check
                        </CardTitle>
                        <CardDescription className="text-slate-400">Verificação manual de fluxos</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-xs p-3 bg-slate-800 rounded-lg border border-slate-700 font-mono">
                            # Teste de Envio (Integrai)
                            <br />GET /api/evolution/fetchInstances
                        </div>
                        <div className="space-y-2">
                            <Button variant="outline" className="w-full bg-transparent border-slate-700 hover:bg-slate-800 text-xs gap-2">
                                <RefreshCw className="h-3 w-3" /> Abrir Terminal de Depuração
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Incidents */}
                <Card className="lg:col-span-2 border-none shadow-strong">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Incidentes Recentes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-50 animate-pulse rounded-lg" />)}
                            </div>
                        ) : data?.incidents.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground italic text-sm">
                                Nenhum incidente registrado recentemente.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data?.incidents.map((inc: any) => (
                                    <div key={inc.id} className="flex items-center justify-between p-3 rounded-xl bg-red-50/30 border border-red-50 transition-hover hover:bg-red-50/50">
                                        <div className="flex items-center gap-3">
                                            <AlertCircle className="h-4 w-4 text-red-500" />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-800 uppercase">{inc.event_type}</span>
                                                <span className="text-[11px] text-slate-500 truncate max-w-sm">{inc.message}</span>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
                                            {format(new Date(inc.created_at), "HH:mm:ss")}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default HealthPage;
