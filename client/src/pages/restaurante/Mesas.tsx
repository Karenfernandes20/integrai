
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
    Plus,
    Search,
    Coffee,
    Users,
    QrCode,
    Clock,
    DollarSign,
    LogOut,
    MoveHorizontal
} from "lucide-react";
import { cn } from "../../lib/utils";

const MesasPage = () => {
    const [searchTerm, setSearchTerm] = useState('');

    const tables = [
        { id: 1, number: '01', status: 'livre', capacity: 4, orders: 0, total: 0, time: '-' },
        { id: 2, number: '02', status: 'ocupada', capacity: 2, orders: 3, total: 145.00, time: '45 min' },
        { id: 3, number: '03', status: 'conta', capacity: 6, orders: 5, total: 382.50, time: '1h 20m' },
        { id: 4, number: '04', status: 'reservada', capacity: 4, orders: 0, total: 0, time: '-' },
        { id: 5, number: '05', status: 'ocupada', capacity: 4, orders: 2, total: 88.00, time: '30 min' },
        { id: 6, number: '06', status: 'livre', capacity: 2, orders: 0, total: 0, time: '-' },
        { id: 7, number: '07', status: 'livre', capacity: 4, orders: 0, total: 0, time: '-' },
        { id: 8, number: '08', status: 'ocupada', capacity: 2, orders: 1, total: 42.00, time: '15 min' },
    ];

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'livre': return "bg-green-50 text-green-600 border-green-200";
            case 'ocupada': return "bg-purple-50 text-purple-600 border-purple-200";
            case 'conta': return "bg-orange-50 text-orange-600 border-orange-200";
            case 'reservada': return "bg-blue-50 text-blue-600 border-blue-200";
            default: return "bg-slate-50 text-slate-500 border-slate-200";
        }
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Mapa de Mesas</h1>
                    <p className="text-muted-foreground">Gerencie a ocupação do salão e contas em tempo real.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="font-bold gap-2">
                        <QrCode size={18} />
                        Imprimir QRs
                    </Button>
                    <Button className="font-black gap-2 shadow-lg shadow-primary/20">
                        <Plus size={18} />
                        Nova Mesa
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-4">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        placeholder="Filtrar mesas..."
                        className="w-full pl-9 h-10 rounded-xl border bg-background text-sm outline-none focus:ring-2 ring-primary/20 transition-all"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500"></span> <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Livre (3)</span></div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-500"></span> <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ocupada (3)</span></div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500"></span> <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Conta (1)</span></div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500"></span> <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reserva (1)</span></div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {tables.map(table => (
                    <Card key={table.id} className={cn("border-2 shadow-sm elevated-card hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer group", getStatusStyle(table.status))}>
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">MESA</span>
                                    <h2 className="text-4xl font-black italic tracking-tighter">{table.number}</h2>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <Badge className={cn("border-none text-[8px] uppercase tracking-widest px-2 h-5", table.status === 'livre' ? 'bg-green-500 text-white' : (table.status === 'ocupada' ? 'bg-purple-500 text-white' : 'bg-orange-500 text-white'))}>
                                        {table.status}
                                    </Badge>
                                    <div className="flex items-center gap-1 text-[10px] font-bold opacity-70">
                                        <Users size={12} /> {table.capacity} lugares
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 space-y-3">
                                {table.status !== 'livre' && table.status !== 'reservada' ? (
                                    <>
                                        <div className="flex justify-between items-center py-2 border-y border-dashed border-current/20">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Valor Atual</span>
                                                <span className="text-xl font-black">R$ {table.total.toFixed(2)}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Sentado há</span>
                                                <span className="text-xs font-bold block">{table.time}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-4">
                                            <Button size="sm" variant="outline" className="h-8 text-[9px] font-black uppercase tracking-widest bg-white border-current/20 hover:bg-current/10">
                                                <MoveHorizontal size={12} className="mr-1.5" /> Transferir
                                            </Button>
                                            <Button size="sm" className={cn("h-8 text-[9px] font-black uppercase tracking-widest border-none shadow-lg", table.status === 'conta' ? 'bg-orange-600 text-white shadow-orange-500/30' : 'bg-purple-600 text-white shadow-purple-500/30')}>
                                                <LogOut size={12} className="mr-1.5" /> {table.status === 'conta' ? 'Fechar' : 'Pedir Conta'}
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-[74px] flex items-center justify-center">
                                        {table.status === 'livre' ? (
                                            <Button className="bg-green-600 hover:bg-green-700 text-white font-black text-[10px] uppercase tracking-widest h-10 w-full rounded-xl shadow-lg shadow-green-500/20">
                                                Abrir Mesa
                                            </Button>
                                        ) : (
                                            <div className="text-center">
                                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Reservado para</p>
                                                <p className="text-sm font-bold">Família Souza - 20:30</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default MesasPage;
