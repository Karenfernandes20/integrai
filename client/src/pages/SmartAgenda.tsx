
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Calendar as CalendarIcon,
    Clock,
    Plus,
    ChevronLeft,
    ChevronRight,
    Phone,
    MessageCircle,
    CheckCircle2,
    XCircle,
    Menu,
    X,
    LayoutList,
    CalendarDays
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
    startOfDay,
    endOfDay,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    format,
    addDays,
    addMonths,
    subDays,
    subMonths,
    isSameDay,
    isToday,
    isSameMonth,
    parseISO,
    eachDayOfInterval
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Types
type ViewMode = 'day' | 'week' | 'month';
type EventStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
type EventType = 'meeting' | 'call' | 'demo' | 'support' | 'sale' | 'consultation';

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
    professionalColor?: string;
    responsibleId?: number;
}

interface ProcessedLead {
    id: number;
    name: string;
    phone: string;
}

const timeSlots = Array.from({ length: 13 }, (_, i) => i + 7); // 7h às 19h

const SmartAgenda = () => {
    const { token } = useAuth();
    const { toast } = useToast();

    // State
    const [date, setDate] = useState<Date>(new Date());
    const [view, setView] = useState<ViewMode>('week');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [events, setEvents] = useState<AgendaEvent[]>([]);
    const [leads, setLeads] = useState<ProcessedLead[]>([]);
    const [professionals, setProfessionals] = useState<any[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        client_name: '',
        phone: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '09:00',
        end_time: '10:00',
        type: 'consultation',
        responsible_id: '',
        description: '',
        status: 'scheduled'
    });

    // Detect mobile
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Fetch data
    useEffect(() => {
        fetchEvents();
        fetchLeads();
        fetchProfessionals();
    }, [date, token, view]);

    const fetchEvents = async () => {
        if (!token) return;
        try {
            let start: Date, end: Date;

            // Define range based on view mode
            if (view === 'day') {
                start = startOfDay(date);
                end = endOfDay(date);
            } else if (view === 'week') {
                start = startOfWeek(date, { weekStartsOn: 0 });
                end = endOfWeek(date, { weekStartsOn: 0 });
            } else { // month
                start = startOfMonth(date);
                end = endOfMonth(date);
            }

            const query = new URLSearchParams({
                start: start.toISOString(),
                end: end.toISOString()
            });

            console.log('[SmartAgenda] Fetching events:', {
                date: format(date, 'yyyy-MM-dd'),
                view,
                isMobile,
                start: start.toISOString(),
                end: end.toISOString()
            });

            const res = await fetch(`/api/crm/appointments?${query.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                console.log('[SmartAgenda] Received appointments:', data.length, data);
                const parsed = data.map((e: any) => ({
                    ...e,
                    start: new Date(e.start),
                    end: new Date(e.end)
                }));
                setEvents(parsed);
            } else {
                console.error('[SmartAgenda] Failed to fetch events:', res.status);
            }
        } catch (error) {
            console.error("[SmartAgenda] Failed to fetch events:", error);
        }
    };

    const fetchLeads = async () => {
        if (!token) return;
        try {
            const res = await fetch('/api/crm/leads', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setLeads(await res.json());
        } catch (error) {
            console.error("Failed to fetch leads:", error);
        }
    };

    const fetchProfessionals = async () => {
        if (!token) return;
        try {
            const res = await fetch('/api/crm/professionals', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setProfessionals(await res.json());
        } catch (error) {
            console.error(error);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            client_name: '',
            phone: '',
            date: format(date, 'yyyy-MM-dd'),
            start_time: '09:00',
            end_time: '10:00',
            type: 'consultation',
            responsible_id: '',
            description: '',
            status: 'scheduled'
        });
        setSelectedEventId(null);
        setSelectedLeadId(null);
    };

    const handleEdit = (event: AgendaEvent) => {
        setFormData({
            title: event.title,
            client_name: event.client,
            phone: event.whatsapp,
            date: format(event.start, 'yyyy-MM-dd'),
            start_time: format(event.start, 'HH:mm'),
            end_time: format(event.end, 'HH:mm'),
            type: event.type as string,
            responsible_id: event.responsibleId?.toString() || '',
            description: event.description || '',
            status: event.status
        });
        setSelectedEventId(event.id);
        setIsCreateOpen(true);
    };

    const handleCreateOrUpdate = async () => {
        if (!formData.title || !formData.date || !formData.start_time) {
            toast({ title: "Erro", description: "Preencha o título e horário", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {

            // Fix: Create Date objects from local string to handle timezone conversion correctly
            const startDate = new Date(`${formData.date}T${formData.start_time}:00`);
            const endDate = new Date(`${formData.date}T${formData.end_time}:00`);
            
            const payload = {
                title: formData.title,
                ...formData,
                lead_id: selectedLeadId,
                start_time: startDate.toISOString(),
                end_time: endDate.toISOString(),
                responsible_id: formData.responsible_id && formData.responsible_id !== '0' ? parseInt(formData.responsible_id) : null,
            };

            const url = selectedEventId ? `/api/crm/appointments/${selectedEventId}` : '/api/crm/appointments';
            const method = selectedEventId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const savedAppointment = await res.json();
                console.log('[SmartAgenda] Appointment saved successfully:', savedAppointment);

                toast({ title: "Sucesso!", description: selectedEventId ? "Agendamento atualizado" : "Agendamento criado" });

                setIsCreateOpen(false);
                resetForm();

                // Change to appointment date and refresh
                if (formData.date) {
                    const [y, m, d] = formData.date.split('-').map(Number);
                    const newDate = new Date(y, m - 1, d);
                    console.log('[SmartAgenda] Changing date to:', format(newDate, 'yyyy-MM-dd'));
                    setDate(newDate);

                    setTimeout(() => {
                        console.log('[SmartAgenda] Force refreshing events...');
                        fetchEvents();
                    }, 100);
                }
            } else {
                toast({ title: "Erro", description: "Falha ao salvar", variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Erro de conexão", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickStatusChange = async (eventId: string, newStatus: EventStatus) => {
        try {
            const res = await fetch(`/api/crm/appointments/${eventId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                toast({
                    title: "Status atualizado!",
                    description: newStatus === 'confirmed' ? "Agendamento confirmado" :
                        newStatus === 'cancelled' ? "Agendamento cancelado" : "Status alterado"
                });
                fetchEvents();
            } else {
                toast({ title: "Erro", description: "Falha ao atualizar status", variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Erro de conexão", variant: "destructive" });
        }
    };

    const getStatusColor = (status: EventStatus) => {
        const colors = {
            scheduled: 'bg-blue-100 text-blue-700 border-blue-300',
            confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
            in_progress: 'bg-indigo-100 text-indigo-700 border-indigo-300',
            completed: 'bg-gray-100 text-gray-700 border-gray-300',
            cancelled: 'bg-rose-100 text-rose-700 border-rose-300',
            no_show: 'bg-orange-100 text-orange-700 border-orange-300'
        };
        return colors[status] || colors.scheduled;
    };

    const getStatusLabel = (status: EventStatus) => {
        const labels = {
            scheduled: 'Agendado',
            confirmed: 'Confirmado',
            in_progress: 'Em Andamento',
            completed: 'Completado',
            cancelled: 'Cancelado',
            no_show: 'Faltou'
        };
        return labels[status];
    };

    // Mobile: apenas o dia atual
    const currentDayEvents = events.filter(e => isSameDay(e.start, date));

    // Calculate days to display based on view mode
    const getDaysToDisplay = (): Date[] => {
        if (view === 'day') {
            return [date];
        } else if (view === 'week') {
            return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date, { weekStartsOn: 0 }), i));
        } else { // month
            const monthStart = startOfMonth(date);
            const monthEnd = endOfMonth(date);
            const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
            const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
            return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
        }
    };

    const weekDays = getDaysToDisplay();

    // Navigation helpers
    const handlePrevious = () => {
        if (view === 'day') setDate(subDays(date, 1));
        else if (view === 'week') setDate(subDays(date, 7));
        else setDate(subMonths(date, 1));
    };

    const handleNext = () => {
        if (view === 'day') setDate(addDays(date, 1));
        else if (view === 'week') setDate(addDays(date, 7));
        else setDate(addMonths(date, 1));
    };

    const getDateRangeLabel = () => {
        if (view === 'day') {
            return format(date, "dd 'de' MMM", { locale: ptBR });
        } else if (view === 'week') {
            return format(startOfWeek(date, { weekStartsOn: 0 }), "MMM yyyy", { locale: ptBR });
        } else {
            return format(date, "MMMM yyyy", { locale: ptBR });
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden min-h-0">
            {/* Header - FIXED */}
            <div className="bg-white border-b shadow-sm p-3 sm:p-4 flex-shrink-0">
                <div className="max-w-7xl mx-auto flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                            {/* Mobile Menu Button */}
                            {isMobile && (
                                <Button size="icon" variant="ghost" onClick={() => setShowMobileMenu(!showMobileMenu)}>
                                    {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
                                </Button>
                            )}

                            {/* Date Navigation */}
                            <div className="flex items-center gap-2">
                                <Button size="icon" variant="outline" onClick={handlePrevious} className="h-8 w-8">
                                    <ChevronLeft size={16} />
                                </Button>
                                <div className="text-center min-w-[120px] sm:min-w-[140px]">
                                    <h2 className="text-sm sm:text-lg font-bold text-slate-800">
                                        {getDateRangeLabel()}
                                    </h2>
                                    <p className="text-[10px] sm:text-xs text-slate-500">
                                        {isToday(date) ? 'Hoje' : format(date, 'EEEE', { locale: ptBR })}
                                    </p>
                                </div>
                                <Button size="icon" variant="outline" onClick={handleNext} className="h-8 w-8">
                                    <ChevronRight size={16} />
                                </Button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                            <Button variant="outline" size="sm" onClick={() => setDate(new Date())} className="text-[10px] sm:text-xs h-8 px-2 sm:px-3">
                                Hoje
                            </Button>
                            <Button size="sm" onClick={() => { resetForm(); setIsCreateOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-[10px] sm:text-xs h-8 px-2 sm:px-3">
                                <Plus size={14} className="mr-1" /> Novo
                            </Button>
                        </div>
                    </div>

                    {/* View Mode Selector */}
                    <div className="flex justify-center mt-1 sm:mt-0">
                        <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)} className="w-full sm:w-auto">
                            <TabsList className="grid grid-cols-3 w-full sm:w-[300px] h-9">
                                <TabsTrigger value="day" className="text-[10px] sm:text-sm py-1">
                                    <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                    Dia
                                </TabsTrigger>
                                <TabsTrigger value="week" className="text-[10px] sm:text-sm py-1">
                                    <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                    Semana
                                </TabsTrigger>
                                <TabsTrigger value="month" className="text-[10px] sm:text-sm py-1">
                                    <LayoutList className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                    Mês
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>
            </div>

            {/* Main Content - SCROLLABLE */}
            <div className="flex-1 overflow-hidden relative">
                <ScrollArea className="h-full">
                    <div className="max-w-7xl mx-auto p-2 sm:p-4">
                        {/* Legend (Mobile Collapsible) */}
                        {(!isMobile || showMobileMenu) && (
                            <Card className="mb-4">
                                <CardContent className="p-3">
                                    <div className="flex flex-wrap gap-3 items-center justify-center">
                                        {[
                                            { status: 'scheduled', label: 'Agendado', color: 'bg-blue-400' },
                                            { status: 'confirmed', label: 'Confirmado', color: 'bg-emerald-500' },
                                            { status: 'in_progress', label: 'Em Andamento', color: 'bg-indigo-500' },
                                            { status: 'completed', label: 'Completado', color: 'bg-gray-400' },
                                            { status: 'cancelled', label: 'Cancelado', color: 'bg-rose-400' }
                                        ].map(s => (
                                            <div key={s.status} className="flex items-center gap-2 text-xs">
                                                <div className={`w-3 h-3 rounded-full ${s.color}`} />
                                                <span className="text-slate-600">{s.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* CALENDAR GRID - NO HORIZONTAL SCROLL */}
                        <Card className="overflow-hidden border-none sm:border shadow-none sm:shadow-sm bg-white/50 backdrop-blur-sm">
                            <div className="overflow-x-auto custom-scrollbar">
                                <div className={cn(
                                    "min-w-full",
                                    view === 'week' ? (isMobile ? "min-w-[600px]" : "min-w-[900px]") :
                                        view === 'month' ? (isMobile ? "min-w-[500px]" : "min-w-[750px]") :
                                            (isMobile ? "min-w-[300px]" : "")
                                )}>
                                    {view === 'month' ? (
                                        // MONTH VIEW - Calendar Style
                                        <>
                                            {/* Month Header - Days of Week */}
                                            <div className="grid grid-cols-7 border-b bg-slate-50">
                                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => (
                                                    <div key={idx} className="p-1 sm:p-2 text-center border-r last:border-r-0 text-[10px] sm:text-xs font-medium text-slate-600">
                                                        {day}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Month Grid - 6 weeks */}
                                            <div className="grid grid-cols-7">
                                                {weekDays.map((day, dayIdx) => {
                                                    const dayEvents = events.filter(e => isSameDay(e.start, day));
                                                    const isCurrentMonth = isSameMonth(day, date);

                                                    return (
                                                        <div
                                                            key={dayIdx}
                                                            className={cn(
                                                                "min-h-[100px] p-2 border-b border-r last:border-r-0 hover:bg-slate-50 transition-colors cursor-pointer group",
                                                                !isCurrentMonth && "bg-slate-50/50",
                                                                isToday(day) && "bg-emerald-50"
                                                            )}
                                                            onClick={() => {
                                                                resetForm();
                                                                setFormData({
                                                                    ...formData,
                                                                    date: format(day, 'yyyy-MM-dd')
                                                                });
                                                                setIsCreateOpen(true);
                                                            }}
                                                        >
                                                            {/* Day Number */}
                                                            <div className={cn(
                                                                "text-xs sm:text-sm font-bold mb-1",
                                                                isToday(day) ? "text-emerald-600" : isCurrentMonth ? "text-slate-700" : "text-slate-400"
                                                            )}>
                                                                {format(day, 'd')}
                                                            </div>

                                                            {/* Events List */}
                                                            <div className="space-y-1">
                                                                {dayEvents.slice(0, 3).map(event => (
                                                                    <div
                                                                        key={event.id}
                                                                        onClick={(e) => { e.stopPropagation(); handleEdit(event); }}
                                                                        className={cn(
                                                                            "px-1 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-xs truncate border-l-2",
                                                                            getStatusColor(event.status)
                                                                        )}
                                                                        title={`${format(event.start, 'HH:mm')} - ${event.client}: ${event.title}`}
                                                                    >
                                                                        <div className="flex items-center gap-1">
                                                                            <Clock size={10} />
                                                                            <span className="font-medium">{format(event.start, 'HH:mm')}</span>
                                                                            <span className="truncate">{event.client}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {dayEvents.length > 3 && (
                                                                    <div className="text-xs text-slate-500 px-2">
                                                                        +{dayEvents.length - 3} mais
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Add button on hover (month) */}
                                                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-1 right-1">
                                                                <Button size="icon" variant="ghost" className="h-5 w-5 rounded-full bg-slate-200 hover:bg-emerald-100 text-slate-600 hover:text-emerald-600">
                                                                    <Plus size={10} />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    ) : (
                                        // DAY/WEEK VIEW - Time Slots
                                        <>
                                            {/* Header Row */}
                                            <div className={cn(
                                                "grid border-b bg-slate-50",
                                                view === 'day' ? "grid-cols-[50px_1fr] sm:grid-cols-[60px_1fr]" : "grid-cols-[50px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)]"
                                            )}>
                                                <div className="p-1 sm:p-2 border-r" />
                                                {weekDays.map((day, idx) => (
                                                    <div key={idx} className={cn(
                                                        "p-2 text-center border-r last:border-r-0",
                                                        isToday(day) && "bg-emerald-50"
                                                    )}>
                                                        <div className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase">
                                                            {format(day, 'EEE', { locale: ptBR })}
                                                        </div>
                                                        <div className={cn(
                                                            "text-base sm:text-lg font-bold mt-0.5",
                                                            isToday(day) ? "text-emerald-600" : "text-slate-700"
                                                        )}>
                                                            {format(day, 'd')}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Time Slots */}
                                            {timeSlots.map(hour => (
                                                <div key={hour} className={cn(
                                                    "grid border-b min-h-[80px]",
                                                    view === 'day' ? "grid-cols-[50px_1fr] sm:grid-cols-[60px_1fr]" : "grid-cols-[50px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)]"
                                                )}>
                                                    {/* Time Label */}
                                                    <div className="p-1 sm:p-2 text-right border-r bg-slate-50/50">
                                                        <span className="text-[10px] sm:text-sm font-medium text-slate-500">
                                                            {hour}:00
                                                        </span>
                                                    </div>

                                                    {/* Day Columns */}
                                                    {weekDays.map((day, dayIdx) => {
                                                        const dayEvents = events.filter(e =>
                                                            isSameDay(e.start, day) && e.start.getHours() === hour
                                                        );

                                                        return (
                                                            <div
                                                                key={dayIdx}
                                                                className={cn(
                                                                    "relative p-1 border-r last:border-r-0 hover:bg-slate-50 transition-colors cursor-pointer group",
                                                                    isToday(day) && "bg-emerald-50/30"
                                                                )}
                                                                onClick={() => {
                                                                    resetForm();
                                                                    setFormData({
                                                                        ...formData,
                                                                        date: format(day, 'yyyy-MM-dd'),
                                                                        start_time: `${hour.toString().padStart(2, '0')}:00`,
                                                                        end_time: `${(hour + 1).toString().padStart(2, '0')}:00`
                                                                    });
                                                                    setIsCreateOpen(true);
                                                                }}
                                                            >
                                                                {dayEvents.map(event => (
                                                                    <div
                                                                        key={event.id}
                                                                        onClick={(e) => { e.stopPropagation(); handleEdit(event); }}
                                                                        className={cn(
                                                                            "p-1.5 sm:p-2 rounded-md mb-1 text-[10px] sm:text-xs border-l-[3px] shadow-sm cursor-pointer hover:shadow-md transition-all group/card",
                                                                            getStatusColor(event.status)
                                                                        )}
                                                                    >
                                                                        <div className="font-bold truncate">{event.client}</div>
                                                                        <div className="text-xs opacity-80 truncate">{event.title}</div>
                                                                        <div className="flex items-center gap-1 mt-1 text-[10px] opacity-70">
                                                                            <Clock size={10} />
                                                                            <span>{format(event.start, 'HH:mm')}</span>
                                                                        </div>

                                                                        {/* Quick Actions - Show on Hover */}
                                                                        {event.status === 'scheduled' && (
                                                                            <div className="opacity-0 group-hover/card:opacity-100 transition-opacity flex gap-1 mt-1">
                                                                                <Button
                                                                                    size="icon"
                                                                                    variant="ghost"
                                                                                    className="h-5 w-5 bg-emerald-500 hover:bg-emerald-600 text-white"
                                                                                    onClick={(e) => { e.stopPropagation(); handleQuickStatusChange(event.id, 'confirmed'); }}
                                                                                    title="Confirmar"
                                                                                >
                                                                                    <CheckCircle2 size={12} />
                                                                                </Button>
                                                                                <Button
                                                                                    size="icon"
                                                                                    variant="ghost"
                                                                                    className="h-5 w-5 bg-rose-500 hover:bg-rose-600 text-white"
                                                                                    onClick={(e) => { e.stopPropagation(); handleQuickStatusChange(event.id, 'cancelled'); }}
                                                                                    title="Cancelar"
                                                                                >
                                                                                    <XCircle size={12} />
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}

                                                                {/* Add button on hover */}
                                                                <div className="opacity-0 group-hover:opacity-100 absolute bottom-1 right-1">
                                                                    <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full bg-slate-200 hover:bg-emerald-100 text-slate-600 hover:text-emerald-600">
                                                                        <Plus size={12} />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
                </ScrollArea>
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedEventId ? 'Editar' : 'Novo'} Agendamento</DialogTitle>
                        <DialogDescription>
                            Preencha os dados do agendamento
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Título / Motivo *</Label>
                            <Input
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Ex: Consulta, Reunião..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Cliente</Label>
                                <Input
                                    value={formData.client_name}
                                    onChange={e => setFormData({ ...formData, client_name: e.target.value })}
                                    placeholder="Nome do cliente"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Telefone</Label>
                                <Input
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Data *</Label>
                                <Input
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Início *</Label>
                                <Input
                                    type="time"
                                    value={formData.start_time}
                                    onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Fim *</Label>
                                <Input
                                    type="time"
                                    value={formData.end_time}
                                    onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Responsável</Label>
                            <Select value={formData.responsible_id} onValueChange={v => setFormData({ ...formData, responsible_id: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Nenhum</SelectItem>
                                    {professionals.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedEventId && (
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="scheduled">Agendado</SelectItem>
                                        <SelectItem value="confirmed">Confirmado</SelectItem>
                                        <SelectItem value="in_progress">Em Andamento</SelectItem>
                                        <SelectItem value="completed">Completado</SelectItem>
                                        <SelectItem value="cancelled">Cancelado</SelectItem>
                                        <SelectItem value="no_show">Não Compareceu</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Observações</Label>
                            <Textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Detalhes adicionais..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleCreateOrUpdate} disabled={isLoading}>
                            {isLoading ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SmartAgenda;
