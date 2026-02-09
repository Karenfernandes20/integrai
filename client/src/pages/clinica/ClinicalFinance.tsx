
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableRow, TableHeader } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import {
    Users,
    Calendar, Plus,
    Search, Stethoscope, MoreVertical
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ClinicalTransactionDialog } from './ClinicalTransactionDialog';

// Types
interface Transaction {
    id: number;
    description: string;
    amount: number;
    type: 'receivable' | 'payable';
    status: 'pending' | 'paid' | 'overdue';
    due_date: string;
    issue_date: string;
    category: string;
    patient_name?: string;
    professional_name?: string;
    insurance_name?: string;
    payment_method?: string;
    patient_id?: number;
    professional_id?: number;
    insurance_plan_id?: number;
    notes?: string;
}

interface DashboardStats {
    revenue: number;
    expenses: number;
    receivables: number;
    payables: number;
    ticket_average: number;
}

const ClinicalFinance = () => {
    const { token } = useAuth();

    // State
    const [stats, setStats] = useState<DashboardStats>({ revenue: 0, expenses: 0, receivables: 0, payables: 0, ticket_average: 0 });
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [cashflow, setCashflow] = useState<any[]>([]);
    const [byInsurance, setByInsurance] = useState<any[]>([]);
    const [byProfessional, setByProfessional] = useState<any[]>([]);

    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    });

    const [filters, setFilters] = useState({
        status: 'all',
        type: 'all',
        patientId: '',
        professionalId: '',
        insuranceId: ''
    });

    const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    // Load Data
    useEffect(() => {
        fetchDashboard();
        fetchTransactions();
    }, [token, dateRange]);

    useEffect(() => {
        fetchTransactions();
    }, [filters]);

    const fetchDashboard = async () => {
        try {
            const params = new URLSearchParams({ startDate: dateRange.start, endDate: dateRange.end });
            const res = await fetch(`/api/finance/clinical/dashboard?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data.summary);
                setCashflow(data.cashflow);
                setByInsurance(data.byInsurance);
                setByProfessional(data.byProfessional);
            }
        } catch (error) { console.error(error); }
    };

    const fetchTransactions = async () => {
        try {
            const params = new URLSearchParams({
                startDate: dateRange.start,
                endDate: dateRange.end,
                ...filters
            });
            const res = await fetch(`/api/finance/clinical/transactions?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setTransactions(await res.json());
            }
        } catch (error) { console.error(error); }
    };

    const handleEdit = (t: Transaction) => {
        setEditingTransaction(t);
        setIsNewTransactionOpen(true);
    };

    const handleNew = () => {
        setEditingTransaction(null);
        setIsNewTransactionOpen(true);
    };

    // Formatters
    const fmtCurrency = (val: number) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtDate = (d: string) => d ? format(parseISO(d), 'dd/MM/yyyy') : '--';

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 bg-slate-50/30 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                        <Stethoscope className="text-emerald-600" />
                        Financeiro Clínico
                    </h1>
                    <p className="text-slate-500">Gestão avançada de contas médicas, convênios e repasses.</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
                    <Input
                        type="date"
                        value={dateRange.start}
                        onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="border-none shadow-none w-36"
                    />
                    <span className="text-slate-400 whitespace-nowrap">até</span>
                    <Input
                        type="date"
                        value={dateRange.end}
                        onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="border-none shadow-none w-36"
                    />
                </div>
                <Button onClick={handleNew} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20">
                    <Plus className="mr-2 h-4 w-4" /> Novo Lançamento
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-all bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Faturamento (Recebido)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-700">{fmtCurrency(stats.revenue)}</div>
                        <p className="text-xs text-slate-400 mt-1">Ticket Médio: {fmtCurrency(stats.ticket_average)}</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-all bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Despesas (Pago)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-700">{fmtCurrency(stats.expenses)}</div>
                        <p className="text-xs text-slate-400 mt-1">Operacional da Clínica</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">A Receber (Convênios/Part.)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700">{fmtCurrency(stats.receivables)}</div>
                        <div className="flex items-center gap-1 text-xs text-amber-600 mt-1 font-medium">
                            <Calendar className="h-3 w-3" /> Pendente no período
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-all bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Contas a Pagar</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-700">{fmtCurrency(stats.payables)}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                            Fornecedores e Repasses
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 shadow-sm border-none bg-white">
                    <CardHeader>
                        <CardTitle>Fluxo de Caixa Diário</CardTitle>
                        <CardDescription>Entradas e Saídas no período selecionado</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={cashflow}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(v), 'dd/MM')} fontSize={12} />
                                <YAxis fontSize={12} tickFormatter={(v) => `R$ ${v / 1000}k`} />
                                <Tooltip formatter={(v: number) => fmtCurrency(v)} cursor={{ fill: 'transparent' }} />
                                <Legend />
                                <Bar dataKey="income" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="outcome" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="shadow-sm border-none bg-blue-50/50">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold text-blue-800">Top Convênios</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {byInsurance.map((i: any, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                    <span className="font-medium text-slate-700">{i.name}</span>
                                    <span className="font-bold text-blue-600">{fmtCurrency(i.total)}</span>
                                </div>
                            ))}
                            {byInsurance.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Sem dados</p>}
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-none bg-emerald-50/50">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold text-emerald-800">Top Profissionais</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {byProfessional.map((p: any, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                    <span className="font-medium text-slate-700">{p.name}</span>
                                    <span className="font-bold text-emerald-600">{fmtCurrency(p.total)}</span>
                                </div>
                            ))}
                            {byProfessional.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Sem dados</p>}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Transactions Table with Filters */}
            <Card className="border-none shadow-md overflow-hidden bg-white">
                <div className="p-4 border-b flex flex-wrap gap-4 items-center bg-slate-50/50">
                    <div className="flex items-center gap-2 bg-white border rounded-md px-3 py-1.5 shadow-sm min-w-[200px]">
                        <Search className="h-4 w-4 text-slate-400" />
                        <input className="border-none outline-none text-sm w-full bg-transparent" placeholder="Buscar por descrição..." />
                    </div>

                    <Select value={filters.status} onValueChange={v => setFilters(prev => ({ ...prev, status: v }))}>
                        <SelectTrigger className="w-[150px] h-9 bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos Status</SelectItem>
                            <SelectItem value="paid">Pago / Recebido</SelectItem>
                            <SelectItem value="pending">Pendente</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filters.type} onValueChange={v => setFilters(prev => ({ ...prev, type: v }))}>
                        <SelectTrigger className="w-[150px] h-9 bg-white"><SelectValue placeholder="Tipo" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas Operações</SelectItem>
                            <SelectItem value="receivable">Receitas</SelectItem>
                            <SelectItem value="payable">Despesas</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-[30%]">Descrição / Paciente</TableHead>
                                <TableHead>Categoria / Convênio</TableHead>
                                <TableHead>Vencimento</TableHead>
                                <TableHead>Profissional</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map(t => (
                                <TableRow key={t.id} className="hover:bg-slate-50/80 group">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-800">{t.description}</span>
                                            {t.patient_name && (
                                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Users className="h-3 w-3" /> {t.patient_name}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="outline" className="w-fit">{t.category}</Badge>
                                            {t.insurance_name && <span className="text-xs text-blue-600 font-medium">{t.insurance_name}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {fmtDate(t.due_date)}
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">
                                        {t.professional_name || '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className={`font-bold ${t.type === 'receivable' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                            {t.type === 'receivable' ? '+ ' : '- '}{fmtCurrency(t.amount)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={t.status === 'paid' ? 'default' : t.status === 'overdue' ? 'destructive' : 'secondary'}
                                            className={t.status === 'paid' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200' : ''}
                                        >
                                            {t.status === 'paid' ? 'Pago' : t.status === 'overdue' ? 'Atrasado' : 'Pendente'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button size="icon" variant="ghost" onClick={() => handleEdit(t)} className="h-8 w-8 text-slate-400 hover:text-slate-600">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {transactions.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-slate-400">
                                        Nenhum lançamento encontrado
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <ClinicalTransactionDialog
                open={isNewTransactionOpen}
                onOpenChange={setIsNewTransactionOpen}
                onSuccess={() => {
                    fetchTransactions();
                    fetchDashboard();
                }}
                transactionToEdit={editingTransaction}
            />
        </div>
    );
};

export default ClinicalFinance;
