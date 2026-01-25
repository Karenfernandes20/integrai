
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
    Truck,
    Search,
    MapPin,
    User,
    Clock,
    CheckCircle2,
    Phone,
    ArrowUpRight,
    Navigation,
    ShoppingBag
} from "lucide-react";
import { cn } from "../../lib/utils";

const EntregasPage = () => {
    const mockDeliveries = [
        { id: '103', client: 'Bruno Fernandes', address: 'Av. Paulista, 1000 - Ap 42', driver: 'Carlos Moto', status: 'em_rota', time: '15 min', phone: '(11) 98888-7777', total: 112.00 },
        { id: '105', client: 'Debora Lima', address: 'Rua Augusta, 500', driver: 'Joana Silva', status: 'aguardando', time: '-', phone: '(11) 97777-6666', total: 45.00 },
        { id: '100', client: 'Marcos Vinicius', address: 'Al. Santos, 120', driver: 'Carlos Moto', status: 'entregue', time: '22 min', phone: '(11) 96666-5555', total: 138.50 },
    ];

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Logística e Entregas</h1>
                    <p className="text-muted-foreground">Gerencie seus entregadores e o status do delivery.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="font-bold gap-2">Configurar Taxas</Button>
                    <Button className="font-black gap-2 shadow-lg shadow-cyan-500/20 bg-cyan-600 hover:bg-cyan-700">
                        <User size={18} />
                        Gerenciar Entregadores
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Lateral Stats */}
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-none shadow-sm elevated-card bg-cyan-600 text-white overflow-hidden relative">
                        <div className="absolute right-[-20px] top-[-20px] opacity-10">
                            <Truck size={120} />
                        </div>
                        <CardContent className="p-6">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Entregadores Ativos</span>
                                <h2 className="text-5xl font-black italic mt-1">04</h2>
                                <p className="text-[10px] font-bold mt-4 bg-white/20 w-fit px-2 py-1 rounded inline-flex items-center gap-1.5 uppercase">
                                    <span className="h-1.5 w-1.5 rounded-full bg-green-400"></span> 2 Entregadores em rota
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm elevated-card">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Resumo Logistics</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {[
                                    { label: 'Tempo Médio Entrega', value: '28 min', icon: Clock, color: 'text-blue-500' },
                                    { label: 'Pedidos Delivery Hoje', value: '14', icon: ShoppingBag, color: 'text-purple-500' },
                                    { label: 'Taxa Delivery Total', value: 'R$ 154,00', icon: Navigation, color: 'text-cyan-500' },
                                ].map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 px-6 hover:bg-muted/5 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center", item.color)}>
                                                <item.icon size={16} />
                                            </div>
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none">{item.label}</span>
                                        </div>
                                        <span className="text-lg font-black">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Delivery List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <input placeholder="Buscar entrega por cliente ou ID..." className="w-full pl-10 h-11 rounded-xl border bg-background text-sm outline-none focus:ring-2 ring-cyan-500/20 transition-all font-medium" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {mockDeliveries.map(delivery => (
                            <Card key={delivery.id} className={cn(
                                "border-none shadow-sm elevated-card hover:shadow-md transition-all group overflow-hidden border-l-4",
                                delivery.status === 'em_rota' ? 'border-l-cyan-500' : (delivery.status === 'aguardando' ? 'border-l-orange-500' : 'border-l-green-500')
                            )}>
                                <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="border-none bg-slate-100 text-slate-500 text-[9px] font-black uppercase h-5 px-2">#{delivery.id}</Badge>
                                            <Badge className={cn(
                                                "border-none text-[9px] font-black uppercase tracking-widest px-2 h-5",
                                                delivery.status === 'em_rota' ? 'bg-cyan-100 text-cyan-600' : (delivery.status === 'aguardando' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600')
                                            )}>
                                                {delivery.status.replace('_', ' ')}
                                            </Badge>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black uppercase">{delivery.client}</h3>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mt-0.5">
                                                <MapPin size={14} className="text-cyan-500" />
                                                {delivery.address}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap md:flex-nowrap items-center gap-8">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Entregador</span>
                                            <div className="flex items-center gap-2 text-sm font-black italic">
                                                <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                    <User size={12} />
                                                </div>
                                                {delivery.driver}
                                            </div>
                                        </div>
                                        <div className="flex flex-col text-right min-w-[80px]">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Total</span>
                                            <span className="text-lg font-black text-emerald-600 leading-none">R$ {delivery.total.toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-xl">
                                                <Phone size={18} />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-xl">
                                                <ArrowUpRight size={18} />
                                            </Button>
                                            <Button className="h-10 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest px-4 rounded-xl shadow-lg">
                                                Ações
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EntregasPage;
