
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
    format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO,
    addMinutes, setHours, setMinutes, getHours, getMinutes, differenceInMinutes,
    startOfDay, endOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock,
    MoreHorizontal, Filter, Plus, Search, User, Phone, FileText,
    CheckCircle2, XCircle, AlertCircle, Clock3, DollarSign,
    Settings, MessageCircle, MoreVertical, Trash2, RefreshCw, ChevronsUpDown, Check
} from 'lucide-react';

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose
} from "@/components/ui/sheet";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

// --- TYPES ---

type ViewMode = 'day' | 'week' | 'month';

type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'canceled' | 'missed' | 'serving';

interface AgendaEvent {
    id: string;
    title: string;
    client: string;
    clientAvatar?: string;
    whatsapp: string;
    start: Date | string;
    end: Date | string;
    status: AppointmentStatus;
    type: string;
    responsible: string;
    responsibleId?: number;
    professionalColor?: string;
    description?: string;
    insurance?: string;
    insurance_plan_id?: number | null;
    billing_amount?: string;
    leadId?: number;
    location?: string;
}

interface Professional {
    id: number;
    name: string;
    color: string;
    avatar?: string;
}

// --- CONSTANTS ---

const START_HOUR = 7;
const END_HOUR = 20;
const PIXELS_PER_MINUTE = 0.75; // Height of 1 minute in pixels. Ultra compact to fit 1366x768 screens.

const STATUS_CONFIG: Record<string, { label: string, color: string, bg: string, border: string }> = {
    scheduled: { label: 'Agendado', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-l-blue-500' },
    confirmed: { label: 'Confirmado', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-l-emerald-500' },
    serving: { label: 'Em Atendimento', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-l-indigo-500' },
    completed: { label: 'Concluído', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-l-slate-500' },
    canceled: { label: 'Cancelado', color: 'text-red-600', bg: 'bg-red-50', border: 'border-l-red-500' },
    missed: { label: 'Faltou', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-l-orange-500' },
};

// --- SUBCOMPONENT: EVENT CARD ---

const EventCard = ({ event, onClick }: { event: AgendaEvent, onClick: (e: AgendaEvent) => void }) => {
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);

    // Position Calculation
    const startMinutes = (startDate.getHours() * 60) + startDate.getMinutes();
    const endMinutes = (endDate.getHours() * 60) + endDate.getMinutes();
    const durationMins = endMinutes - startMinutes;

    const top = (startMinutes - (START_HOUR * 60)) * PIXELS_PER_MINUTE;
    const height = durationMins * PIXELS_PER_MINUTE;

    const style = STATUS_CONFIG[event.status.toLowerCase()] || STATUS_CONFIG.scheduled;

    return (
        <div
            className={cn(
                "absolute left-1 right-1 rounded-md border-l-[4px] shadow-sm text-xs cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md hover:z-20 overflow-hidden flex flex-col group bg-white",
                style.bg,
                style.border, // Left border color
                "border-t border-r border-b border-slate-200 dark:border-transparent"
            )}
            style={{
                top: `${top}px`,
                height: `${height}px`,
                minHeight: '22px'
            }}
            onClick={(e) => { e.stopPropagation(); onClick(event); }}
        >
            <div className="p-0.5 px-1.5 flex flex-col h-full relative">
                {/* Header */}
                <div className="flex justify-between items-start gap-1 w-full relative z-10">
                    <span className={cn("font-bold truncate leading-tight text-[9px]", style.color)}>
                        {event.client}
                    </span>
                    {event.status === 'confirmed' && <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />}
                </div>

                {/* Time & Badges (Visible if height permits) */}
                {height > 22 && (
                    <div className="mt-0.5 flex items-center justify-between text-[8px] text-slate-500 font-medium leading-none">
                        <span className="flex items-center gap-1 opacity-80" style={{ fontSize: '8px' }}>
                            {format(startDate, 'HH:mm')}
                        </span>
                        {event.insurance && height > 35 && (
                            <Badge variant="secondary" className="text-[7px] h-3 px-1 border-none uppercase font-black opacity-70 scale-75 origin-right">{event.insurance.substring(0, 3)}</Badge>
                        )}
                    </div>
                )}

                {/* Responsible (Visible if tall) */}
                {height > 45 && (
                    <div className="mt-auto pt-0.5 flex items-center gap-1 text-[8px] text-slate-400 truncate border-t border-black/5 leading-none">
                        <User size={10} /> {event.responsible}
                    </div>
                )}
            </div>
        </div>
    );
};


// --- MAIN COMPONENT ---

const ClinicalAgenda = () => {
    const { token } = useAuth();
    const { toast } = useToast();

    // -- State --
    const [date, setDate] = useState<Date>(new Date());
    const [view, setView] = useState<ViewMode>('day'); // Default to day for column view
    const [events, setEvents] = useState<AgendaEvent[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [selectedProfessional, setSelectedProfessional] = useState<string>('all');
    const [loading, setLoading] = useState(false);

    // -- Patient Search State --
    const [leads, setLeads] = useState<any[]>([]);
    const [openCombobox, setOpenCombobox] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Selected Event for Drawer
    const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // -- Mock Professionals (Fallback) -- 
    useEffect(() => {
        // Fetch professionals
        const fetchProfs = async () => {
            try {
                const res = await fetch('/api/crm/professionals', { headers: { 'Authorization': `Bearer ${token}` } });
                if (res.ok) {
                    const data = await res.json();
                    setProfessionals(data);
                }
            } catch (e) { console.error(e); }
        };
        fetchProfs();
    }, [token]);

    // -- Fetch Leads for Autocomplete --
    useEffect(() => {
        const fetchLeads = async () => {
            if (!token) return;
            try {
                // Fetch all leads for search. Ideally this should be paginated or server-side searched, 
                // but for now we fetch all for client-side filtering as requested.
                const res = await fetch('/api/crm/leads', { headers: { 'Authorization': `Bearer ${token}` } });
                if (res.ok) setLeads(await res.json());
            } catch (e) { console.error("Failed to fetch leads"); }
        };
        fetchLeads();
    }, [token]);

    // -- Fetch Appointments --
    const fetchAppointments = async () => {
        if (!token) return;
        setLoading(true);
        try {
            // Buffer: Fetch a wide range based on view.
            let start = startOfDay(date);
            let end = endOfDay(date);

            if (view === 'week') {
                start = startOfWeek(date, { weekStartsOn: 0 });
                end = endOfWeek(date, { weekStartsOn: 0 });
            } else if (view === 'month') {
                start = startOfWeek(startOfMonth(date)); // Get full grid weeks
                end = endOfWeek(endOfMonth(date));
            }

            const params = new URLSearchParams({
                start: start.toISOString(),
                end: end.toISOString(),
                responsible_id: selectedProfessional
            });

            const res = await fetch(`/api/crm/appointments?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Falha ao buscar agendamentos');

            const data = await res.json();

            // Parse Dates
            const parsed = data.map((ev: any) => ({
                ...ev,
                start: new Date(ev.start),
                end: new Date(ev.end)
            }));

            setEvents(parsed);
        } catch (e) {
            console.error(e);
            toast({ title: "Erro", description: "Não foi possível carregar a agenda.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAppointments();
    }, [date, view, token, selectedProfessional]);


    // -- Helpers --
    const handlePrev = () => {
        if (view === 'day') setDate(d => addDays(d, -1));
        if (view === 'week') setDate(d => addDays(d, -7));
        if (view === 'month') setDate(d => addDays(d, -30)); // Rough month nav
    };

    const handleNext = () => {
        if (view === 'day') setDate(d => addDays(d, 1));
        if (view === 'week') setDate(d => addDays(d, 7));
        if (view === 'month') setDate(d => addDays(d, 30));
    };

    const handleEventClick = (event: AgendaEvent) => {
        setSelectedEvent(event);
        setIsDrawerOpen(true);
    };

    const handleDelete = async () => {
        if (!selectedEvent) return;
        if (selectedEvent.id === 'new') {
            setIsDrawerOpen(false);
            return;
        }
        if (!confirm("Deseja realmente deletar este agendamento?")) return;

        try {
            const res = await fetch(`/api/crm/appointments/${selectedEvent.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Erro ao deletar");

            toast({ title: "Sucesso", description: "Agendamento deletado." });
            setIsDrawerOpen(false);
            fetchAppointments(); // Refresh grid
        } catch (e) {
            toast({ title: "Erro", description: "Não foi possível deletar.", variant: "destructive" });
        }
    };

    const handleSelectPatient = (lead: any, isNew: boolean = false) => {
        if (!selectedEvent) return;

        const name = isNew ? searchTerm : lead.name;
        const phone = isNew ? '' : (lead.phone || '');

        setSelectedEvent({
            ...selectedEvent,
            client: name,
            whatsapp: phone,
            leadId: isNew ? undefined : lead.id
        });
        setOpenCombobox(false);
    };

    const handleNewAppointment = () => {
        const now = new Date();
        const nextHour = addMinutes(now, 60);

        setSelectedEvent({
            id: 'new',
            title: 'Nova Consulta',
            client: 'Novo Paciente',
            whatsapp: '',
            start: now.toISOString(),
            end: nextHour.toISOString(),
            status: 'scheduled',
            type: 'consulta',
            responsible: 'Sem Responsável',
            billing_amount: '0,00'
        });
        setIsDrawerOpen(true);
    };

    const handleSave = async () => {
        // TODO: Implement actual save logic (POST/PUT)
        // For now just close and toast
        toast({ title: "Salvo", description: "Agendamento salvo com sucesso (Simulação)." });
        setIsDrawerOpen(false);
        fetchAppointments();
    };

    // Calculate Grid Lines
    const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

    // -- Render --
    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">

            {/* 1. TOP HEADER */}
            <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-4 shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-4 overflow-hidden">
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrev}><ChevronLeft size={16} /></Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-bold" onClick={() => setDate(new Date())}>Hoje</Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNext}><ChevronRight size={16} /></Button>
                    </div>
                    <h1 className="text-lg font-bold capitalize flex items-center gap-2 truncate min-w-0">
                        <CalendarIcon className="text-blue-600 w-5 h-5 shrink-0" />
                        <span className="truncate whitespace-nowrap">
                            {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                        </span>
                        <span className="text-slate-400 font-normal text-sm shrink-0">{format(date, "yyyy")}</span>
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    {/* Professional Filter */}
                    <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                        <SelectTrigger className="w-[180px] h-9 text-xs font-bold bg-slate-50 border-slate-200">
                            <div className="flex items-center gap-2 truncate">
                                <User size={14} className="text-slate-400" />
                                <SelectValue placeholder="Profissional" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos Profissionais</SelectItem>
                            {professionals.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="hidden md:flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1 shrink-0">
                        {(['day', 'week', 'month'] as ViewMode[]).map((m) => (
                            <button
                                key={m}
                                onClick={() => setView(m)}
                                className={cn(
                                    "px-3 py-1 text-xs font-bold rounded-md transition-all capitalize whitespace-nowrap",
                                    view === m ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 border border-slate-200 dark:border-transparent" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                {m === 'day' ? 'Dia' : m === 'week' ? 'Semana' : 'Mês'}
                            </button>
                        ))}
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-blue-600" onClick={() => fetchAppointments()} disabled={loading}>
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-lg shadow-blue-500/20" onClick={handleNewAppointment}>
                        <Plus size={16} /> <span className="hidden sm:inline">Novo Agendamento</span>
                    </Button>
                    <Button variant="ghost" size="icon"><Settings size={18} className="text-slate-400" /></Button>
                </div>
            </header>

            {/* 2. MAIN GRID AREA */}
            <div className="flex-1 overflow-hidden relative flex">

                {/* 2b. GRID CONTENT (Conditional Render based on View) */}
                {view === 'month' ? (
                    // --- MONTH VIEW (Google Calendar Style) ---
                    <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
                        {/* Weekday Headers */}
                        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                                <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Month Grid */}
                        <div className="flex-1 grid grid-cols-7 grid-rows-6">
                            {(() => {
                                const monthStart = startOfMonth(date);
                                const monthEnd = endOfMonth(date);
                                const startDate = startOfWeek(monthStart);
                                const endDate = endOfWeek(endOfWeek(monthEnd)); // Ensure full weeks

                                // Ensure exactly 42 days (6 weeks) for stability
                                const days = eachDayOfInterval({ start: startDate, end: addDays(startDate, 41) });

                                return days.map((day, idx) => {
                                    const isCurrentMonth = isSameMonth(day, date);
                                    const dayEvents = events.filter(e => isSameDay(new Date(e.start), day));
                                    const maxVisible = 3;
                                    const hasMore = dayEvents.length > maxVisible;

                                    return (
                                        <div
                                            key={day.toISOString()}
                                            className={cn(
                                                "border-b border-r border-slate-200 dark:border-slate-800/50 p-1 relative flex flex-col gap-0.5 transition-colors hover:bg-slate-50/50",
                                                !isCurrentMonth && "bg-slate-50/30 dark:bg-slate-900/20 text-slate-400",
                                                isToday(day) && "bg-blue-50/20"
                                            )}
                                            onClick={() => {
                                                setDate(day);
                                                setView('day');
                                            }}
                                        >
                                            {/* Day Number */}
                                            <div className="flex justify-between items-start mb-1 h-6">
                                                <span className={cn(
                                                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                                                    isToday(day) ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-700 dark:text-slate-300"
                                                )}>
                                                    {format(day, 'd')}
                                                </span>
                                                {dayEvents.length > 0 && <span className="text-[10px] font-bold text-slate-300">{dayEvents.length}</span>}
                                            </div>

                                            {/* Events List */}
                                            <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                                                {dayEvents.slice(0, maxVisible).map(event => {
                                                    const style = STATUS_CONFIG[event.status.toLowerCase()] || STATUS_CONFIG.scheduled;
                                                    return (
                                                        <div
                                                            key={event.id}
                                                            className={cn(
                                                                "text-[10px] px-1.5 py-0.5 rounded border-l-2 truncate font-medium cursor-pointer flex items-center gap-1 hover:brightness-95 transition-all text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 shadow-sm",
                                                                style.border
                                                            )}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEventClick(event);
                                                            }}
                                                        >
                                                            <span className="text-[9px] font-bold opacity-70 tabular-nums">{format(new Date(event.start), 'HH:mm')}</span>
                                                            <span className="truncate">{event.client}</span>
                                                        </div>
                                                    );
                                                })}

                                                {hasMore && (
                                                    <div className="text-[10px] font-bold text-slate-400 pl-1 hover:text-blue-600 cursor-pointer">
                                                        + {dayEvents.length - maxVisible} mais
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                ) : (
                    // --- DAY & WEEK VIEW (Time Grid) ---
                    // UNIFIED SCROLL AREA for Sync
                    <ScrollArea className="flex-1 bg-white dark:bg-slate-950">
                        <div className="min-w-[800px] relative flex flex-col">

                            {/* STICKY HEADER ROW */}
                            <div className="sticky top-0 z-40 flex h-14 bg-slate-50/95 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 shadow-sm">
                                {/* Corner Spacer (Sticky Left) */}
                                <div className="w-14 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 sticky left-0 z-50"></div>

                                {/* Column Headers */}
                                <div className="flex-1 flex">
                                    {view === 'day' ? (
                                        // RESOURCE VIEW: Professional Columns
                                        (professionals.length > 0 ? professionals : [{ id: 0, name: 'Geral', color: '#6366f1' }]).map(prof => (
                                            <div key={prof.id} className="flex-1 min-w-[150px] p-2 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex items-center justify-center gap-3">
                                                <Avatar className="w-8 h-8 border-2 border-white shadow-sm ring-1 ring-slate-100">
                                                    <AvatarImage src={prof.avatar} />
                                                    <AvatarFallback className="bg-blue-100 text-blue-700 font-bold text-xs">{prof.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm font-bold truncate max-w-full text-slate-700 dark:text-slate-300">{prof.name}</span>
                                            </div>
                                        ))
                                    ) : view === 'week' ? (
                                        // WEEK VIEW: Day Columns
                                        eachDayOfInterval({ start: startOfWeek(date, { weekStartsOn: 0 }), end: endOfWeek(date, { weekStartsOn: 0 }) }).map(day => (
                                            <div key={day.toISOString()} className={cn("flex-1 min-w-[120px] p-2 text-center border-r border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer", isToday(day) && "bg-blue-50/40")}>
                                                <span className={cn("text-[10px] uppercase font-bold tracking-wider", isToday(day) ? "text-blue-600" : "text-slate-400")}>{format(day, 'EEE', { locale: ptBR })}</span>
                                                <div className={cn("text-lg font-black leading-none", isToday(day) ? "text-blue-600" : "text-slate-700 dark:text-slate-300")}>
                                                    {format(day, 'd')}
                                                </div>
                                            </div>
                                        ))
                                    ) : null}
                                </div>
                            </div>

                            {/* BODY ROW */}
                            <div className="flex relative" style={{ height: (END_HOUR - START_HOUR + 1) * 60 * PIXELS_PER_MINUTE }}>

                                {/* Time ColumnLabels (Sticky Left) */}
                                <div className="w-14 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky left-0 z-30">
                                    {hours.map(h => (
                                        <div
                                            key={h}
                                            className="absolute w-full text-[9px] text-slate-400 font-bold flex items-start justify-center pt-1 border-b border-transparent"
                                            style={{ top: (h - START_HOUR) * 60 * PIXELS_PER_MINUTE, height: 60 * PIXELS_PER_MINUTE }}
                                        >
                                            {h}:00
                                        </div>
                                    ))}
                                </div>

                                {/* Grid Lines & Events */}
                                <div className="flex-1 relative bg-white dark:bg-slate-950">
                                    {/* Horizontal Grid Lines */}
                                    {hours.map(h => (
                                        <div
                                            key={h}
                                            className="absolute w-full border-b border-slate-100 dark:border-dashed dark:border-slate-800/50 pointer-events-none"
                                            style={{ top: (h - START_HOUR) * 60 * PIXELS_PER_MINUTE, height: 60 * PIXELS_PER_MINUTE }}
                                        />
                                    ))}

                                    {/* Current Time Indicator Line */}
                                    {isToday(date) && (
                                        <div
                                            className="absolute w-full border-t-2 border-red-500 z-20 pointer-events-none opacity-60 flex items-center shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                            style={{
                                                top: ((new Date().getHours() - START_HOUR) * 60 + new Date().getMinutes()) * PIXELS_PER_MINUTE
                                            }}
                                        >
                                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-[5px] shadow-sm"></div>
                                        </div>
                                    )}

                                    {/* EVENTS RENDERING */}
                                    {view === 'day' ? (
                                        // Render by Professional Column
                                        (professionals.length > 0 ? professionals : [{ id: 0, name: 'Geral' }]).map((prof, colIndex) => {
                                            const colEvents = events.filter(e => {
                                                // If viewing specific date, filter by day
                                                if (!isSameDay(new Date(e.start), date)) return false;
                                                // Filter by professional ID (assuming backend sends responsibleId)
                                                if (prof.id !== 0 && e.responsibleId !== prof.id) return false;
                                                return true;
                                            });

                                            return (
                                                <div
                                                    key={prof.id}
                                                    className="absolute top-0 bottom-0 border-r border-slate-200 dark:border-slate-800/50 hover:bg-slate-50/50 transition-colors"
                                                    style={{
                                                        left: `${colIndex * (100 / (professionals.length || 1))}%`,
                                                        width: `${100 / (professionals.length || 1)}%`
                                                    }}
                                                >
                                                    {colEvents.map(event => <EventCard key={event.id} event={event} onClick={handleEventClick} />)}

                                                    {/* Clickable slots for creation could go here */}
                                                </div>
                                            )
                                        })
                                    ) : view === 'week' ? (
                                        // Render by Day Column
                                        eachDayOfInterval({ start: startOfWeek(date, { weekStartsOn: 0 }), end: endOfWeek(date, { weekStartsOn: 0 }) }).map((day, colIndex) => {
                                            const colEvents = events.filter(e => isSameDay(new Date(e.start), day));

                                            return (
                                                <div
                                                    key={day.toISOString()}
                                                    className="absolute top-0 bottom-0 border-r border-slate-200 dark:border-slate-800/50 hover:bg-slate-50/50 transition-colors"
                                                    style={{
                                                        left: `${colIndex * (100 / 7)}%`,
                                                        width: `${100 / 7}%`
                                                    }}
                                                >
                                                    {colEvents.map(event => <EventCard key={event.id} event={event} onClick={handleEventClick} />)}
                                                </div>
                                            )
                                        })
                                    ) : null}

                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* 3. RIGHT DRAWER (DETAILS & EDIT) */}
            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto p-0 gap-0 border-l shadow-2xl">

                    {/* DRAWER HEADER */}
                    <div className="bg-slate-50 dark:bg-slate-900 border-b p-6 pb-4">
                        <div className="flex justify-between items-start mb-4">
                            <Badge variant="outline" className="bg-white">
                                ID: {selectedEvent?.id}
                            </Badge>
                            <div className="flex gap-2">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={handleDelete}>
                                    <Trash2 size={16} />
                                </Button>
                                <SheetClose asChild><Button size="icon" variant="ghost" className="h-8 w-8"><XCircle size={18} /></Button></SheetClose>
                            </div>
                        </div>

                        <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                            {selectedEvent?.id === 'new' ? (
                                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openCombobox}
                                            className="w-full justify-between text-lg font-bold h-12 bg-white border-slate-300"
                                        >
                                            {selectedEvent.client !== 'Novo Paciente' ? selectedEvent.client : "Buscar ou Criar Paciente..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[350px] p-0" align="start">
                                        <Command shouldFilter={false}>
                                            <CommandInput placeholder="Buscar paciente..." onValueChange={setSearchTerm} />
                                            <CommandList>
                                                <CommandEmpty className="py-2 px-2">
                                                    <p className="text-sm text-slate-500 mb-2 px-2">Nenhum paciente encontrado.</p>
                                                    <Button
                                                        variant="secondary"
                                                        className="w-full justify-start font-bold text-blue-600 bg-blue-50 hover:bg-blue-100"
                                                        onClick={() => handleSelectPatient(null, true)}
                                                    >
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        Cadastrar novo: "{searchTerm}"
                                                    </Button>
                                                </CommandEmpty>
                                                <CommandGroup>
                                                    {leads
                                                        .filter(l => l.name?.toLowerCase().includes(searchTerm.toLowerCase()))
                                                        .slice(0, 10) // Limit results
                                                        .map((lead) => (
                                                            <CommandItem
                                                                key={lead.id}
                                                                value={lead.name}
                                                                onSelect={() => handleSelectPatient(lead)}
                                                                className="cursor-pointer"
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        selectedEvent.client === lead.name ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold">{lead.name}</span>
                                                                    {lead.phone && <span className="text-xs text-slate-400">{lead.phone}</span>}
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                selectedEvent?.client
                            )}
                        </SheetTitle>
                        <SheetDescription className="flex items-center gap-2 mt-1">
                            <span className="flex items-center gap-1 text-slate-600 font-medium">
                                <Clock size={14} />
                                {selectedEvent && format(new Date(selectedEvent.start), "EEEE, d MMMM 'às' HH:mm", { locale: ptBR })}
                            </span>
                        </SheetDescription>
                    </div>

                    {selectedEvent && (
                        <div className="p-6 space-y-8" key={selectedEvent.id}>

                            {/* 1. STATUS BAR */}
                            <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
                                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Status do Agendamento</Label>
                                <Select defaultValue={selectedEvent.status}>
                                    <SelectTrigger className={cn("w-full font-bold h-10 border-0 ring-1 ring-slate-200", STATUS_CONFIG[selectedEvent.status.toLowerCase()]?.bg)}>
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full bg-current", STATUS_CONFIG[selectedEvent.status.toLowerCase()]?.color)}></div>
                                            <SelectValue />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                            <SelectItem key={key} value={key} className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("w-2 h-2 rounded-full", cfg.color.replace('text-', 'bg-'))}></div>
                                                    {cfg.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* 2. TIME EDIT */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-bold text-slate-500 mb-1.5 block">Início</Label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                        <Input
                                            type="time"
                                            className="pl-9 font-mono font-medium"
                                            defaultValue={format(new Date(selectedEvent.start), 'HH:mm')}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs font-bold text-slate-500 mb-1.5 block">Fim</Label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                        <Input
                                            type="time"
                                            className="pl-9 font-mono font-medium"
                                            defaultValue={format(new Date(selectedEvent.end), 'HH:mm')}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* 3. PATIENT & CONTACT */}
                            <div className="flex gap-4 items-center">
                                <Avatar className="w-16 h-16 border-2 border-slate-100 shadow-sm">
                                    <AvatarImage src={selectedEvent.clientAvatar} />
                                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xl">{selectedEvent.client ? selectedEvent.client.substring(0, 1) : '?'}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-2">
                                    <div className="font-bold text-slate-900">{selectedEvent.client}</div>

                                    {/* Editable Phone Field */}
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                        <Input
                                            placeholder="WhatsApp / Telefone"
                                            className="pl-9 h-9 text-sm"
                                            value={selectedEvent.whatsapp}
                                            onChange={(e) => setSelectedEvent({ ...selectedEvent, whatsapp: e.target.value })}
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" className="h-8 gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 bg-white">
                                            <MessageCircle size={14} /> WhatsApp
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* 4. FINANCIAL SUMMARY */}
                            <Card className="bg-slate-50 border-slate-200 shadow-sm overflow-hidden">
                                <CardContent className="p-0 flex">
                                    <div className="bg-yellow-100 w-2 shrink-0"></div>
                                    <div className="p-4 flex-1 flex justify-between items-center">
                                        <div>
                                            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-0.5">Valor da Consulta</div>
                                            <div className="text-xl font-black text-slate-800 flex items-baseline gap-1">
                                                <span className="text-sm font-medium text-slate-400">R$</span>
                                                {selectedEvent.billing_amount || '150,00'}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <Badge variant="outline" className="bg-white text-yellow-600 border-yellow-200">Pendente</Badge>
                                            <Button size="sm" variant="link" className="h-6 px-0 text-blue-600">Ver Fatura</Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* 5. NOTES */}
                            <div>
                                <Label className="mb-2 block font-bold text-sm text-slate-700">Observações</Label>
                                <Textarea
                                    className="bg-slate-50 min-h-[100px] border-slate-200 resize-none focus:bg-white transition-colors"
                                    placeholder="Nenhuma observação registrada..."
                                    defaultValue={selectedEvent.description}
                                />
                            </div>

                        </div>
                    )}

                    <SheetFooter className="p-6 border-t bg-slate-50/50 mt-auto">
                        <div className="flex justify-between w-full">
                            <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-2" onClick={handleDelete}>
                                <Trash2 size={16} /> Deletar
                            </Button>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => setIsDrawerOpen(false)}>Fechar</Button>
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 px-8" onClick={handleSave}>
                                    {selectedEvent?.id === 'new' ? 'Criar Agendamento' : 'Salvar Alterações'}
                                </Button>
                            </div>
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div >
    );
};

export default ClinicalAgenda;
