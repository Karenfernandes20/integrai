import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Progress } from '../../components/ui/progress';
import { Badge } from '../../components/ui/badge';
import { toast } from '../../components/ui/use-toast';
import { Plus, Target, Trophy, Rocket, AlertTriangle } from 'lucide-react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    BarChart,
    Bar,
    Cell
} from 'recharts';

type PeriodPreset = 'current_month' | 'year' | 'custom';
type GoalType = 'revenue' | 'sales_count' | 'product' | 'new_clients' | 'category' | 'avg_ticket';
type GoalScope = 'company' | 'seller' | 'channel';

const CHANNEL_OPTIONS = ['whatsapp', 'loja_fisica', 'instagram', 'marketplace', 'outros'];

const today = new Date();
const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const lastDayMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

const toDateInput = (d: Date) => d.toISOString().slice(0, 10);
const formatMoney = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const formatPercent = (value: number) => `${Number(value || 0).toFixed(1)}%`;

const progressClass = (pct: number) => {
    if (pct < 50) return 'bg-red-500';
    if (pct < 80) return 'bg-yellow-500';
    if (pct <= 100) return 'bg-green-500';
    return 'bg-purple-500';
};

export default function MetasPage() {
    const { token, user } = useAuth();
    const [instanceId, setInstanceId] = useState<number | null>(null);
    const [loadingInstance, setLoadingInstance] = useState(true);

    const [preset, setPreset] = useState<PeriodPreset>('current_month');
    const [startDate, setStartDate] = useState(toDateInput(firstDayMonth));
    const [endDate, setEndDate] = useState(toDateInput(lastDayMonth));

    const [overview, setOverview] = useState<any>(null);
    const [closingAnalytics, setClosingAnalytics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
    const [sellerOptions, setSellerOptions] = useState<any[]>([]);
    const [productOptions, setProductOptions] = useState<any[]>([]);

    const [goalForm, setGoalForm] = useState({
        name: '',
        type: 'revenue' as GoalType,
        targetValue: '',
        startDate: toDateInput(firstDayMonth),
        endDate: toDateInput(lastDayMonth),
        scope: 'company' as GoalScope,
        sellerId: '',
        channel: '',
        productId: '',
        category: ''
    });

    const [distributeForm, setDistributeForm] = useState({
        totalTarget: '',
        startDate: toDateInput(firstDayMonth),
        endDate: toDateInput(lastDayMonth),
        commissionRate: ''
    });

    const [manualMode, setManualMode] = useState(false);
    const [manualDistributions, setManualDistributions] = useState<{ sellerId: number, name: string, targetValue: string }[]>([]);

    useEffect(() => {
        if (isDistributeModalOpen && sellerOptions.length > 0) {
            // Init manual distributions
            const initial = sellerOptions.map(s => ({
                sellerId: s.id,
                name: s.full_name,
                targetValue: '' // Start empty or equal split? Start empty to force input or calculate on button click
            }));
            setManualDistributions(initial);
        }
    }, [isDistributeModalOpen, sellerOptions]);

    const calculateEqualSplit = () => {
        const total = Number(distributeForm.totalTarget);
        if (!total || manualDistributions.length === 0) return;
        const split = (total / manualDistributions.length).toFixed(2);
        setManualDistributions(prev => prev.map(d => ({ ...d, targetValue: split })));
    };

    useEffect(() => {
        if (preset === 'current_month') {
            setStartDate(toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
            setEndDate(toDateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
        } else if (preset === 'year') {
            setStartDate(toDateInput(new Date(today.getFullYear(), 0, 1)));
            setEndDate(toDateInput(new Date(today.getFullYear(), 11, 31)));
        }
    }, [preset]);

    const fetchInstance = async () => {
        if (!token || !user?.company_id) return;
        setLoadingInstance(true);
        try {
            const res = await fetch(`/api/companies/${user.company_id}/instances`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) return setInstanceId(null);
            const instances = await res.json();
            if (!Array.isArray(instances) || instances.length === 0) return setInstanceId(null);
            const connected = instances.find((i: any) => i.status === 'open' || i.status === 'connected');
            setInstanceId(Number((connected || instances[0]).id));
        } catch {
            setInstanceId(null);
        } finally {
            setLoadingInstance(false);
        }
    };

    const fetchOverview = async () => {
        if (!token || !instanceId) return;
        setLoading(true);
        try {
            const query = new URLSearchParams({ instance_id: String(instanceId), startDate, endDate });
            const res = await fetch(`/api/shop/goals/overview?${query.toString()}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'x-instance-id': String(instanceId)
                }
            });
            if (!res.ok) throw new Error('Erro ao carregar metas');
            const data = await res.json();
            setOverview(data);
        } catch (e: any) {
            toast({ title: 'Erro', description: e.message || 'Falha ao carregar metas', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const fetchClosingAnalytics = async () => {
        if (!token) return;
        try {
            const query = new URLSearchParams({ startDate, endDate });
            const res = await fetch(`/api/closing-reasons/analytics?${query.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) {
                setClosingAnalytics(null);
                return;
            }
            const data = await res.json();
            setClosingAnalytics(data);
        } catch {
            setClosingAnalytics(null);
        }
    };

    const fetchSellers = async () => {
        if (!token || !instanceId) return;
        try {
            const query = new URLSearchParams({ instance_id: String(instanceId) });
            const res = await fetch(`/api/shop/goals/sellers?${query.toString()}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'x-instance-id': String(instanceId)
                }
            });
            if (!res.ok) return;
            const data = await res.json();
            setSellerOptions(Array.isArray(data) ? data : []);
        } catch {
            setSellerOptions([]);
        }
    };

    const fetchProducts = async () => {
        if (!token || !instanceId) return;
        try {
            const query = new URLSearchParams({ instance_id: String(instanceId), limit: '500' });
            const res = await fetch(`/api/shop/inventory?${query.toString()}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'x-instance-id': String(instanceId)
                }
            });
            if (!res.ok) return;
            const data = await res.json();
            setProductOptions(Array.isArray(data) ? data : []);
        } catch {
            setProductOptions([]);
        }
    };

    useEffect(() => {
        if (token && user?.company_id) fetchInstance();
    }, [token, user?.company_id]);

    useEffect(() => {
        if (instanceId) {
            fetchOverview();
            fetchSellers();
            fetchProducts();
            fetchClosingAnalytics();
        }
    }, [instanceId, startDate, endDate]);

    const handleCreateGoal = async () => {
        if (!instanceId) return;
        if (!goalForm.name || !goalForm.targetValue) {
            toast({ title: 'Campos obrigatórios', description: 'Preencha nome e valor alvo.', variant: 'destructive' });
            return;
        }

        try {
            const res = await fetch('/api/shop/goals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    'x-instance-id': String(instanceId)
                },
                body: JSON.stringify({
                    name: goalForm.name,
                    type: goalForm.type,
                    targetValue: Number(goalForm.targetValue),
                    startDate: goalForm.startDate,
                    endDate: goalForm.endDate,
                    scope: goalForm.scope,
                    sellerId: goalForm.scope === 'seller' ? Number(goalForm.sellerId || 0) || null : null,
                    channel: goalForm.scope === 'channel' ? goalForm.channel || null : null,
                    productId: goalForm.type === 'product' ? Number(goalForm.productId || 0) || null : null,
                    category: goalForm.type === 'category' ? goalForm.category || null : null,
                    instance_id: instanceId
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao criar meta');
            toast({ title: 'Meta criada com sucesso!' });
            // Reset form
            setGoalForm({
                name: '',
                type: 'revenue' as GoalType,
                targetValue: '',
                startDate: toDateInput(firstDayMonth),
                endDate: toDateInput(lastDayMonth),
                scope: 'company' as GoalScope,
                sellerId: '',
                channel: '',
                productId: '',
                category: ''
            });
            setIsGoalModalOpen(false);
            fetchOverview();
        } catch (e: any) {
            toast({ title: 'Erro ao criar meta', description: e.message, variant: 'destructive' });
        }
    };

    const handleDistribute = async () => {
        if (!instanceId) return;
        if (!distributeForm.totalTarget) {
            toast({ title: 'Informe a meta total', variant: 'destructive' });
            return;
        }

        // Validate manual distributions if in manual mode
        if (manualMode) {
            const hasEmpty = manualDistributions.some(d => !d.targetValue || Number(d.targetValue) <= 0);
            if (hasEmpty) {
                toast({ title: 'Distribuição inválida', description: 'Todas as metas individuais devem ter valores maiores que zero.', variant: 'destructive' });
                return;
            }
        }

        try {
            const res = await fetch('/api/shop/goals/distribute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    'x-instance-id': String(instanceId)
                },
                body: JSON.stringify({
                    totalTarget: Number(distributeForm.totalTarget),
                    startDate: distributeForm.startDate,
                    endDate: distributeForm.endDate,
                    commissionRate: Number(distributeForm.commissionRate || 0),
                    instance_id: instanceId,
                    distributions: manualMode ? manualDistributions.map(d => ({ sellerId: d.sellerId, targetValue: Number(d.targetValue) })) : undefined
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao distribuir metas');
            toast({ title: 'Metas individuais criadas', description: `${data.created} metas geradas.` });
            // Reset form
            setDistributeForm({
                totalTarget: '',
                startDate: toDateInput(firstDayMonth),
                endDate: toDateInput(lastDayMonth),
                commissionRate: ''
            });
            setManualMode(false);
            setIsDistributeModalOpen(false);
            fetchOverview();
        } catch (e: any) {
            toast({ title: 'Erro', description: e.message, variant: 'destructive' });
        }
    };

    const summary = overview?.summary || {};
    const intelligence = overview?.intelligence || {};
    const charts = overview?.charts || {};
    const sellers = overview?.sellers || [];
    const channels = overview?.channels || [];
    const history = overview?.history?.goals || [];

    if (loadingInstance) return <div className="p-8 text-center text-muted-foreground">Buscando instância...</div>;
    if (!instanceId) return <div className="p-8 text-center text-red-500">Nenhuma instância disponível para esta loja.</div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Target className="h-8 w-8 text-primary" />
                    Metas Comerciais
                </h1>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setIsDistributeModalOpen(true)}>Dividir Meta por Vendedores</Button>
                    <Button onClick={() => setIsGoalModalOpen(true)} className="fixed bottom-6 right-6 z-20 shadow-lg rounded-full">
                        <Plus className="h-4 w-4 mr-2" /> Nova Meta
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Filtro de Período</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                        <Label>Atalho</Label>
                        <Select value={preset} onValueChange={(v) => setPreset(v as PeriodPreset)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="current_month">Mês atual</SelectItem>
                                <SelectItem value="year">Este ano</SelectItem>
                                <SelectItem value="custom">Personalizado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label>Data inicial</Label>
                        <Input type="date" value={startDate} onChange={(e) => { setPreset('custom'); setStartDate(e.target.value); }} />
                    </div>
                    <div className="space-y-1">
                        <Label>Data final</Label>
                        <Input type="date" value={endDate} onChange={(e) => { setPreset('custom'); setEndDate(e.target.value); }} />
                    </div>
                    <div className="flex items-end">
                        <Button onClick={fetchOverview} className="w-full">Atualizar</Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Meta do Período</p><p className="text-xl font-bold">{formatMoney(summary.target || 0)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Valor Vendido</p><p className="text-xl font-bold">{formatMoney(summary.sold || 0)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">% Atingido</p><p className="text-xl font-bold">{formatPercent(summary.percentage || 0)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Falta para Meta</p><p className="text-xl font-bold">{formatMoney(summary.missing || 0)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Dias Restantes</p><p className="text-xl font-bold">{summary.days_remaining ?? 0}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Média Diária Necessária</p><p className="text-xl font-bold">{formatMoney(summary.required_daily || 0)}</p></CardContent></Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Conversão por Motivo de Encerramento</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Encerramentos</p>
                        <p className="text-xl font-bold">{closingAnalytics?.summary?.totalClosures || 0}</p>
                    </div>
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Positivos</p>
                        <p className="text-xl font-bold text-green-600">{closingAnalytics?.summary?.positive || 0}</p>
                    </div>
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Negativos</p>
                        <p className="text-xl font-bold text-red-600">{closingAnalytics?.summary?.negative || 0}</p>
                    </div>
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Conversão Positiva</p>
                        <p className="text-xl font-bold text-primary">{Number(closingAnalytics?.summary?.positivePct || 0).toFixed(1)}%</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold">Progresso geral da meta</span>
                        <Badge className={progressClass(Number(summary.percentage || 0))}>{formatPercent(summary.percentage || 0)}</Badge>
                    </div>
                    <Progress value={Math.min(100, Number(summary.percentage || 0))} />
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                        {Number(summary.percentage || 0) >= 100 ? <Rocket className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                        {intelligence.insight || 'Sem insight para o período selecionado.'}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                    <CardHeader><CardTitle>Meta vs Realizado (Diário)</CardTitle></CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={charts.meta_vs_realized_daily || []}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={(v) => `R$ ${Math.round(Number(v) / 1000)}k`} />
                                <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
                                <Line type="monotone" dataKey="sold_cumulative" name="Realizado" stroke="#16a34a" strokeWidth={2.5} />
                                <Line type="monotone" dataKey="target_cumulative" name="Meta" stroke="#2563eb" strokeWidth={2.5} strokeDasharray="5 5" />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Ranking de Vendedores</CardTitle></CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={(charts.seller_ranking || []).slice(0, 8)}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={(v) => `R$ ${Math.round(Number(v) / 1000)}k`} />
                                <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
                                <Bar dataKey="sold" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Metas por Vendedor</CardTitle></CardHeader>
                <CardContent>
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b">
                                    <th className="py-2">Vendedor</th>
                                    <th className="py-2">Meta</th>
                                    <th className="py-2">Vendas</th>
                                    <th className="py-2">%</th>
                                    <th className="py-2">Ranking</th>
                                    <th className="py-2">Comissão</th>
                                    <th className="py-2">Badge</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sellers.map((s: any) => (
                                    <tr key={s.seller_id} className="border-b">
                                        <td className="py-2">{s.seller_name}</td>
                                        <td>{formatMoney(s.target || 0)}</td>
                                        <td>{formatMoney(s.sold || 0)}</td>
                                        <td><Badge variant="outline">{formatPercent(s.percentage || 0)}</Badge></td>
                                        <td>#{s.ranking}</td>
                                        <td>{formatMoney(s.commission_estimate || 0)}</td>
                                        <td>{s.has_medal ? <span className="inline-flex items-center gap-1 text-amber-600"><Trophy className="h-4 w-4" /> {s.badge || 'Top Vendas'}</span> : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                    <CardHeader><CardTitle>Metas por Canal</CardTitle></CardHeader>
                    <CardContent>
                        <div className="overflow-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b">
                                        <th className="py-2">Canal</th>
                                        <th className="py-2">Meta</th>
                                        <th className="py-2">Realizado</th>
                                        <th className="py-2">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {channels.map((c: any) => (
                                        <tr key={c.channel} className="border-b">
                                            <td className="py-2 capitalize">{String(c.channel || '').replace('_', ' ')}</td>
                                            <td>{formatMoney(c.target || 0)}</td>
                                            <td>{formatMoney(c.sold || 0)}</td>
                                            <td><Badge variant="outline">{formatPercent(c.percentage || 0)}</Badge></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Distribuição por Canal</CardTitle></CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.channel_breakdown || []}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="channel" tickFormatter={(v) => String(v).replace('_', ' ')} />
                                <YAxis tickFormatter={(v) => `R$ ${Math.round(Number(v) / 1000)}k`} />
                                <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
                                <Bar dataKey="sold" radius={[6, 6, 0, 0]}>
                                    {(charts.channel_breakdown || []).map((_entry: any, i: number) => (
                                        <Cell key={`ch-${i}`} fill={['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#06b6d4', '#eab308'][i % 6]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Histórico e Comparativo</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                        Comparação com período anterior: <strong>{formatPercent(overview?.history?.period_comparison_percentage || 0)}</strong>
                    </div>
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b">
                                    <th className="py-2">Meta</th>
                                    <th className="py-2">Período</th>
                                    <th className="py-2">Status</th>
                                    <th className="py-2">%</th>
                                    <th className="py-2">Meta</th>
                                    <th className="py-2">Realizado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h: any) => (
                                    <tr key={h.id} className="border-b">
                                        <td className="py-2">{h.name}</td>
                                        <td>{h.start_date ? new Date(h.start_date).toLocaleDateString('pt-BR') : '-'} - {h.end_date ? new Date(h.end_date).toLocaleDateString('pt-BR') : '-'}</td>
                                        <td>{h.status === 'achieved' ? <Badge className="bg-green-600">Atingida</Badge> : h.status === 'in_progress' ? <Badge variant="secondary">Em andamento</Badge> : <Badge variant="destructive">Não atingida</Badge>}</td>
                                        <td>{formatPercent(h.percentage || 0)}</td>
                                        <td>{formatMoney(h.target || 0)}</td>
                                        <td>{formatMoney(h.current || 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isGoalModalOpen} onOpenChange={setIsGoalModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader><DialogTitle>Criar Nova Meta</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                            <Label>Nome da meta</Label>
                            <Input value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} placeholder="Meta Fevereiro" />
                        </div>
                        <div>
                            <Label>Tipo de meta</Label>
                            <Select value={goalForm.type} onValueChange={(v) => setGoalForm({ ...goalForm, type: v as GoalType })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="revenue">Faturamento</SelectItem>
                                    <SelectItem value="sales_count">Número de vendas</SelectItem>
                                    <SelectItem value="product">Produto específico</SelectItem>
                                    <SelectItem value="new_clients">Novos clientes</SelectItem>
                                    <SelectItem value="category">Categoria</SelectItem>
                                    <SelectItem value="avg_ticket">Ticket médio</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Valor alvo</Label>
                            <Input type="number" value={goalForm.targetValue} onChange={(e) => setGoalForm({ ...goalForm, targetValue: e.target.value })} />
                        </div>
                        <div>
                            <Label>Início</Label>
                            <Input type="date" value={goalForm.startDate} onChange={(e) => setGoalForm({ ...goalForm, startDate: e.target.value })} />
                        </div>
                        <div>
                            <Label>Fim</Label>
                            <Input type="date" value={goalForm.endDate} onChange={(e) => setGoalForm({ ...goalForm, endDate: e.target.value })} />
                        </div>
                        <div>
                            <Label>Aplicar para</Label>
                            <Select value={goalForm.scope} onValueChange={(v) => setGoalForm({ ...goalForm, scope: v as GoalScope })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="company">Loja inteira</SelectItem>
                                    <SelectItem value="seller">Vendedor específico</SelectItem>
                                    <SelectItem value="channel">Canal específico</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            {goalForm.scope === 'seller' && (
                                <>
                                    <Label>Vendedor</Label>
                                    <Select value={goalForm.sellerId} onValueChange={(v) => setGoalForm({ ...goalForm, sellerId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                        <SelectContent>
                                            {sellerOptions.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.full_name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </>
                            )}
                            {goalForm.scope === 'channel' && (
                                <>
                                    <Label>Canal</Label>
                                    <Select value={goalForm.channel} onValueChange={(v) => setGoalForm({ ...goalForm, channel: v })}>
                                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                        <SelectContent>
                                            {CHANNEL_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </>
                            )}
                        </div>
                        <div className="md:col-span-2">
                            {goalForm.type === 'product' && (
                                <>
                                    <Label>Produto específico</Label>
                                    <Select value={goalForm.productId} onValueChange={(v) => setGoalForm({ ...goalForm, productId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                                        <SelectContent>
                                            {productOptions.map((p: any) => (
                                                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </>
                            )}
                            {goalForm.type === 'category' && (
                                <>
                                    <Label>Categoria</Label>
                                    <Input value={goalForm.category} onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value })} placeholder="Ex: Eletrônicos" />
                                </>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsGoalModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateGoal}>Salvar Meta</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDistributeModalOpen} onOpenChange={setIsDistributeModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Dividir Meta Geral entre Vendedores</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2 flex items-center justify-between">
                            <Label>Modo de Distribuição</Label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                                <input type="checkbox" checked={manualMode} onChange={(e) => setManualMode(e.target.checked)} className="rounded border-gray-300" />
                                Ajuste Manual Individual
                            </label>
                        </div>

                        <div className="md:col-span-2">
                            <Label>Meta total {manualMode ? '(Referência)' : ''}</Label>
                            <div className="flex gap-2">
                                <Input type="number" value={distributeForm.totalTarget} onChange={(e) => setDistributeForm({ ...distributeForm, totalTarget: e.target.value })} />
                                {manualMode && <Button variant="secondary" onClick={calculateEqualSplit} title="Distribuir Igualmente">Distribuir</Button>}
                            </div>
                        </div>

                        <div>
                            <Label>Início</Label>
                            <Input type="date" value={distributeForm.startDate} onChange={(e) => setDistributeForm({ ...distributeForm, startDate: e.target.value })} />
                        </div>
                        <div>
                            <Label>Fim</Label>
                            <Input type="date" value={distributeForm.endDate} onChange={(e) => setDistributeForm({ ...distributeForm, endDate: e.target.value })} />
                        </div>
                        <div className="md:col-span-2">
                            <Label>Comissão estimada (%)</Label>
                            <Input type="number" value={distributeForm.commissionRate} onChange={(e) => setDistributeForm({ ...distributeForm, commissionRate: e.target.value })} />
                        </div>

                        {manualMode && (
                            <div className="md:col-span-2 space-y-2 mt-2 max-h-60 overflow-y-auto border rounded p-2">
                                <Label>Valores por Vendedor</Label>
                                {manualDistributions.map((dist, idx) => (
                                    <div key={dist.sellerId} className="flex items-center gap-2">
                                        <span className="text-sm flex-1 truncate" title={dist.name}>{dist.name}</span>
                                        <Input
                                            type="number"
                                            className="w-32 h-8"
                                            value={dist.targetValue}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setManualDistributions(prev => prev.map((item, i) => i === idx ? { ...item, targetValue: val } : item));
                                            }}
                                        />
                                    </div>
                                ))}
                                <div className="text-right text-sm font-bold mt-2">
                                    Soma: {formatMoney(manualDistributions.reduce((acc, curr) => acc + Number(curr.targetValue || 0), 0))}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDistributeModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleDistribute}>Criar Metas Individuais</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {loading && <div className="text-sm text-muted-foreground">Atualizando dados de metas...</div>}
        </div>
    );
}

