
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
    ChefHat,
    Timer,
    CheckCircle2,
    AlertCircle,
    Maximize,
    Bell,
    UtensilsCrossed
} from "lucide-react";
import { cn } from "../../lib/utils";

const CozinhaPage = () => {
    // KDS Mode: Orders that need preparation
    const [kdsOrders, setKdsOrders] = useState([
        { id: '101', table: '05', items: [{ name: 'Burger House', qty: 2 }, { name: 'Batata Frita', qty: 1 }], time: '12:05', elapsed: '08', status: 'preparo', priority: 'normal' },
        { id: '102', table: '08', items: [{ name: 'Salmão Grelhado', qty: 1 }], time: '12:10', elapsed: '03', status: 'confirmado', priority: 'high' },
        { id: '104', table: '12', items: [{ name: 'Frango Empanado', qty: 1 }, { name: 'Arroz Branco', qty: 1 }], time: '12:12', elapsed: '01', status: 'confirmado', priority: 'normal' },
    ]);

    return (
        <div className="h-screen bg-slate-950 text-slate-50 flex flex-col animate-in fade-in duration-500 overflow-hidden">
            {/* Dark Mode Header for TV Mode */}
            <div className="h-20 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-8">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <ChefHat className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-widest italic">Painel KDS</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cozinha Digital Integrai</p>
                        </div>
                    </div>
                    <div className="h-10 w-[1px] bg-slate-800" />
                    <div className="flex gap-4">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-500">Em Preparo</span>
                            <span className="text-xl font-black">03</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-green-500">Prontos</span>
                            <span className="text-xl font-black">12</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right mr-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Tempo Médio</p>
                        <p className="text-lg font-black text-orange-400">14 min</p>
                    </div>
                    <Button variant="outline" className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 group h-12 w-12 rounded-full p-0">
                        <Bell className="group-hover:animate-bounce" size={20} />
                    </Button>
                    <Button variant="outline" className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 h-10 gap-2 font-black text-[10px] uppercase px-4 rounded-full">
                        <Maximize size={16} /> Fullscreen
                    </Button>
                </div>
            </div>

            {/* KDS GRID */}
            <div className="flex-1 p-6 overflow-x-auto">
                <div className="flex gap-6 h-full min-w-max">
                    {kdsOrders.map((order, idx) => (
                        <div key={order.id} className="w-80 h-full flex flex-col gap-4">
                            <Card className={cn(
                                "border-none flex flex-col h-full bg-slate-900 shadow-2xl relative overflow-hidden",
                                order.elapsed > '10' ? "ring-2 ring-red-500/50" : "ring-1 ring-slate-800"
                            )}>
                                {/* Order Header */}
                                <div className={cn(
                                    "p-4 flex items-center justify-between",
                                    order.elapsed > '10' ? "bg-red-500/10" : "bg-slate-800/30"
                                )}>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-slate-700 text-slate-300 border-none rounded font-black text-[9px] uppercase">#{order.id}</Badge>
                                            {order.priority === 'high' && <Badge className="bg-red-600 text-white border-none rounded font-black text-[9px] uppercase animate-pulse">URGENTE</Badge>}
                                        </div>
                                        <h2 className="text-3xl font-black italic tracking-tighter mt-1">MESA {order.table}</h2>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-2 text-slate-400 mb-1">
                                            <Timer size={14} />
                                            <span className="text-[10px] font-bold uppercase">{order.time}</span>
                                        </div>
                                        <span className={cn(
                                            "text-2xl font-black",
                                            order.elapsed > '10' ? "text-red-500" : "text-orange-400"
                                        )}>{order.elapsed}'</span>
                                    </div>
                                </div>

                                {/* Order Items List */}
                                <CardContent className="flex-1 p-0 overflow-y-auto">
                                    <div className="divide-y divide-slate-800">
                                        {order.items.map((item, i) => (
                                            <div key={i} className="p-4 flex items-start gap-3 hover:bg-slate-800/20 transition-colors">
                                                <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center font-black text-lg shrink-0">
                                                    {item.qty}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-lg leading-tight uppercase">{item.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Sem cebola, bem passado</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>

                                {/* Footer Action */}
                                <div className="p-4 bg-slate-900/50 border-t border-slate-800">
                                    <Button className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-green-500/20 gap-3 group">
                                        <CheckCircle2 size={24} className="group-hover:scale-110 transition-transform" />
                                        Pedido Pronto
                                    </Button>
                                </div>

                                {/* Progress Bar on top of card */}
                                <div className="absolute bottom-0 left-0 w-full h-1.5 bg-slate-800">
                                    <div className={cn(
                                        "h-full transition-all duration-1000",
                                        parseInt(order.elapsed) > 10 ? "bg-red-500" : "bg-orange-500"
                                    )} style={{ width: `${Math.min(parseInt(order.elapsed) * 10, 100)}%` }} />
                                </div>
                            </Card>
                        </div>
                    ))}

                    <div className="w-80 h-full border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center opacity-30 gap-4">
                        <UtensilsCrossed size={48} />
                        <span className="font-black uppercase tracking-widest text-xs">Aguardando Pedidos</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CozinhaPage;
