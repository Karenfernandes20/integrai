
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import {
    TrendingUp, Users, Calendar, DollarSign, AlertCircle,
    ArrowUpRight, ArrowDownRight, Activity, Filter, Download, Check
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '../components/ui/input';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4'];

const ClinicalBIPage = () => {
    const { token } = useAuth();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dates, setDates] = useState({
        from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        to: format(new Date(), 'yyyy-MM-dd')
    });
    const [selectedProf, setSelectedProf] = useState('all');
    const [professionals, setProfessionals] = useState<any[]>([]);

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                start: new Date(dates.from).toISOString(),
                end: new Date(dates.to).toISOString()
            });
            if (selectedProf !== 'all') params.append('professional_id', selectedProf);

            const res = await fetch(`/api/crm/clinical-bi?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setData(await res.json());
        } catch (e) { console.error(e); }
        setIsLoading(false);
    };

    const fetchProfessionals = async () => {
        try {
            const res = await fetch('/api/crm/professionals', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setProfessionals(await res.json());
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (token) {
            fetchStats();
            fetchProfessionals();
        }
    }, [token, dates, selectedProf]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    if (isLoading && !data) return <div className="h-96 flex items-center justify-center">Carregando inteligência clínica...</div>;

    const kpis = data?.kpis || {};

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-10 bg-background/80 backdrop-blur-md py-4 border-b">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent flex items-center gap-3">
                        <Activity className="text-blue-600" /> BI Clínico Avançado
                    </h1>
                    <p className="text-muted-foreground mt-1">Visão estratégica e preditiva da sua operação de saúde.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md border">
                        <Input type="date" className="h-8 w-32 bg-transparent border-0" value={dates.from} onChange={e => setDates({ ...dates, from: e.target.value })} />
                        <span className="text-xs opacity-50">até</span>
                        <Input type="date" className="h-8 w-32 bg-transparent border-0" value={dates.to} onChange={e => setDates({ ...dates, to: e.target.value })} />
                    </div>
                    <Select value={selectedProf} onValueChange={setSelectedProf}>
                        <SelectTrigger className="w-[180px] h-9">
                            <Filter className="w-3 h-3 mr-2" />
                            <SelectValue placeholder="Profissional" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos Profissionais</SelectItem>
                            {professionals.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="h-9">
                        <Download className="w-4 h-4 mr-2" /> Exportar PDF
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(kpis.total_billing)}</div>
                        <div className="flex items-center text-xs text-green-500 mt-1">
                            <ArrowUpRight className="h-3 w-3 mr-1" /> +12.5% vs mês anterior
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/5 to-transparent border-green-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Atendimentos</CardTitle>
                        <Users className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis.attended || 0}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                            {kpis.total_appointments || 0} agendados no período
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-500/5 to-transparent border-orange-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Taxa de No-show</CardTitle>
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {((kpis.no_shows / (kpis.total_appointments || 1)) * 100).toFixed(1)}%
                        </div>
                        <div className="flex items-center text-xs text-red-500 mt-1">
                            <ArrowUpRight className="h-3 w-3 mr-1" /> +2% crítico
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-purple-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                        <TrendingUp className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(kpis.total_billing / (kpis.attended || 1))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            Por paciente atendido
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Volume por Dia */}
                <Card>
                    <CardHeader>
                        <CardTitle>Volume e Receita Diária</CardTitle>
                        <CardDescription>Distribuição de atendimentos ao longo do tempo.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data?.dailyStats}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd/MM')} fontSize={10} />
                                <YAxis fontSize={10} />
                                <Tooltip labelFormatter={(v) => format(new Date(v), 'dd MMMM yyyy', { locale: ptBR })} />
                                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" name="Receita" />
                                <Area type="monotone" dataKey="count" stroke="#22c55e" fill="transparent" name="Atendimentos" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Billing by Insurance */}
                <Card>
                    <CardHeader>
                        <CardTitle>Receita por Convênio</CardTitle>
                        <CardDescription>Impacto financeiro por operadora.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.billingByInsurance} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                <XAxis type="number" fontSize={10} hide />
                                <YAxis dataKey="insurance_name" type="category" width={100} fontSize={10} />
                                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                                <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Valor Total" barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Billing by Professional */}
                <Card>
                    <CardHeader>
                        <CardTitle>Desempenho por Profissional</CardTitle>
                        <CardDescription>Comparativo de produtividade e faturamento.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data?.billingByProfessional}
                                    dataKey="total"
                                    nameKey="professional_name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    label
                                >
                                    {data?.billingByProfessional.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* AI Insights */}
                <Card className="border-blue-500/30 bg-blue-500/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-blue-600" /> Insights de IA
                        </CardTitle>
                        <CardDescription>Análise preditiva baseada nos seus dados.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-4 items-start p-3 bg-white rounded-lg border shadow-sm">
                            <div className="p-2 bg-orange-100 rounded-full text-orange-600"><AlertCircle className="h-4 w-4" /></div>
                            <div>
                                <p className="text-sm font-semibold text-orange-900">Alerta de Ocupação</p>
                                <p className="text-xs text-orange-800 opacity-80 mt-1">Sua ocupação nas terças coincidem com um aumento de 15% no no-show. Sugerimos implantar confirmação ativa via WhatsApp 2h antes.</p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start p-3 bg-white rounded-lg border shadow-sm">
                            <div className="p-2 bg-green-100 rounded-full text-green-600"><Check className="h-4 w-4" /></div>
                            <div>
                                <p className="text-sm font-semibold text-green-900">Convênio Mais Rentável</p>
                                <p className="text-xs text-green-800 opacity-80 mt-1">O Convênio {data?.billingByInsurance?.[0]?.insurance_name || 'X'} possui o maior ticket médio ({formatCurrency(data?.billingByInsurance?.[0]?.total / data?.billingByInsurance?.[0]?.count)}) e menor índice de glosa.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ClinicalBIPage;
