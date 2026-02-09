import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    CalendarDays,
    Stethoscope,
    Building2,
    Search,
    UserCheck,
    FileText,
    Sparkles,
    Filter
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
type EventType = 'consultation' | 'return' | 'exam' | 'procedure' | 'emergency';

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
    insurance?: string;
    professionalColor?: string;
    responsibleId?: number;
}

const timeSlots = Array.from({ length: 15 }, (_, i) => i + 6); // 6h às 21h

const ClinicalAgenda = () => {
    const { token } = useAuth();
    const { toast } = useToast();

    // State
    const [date, setDate] = useState<Date>(new Date());
    const [view, setView] = useState<ViewMode>('week');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [events, setEvents] = useState<AgendaEvent[]>([]);
    const [professionals, setProfessionals] = useState<any[]>([]);
    const [selectedProfessional, setSelectedProfessional] = useState<string>("all");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        client_name: '',
        phone: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '09:00',
        end_time: '09:30',
        type: 'consultation',
        responsible_id: '',
        insurance: 'Particular',
        description: '',
        status: 'scheduled'
    });

    // Detect mobile
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Fetch Data
    const fetchAppointments = async () => {
        if (!token) return;

        try {
            let start, end;

            // Calculate range in LOCAL time first
            if (view === 'day') {
                start = startOfDay(date);
                end = endOfDay(date);
            } else if (view === 'week') {
                start = startOfWeek(date, { weekStartsOn: 0 });
                end = endOfWeek(date, { weekStartsOn: 0 });
            } else {
                const monthStart = startOfMonth(date);
                const monthEnd = endOfMonth(date);
                start = startOfWeek(monthStart, { weekStartsOn: 0 });
                end = endOfWeek(monthEnd, { weekStartsOn: 0 });
            }

            // Convert to UTC ISO Strings for the query
            // If local is 00:00, ISO is 03:00Z (in BRT).
            // This queries the database for events falling within the user's local day interval.
            const startStr = start.toISOString();
            const endStr = end.toISOString();

            // To be safe and avoid edge cases with timezones or week overlaps, let's buffer.
            // Actually, best is to just fetch the whole month surrounding the date, OR if week overlaps months, fetch both.
            // Simpler strategy: Always fetch from 'startOfWeek(startOfMonth(date))' to 'endOfWeek(endOfMonth(date))'? 
            // Let's stick to the exact view needed.

            // Correction: If week overlaps months (e.g. Fed 28 - Mar 5), and date is Feb 28.
            // startOfMonth(Feb 28) = Feb 1. endOfMonth(Feb 28) = Feb 28.
            // Events on Mar 1-5 will NOT be fetched if we reused month logic.
            // So we MUST respect the view.

            // Revised logic above (if/else) handles this correctly for Week view.

            const params = new URLSearchParams({ start: startStr, end: endStr });
            if (selectedProfessional !== 'all') params.append('responsible_id', selectedProfessional);

            const res = await fetch(`/api/crm/appointments?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to fetch');

            const data = await res.json();

            console.log("--- FRONTEND FETCH DEBUG ---");
            console.log("Range:", start, end);
            console.log("Fetched Events Count:", data.length);
            console.log("Fetched Data Sample:", data[0]);

            const parsedEvents: AgendaEvent[] = Array.isArray(data) ? data.map((item: any) => ({
                id: item.id,
                title: item.title,
                client: item.client,
                whatsapp: item.whatsapp,
                // Backend is now expected to return ISO strings (Z). new Date() handles Z correctly.
                start: new Date(item.start),
                end: new Date(item.end),
                status: item.status,
                type: item.type,
                responsible: item.responsible,
                professionalColor: item.professionalColor,
                insurance: item.insurance_plan_id || 'Particular', // Map or fallback
                description: item.description
            })) : [];

            setEvents(parsedEvents);

        } catch (error) {
            console.error("Error fetching appointments:", error);
            // Don't clear events on error to allow offline/optimistic feel or just keep old data
        }
    };

    useEffect(() => {
        fetchAppointments();
    }, [token, date, view, selectedProfessional]); // Refetch when view context changes

    // Initial reference data (Mock for professionals for now as requested limit to appointments logic, 
    // but we can fetch real professionals if the endpoint exists. Keeping mock for stability as per instruction).
    useEffect(() => {
        setProfessionals([
            { id: '1', name: 'Dr. André', specialty: 'Cardiologia', color: 'blue' },
            { id: '2', name: 'Dra. Eliana', specialty: 'Dermatologia', color: 'purple' },
            { id: '3', name: 'Lab-A1', specialty: 'Exames', color: 'emerald' },
        ]);
    }, []);

    const handleSaveEvent = async () => {
        if (!formData.client_name) {
            toast({ title: "Erro", description: "Informe o nome do paciente.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            // USER REQUIREMENT: Save dates in UTC (ISO 8601)
            // 1. Create a Date object representing the selected LOCAL time.
            // Note: "YYYY-MM-DD" + "T" + "HH:MM" constructor in JS creates a local date.
            const localDate = new Date(`${formData.date}T${formData.start_time}:00`);

            const durationMinutes = parseInt(formData.end_time) || 30;
            const localEndDate = new Date(localDate.getTime() + durationMinutes * 60000);

            // 2. Convert to UTC ISO String for the backend
            // This ensures "09:00" in Brasilia (-3) becomes "12:00Z" in the database.
            const startIso = localDate.toISOString();
            const endIso = localEndDate.toISOString();

            const payload = {
                title: formData.title || (formData.type === 'consultation' ? 'Consulta' : 'Atendimento'),
                client_name: formData.client_name,
                phone: formData.phone,
                start_time: startIso,
                end_time: endIso,
                type: formData.type,
                status: formData.status,
                description: `${formData.description || ''} \n[Convênio: ${formData.insurance}]`.trim(),

                responsible_id: (formData.responsible_id && formData.responsible_id !== 'any') ? parseInt(formData.responsible_id) : (selectedProfessional !== 'all' ? parseInt(selectedProfessional) : null)
            };

            console.log("--- FRONTEND CREATE DEBUG ---");
            console.log("Sending Payload:", payload);

            const res = await fetch('/api/crm/appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.text();
                console.error("Create failed:", err);
                throw new Error('Falha ao criar agendamento');
            }

            const newEvent = await res.json();
            console.log("Create Response:", newEvent);

            toast({ title: "Sucesso", description: "Agendamento criado com sucesso!" });

            // Immediately refetch to update the UI
            await fetchAppointments();

            setIsCreateOpen(false);
            resetForm();
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Não foi possível criar o agendamento.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            client_name: '',
            phone: '',
            date: format(date, 'yyyy-MM-dd'),
            start_time: '09:00',
            end_time: '30',
            type: 'consultation',
            responsible_id: selectedProfessional !== 'all' ? selectedProfessional : '',
            insurance: 'Particular',
            description: '',
            status: 'scheduled'
        });
        setSelectedEventId(null);
    };

    const getStatusColor = (status: EventStatus) => {
        const colors = {
            scheduled: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
            confirmed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
            in_progress: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
            completed: 'bg-slate-100 text-slate-600 border-slate-200',
            cancelled: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
            no_show: 'bg-orange-500/10 text-orange-600 border-orange-500/20'
        };
        return colors[status] || colors.scheduled;
    };

    const getTypeColor = (type: EventType) => {
        const colors = {
            consultation: 'bg-blue-600',
            return: 'bg-emerald-500',
            exam: 'bg-amber-500',
            procedure: 'bg-purple-600',
            emergency: 'bg-red-600'
        };
        return colors[type] || 'bg-slate-500';
    };

    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date, { weekStartsOn: 0 }), i));

    return (
        <div className="flex-1 flex flex-col bg-[#F8FAFC] dark:bg-slate-950 overflow-hidden font-sans min-h-0">
            {/* TOP BAR / NAVIGATION */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5 p-4 shrink-0 transition-all">
                <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl sm:rounded-2xl p-0.5 sm:p-1 gap-0.5 sm:gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl hover:bg-white dark:hover:bg-slate-700 shadow-none transition-all" onClick={() => setDate(subMonths(date, 1))}>
                                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                            </Button>
                            <div className="px-2 sm:px-4 text-[11px] sm:text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[100px] sm:min-w-[150px] text-center">
                                {format(date, "MMMM yyyy", { locale: ptBR })}
                            </div>
                            <Button size="icon" variant="ghost" className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl hover:bg-white dark:hover:bg-slate-700 shadow-none transition-all" onClick={() => setDate(addMonths(date, 1))}>
                                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                                <SelectTrigger className="w-[150px] sm:w-[200px] h-9 sm:h-10 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-semibold text-slate-700 dark:text-slate-200">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <Stethoscope className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                                        <SelectValue placeholder="Profissional" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                                    <SelectItem value="all">Todos Profissionais</SelectItem>
                                    {professionals.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.specialty})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)} className="bg-slate-100 dark:bg-slate-800 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl">
                            <TabsList className="bg-transparent border-none gap-0.5 sm:gap-1 h-8 sm:h-9">
                                <TabsTrigger value="day" className="h-7 sm:h-8 rounded-lg sm:rounded-xl px-2 sm:px-4 text-[10px] sm:text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">Dia</TabsTrigger>
                                <TabsTrigger value="week" className="h-7 sm:h-8 rounded-lg sm:rounded-xl px-2 sm:px-4 text-[10px] sm:text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">Semana</TabsTrigger>
                                <TabsTrigger value="month" className="h-7 sm:h-8 rounded-lg sm:rounded-xl px-2 sm:px-4 text-[10px] sm:text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">Mês</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="w-px h-8 bg-slate-200 dark:bg-white/10 mx-1 hidden sm:block" />

                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 sm:h-10 px-3 sm:px-5 rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs"
                            onClick={() => { resetForm(); setIsCreateOpen(true); }}
                        >
                            <Plus className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Novo Agendamento</span><span className="sm:hidden">Novo</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* MAIN AGENDA AREA */}
            <div className="flex-1 flex overflow-hidden">
                {/* CALENDAR VIEW */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950 p-2 sm:p-6">
                    <div className="max-w-[1600px] mx-auto">

                        {/* MONTH VIEW GRID */}
                        {view === 'month' ? (
                            <div className="grid grid-cols-7 border border-slate-200 dark:border-white/5 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-slate-900">
                                {/* Weekday Headers */}
                                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].map((d, i) => (
                                    <div key={d} className="h-8 sm:h-12 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-white/5 font-black text-[10px] sm:text-xs text-slate-400 uppercase tracking-widest">
                                        {d}
                                    </div>
                                ))}

                                {/* Days Grid */}
                                {(() => {
                                    const monthStart = startOfMonth(date);
                                    const monthEnd = endOfMonth(date);
                                    const startDate = startOfWeek(monthStart);
                                    const endDate = endOfWeek(monthEnd);
                                    const monthDays = eachDayOfInterval({ start: startDate, end: endDate });

                                    return monthDays.map((day, idx) => {
                                        const isCurrentMonth = isSameMonth(day, date);
                                        const dayEvents = events.filter(e => isSameDay(e.start, day));

                                        return (
                                            <div
                                                key={idx}
                                                className={cn(
                                                    "min-h-[100px] sm:min-h-[140px] border-b border-r border-slate-200 dark:border-white/5 p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 flex flex-col gap-1",
                                                    !isCurrentMonth && "bg-slate-50/50 dark:bg-slate-900/50 opacity-40",
                                                    isToday(day) && "bg-blue-50/30 dark:bg-blue-900/10"
                                                )}
                                                onClick={() => { setDate(day); setView('day'); }}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className={cn(
                                                        "text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full",
                                                        isToday(day) ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "text-slate-700 dark:text-slate-300"
                                                    )}>
                                                        {format(day, 'd')}
                                                    </span>
                                                    {dayEvents.length > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">{dayEvents.length}</Badge>}
                                                </div>

                                                <div className="flex-1 flex flex-col gap-1 mt-1 overflow-y-auto custom-scrollbar">
                                                    {dayEvents.slice(0, 3).map(ev => (
                                                        <div key={ev.id} className={cn("text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded border truncate font-bold", getStatusColor(ev.status))}>
                                                            {format(ev.start, 'HH:mm')} {ev.client.split(' ')[0]}
                                                        </div>
                                                    ))}
                                                    {dayEvents.length > 3 && (
                                                        <div className="text-[9px] text-slate-400 pl-1 font-medium">
                                                            + {dayEvents.length - 3} mais
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        ) : (
                            /* DAY & WEEK VIEW (TIME SLOTS) */
                            <div className="grid grid-cols-[50px_1fr] sm:grid-cols-[80px_1fr] border border-slate-200 dark:border-white/5 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-slate-900">
                                {/* Time Labels Column */}
                                <div className="bg-slate-50 dark:bg-slate-900/80 border-r border-slate-200 dark:border-white/5">
                                    <div className="h-12 sm:h-20 flex items-center justify-center border-b border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-slate-800">
                                        <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" />
                                    </div>
                                    {timeSlots.map(h => (
                                        <div key={h} className="h-16 sm:h-24 flex items-center justify-center text-[9px] sm:text-[11px] font-bold text-slate-500 font-mono border-b border-white/5">
                                            {h}:00
                                        </div>
                                    ))}
                                </div>

                                {/* Days Columns */}
                                <div className={cn(
                                    "flex-1",
                                    view === 'week' ? "grid grid-cols-7 w-full" : "flex w-full"
                                )}>
                                    {(view === 'day' ? [date] : weekDays).map((day, idx) => (
                                        <div key={idx} className={cn(
                                            "border-r border-slate-200 dark:border-white/5 last:border-r-0 relative",
                                            view === 'day' ? "flex-1" : "min-w-0",
                                            isToday(day) && "bg-blue-50/20 dark:bg-blue-900/5 shadow-inner"
                                        )}>
                                            {/* Day Header */}
                                            <div className={cn(
                                                "h-12 sm:h-20 flex flex-col items-center justify-center gap-0.5 sm:gap-1 border-b border-slate-200 dark:border-white/5 transition-colors",
                                                isToday(day) ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                            )}>
                                                <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">{format(day, 'EEE', { locale: ptBR })}</span>
                                                <span className="text-sm sm:text-xl font-black">{format(day, 'd')}</span>
                                            </div>

                                            {/* Slots Container */}
                                            <div className="relative h-full bg-[size:100%_64px] sm:bg-[size:100%_96px] bg-[linear-gradient(to_bottom,transparent_95%,rgba(0,0,0,0.02)_100%)]">
                                                {/* Render events for this day */}
                                                {events.filter(e => isSameDay(e.start, day)).map(event => {
                                                    const slotHeight = isMobile ? 64 : 96;
                                                    const startPos = (event.start.getHours() - 6) * slotHeight + (event.start.getMinutes() / 60) * slotHeight;
                                                    const duration = (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60);
                                                    return (
                                                        <div
                                                            key={event.id}
                                                            className={cn(
                                                                "absolute left-1 sm:left-2 right-1 sm:right-2 p-1 sm:p-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs flex flex-col gap-0.5 sm:gap-1 shadow-sm border-l-4 transition-all hover:scale-[1.02] hover:shadow-xl cursor-pointer group z-10",
                                                                getStatusColor(event.status),
                                                                `border-l-${getTypeColor(event.type)}`
                                                            )}
                                                            style={{ top: `${startPos}px`, height: `${duration * slotHeight}px` }}
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <span className="font-bold truncate">{event.client}</span>
                                                                <Badge className="bg-white/50 text-[8px] h-4 px-1 border-none text-slate-600 uppercase font-black">{event.insurance}</Badge>
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[9px] font-bold opacity-60">
                                                                <Clock className="w-2.5 h-2.5" /> {format(event.start, 'HH:mm')} - {event.responsible}
                                                            </div>

                                                            {/* Quick Actions (Hover) */}
                                                            <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button className="p-1 bg-white dark:bg-slate-800 rounded-full shadow-md text-emerald-500 hover:scale-110"><MessageCircle size={12} /></button>
                                                                <button className="p-1 bg-white dark:bg-slate-800 rounded-full shadow-md text-blue-500 hover:scale-110"><FileText size={12} /></button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Empty Slots clickable areas */}
                                                {timeSlots.map(h => (
                                                    <div key={h} className="h-16 sm:h-24 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition-colors" onClick={() => {
                                                        setFormData({
                                                            ...formData,
                                                            date: format(day, 'yyyy-MM-dd'),
                                                            start_time: `${h.toString().padStart(2, '0')}:00`,
                                                            end_time: `${h.toString().padStart(2, '0')}:30`
                                                        });
                                                        setIsCreateOpen(true);
                                                    }} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* SIDEBAR - ACTION CENTER (IA & ANALYTICS) */}
                <div className="w-[300px] border-l border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900 p-6 hidden xl:flex flex-col gap-6 overflow-y-auto">
                    <Card className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-none shadow-xl rounded-3xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12"><Sparkles size={100} /></div>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 italic">IA Clínica Assistant</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-2">
                            <p className="text-[11px] leading-relaxed text-blue-100">
                                "Sua agenda para amanhã está com 30% de janelas. Recomendo disparar campanhas de retorno para pacientes com +6 meses sem visita."
                            </p>
                            <Button className="w-full h-8 bg-white text-blue-600 hover:bg-white/90 text-[10px] font-bold rounded-xl border-none">
                                Analisar Pacientes
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atendimento em Tempo Real</h4>
                        {[
                            { name: "Mariana Silva", status: "Aguardando", wait: "12min", color: "amber" },
                            { name: "Carlos Eduardo", status: "Em Consulta", wait: "05min", color: "emerald" },
                        ].map((p, i) => (
                            <div key={i} className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-white/5 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{p.name}</span>
                                    <Badge className={`bg-${p.color}-500/10 text-${p.color}-600 border-none text-[8px] font-black`}>{p.status}</Badge>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                    <span className="flex items-center gap-1"><Clock size={10} /> Espera: {p.wait}</span>
                                    <Button variant="ghost" size="sm" className="h-6 text-[9px] hover:text-blue-500">Chamar</Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Card className="mt-auto bg-slate-100 dark:bg-slate-800 border-none rounded-3xl">
                        <CardHeader className="p-4 pb-0">
                            <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumo do Dia</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 py-3 space-y-2">
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Agendados:</span> <span className="font-bold text-slate-700 dark:text-slate-200">22</span></div>
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Confirmados:</span> <span className="font-bold text-emerald-500">18</span></div>
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Faltas:</span> <span className="font-bold text-rose-500">02</span></div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* CREATE EVENT DIALOG (MODAL) */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[550px] bg-white dark:bg-slate-900 border-none shadow-2xl rounded-[32px] p-8 max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="mb-6">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
                            <CalendarIcon className="w-6 h-6" />
                        </div>
                        <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white">Novo Agendamento Clínico</DialogTitle>
                        <DialogDescription className="text-slate-500">Configure o horário e dados do paciente para reserva.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase text-slate-400">Paciente / Nome Completo *</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input
                                    value={formData.client_name}
                                    onChange={e => setFormData({ ...formData, client_name: e.target.value })}
                                    placeholder="Buscar paciente cadastrado..."
                                    className="pl-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                                />
                                <Button variant="ghost" size="sm" className="absolute right-2 top-1.5 h-7 text-[10px] font-bold text-blue-600"><Plus className="w-3 h-3 mr-1" /> Novo</Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-slate-400">Procedimento / Especialidade *</Label>
                                <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v as any })}>
                                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-medium">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-900">
                                        <SelectItem value="consultation">Consulta de Rotina</SelectItem>
                                        <SelectItem value="return">Retorno</SelectItem>
                                        <SelectItem value="exam">Exame / Laudo</SelectItem>
                                        <SelectItem value="procedure">Pequena Cirurgia / Procedimento</SelectItem>
                                        <SelectItem value="emergency">Emergência / Encaixe</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-slate-400">Profissional</Label>
                                <Select value={formData.responsible_id} onValueChange={v => setFormData({ ...formData, responsible_id: v })}>
                                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-medium">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-900">
                                        <SelectItem value="any">Qualquer / Sem Preferência</SelectItem>
                                        {professionals.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-slate-400">Convênio / Pagamento *</Label>
                                <Select value={formData.insurance} onValueChange={v => setFormData({ ...formData, insurance: v })}>
                                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-medium">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-900">
                                        <SelectItem value="Particular">Particular / Dinheiro</SelectItem>
                                        <SelectItem value="Unimed">Unimed</SelectItem>
                                        <SelectItem value="Bradesco">Bradesco Saúde</SelectItem>
                                        <SelectItem value="Amil">Amil</SelectItem>
                                        <SelectItem value="SulAmérica">SulAmérica</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-slate-400">Data</Label>
                                <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-none" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-slate-400">Início</Label>
                                <Input type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-none" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-slate-400">Duração</Label>
                                <Select value={formData.end_time} onValueChange={v => setFormData({ ...formData, end_time: v })}>
                                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-medium">
                                        <SelectValue placeholder="30 min" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-900">
                                        <SelectItem value="30">30 min</SelectItem>
                                        <SelectItem value="45">45 min</SelectItem>
                                        <SelectItem value="60">1 hora</SelectItem>
                                        <SelectItem value="120">2 horas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase text-slate-400">Observações Clínicas (Opzional)</Label>
                            <Textarea
                                placeholder="Relate queixas principais ou avisos para o médico..."
                                className="rounded-2xl bg-slate-50 dark:bg-slate-800 border-none resize-none min-h-[100px]"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-8 gap-3 sm:gap-0">
                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="rounded-xl h-12 font-bold text-slate-500">Cancelar</Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 px-8 font-black shadow-xl shadow-blue-500/20"
                            onClick={handleSaveEvent}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Salvando...' : 'Finalizar Agendamento'}
                        </Button>
                    </DialogFooter>
                </DialogContent >
            </Dialog >
        </div >
    );
};

export default ClinicalAgenda;
