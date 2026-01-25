
import { useState, useEffect } from "react";
import { CompanySummary } from "../../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
    ShoppingBag,
    TrendingUp,
    Users,
    Coffee,
    ChefHat,
    Truck,
    DollarSign,
    RefreshCw,
    Clock,
    AlertCircle,
    UtensilsCrossed
} from "lucide-react";
import { cn } from "../../lib/utils";

interface RestaurantDashboardProps {
    company: CompanySummary;
}

export const RestaurantDashboard = ({ company }: RestaurantDashboardProps) => {
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [shift, setShift] = useState('all');
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem("auth_token");
            let url = `/api/restaurant/stats?companyId=${company.id}`;
            if (dateRange.start) url += `&startDate=${dateRange.start}`;
            if (dateRange.end) url += `&endDate=${dateRange.end}`;
            if (shift !== 'all') url += `&shift=${shift}`;

            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (e) {
            console.error("Error fetching restaurant stats", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, [company.id, dateRange, shift]);

    const statCards = [
        {
            title: "Pedidos Ativos",
            value: stats?.activeOrders || 0,
            icon: ShoppingBag,
            color: "text-orange-500",
            bg: "bg-orange-50",
            description: "No salão, delivery e app"
        },
        {
            title: "Pedidos do Período",
            value: stats?.totalOrders || 0,
            icon: UtensilsCrossed,
            color: "text-blue-500",
            bg: "bg-blue-50",
            description: "Total processado"
        },
        {
            title: "Clientes Atendidos",
            value: stats?.clientsServed || 0,
            icon: Users,
            color: "text-green-500",
            bg: "bg-green-50",
            description: "Pedidos finalizados"
        },
        {
            title: "Faturamento",
            value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.revenue || 0),
            icon: DollarSign,
            color: "text-emerald-500",
            bg: "bg-emerald-50",
            description: "Total do período"
        },
        {
            title: "Ticket Médio",
            value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.ticketMedio || 0),
            icon: TrendingUp,
            color: "text-indigo-500",
            bg: "bg-indigo-50",
            description: "Receita por pedido"
        },
        {
            title: "Mesas Ocupadas",
            value: `${stats?.occupiedTables || 0}/${stats?.totalTables || 0}`,
            icon: Coffee,
            color: "text-purple-500",
            bg: "bg-purple-50",
            description: "Ocupação do salão"
        },
        {
            title: "Tempo Preparo",
            value: `${stats?.avgPrepTime || 0} min`,
            icon: ChefHat,
            color: "text-cyan-500",
            bg: "bg-cyan-50",
            description: "Média pedido → pronto"
        },
        {
            title: "Status WhatsApp",
            value: stats?.whatsappStatus === 'connected' ? 'Ativo' : 'Offline',
            icon: AlertCircle,
            color: stats?.whatsappStatus === 'connected' ? "text-green-500" : "text-red-500",
            bg: stats?.whatsappStatus === 'connected' ? "bg-green-50" : "bg-red-50",
            description: "Instância via QR Code"
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 uppercase text-[10px] tracking-widest px-2 py-0.5">
                            Módulo Restaurante
                        </Badge>
                        <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 uppercase text-[10px] tracking-widest px-2 py-0.5">
                            Real-time Sync
                        </Badge>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight mt-1">Gestão de Restaurante</h1>
                    <p className="text-muted-foreground text-sm">Painel completo de operações, cozinha e delivery.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 bg-background p-1.5 rounded-xl border shadow-sm">
                    <Select value={shift} onValueChange={setShift}>
                        <SelectTrigger className="w-[120px] h-8 text-xs border-none shadow-none focus:ring-0">
                            <SelectValue placeholder="Turno" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos Turnos</SelectItem>
                            <SelectItem value="almoco">Almoço</SelectItem>
                            <SelectItem value="jantar">Jantar</SelectItem>
                            <SelectItem value="madrugada">Madrugada</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="w-[1px] h-4 bg-border mx-1" />
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

            {/* Pipeline and Active Operations */}
            <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-none shadow-sm elevated-card">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold">Fluxo de Pedidos (Funil)</CardTitle>
                            <CardDescription>Acompanhe o percurso do pedido em tempo real</CardDescription>
                        </div>
                        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                            {[
                                { label: 'Novo', color: 'bg-slate-200' },
                                { label: 'Confirmado', color: 'bg-blue-300' },
                                { label: 'Preparo', color: 'bg-orange-400' },
                                { label: 'Pronto', color: 'bg-green-400' },
                                { label: 'Entrega', color: 'bg-cyan-400' },
                                { label: 'Pago', color: 'bg-emerald-500' },
                                { label: 'Cancelado', color: 'bg-red-400' },
                            ].map((step, idx) => (
                                <div key={idx} className="flex flex-col items-center p-3 rounded-xl border bg-background/50 group hover:border-primary/50 transition-colors">
                                    <span className="text-[9px] uppercase font-black text-muted-foreground mb-2 text-center leading-none">{step.label}</span>
                                    <div className={cn("h-1 w-full rounded-full mb-2", step.color)} />
                                    <span className="text-lg font-black italic">0</span>
                                    <span className="text-[8px] opacity-50 font-bold">R$ 0,00</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 grid md:grid-cols-2 gap-4">
                            <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                                    <ChefHat size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Cozinha Digital</p>
                                    <h4 className="text-sm font-bold">3 pedidos aguardando</h4>
                                </div>
                                <Button size="sm" variant="outline" className="ml-auto text-[9px] h-7 uppercase font-black tracking-widest bg-white">Ver KDS</Button>
                            </div>
                            <div className="bg-cyan-50 border border-cyan-100 p-4 rounded-xl flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-cyan-600 shadow-sm">
                                    <Truck size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-600">Entregas Ativas</p>
                                    <h4 className="text-sm font-bold">1 pedido em rota</h4>
                                </div>
                                <Button size="sm" variant="outline" className="ml-auto text-[9px] h-7 uppercase font-black tracking-widest bg-white">Rastrear</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="border-none shadow-sm elevated-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Coffee className="h-5 w-5 text-purple-600" />
                                Mapa de Mesas
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="grid grid-cols-4 gap-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((table) => (
                                    <div
                                        key={table}
                                        className={cn(
                                            "aspect-square rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all border-2",
                                            table === 2 || table === 5 ? "bg-purple-50 border-purple-200 text-purple-700 shadow-inner" : "bg-green-50 border-green-200 text-green-700"
                                        )}
                                    >
                                        <span className="text-[9px] font-black">{table}</span>
                                        {table === 2 || table === 5 ? <Clock size={10} className="mt-1 opacity-50" /> : <UtensilsCrossed size={10} className="mt-1 opacity-50" />}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500"></span> Livre</div>
                                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-500"></span> Ocupada</div>
                                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500"></span> Conta</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-none shadow-xl text-white overflow-hidden relative group">
                        <div className="absolute right-[-20px] top-[-20px] opacity-10 blur-sm group-hover:scale-110 transition-transform">
                            <ChefHat size={120} />
                        </div>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Badge className="bg-blue-500/20 text-blue-400 border-none font-black text-[9px] tracking-widest">NOVA FEATURE</Badge>
                            </div>
                            <h3 className="text-lg font-black leading-tight italic">MODO TV COZINHA</h3>
                            <p className="text-slate-400 text-[10px] mt-1 font-bold">Transforme qualquer tablet ou smart TV em um KDS profissional para sua equipe.</p>
                            <Button className="w-full mt-4 bg-white text-slate-900 hover:bg-slate-100 font-black text-[10px] tracking-widest uppercase">Ativar Painel TV</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
