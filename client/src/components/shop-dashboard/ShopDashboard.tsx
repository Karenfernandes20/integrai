
import React, { useEffect, useState } from 'react';
import { CompanySummary } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { DateRange } from 'react-day-picker';
// import { DateRangePicker } from '../ui/date-range-picker'; // If exists
import { Calendar as CalendarIcon, DollarSign, Package, ShoppingBag, Truck, Users, Activity, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";
import { formatCurrency } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../ui/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface ShopDashboardProps {
    company: CompanySummary;
}

interface DashboardData {
    summary: {
        sales_count: number;
        revenue: number;
        avg_ticket: number;
        pending_orders: number;
        overdue_receivables_count: number;
        overdue_receivables_value: number;
        critical_stock: number;
    };
    charts: {
        top_products: any[];
        payment_methods: any[];
    }
}

export function ShopDashboard({ company }: ShopDashboardProps) {
    const { token, user } = useAuth();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(false);
    // const [date, setDate] = useState<DateRange | undefined>({ from: new Date(), to: new Date() }); // Default today
    const [instanceId, setInstanceId] = useState<string | null>(null); // We need to resolve instance ID

    // Fetch Instance ID (Assuming first active instance or passed via props/context if refined)
    // For now, let's try to get it from company summary if available, or fetch instances
    const fetchInstance = async () => {
        try {
            const res = await fetch(`/api/companies/${company.id}/instances`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const instances = await res.json();
                if (instances.length > 0) {
                    // Pick the first connected one or just first
                    const connected = instances.find((i: any) => i.status === 'open' || i.status === 'connected');
                    setInstanceId(connected ? connected.id : instances[0].id);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchInstance();
    }, [company.id]);

    const fetchData = async () => {
        if (!instanceId) return;
        setLoading(true);
        try {
            // Add date filters
            const query = new URLSearchParams();
            query.append('instance_id', instanceId.toString());
            // if (date?.from) query.append('startDate', date.from.toISOString());
            // if (date?.to) query.append('endDate', date.to.toISOString());

            const res = await fetch(`/api/shop/dashboard?${query.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to fetch dashboard data');
            const jsonData = await res.json();
            setData(jsonData);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Falha ao carregar dados do dashboard", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (instanceId) fetchData();
    }, [instanceId]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    if (!instanceId) return <div className="p-8 text-center">Buscando instância conectada...</div>;
    if (loading && !data) return <div className="p-8 text-center">Carregando dados...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Filters */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard Lojista</h2>
                    <p className="text-muted-foreground">Visão geral da sua operação em tempo real</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* DatePicker would go here */}
                    <Button onClick={fetchData} disabled={loading} variant="outline" size="sm">
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.summary.sales_count || 0}</div>
                        <p className="text-xs text-muted-foreground">Pedidos finalizados</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data?.summary.revenue || 0)}</div>
                        <p className="text-xs text-muted-foreground">Total período selecionado</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data?.summary.avg_ticket || 0)}</div>
                        <p className="text-xs text-muted-foreground">Por venda realizada</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pedidos Abertos</CardTitle>
                        <Activity className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.summary.pending_orders || 0}</div>
                        <p className="text-xs text-muted-foreground">Aguardando finalização</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Notas em Atraso</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{data?.summary.overdue_receivables_count || 0}</div>
                        <p className="text-xs text-muted-foreground">{formatCurrency(data?.summary.overdue_receivables_value || 0)} a receber</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Estoque Crítico</CardTitle>
                        <Package className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.summary.critical_stock || 0}</div>
                        <p className="text-xs text-muted-foreground">Produtos abaixo do mínimo</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Top Produtos</CardTitle>
                        <CardDescription>Produtos mais vendidos no período</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data?.charts.top_products || []}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                    <Tooltip
                                        formatter={(value: number) => [formatCurrency(value), 'Total']}
                                        labelStyle={{ color: 'black' }}
                                    />
                                    <Bar dataKey="total" fill="#0e99b0" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Formas de Pagamento</CardTitle>
                        <CardDescription>Distribuição por método</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data?.charts.payment_methods || []}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="total"
                                    >
                                        {(data?.charts.payment_methods || []).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center mt-4">
                            {(data?.charts.payment_methods || []).map((entry, index) => (
                                <div key={entry.payment_method} className="flex items-center gap-1 text-xs">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span>{entry.payment_method}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
