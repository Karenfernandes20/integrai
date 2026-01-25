
import { useState, useEffect } from "react";
import { CompanySummary } from "../../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
    MessageCircle,
    TrendingUp,
    Users,
    Car,
    Calendar,
    DollarSign,
    RefreshCw,
    Clock,
    CheckCircle,
    ClipboardList,
    AlertCircle
} from "lucide-react";
import { cn } from "../../lib/utils";

interface LavajatoDashboardProps {
    company: CompanySummary;
}

export const LavajatoDashboard = ({ company }: LavajatoDashboardProps) => {
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem("auth_token");
            let url = `/api/lavajato/stats?companyId=${company.id}`;
            if (dateRange.start) url += `&startDate=${dateRange.start}`;
            if (dateRange.end) url += `&endDate=${dateRange.end}`;

            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (e) {
            console.error("Error fetching lavajato stats", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, [company.id, dateRange]);

    const statCards = [
        {
            title: "Conversas Ativas",
            value: stats?.activeConversations || 0,
            icon: MessageCircle,
            color: "text-blue-500",
            bg: "bg-blue-50",
            description: "Atendimentos em aberto"
        },
        {
            title: "Mensagens Recebidas",
            value: stats?.messagesReceived || 0,
            icon: MessageCircle,
            color: "text-purple-500",
            bg: "bg-purple-50",
            description: "Total de interações"
        },
        {
            title: "Clientes Atendidos",
            value: stats?.clientsServed || 0,
            icon: Users,
            color: "text-green-500",
            bg: "bg-green-50",
            description: "Serviços finalizados"
        },
        {
            title: "Novos Clientes",
            value: stats?.newClients || 0,
            icon: TrendingUp,
            color: "text-cyan-500",
            bg: "bg-cyan-50",
            description: "Cadastrados no período"
        },
        {
            title: "Agendamentos Hoje",
            value: stats?.appointmentsToday || 0,
            icon: Calendar,
            color: "text-orange-500",
            bg: "bg-orange-50",
            description: "Veículos previstos"
        },
        {
            title: "Faturamento",
            value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.revenue || 0),
            icon: DollarSign,
            color: "text-emerald-500",
            bg: "bg-emerald-50",
            description: "Total no período"
        },
        {
            title: "Ticket Médio",
            value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.ticketMedio || 0),
            icon: TrendingUp,
            color: "text-indigo-500",
            bg: "bg-indigo-50",
            description: "Receita por cliente"
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 uppercase text-[10px] tracking-widest px-2 py-0.5">
                            Módulo Lavajato
                        </Badge>
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-[10px] uppercase tracking-widest px-2 py-0.5",
                                stats?.whatsappStatus === 'connected' ? "bg-green-50 text-green-600 border-green-200" : "bg-red-50 text-red-600 border-red-200"
                            )}
                        >
                            ● {stats?.whatsappStatus === 'connected' ? 'WhatsApp Online' : 'WhatsApp Offline'}
                        </Badge>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight mt-1">Dashboard Operacional</h1>
                    <p className="text-muted-foreground text-sm">Gestão completa de lavagem e estética automotiva.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 bg-background p-1.5 rounded-xl border shadow-sm">
                    <div className="flex items-center gap-1.5 px-2">
                        <input
                            type="date"
                            className="bg-transparent border-none text-xs focus:ring-0"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        />
                        <span className="text-muted-foreground">-</span>
                        <input
                            type="date"
                            className="bg-transparent border-none text-xs focus:ring-0"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        />
                    </div>
                    <div className="w-[1px] h-4 bg-border mx-1" />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={fetchStats}
                        disabled={loading}
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((card, idx) => (
                    <Card key={idx} className="border-none shadow-sm elevated-card group hover:shadow-md transition-all">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div className={cn("p-2 rounded-lg", card.bg)}>
                                    <card.icon className={cn("h-5 w-5", card.color)} />
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{card.title}</p>
                                    <h3 className="text-xl font-bold">{card.value}</h3>
                                </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
                                {card.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Funnel and Real-time Section */}
            <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-none shadow-sm elevated-card">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Fluxo de Lavagem (Funil)</CardTitle>
                            <CardDescription>Status atual dos veículos na loja</CardDescription>
                        </div>
                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                            {[
                                { label: 'Leads', status: 'lead', color: 'bg-slate-200' },
                                { label: 'Atendimento', status: 'atendimento', color: 'bg-blue-400' },
                                { label: 'Autorizado', status: 'autorizado', color: 'bg-cyan-400' },
                                { label: 'Em Lavagem', status: 'lavagem', color: 'bg-orange-400' },
                                { label: 'Finalizado', status: 'finalizado', color: 'bg-green-400' },
                                { label: 'Pago', status: 'pago', color: 'bg-emerald-500' },
                            ].map((step, idx) => (
                                <div key={idx} className="flex flex-col items-center p-3 rounded-lg border bg-background/50">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground mb-2">{step.label}</span>
                                    <div className={cn("h-1.5 w-full rounded-full mb-2", step.color)} />
                                    <span className="text-lg font-bold">0</span>
                                    <span className="text-[9px] text-muted-foreground">R$ 0,00</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-primary" />
                                <div className="text-xs">
                                    <p className="font-bold text-primary">Dica operacional</p>
                                    <p className="text-muted-foreground">O tempo médio de lavagem está em 45 min. Meta: 40 min.</p>
                                </div>
                            </div>
                            <Button size="sm" variant="outline" className="text-[10px] h-7 px-3 uppercase font-bold tracking-widest bg-white">Ver detalhes</Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="border-none shadow-sm elevated-card h-full">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Clock className="h-5 w-5 text-blue-500" />
                                Status Box
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {[1, 2, 3].map((box) => (
                                    <div key={box} className="flex items-center justify-between p-3 rounded-lg border group hover:border-primary/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs">
                                                {box}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold">Box 0{box}</p>
                                                <p className="text-[10px] text-muted-foreground">Livre para uso</p>
                                            </div>
                                        </div>
                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none text-[9px] uppercase tracking-widest px-2">Disponível</Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
