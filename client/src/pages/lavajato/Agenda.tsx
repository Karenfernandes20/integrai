
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, Search, Filter, Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "../../lib/utils";

const AgendaPage = () => {
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'list'>('day');

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Agenda Inteligente</h1>
                    <p className="text-muted-foreground">Gerencie os horários de lavagem e serviços.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex border rounded-lg p-1 bg-background shadow-sm">
                        {(['day', 'week', 'month', 'list'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-all uppercase tracking-wider",
                                    viewMode === mode ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground"
                                )}
                            >
                                {mode === 'day' ? 'Dia' : mode === 'week' ? 'Semana' : mode === 'month' ? 'Mês' : 'Lista'}
                            </button>
                        ))}
                    </div>
                    <Button className="font-bold flex items-center gap-2 shadow-sm">
                        <Plus className="h-4 w-4" />
                        Novo Agendamento
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-4 gap-6">
                {/* Lateral Filters/Stats */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-none shadow-sm elevated-card">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Filtros Rápidos</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input placeholder="Buscar placa ou cliente..." className="w-full pl-9 h-10 rounded-lg border bg-muted/30 focus:bg-background transition-all text-sm outline-none focus:ring-2 ring-primary/20" />
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-bold text-muted-foreground">Box de Lavagem</p>
                                {[1, 2, 3].map(box => (
                                    <div key={box} className="flex items-center gap-2">
                                        <input type="checkbox" id={`box-${box}`} className="rounded border-gray-300 text-primary focus:ring-primary" defaultChecked />
                                        <label htmlFor={`box-${box}`} className="text-sm">Box 0{box}</label>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-bold text-muted-foreground">Situação</p>
                                {['Agendado', 'Confirmado', 'Em Lavagem', 'Finalizado'].map(status => (
                                    <div key={status} className="flex items-center gap-2">
                                        <input type="checkbox" id={`status-${status}`} className="rounded border-gray-300 text-primary focus:ring-primary" defaultChecked />
                                        <label htmlFor={`status-${status}`} className="text-sm">{status}</label>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-primary text-primary-foreground border-none shadow-lg shadow-primary/20 overflow-hidden relative">
                        <div className="absolute right-[-20px] top-[-20px] opacity-10">
                            <CalendarIcon size={120} />
                        </div>
                        <CardContent className="p-6">
                            <h3 className="text-lg font-bold mb-1">Capacidade do Dia</h3>
                            <p className="text-primary-foreground/80 text-xs mb-4">Você ainda tem 4 horários livres hoje.</p>
                            <div className="w-full bg-primary-foreground/20 rounded-full h-2 mb-4">
                                <div className="bg-white h-full rounded-full w-[75%]" />
                            </div>
                            <Button variant="secondary" size="sm" className="w-full font-bold uppercase text-[10px] tracking-widest">Ver Horários Livres</Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Calendar Area */}
                <div className="lg:col-span-3">
                    <Card className="border-none shadow-sm elevated-card min-h-[600px]">
                        <CardHeader className="border-b bg-muted/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <h2 className="text-xl font-bold">Hoje, 24 de Janeiro</h2>
                                    <div className="flex items-center gap-1">
                                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full"><ChevronLeft className="h-4 w-4" /></Button>
                                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full"><ChevronRight className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none px-3">22 Agendamentos</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {/* Column Headers (Boxes) */}
                            <div className="grid grid-cols-[100px_1fr_1fr_1fr] border-b bg-muted/5 font-bold text-[10px] uppercase tracking-widest text-muted-foreground text-center">
                                <div className="p-3 border-r">Horário</div>
                                <div className="p-3 border-r">Box 01</div>
                                <div className="p-3 border-r">Box 02</div>
                                <div className="p-3">Box 03</div>
                            </div>

                            {/* Time Slots */}
                            <div className="relative">
                                {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(hour => (
                                    <div key={hour} className="grid grid-cols-[100px_1fr_1fr_1fr] border-b group h-24">
                                        <div className="p-3 border-r flex flex-col items-center justify-center text-muted-foreground font-mono text-xs bg-muted/5">
                                            <span className="font-bold text-foreground">{hour}:00</span>
                                            <span className="opacity-50">30 min</span>
                                        </div>
                                        <div className="border-r relative hover:bg-muted/30 transition-colors p-1">
                                            {hour === 9 && (
                                                <div className="absolute inset-x-1 top-1 bottom-1 bg-white border border-blue-200 rounded-lg shadow-sm p-3 z-10 hover:shadow-md transition-all cursor-pointer border-l-4 border-l-blue-500">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Toyota Hilux - ABC-1234</span>
                                                        <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[8px] h-4">Agendado</Badge>
                                                    </div>
                                                    <p className="text-[11px] font-bold mt-1">Lavagem Completa + Cera</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> 09:00 - 10:30
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="border-r relative hover:bg-muted/30 transition-colors">
                                            {hour === 14 && (
                                                <div className="absolute inset-x-1 top-1 bottom-1 bg-white border border-orange-200 rounded-lg shadow-sm p-3 z-10 hover:shadow-md transition-all cursor-pointer border-l-4 border-l-orange-500">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[10px] font-bold text-orange-600 uppercase tracking-tighter">Honda Civic - XYZ-8888</span>
                                                        <Badge className="bg-orange-50 text-orange-600 border-orange-100 text-[8px] h-4">Em Lavagem</Badge>
                                                    </div>
                                                    <p className="text-[11px] font-bold mt-1">Polimento Técnico</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> 14:00 - 17:00
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="relative hover:bg-muted/30 transition-colors">
                                            {hour === 10 && (
                                                <div className="absolute inset-x-1 top-1 bottom-1 bg-white border border-green-200 rounded-lg shadow-sm p-3 z-10 hover:shadow-md transition-all cursor-pointer border-l-4 border-l-green-500 opacity-60">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-tighter">BMW X5 - MOK-9999</span>
                                                        <Badge className="bg-green-50 text-green-600 border-green-100 text-[8px] h-4">Finalizado</Badge>
                                                    </div>
                                                    <p className="text-[11px] font-bold mt-1 line-through">Lavagem Simples</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default AgendaPage;
