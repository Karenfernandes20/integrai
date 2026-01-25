
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
    Plus,
    Search,
    ShoppingBag,
    Clock,
    MessageCircle,
    ArrowRight,
    Coffee,
    Truck,
    MoreVertical,
    CheckCircle2
} from "lucide-react";
import { cn } from "../../lib/utils";

const PedidosPage = () => {
    const [view, setView] = useState<'kanban' | 'list'>('kanban');

    const mockOrders = [
        { id: '101', table: '05', client: 'Roberto Gusmão', items: '2x Burger House, 1x Coca-Cola', total: 85.00, status: 'novo', channel: 'salao', time: '5 min' },
        { id: '102', table: '08', client: 'Alice Duarte', items: '1x Salmão Grelhado, 1x Suco Natural', total: 64.00, status: 'preparo', channel: 'salao', time: '12 min' },
        { id: '103', table: 'Delivery', client: 'Bruno Fernandes', items: '3x Pizza Calabresa, 1x Guaraná 2L', total: 112.00, status: 'entrega', channel: 'delivery', time: '25 min' },
        { id: '104', table: 'QR-12', client: 'Mesa 12 (Via QR)', items: '4x Chopp, 1x Batata Frita', total: 95.00, status: 'novo', channel: 'qrcode', time: '2 min' },
    ];

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'novo': return { label: 'Novo', color: 'bg-blue-50 text-blue-600 border-blue-200', dot: 'bg-blue-500' };
            case 'preparo': return { label: 'Cozinhando', color: 'bg-orange-50 text-orange-600 border-orange-200', dot: 'bg-orange-500' };
            case 'pronto': return { label: 'Pronto', color: 'bg-green-50 text-green-600 border-green-200', dot: 'bg-green-500' };
            case 'entrega': return { label: 'Saiu para Entrega', color: 'bg-cyan-50 text-cyan-600 border-cyan-200', dot: 'bg-cyan-500' };
            default: return { label: status, color: 'bg-slate-50', dot: 'bg-slate-400' };
        }
    };

    const getChannelIcon = (channel: string) => {
        switch (channel) {
            case 'salao': return <Coffee size={14} />;
            case 'delivery': return <Truck size={14} />;
            case 'qrcode': return <ShoppingBag size={14} />;
            default: return <MessageCircle size={14} />;
        }
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestão de Pedidos</h1>
                    <p className="text-muted-foreground">Monitore o fluxo de vendas e produção em tempo real.</p>
                </div>
                <div className="flex gap-2">
                    <div className="flex border rounded-lg p-1 bg-background shadow-sm h-10">
                        <button onClick={() => setView('kanban')} className={cn("px-4 text-xs font-bold rounded-md transition-all", view === 'kanban' ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground")}>Fluxo</button>
                        <button onClick={() => setView('list')} className={cn("px-4 text-xs font-bold rounded-md transition-all", view === 'list' ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground")}>Lista</button>
                    </div>
                    <Button className="font-black h-10 px-6 gap-2 shadow-lg shadow-primary/20">
                        <Plus size={18} />
                        Novo Pedido
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                        placeholder="Buscar por ID, mesa ou cliente..."
                        className="w-full pl-10 h-11 rounded-xl border bg-background text-sm outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                    />
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-black uppercase">
                        2 Ativos
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100 text-[10px] font-black uppercase">
                        1 No Fogo
                    </div>
                </div>
            </div>

            {view === 'kanban' ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {['novo', 'preparo', 'pronto', 'entrega'].map(column => (
                        <div key={column} className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                                    {getStatusInfo(column).label} ({mockOrders.filter(o => o.status === column).length})
                                </h3>
                                <div className={cn("h-2 w-2 rounded-full", getStatusInfo(column).dot)} />
                            </div>
                            <div className="space-y-3">
                                {mockOrders.filter(o => o.status === column).map(order => (
                                    <OrderCard key={order.id} order={order} statusInfo={getStatusInfo(order.status)} channelIcon={getChannelIcon(order.channel)} />
                                ))}
                                {mockOrders.filter(o => o.status === column).length === 0 && (
                                    <div className="h-24 border-2 border-dashed rounded-xl flex items-center justify-center opacity-30">
                                        <span className="text-[10px] font-bold uppercase">Vazio</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <Card className="border-none shadow-sm elevated-card">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-muted/5 border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    <tr>
                                        <th className="px-6 py-4">ID</th>
                                        <th className="px-6 py-4">Origem</th>
                                        <th className="px-6 py-4">Mesa/Local</th>
                                        <th className="px-6 py-4">Cliente</th>
                                        <th className="px-6 py-4">Itens</th>
                                        <th className="px-6 py-4">Total</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {mockOrders.map(order => (
                                        <tr key={order.id} className="hover:bg-muted/5 transition-colors group">
                                            <td className="px-6 py-4 font-black">#{order.id}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant="outline" className="flex items-center gap-1.5 w-fit border-none bg-slate-100 text-slate-700 font-bold text-[9px] uppercase h-6 px-3">
                                                    {getChannelIcon(order.channel)}
                                                    {order.channel}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 font-bold">{order.table}</td>
                                            <td className="px-6 py-4">{order.client}</td>
                                            <td className="px-6 py-4 italic text-muted-foreground">{order.items}</td>
                                            <td className="px-6 py-4 font-black text-emerald-600">R$ {order.total.toFixed(2)}</td>
                                            <td className="px-6 py-4">
                                                <Badge className={cn("border-none text-[9px] font-black uppercase h-6 px-3", getStatusInfo(order.status).color)}>
                                                    {getStatusInfo(order.status).label}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-50"><ArrowRight size={14} /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><MoreVertical size={14} /></Button>
                                                </div>
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

const OrderCard = ({ order, statusInfo, channelIcon }: any) => (
    <Card className="border-none shadow-sm elevated-card hover:shadow-md transition-all cursor-pointer group">
        <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                        #{order.id} • {channelIcon}
                    </div>
                    <h4 className="text-sm font-black flex items-center gap-2">
                        {order.table}
                        <span className="text-muted-foreground font-medium text-xs">— {order.client}</span>
                    </h4>
                </div>
                <div className="text-right">
                    <span className="text-xs font-black text-emerald-600 block">R$ {order.total.toFixed(2)}</span>
                    <span className="text-[10px] text-muted-foreground font-bold flex items-center gap-1 justify-end mt-1">
                        <Clock size={10} className="text-orange-500" /> {order.time}
                    </span>
                </div>
            </div>

            <div className="bg-muted/30 p-2.5 rounded-lg border border-dashed text-[11px] leading-tight text-slate-600 italic">
                {order.items}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-dashed">
                <Button size="sm" className="flex-1 h-8 text-[9px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 shadow-blue-500/20">
                    Avançar
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted text-slate-400">
                    <MessageCircle size={14} />
                </Button>
            </div>
        </CardContent>
    </Card>
);

export default PedidosPage;
