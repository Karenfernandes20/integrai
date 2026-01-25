
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Plus, Search, Car, User, Settings2, History, ChevronRight, FileText } from "lucide-react";
import { cn } from "../../lib/utils";

const VehiclesPage = () => {
    const [searchTerm, setSearchTerm] = useState('');

    const mockVehicles = [
        { id: 1, plate: 'ABC-1234', model: 'Toyota Hilux', brand: 'Toyota', color: 'Prata', type: 'Caminhonete', owner: 'João Silva', lastVisit: '10 Jan 2024', totalVisits: 8, totalSpent: 1250.00 },
        { id: 2, plate: 'XYZ-8888', model: 'Honda Civic', brand: 'Honda', color: 'Preto', type: 'Sedan', owner: 'Maria Oliveira', lastVisit: '22 Dez 2023', totalVisits: 12, totalSpent: 2400.00 },
        { id: 3, plate: 'MOK-9999', model: 'BMW X5', brand: 'BMW', color: 'Branco', type: 'SUV', owner: 'Ricardo Souza', lastVisit: '05 Jan 2024', totalVisits: 3, totalSpent: 900.00 },
    ];

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Veículos</h1>
                    <p className="text-muted-foreground">Cadastro e histórico detalhado da frota dos clientes.</p>
                </div>
                <Button className="font-bold flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Cadastrar Veículo
                </Button>
            </div>

            <Card className="border-none shadow-sm elevated-card">
                <CardHeader className="pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <input
                                placeholder="Buscar por placa, modelo ou proprietário..."
                                className="w-full pl-10 h-10 rounded-xl border bg-muted/20 focus:bg-background transition-all text-sm outline-none focus:ring-2 ring-primary/20"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-10 px-4 rounded-xl gap-2 font-semibold">
                                <Settings2 className="h-4 w-4" />
                                Filtros Avançados
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b bg-muted/5 text-[10px] uppercase font-bold tracking-widest text-muted-foreground text-left">
                                    <th className="px-6 py-4">Veículo / Placa</th>
                                    <th className="px-6 py-4">Proprietário</th>
                                    <th className="px-6 py-4">Tipo</th>
                                    <th className="px-6 py-4">Última Visita</th>
                                    <th className="px-6 py-4">Frequência</th>
                                    <th className="px-6 py-4">Total Gasto</th>
                                    <th className="px-6 py-4 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {mockVehicles.map((v) => (
                                    <tr key={v.id} className="group hover:bg-muted/10 transition-colors cursor-pointer">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                    <Car size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">{v.model}</p>
                                                    <Badge variant="outline" className="bg-white border-primary/20 text-primary font-mono text-[10px] h-5">
                                                        {v.plate}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                    <User size={14} />
                                                </div>
                                                <span className="text-sm font-medium">{v.owner}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge className="bg-slate-100 text-slate-600 border-none font-medium h-6">{v.type}</Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-muted-foreground">{v.lastVisit}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-bold">{v.totalVisits} visitas</span>
                                                <div className="w-24 bg-muted h-1 rounded-full overflow-hidden">
                                                    <div className="bg-primary h-full" style={{ width: `${Math.min(v.totalVisits * 10, 100)}%` }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold text-emerald-600">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.totalSpent)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" title="Histórico">
                                                    <History className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100" title="Editar">
                                                    <Settings2 className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100" title="Ver OSs">
                                                    <FileText className="h-4 w-4" />
                                                </Button>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default VehiclesPage;
