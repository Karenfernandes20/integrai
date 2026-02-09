import { CompanySummary } from "@/types";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ptBR } from "date-fns/locale";
import {
    Users,
    Calendar,
    Activity,
    Clock,
    UserCheck,
    AlertCircle,
    TrendingUp,
    Target,
    UserMinus,
    DollarSign,
    Sparkles,
    ChevronRight,
    Stethoscope,
    Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface ClinicalDashboardProps {
    company: CompanySummary;
}

export const ClinicalDashboard = ({ company }: ClinicalDashboardProps) => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [financials, setFinancials] = useState<any>(null);
    const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            try {
                const now = new Date();
                const today = now.toISOString().split('T')[0];
                const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const startMonthStr = startMonth.toISOString().split('T')[0];

                // 1. BI Stats (Month)
                const biRes = await fetch(`/api/crm/clinical-bi?start=${startMonthStr}&end=${today}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const biData = await biRes.json();
                setStats(biData);

                // 2. Financials (Month)
                const finRes = await fetch(`/api/finance/clinical/dashboard?startDate=${startMonthStr}&endDate=${today}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const finData = await finRes.json();
                setFinancials(finData);

                // 3. Today's Appointments
                const todayRes = await fetch(`/api/crm/appointments?start=${today}T00:00:00&end=${today}T23:59:59`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                let todayApps = [];
                if (todayRes.ok) {
                    const data = await todayRes.json();
                    if (Array.isArray(data)) todayApps = data;
                }
                setTodayAppointments(todayApps);

                // 4. Alerts (Overdue Receivables)
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                const alertsRes = await fetch(`/api/finance/clinical/transactions?status=pending&type=receivable&endDate=${yesterdayStr}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                let alertsData = [];
                if (alertsRes.ok) {
                    const data = await alertsRes.json();
                    if (Array.isArray(data)) alertsData = data;
                }
                setAlerts(alertsData);

                setIsLoading(false);
            } catch (e) {
                console.error(e);
                setIsLoading(false);
                setTodayAppointments([]);
            }
        };

        fetchData();
    }, [token]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-2 text-slate-500">Carregando painel clínico...</span>
            </div>
        );
    }

    // Calculations
    const todayDate = new Date().toISOString().split('T')[0];
    const todayStat = stats?.dailyStats?.find((d: any) => d.date.startsWith(todayDate));
    const todayRevenue = todayStat ? Number(todayStat.revenue) : 0;

    // KPIs
    const totalAppointments = Number(stats?.kpis?.total_appointments || 0);
    const noShows = Number(stats?.kpis?.no_shows || 0);
    const noShowRate = totalAppointments > 0 ? (noShows / totalAppointments) * 100 : 0;

    const ticketAverage = Number(financials?.summary?.ticket_average || 0);

    const capacity = 40; // Mock daily capacity
    const dailyOccupancy = Math.min((todayAppointments.length / capacity) * 100, 100);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-10">
            {/* TOP HEADER SECTION */}
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between bg-white dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
                        <Stethoscope className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Painel de Gestão Clínica</h1>
                        <p className="text-slate-500 text-sm flex items-center gap-1.5">
                            Centro de comando para <span className="font-semibold text-blue-600 dark:text-blue-400">{company.name}</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        className="rounded-xl h-11 px-6 font-semibold border-slate-200 hover:bg-slate-50 transition-all"
                        onClick={() => navigate('/app/agenda')}
                    >
                        <Calendar className="mr-2 h-4 w-4" />
                        Agenda Completa
                    </Button>
                    <Button
                        className="rounded-xl h-11 px-6 font-semibold bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/10 transition-all border-none"
                        onClick={() => navigate('/app/contatos')}
                    >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Cadastrar Paciente
                    </Button>
                </div>
            </div>

            {/* HIGH-LEVEL KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-none shadow-sm bg-blue-600 text-white overflow-hidden relative group cursor-pointer" onClick={() => navigate('/app/financeiro')}>
                    <div className="absolute right-[-20px] top-[-20px] opacity-10 group-hover:scale-110 transition-transform">
                        <DollarSign size={160} />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-blue-100 font-medium">Receita Hoje (Agenda)</CardDescription>
                        <CardTitle className="text-3xl font-bold leading-none">{formatCurrency(todayRevenue)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1.5 text-blue-100 text-xs font-medium">
                            <TrendingUp className="h-3.5 w-3.5" />
                            <span>{todayAppointments.length} agendamentos hoje</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 cursor-pointer" onClick={() => navigate('/app/agenda')}>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-medium flex justify-between items-center">
                            Ocupação Hoje
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold">
                                {dailyOccupancy > 80 ? 'Alta' : dailyOccupancy > 50 ? 'Média' : 'Baixa'}
                            </Badge>
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold text-slate-900 dark:text-white">{dailyOccupancy.toFixed(0)}%</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Progress value={dailyOccupancy} className="h-1.5 bg-slate-100 dark:bg-slate-800" />
                        <p className="text-[10px] text-slate-400 font-medium">{todayAppointments.length} pacientes agendados</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 cursor-pointer" onClick={() => navigate('/app/bi-clinico')}>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-medium">Taxa de No-Show (Mês)</CardDescription>
                        <CardTitle className="text-3xl font-bold text-slate-900 dark:text-white">{noShowRate.toFixed(1)}%</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                            <UserMinus className="h-3.5 w-3.5" />
                            <span>{noShows} faltas registradas</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 cursor-pointer" onClick={() => navigate('/app/financeiro')}>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-medium">Ticket Médio</CardDescription>
                        <CardTitle className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(ticketAverage)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold uppercase tracking-tighter">
                            <DollarSign className="h-3.5 w-3.5" />
                            <span>Por atendimento</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* MAIN CONTENT SPLIT */}
            <div className="grid lg:grid-cols-3 gap-8">

                {/* LEFT: TODAY'S AGENDA */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 dark:border-white/5 pb-6">
                            <div>
                                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-blue-500" />
                                    Fluxo de Pacientes (Hoje)
                                </CardTitle>
                                <CardDescription>{todayAppointments.length} consultas agendadas</CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                className="text-blue-600 font-semibold text-xs group"
                                onClick={() => navigate('/app/agenda')}
                            >
                                Ver todos <ChevronRight className="ml-1 h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-50 dark:divide-white/5">
                                {todayAppointments.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500 text-sm">
                                        Nenhum paciente agendado para hoje.
                                    </div>
                                ) : (
                                    todayAppointments.slice(0, 5).map((row, i) => (
                                        <div key={i} className="flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => navigate('/app/agenda')}>
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 text-xs uppercase">
                                                    {(row.client || row.title || '?').substring(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{row.client || row.title}</p>
                                                    <p className="text-xs text-slate-500">{row.responsible || 'Sem profissional'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                        {row.start ? format(new Date(row.start), 'HH:mm') : '--:--'}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Horário</p>
                                                </div>
                                                <Badge className={
                                                    row.status === 'confirmed' ? "bg-emerald-500/10 text-emerald-600" :
                                                        row.status === 'completed' ? "bg-blue-500/10 text-blue-600" :
                                                            row.status === 'no-show' ? "bg-red-500/10 text-red-600" :
                                                                "bg-slate-500/10 text-slate-600"
                                                }>
                                                    {row.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* BI CHART PREVIEW (Placeholder - Future Implementation) */}
                    <Card className="border-none shadow-sm bg-white dark:bg-slate-900 cursor-pointer" onClick={() => navigate('/app/bi-clinico')}>
                        <CardHeader>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-blue-500" />
                                Volume Mensal vs Faturamento
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[240px] flex items-center justify-center bg-slate-50 dark:bg-white/5 rounded-2xl m-6 border border-dashed border-slate-200">
                            {/* Ideally integrate Recharts later */}
                            <p className="text-slate-400 text-sm italic">Clique para ver o relatório completo de BI.</p>
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT: AI INSIGHTS & ALERTS */}
                <div className="space-y-6">
                    {/* IA Clinical Assistant */}
                    <Card className="border-none shadow-xl bg-gradient-to-br from-indigo-900 to-slate-950 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                            <Sparkles size={80} />
                        </div>
                        <CardHeader className="pb-3 border-b border-white/10">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Activity className="h-4 w-4 text-blue-400" />
                                IA Clínico Insights
                            </CardTitle>
                            <CardDescription className="text-slate-400">Análise inteligente da clínica</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            {todayAppointments.length > 0 && todayAppointments.some(a => a.status === 'no-show') && (
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors cursor-pointer ring-1 ring-inset ring-blue-500/20">
                                    <p className="text-xs font-bold text-blue-400 mb-1 flex items-center gap-1">
                                        <Target className="h-3 w-3" /> Atenção: Faltas
                                    </p>
                                    <p className="text-xs text-slate-200 leading-relaxed">
                                        Detectamos {todayAppointments.filter(a => a.status === 'no-show').length} faltas hoje. Deseja disparar automação de re-agendamento?
                                    </p>
                                    <Button
                                        size="sm"
                                        className="h-7 mt-2 text-[10px] bg-blue-600 hover:bg-blue-500 border-none font-bold"
                                        onClick={() => {
                                            toast.info("Iniciando automação de remarcação...");
                                            navigate('/app/atendimento');
                                        }}
                                    >
                                        Enviar Agora
                                    </Button>
                                </div>
                            )}

                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 opacity-70">
                                <p className="text-xs font-bold text-emerald-400 mb-1">Resumo Financeiro</p>
                                <p className="text-xs text-slate-300">
                                    Recebíveis em aberto (Ontem): {alerts.length}. Verifique o painel financeiro.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Operational Alerts */}
                    <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                                Alertas Financeiros
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {alerts.length === 0 ? (
                                <p className="text-xs text-slate-500 italic">Nenhum alerta pendente.</p>
                            ) : (
                                alerts.slice(0, 5).map((alert, i) => (
                                    <div
                                        key={i}
                                        className="flex gap-3 items-start group cursor-pointer"
                                        onClick={() => navigate('/app/financeiro')}
                                    >
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_red]" />
                                        <div>
                                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">
                                                {alert.description} - {formatCurrency(Number(alert.amount))}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                Vencido em: {alert.due_date ? format(new Date(alert.due_date), 'dd/MM') : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
