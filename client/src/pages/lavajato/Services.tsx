
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Plus, Search, Wrench, Clock, DollarSign, Edit3, Trash2 } from "lucide-react";

const ServicesPage = () => {
    const services = [
        { id: 1, name: 'Lavagem Simples', description: 'Ducha + Aspirador + Pretinho', price: 50.00, time: 40, category: 'Lavagem' },
        { id: 2, name: 'Lavagem Completa', description: 'Lavagem detalhada + Cera líquida + Painel', price: 80.00, time: 70, category: 'Lavagem' },
        { id: 3, name: 'Polimento Técnico', description: 'Correção de pintura 3 etapas + Proteção', price: 450.00, time: 300, category: 'Estética' },
        { id: 4, name: 'Higienização Interna', description: 'Limpeza profunda de bancos, teto e carpetes', price: 250.00, time: 180, category: 'Estética' },
    ];

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Serviços e Preços</h1>
                    <p className="text-muted-foreground">Configure seu catálogo de serviços e tempos de execução.</p>
                </div>
                <Button className="font-bold flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Novo Serviço
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map(service => (
                    <Card key={service.id} className="border-none shadow-sm elevated-card group hover:scale-[1.02] transition-all">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <Wrench size={20} />
                                </div>
                                <Badge className="bg-slate-100 text-slate-600 border-none text-[9px] uppercase tracking-widest px-2">{service.category}</Badge>
                            </div>
                            <CardTitle className="text-xl font-bold mt-4">{service.name}</CardTitle>
                            <CardDescription className="text-xs line-clamp-2 min-h-[32px]">{service.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between py-3 border-y border-dashed">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tempo Médio</span>
                                    <div className="flex items-center gap-1.5 text-sm font-bold">
                                        <Clock size={14} className="text-blue-500" />
                                        {service.time} min
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Preço</span>
                                    <div className="flex items-center gap-1.5 text-lg font-black text-emerald-600">
                                        R$ {service.price.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <Button variant="outline" size="sm" className="flex-1 font-bold text-[10px] uppercase tracking-widest rounded-lg h-9">
                                    <Edit3 size={12} className="mr-2" /> Editar
                                </Button>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg">
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default ServicesPage;
