
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Calendar as CalendarIcon,
    Clock,
    Plus,
    ChevronLeft,
    ChevronRight,
    Search,
    Filter,
    MoreHorizontal,
    Phone,
    MessageCircle,
    DollarSign,
    RotateCw,
    XCircle,
    CheckCircle2,
    CalendarDays,
    LayoutList,
    Users,
    Tag,
    MapPin,
    Repeat
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
type ViewMode = 'day' | 'week' | 'month' | 'list';
type EventStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
type EventType = 'meeting' | 'call' | 'demo' | 'support' | 'sale';

interface AgendaEvent {
    id: string;
    title: string;
    client: string;
    clientAvatar?: string;
    whatsapp: string;
    start: Date;
    end: Date;
    status: EventStatus;
    type: EventType;
    responsible: string;
    description?: string;
    location?: string;
}

// Mock Data
const MOCK_EVENTS: AgendaEvent[] = [
    {
        id: '1',
        title: 'Reunião de Apresentação',
        client: 'Empresas Tostes',
        whatsapp: '5511999999999',
        start: new Date(new Date().setHours(9, 0, 0, 0)),
        end: new Date(new Date().setHours(10, 0, 0, 0)),
        status: 'confirmed',
        type: 'meeting',
        responsible: 'Ana Silva',
        location: 'Google Meet'
    },
    {
        id: '2',
        title: 'Fechamento de Contrato',
        client: 'Tech Solutions',
        whatsapp: '5511988888888',
        start: new Date(new Date().setHours(14, 0, 0, 0)),
        end: new Date(new Date().setHours(15, 30, 0, 0)),
        status: 'scheduled',
        type: 'sale',
        responsible: 'Carlos Santos',
        location: 'Escritório Central'
    },
    {
        id: '3',
        title: 'Suporte Técnico',
        client: 'Restaurante Sabor',
        whatsapp: '5511977777777',
        start: new Date(new Date().setHours(11, 0, 0, 0)),
        end: new Date(new Date().setHours(11, 45, 0, 0)),
        status: 'in_progress',
        type: 'support',
        responsible: 'Ana Silva'
    }
];

const SmartAgenda = () => {
    const [date, setDate] = useState<Date>(new Date());
    const [view, setView] = useState<ViewMode>('day');
    const [events, setEvents] = useState<AgendaEvent[]>(MOCK_EVENTS);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Helpers
    const getStatusColor = (status: EventStatus) => {
        switch (status) {
            case 'scheduled': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'confirmed': return 'bg-green-100 text-green-700 border-green-200';
            case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'completed': return 'bg-gray-100 text-gray-700 border-gray-200';
            case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
            case 'no_show': return 'bg-orange-100 text-orange-700 border-orange-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getTypeIcon = (type: EventType) => {
        switch (type) {
            case 'meeting': return Users;
            case 'call': return Phone;
            case 'sale': return DollarSign;
            case 'support': return WrenchIcon; // Need to define or import Wrench? Using Tool icon logic
            case 'demo': return React.Fragment; // Placeholder
            default: return CalendarIcon;
        }
    };

    // Using a simpler approach for icons in rendering

    const timeSlots = Array.from({ length: 13 }, (_, i) => i + 8); // 8am to 8pm

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-background animate-in fade-in duration-500 overflow-hidden">
            {/* Header Toolbar */}
            <div className="border-b px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-card/50 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="min-w-[140px] text-center font-semibold text-sm">
                            {date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                        </span>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>Hoje</Button>
                </div>

                <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border">
                    <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)} className="w-auto">
                        <TabsList className="h-8">
                            <TabsTrigger value="day" className="text-xs">Dia</TabsTrigger>
                            <TabsTrigger value="week" className="text-xs">Semana</TabsTrigger>
                            <TabsTrigger value="month" className="text-xs">Mês</TabsTrigger>
                            <TabsTrigger value="list" className="text-xs">Lista</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" title="Filtros"><Filter className="h-4 w-4" /></Button>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 font-semibold">
                                <Plus className="h-4 w-4 mr-2" />
                                Novo Agendamento
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Novo Agendamento</DialogTitle>
                                <DialogDescription>
                                    Crie um novo compromisso na agenda. O cliente receberá uma notificação automática.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Cliente</Label>
                                        <Input placeholder="Buscar cliente..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>WhatsApp</Label>
                                        <Input placeholder="(00) 00000-0000" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Data</Label>
                                        <Input type="date" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Horário</Label>
                                        <div className="flex gap-2">
                                            <Input type="time" className="flex-1" />
                                            <span className="self-center">até</span>
                                            <Input type="time" className="flex-1" />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Tipo</Label>
                                        <Select>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="meeting">Reunião</SelectItem>
                                                <SelectItem value="sale">Venda</SelectItem>
                                                <SelectItem value="support">Suporte</SelectItem>
                                                <SelectItem value="call">Ligação</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Responsável</Label>
                                        <Select>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ana">Ana Silva</SelectItem>
                                                <SelectItem value="carlos">Carlos Santos</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Etiquetas</Label>
                                    <div className="flex gap-2">
                                        <Badge variant="outline" className="cursor-pointer hover:bg-red-50 hover:text-red-600 border-red-200">Urgente</Badge>
                                        <Badge variant="outline" className="cursor-pointer hover:bg-blue-50 hover:text-blue-600 border-blue-200">Novo Cliente</Badge>
                                        <Badge variant="outline" className="cursor-pointer hover:bg-green-50 hover:text-green-600 border-green-200">VIP</Badge>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Observações</Label>
                                    <Textarea placeholder="Detalhes do agendamento..." />
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                    <input type="checkbox" id="send_whatsapp" className="rounded border-gray-300" defaultChecked />
                                    <Label htmlFor="send_whatsapp" className="cursor-pointer">Enviar confirmação por WhatsApp automaticamente</Label>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                                <Button onClick={() => setIsCreateOpen(false)}>Agendar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Sidebar (Optional on mobile, visible on desktop) */}
                <div className="w-64 border-r bg-muted/10 hidden lg:flex flex-col p-4 gap-6 overflow-y-auto">
                    <div className="space-y-4">
                        <div className="bg-card rounded-xl p-3 border shadow-sm">
                            <CalendarIcon className="w-full h-auto text-muted-foreground/20" />
                            {/* Mini calendar placeholder */}
                            <div className="text-center text-xs text-muted-foreground mt-2">Navegação Rápida</div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</h3>
                        <div className="space-y-1">
                            {['Agendado', 'Confirmado', 'Em Atendimento', 'Finalizado', 'Cancelado'].map(s => (
                                <div key={s} className="flex items-center gap-2 text-sm p-1.5 hover:bg-muted/50 rounded-md cursor-pointer transition-colors">
                                    <div className={`w-2 h-2 rounded-full ${s === 'Agendado' ? 'bg-yellow-400' :
                                            s === 'Confirmado' ? 'bg-green-500' :
                                                s === 'Em Atendimento' ? 'bg-blue-500' :
                                                    s === 'Finalizado' ? 'bg-gray-400' : 'bg-red-400'
                                        }`} />
                                    <span>{s}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Responsáveis</h3>
                        <div className="flex -space-x-2 overflow-hidden py-1">
                            <Avatar className="h-8 w-8 border-2 border-background"><AvatarFallback>AN</AvatarFallback></Avatar>
                            <Avatar className="h-8 w-8 border-2 border-background"><AvatarFallback>CS</AvatarFallback></Avatar>
                            <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold">+3</div>
                        </div>
                    </div>
                </div>

                {/* Calendar View Area */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4">
                    {view === 'day' && (
                        <div className="w-full max-w-5xl mx-auto bg-white rounded-xl shadow-sm border overflow-hidden min-h-[800px]">
                            {/* Day View Header */}
                            <div className="grid grid-cols-[80px_1fr] border-b">
                                <div className="p-4 border-r bg-muted/5"></div>
                                <div className="p-4 text-center font-semibold text-lg text-primary">
                                    Hoje
                                </div>
                            </div>

                            {/* Time Grid */}
                            <div className="relative">
                                {/* Current Time Indicator Line (Mock position) */}
                                <div className="absolute left-0 right-0 top-[35%] border-t-2 border-red-400 z-10 pointer-events-none flex items-center">
                                    <div className="w-[80px] text-right pr-2 text-xs font-bold text-red-500 bg-white/80 backdrop-blur-sm -mt-2">Agora</div>
                                    <div className="h-2 w-2 rounded-full bg-red-400 -ml-1 -mt-[1px]"></div>
                                </div>

                                {timeSlots.map(hour => (
                                    <div key={hour} className="grid grid-cols-[80px_1fr] border-b min-h-[100px] group">
                                        {/* Time Label */}
                                        <div className="border-r p-3 text-right">
                                            <span className="text-sm font-medium text-muted-foreground">{hour}:00</span>
                                        </div>

                                        {/* Slots Area */}
                                        <div className="relative p-1 hover:bg-muted/5 transition-colors cursor-pointer" onClick={() => setIsCreateOpen(true)}>
                                            {/* Render events that match this hour */}
                                            {events.filter(e => e.start.getHours() === hour).map(event => (
                                                <div
                                                    key={event.id}
                                                    onClick={(e) => { e.stopPropagation(); /* Open Detail logic */ }}
                                                    className={cn(
                                                        "absolute left-2 right-2 p-3 rounded-lg border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all z-10",
                                                        getStatusColor(event.status),
                                                        "bg-opacity-90 backdrop-blur-sm"
                                                    )}
                                                    style={{ top: '4px', height: 'calc(100% - 8px)' }} // Mock height handling
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-bold text-sm truncate">{event.title}</span>
                                                        <div className="flex gap-1">
                                                            <button title="WhatsApp" className="hover:bg-black/10 p-1 rounded"><MessageCircle size={14} /></button>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs opacity-90 flex items-center gap-2 mt-1">
                                                        <Users size={12} /> {event.client}
                                                    </div>
                                                    <div className="text-xs opacity-75 mt-1 flex gap-2">
                                                        <span className="flex items-center gap-1"><Clock size={10} /> {event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {event.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {view === 'list' && (
                        <div className="w-full max-w-5xl mx-auto space-y-4">
                            {events.map(event => (
                                <Card key={event.id} className="hover:shadow-md transition-all border-l-4" style={{ borderLeftColor: event.status === 'confirmed' ? 'green' : event.status === 'scheduled' ? 'gold' : 'gray' }}>
                                    <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className={cn("text-[10px] uppercase", getStatusColor(event.status))}>{event.status}</Badge>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays size={12} /> {event.start.toLocaleDateString()}</span>
                                            </div>
                                            <h3 className="font-bold text-lg">{event.title}</h3>
                                            <p className="text-muted-foreground flex items-center gap-2 text-sm">
                                                <Users size={14} /> {event.client}
                                                <span className="text-muted-foreground/50">|</span>
                                                <Phone size={14} /> {event.whatsapp}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="text-right hidden md:block">
                                                <div className="text-sm font-bold">{event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                <div className="text-xs text-muted-foreground">Duração: 1h</div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="icon" variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50"><MessageCircle size={18} /></Button>
                                                <Button size="icon" variant="outline"><MoreHorizontal size={18} /></Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Placeholder for other views */}
                    {(view === 'week' || view === 'month') && (
                        <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground bg-white rounded-xl shadow border">
                            <CalendarIcon size={48} className="mb-4 opacity-20" />
                            <h3 className="text-lg font-bold">Visualização em Breve</h3>
                            <p>O modo {view === 'week' ? 'Semanal' : 'Mensal'} está sendo otimizado.</p>
                            <Button variant="outline" className="mt-4" onClick={() => setView('day')}>Voltar para Dia</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Simple Icon component helper if needed
const WrenchIcon = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>;

export default SmartAgenda;
