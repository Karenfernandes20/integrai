
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { useAuth } from "../contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { CheckCircle, AlertCircle, XCircle, Clock } from "lucide-react";

interface PlanStatus {
    plan_name: string;
    max_users: number;
    max_whatsapp_users: number;
    max_connections: number;
    max_queues: number;
    max_ai_agents: number;
    max_automations: number;
    max_messages_month: number;
    use_campaigns: boolean;
    use_schedules: boolean;
    usage: {
        messages_count: number;
        users_count: number;
        ai_agents_count: number;
        automations_count: number;
    };
}

interface BillingInfo {
    id: number;
    status: 'active' | 'past_due' | 'cancelled' | 'trialing';
    current_period_end: string;
    plan_name: string;
    plan_price: string;
    created_at: string;
}

interface Invoice {
    id: number;
    amount: string;
    status: string;
    created_at: string;
    due_date: string;
    pdf_url?: string;
}

export function PlanUsage() {
    const { token } = useAuth();
    const [data, setData] = useState<PlanStatus | null>(null);
    const [billing, setBilling] = useState<BillingInfo | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!token) return;
            try {
                // Parallel fetch
                const [planRes, subRes, invRes] = await Promise.all([
                    fetch("/api/subscription", { headers: { Authorization: `Bearer ${token}` } }),
                    fetch("/api/billing/subscription", { headers: { Authorization: `Bearer ${token}` } }),
                    fetch("/api/billing/invoices", { headers: { Authorization: `Bearer ${token}` } })
                ]);

                if (planRes.ok) setData(await planRes.json());
                if (subRes.ok) {
                    const subData = await subRes.json();
                    if (subData.status !== 'none') setBilling(subData);
                }
                if (invRes.ok) setInvoices(await invRes.json());

            } catch (err) {
                console.error("Failed to fetch plan data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token]);

    if (loading) return <div className="p-4 text-xs text-muted-foreground">Carregando plano...</div>;

    // Status Badge Logic
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return <Badge className="bg-green-500 hover:bg-green-600">Ativa</Badge>;
            case 'past_due': return <Badge variant="destructive">Em Atraso</Badge>;
            case 'cancelled': return <Badge variant="secondary">Cancelada</Badge>;
            case 'trialing': return <Badge className="bg-blue-500">Período de Teste</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const usagePercent = (used: number, max: number) => {
        if (!max || max === 0) return 0;
        return Math.min(100, Math.round((used / max) * 100));
    };

    return (
        <div className="space-y-6">
            {/* LIMITS SECTION */}
            {data && (
                <Card className="w-full">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Limites do Plano: {data.plan_name}</CardTitle>
                                <CardDescription>Consumo de recursos neste mês.</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-sm px-3 py-1 font-medium bg-primary/10 border-primary/20 text-primary">
                                {data.plan_name.toUpperCase()}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Messages */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium text-muted-foreground">Mensagens (Mês)</span>
                                <span>{data.usage.messages_count} / {data.max_messages_month}</span>
                            </div>
                            <Progress value={usagePercent(data.usage.messages_count, data.max_messages_month)} className="h-2" />
                        </div>
                        {/* Users */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium text-muted-foreground">Usuários</span>
                                <span>{data.usage.users_count} / {data.max_users}</span>
                            </div>
                            <Progress value={usagePercent(data.usage.users_count, data.max_users)} className="h-2" />
                        </div>
                        {/* Features GRID */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                            <div className={`text-xs p-2 rounded border ${data.use_campaigns ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300" : "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300"}`}>
                                Campanhas: <strong>{data.use_campaigns ? "Ativo" : "Não Incluso"}</strong>
                            </div>
                            <div className={`text-xs p-2 rounded border ${data.use_schedules ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300" : "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300"}`}>
                                Agendamentos: <strong>{data.use_schedules ? "Ativo" : "Não Incluso"}</strong>
                            </div>
                            <div className={`text-xs p-2 rounded border ${data.max_ai_agents > 0 ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300" : "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300"}`}>
                                Agentes IA: <strong>{data.max_ai_agents}</strong>
                            </div>
                            <div className={`text-xs p-2 rounded border ${data.max_automations > 0 ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300" : "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300"}`}>
                                Automações: <strong>{data.max_automations}</strong>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* BILLING SECTION */}
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="text-lg">Faturamento e Assinatura</CardTitle>
                    <CardDescription>Detalhes da sua recorrência e histórico de pagamentos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {billing ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col p-4 border rounded-lg bg-card shadow-sm">
                                <span className="text-xs text-muted-foreground uppercase font-bold mb-1">Status Atual</span>
                                <div className="flex items-center gap-2">
                                    {getStatusBadge(billing.status)}
                                </div>
                            </div>
                            <div className="flex flex-col p-4 border rounded-lg bg-card shadow-sm">
                                <span className="text-xs text-muted-foreground uppercase font-bold mb-1">Próxima Renovação</span>
                                <div className="flex items-center gap-2 text-lg font-mono">
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                    {new Date(billing.current_period_end).toLocaleDateString()}
                                </div>
                            </div>
                            <div className="flex flex-col p-4 border rounded-lg bg-card shadow-sm">
                                <span className="text-xs text-muted-foreground uppercase font-bold mb-1">Valor Mensal</span>
                                <div className="flex items-center gap-2 text-lg font-bold">
                                    R$ {billing.plan_price || '0.00'}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 border border-dashed rounded text-center text-muted-foreground text-sm">
                            Nenhuma assinatura ativa encontrada. Entre em contato com o suporte.
                        </div>
                    )}

                    <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            Histórico de Pagamentos
                        </h4>
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoices.length > 0 ? (
                                        invoices.map((inv) => (
                                            <TableRow key={inv.id}>
                                                <TableCell>{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell>R$ {inv.amount}</TableCell>
                                                <TableCell>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                        {inv.status === 'paid' ? 'Pago' : inv.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" disabled>
                                                        PDF
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-xs text-muted-foreground h-20">
                                                Nenhum pagamento registrado.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
