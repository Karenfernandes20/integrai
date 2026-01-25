
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
    Plus,
    Search,
    ClipboardList,
    Clock,
    CheckCircle2,
    ArrowRight,
    Printer,
    MessageSquare,
    DollarSign,
    Car,
    User
} from "lucide-react";
import { cn } from "../../lib/utils";

const ServiceOrdersPage = () => {
    const [view, setView] = useState<'kanban' | 'list'>('kanban');

    const orders = [
        { id: 'OS-1001', plate: 'ABC-1234', model: 'Toyota Hilux', client: 'João Silva', status: 'em_execucao', services: 'Lavagem Completa + Cera', value: 150.00, timeStarted: '09:30', progress: 65, staff: 'Eduardo' },
        { id: 'OS-1002', plate: 'XYZ-8888', model: 'Honda Civic', client: 'Maria Oliveira', status: 'aberta', services: 'Polimento de Farol', value: 80.00, timeStarted: '10:15', progress: 0, staff: 'Marcos' },
        { id: 'OS-1003', plate: 'MOK-9999', model: 'BMW X5', brand: 'BMW', status: 'finalizada', services: 'Duchinha Especial', value: 50.00, timeStarted: '08:45', progress: 100, staff: 'Eduardo' },
    ];

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'aberta': return { label: 'Aguardando', color: 'bg-slate-100 text-slate-700', border: 'border-l-slate-400' };
            case 'em_execucao': return { label: 'Em Execução', color: 'bg-blue-50 text-blue-700', border: 'border-l-blue-500' };
            case 'finalizada': return { label: 'Pronto / Finalizada', color: 'bg-green-50 text-green-700', border: 'border-l-green-500' };
            case 'paga': return { label: 'Pago', color: 'bg-emerald-50 text-emerald-700', border: 'border-l-emerald-500' };
            default: return { label: status, color: 'bg-gray-100', border: 'border-l-gray-300' };
        }
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Ordens de Serviço</h1>
                    <p className="text-muted-foreground">Acompanhamento em tempo real da linha de produção.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setView('list')} className={cn("rounded-lg font-bold text-xs h-9", view === 'list' && "bg-muted shadow-inner")}>Lista</Button>
                    <Button variant="outline" onClick={() => setView('kanban')} className={cn("rounded-lg font-bold text-xs h-9", view === 'kanban' && "bg-muted shadow-inner")}>Painel TV</Button>
                    <Button className="font-bold flex items-center gap-2 h-9">
                        <Plus className="h-4 w-4" />
                        Nova OS
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-4">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input placeholder="Buscar por placa, cliente ou OS..." className="w-full pl-9 h-10 rounded-xl border bg-background text-sm outline-none focus:ring-2 ring-primary/20 transition-all" />
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-8 px-3 rounded-full bg-blue-50 text-blue-600 border-blue-100 uppercase tracking-widest text-[9px] font-bold">2 Em Execução</Badge>
                    <Badge variant="outline" className="h-8 px-3 rounded-full bg-green-50 text-green-600 border-green-100 uppercase tracking-widest text-[9px] font-bold">1 Finalizado</Badge>
                </div>
            </div>

            {view === 'kanban' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Column: A fazer */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-xs uppercase font-bold tracking-[0.2em] text-muted-foreground">A Iniciar (1)</h3>
                        </div>
                        {orders.filter(o => o.status === 'aberta').map(order => (
                            <OrderCard key={order.id} order={order} statusInfo={getStatusInfo(order.status)} />
                        ))}
                    </div>

                    {/* Column: Em execução */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-xs uppercase font-bold tracking-[0.2em] text-blue-500">Em Lavagem (1)</h3>
                        </div>
                        {orders.filter(o => o.status === 'em_execucao').map(order => (
                            <OrderCard key={order.id} order={order} statusInfo={getStatusInfo(order.status)} />
                        ))}
                    </div>

                    {/* Column: Finalizado */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-xs uppercase font-bold tracking-[0.2em] text-green-500">Pronto (1)</h3>
                        </div>
                        {orders.filter(o => o.status === 'finalizada').map(order => (
                            <OrderCard key={order.id} order={order} statusInfo={getStatusInfo(order.status)} />
                        ))}
                    </div>
                </div>
            ) : (
                <Card className="border-none shadow-sm elevated-card">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto text-sm">
                            <table className="w-full text-left">
                                <thead className="bg-muted/5 border-b uppercase tracking-widest text-[10px] font-bold text-muted-foreground">
                                    <tr>
                                        <th className="px-6 py-4">OS ID</th>
                                        <th className="px-6 py-4">Veículo</th>
                                        <th className="px-6 py-4">Cliente</th>
                                        <th className="px-6 py-4">Serviço Principal</th>
                                        <th className="px-6 py-4">Início</th>
                                        <th className="px-6 py-4 text-right">Valor</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {orders.map(order => (
                                        <tr key={order.id} className="hover:bg-muted/5">
                                            <td className="px-6 py-4 font-bold text-xs">{order.id}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="font-mono bg-white text-[10px]">{order.plate}</Badge>
                                                    <span className="font-medium">{order.model}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">{order.client}</td>
                                            <td className="px-6 py-4">{order.services}</td>
                                            <td className="px-6 py-4 text-muted-foreground">{order.timeStarted}</td>
                                            <td className="px-6 py-4 text-right font-bold text-emerald-600">R$ {order.value.toFixed(2)}</td>
                                            <td className="px-6 py-4">
                                                <Badge className={cn("border-none text-[9px] uppercase tracking-tighter h-6 px-3", getStatusInfo(order.status).color)}>
                                                    {getStatusInfo(order.status).label}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-50" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

const OrderCard = ({ order, statusInfo }: { order: any, statusInfo: any }) => (
    <Card className={cn("border-none shadow-sm elevated-card bg-card hover:shadow-md transition-all cursor-pointer border-l-4", statusInfo.border)}>
        <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{order.id}</span>
                    <h4 className="text-xl font-black font-mono tracking-tighter leading-none">{order.plate}</h4>
                    <p className="text-xs font-semibold text-muted-foreground mt-1">{order.model}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <Badge className={cn("border-none text-[8px] uppercase tracking-widest px-2 py-0.5", statusInfo.color)}>
                        {statusInfo.label}
                    </Badge>
                    <span className="text-xs font-bold text-emerald-600">R$ {order.value.toFixed(2)}</span>
                </div>
            </div>

            <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Serviço:</p>
                <p className="text-xs font-medium bg-muted/30 p-2 rounded border border-dashed">{order.services}</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-dashed">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold">
                        {order.staff.charAt(0)}
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">{order.staff}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-muted text-muted-foreground">
                        <Printer size={12} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-blue-50 text-blue-500">
                        <MessageSquare size={12} />
                    </Button>
                </div>
            </div>

            {order.status === 'em_execucao' && (
                <div className="pt-2">
                    <div className="flex justify-between text-[10px] font-bold mb-1 uppercase tracking-widest">
                        <span>Progresso</span>
                        <span className="text-blue-500">{order.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${order.progress}%` }} />
                    </div>
                </div>
            )}
        </CardContent>
    </Card>
);

export default ServiceOrdersPage;
