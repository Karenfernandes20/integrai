
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { ArrowUpRight, ArrowDownRight, DollarSign, Users, Activity, BarChart3 } from "lucide-react";

export default function ConversionReports() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/reports/conversion', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                });
                if (res.ok) {
                    setStats(await res.json());
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div className="p-8">Carregando métricas...</div>;
    if (!stats) return <div className="p-8">Erro ao carregar dados.</div>;

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Relatório de Conversão</h1>
                <p className="text-muted-foreground">Métricas de crescimento e saúde da base de clientes.</p>
            </div>

            {/* Top Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                        <Activity className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.conversion.rate}%</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.conversion.paid_companies} pagantes de {stats.conversion.total_companies} totais
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Churn Inicial</CardTitle>
                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.churn.rate}%</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.churn.cancelled} cancelamentos
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Uso Médio (Mensagens)</CardTitle>
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.usage.avg_messages}</div>
                        <p className="text-xs text-muted-foreground">
                            Por empresa / mês
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tamanho Médio Equipe</CardTitle>
                        <Users className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.usage.avg_users}</div>
                        <p className="text-xs text-muted-foreground">
                            Usuários por empresa
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Revenue Section */}
            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Receita por Plano (Estimativa)</CardTitle>
                    <CardDescription>Distribuição de receita baseada em assinaturas ativas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {stats.revenue_by_plan.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhuma assinatura ativa encontrada.</p>
                        ) : (
                            stats.revenue_by_plan.map((plan: any, i: number) => (
                                <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                            {plan.name?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium">{plan.name}</p>
                                            <p className="text-xs text-muted-foreground">{plan.sub_count} assinantes</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">R$ {parseFloat(plan.total_revenue || 0).toFixed(2)}</p>
                                        <p className="text-xs text-green-600 font-medium">Recorrente</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
