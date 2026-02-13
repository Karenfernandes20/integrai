
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Loader2, FileDown, TrendingUp, TrendingDown, DollarSign, Filter, MessageSquare, AlertTriangle, CheckSquare, Zap, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";

const RelatoriosPage = () => {
    const { token, user } = useAuth();
    const [activeTab, setActiveTab] = useState("operational");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedCity, setSelectedCity] = useState("0"); // 0 = all
    const [cities, setCities] = useState<any[]>([]);

    // Data States
    const [dreData, setDreData] = useState<any>(null);
    const [breakdownData, setBreakdownData] = useState<any>(null);
    const [indicatorsData, setIndicatorsData] = useState<any>(null);
    const [operationalData, setOperationalData] = useState<any>(null);

    // Fetch initial data (cities)
    useEffect(() => {
        const fetchCities = async () => {
            try {
                const res = await fetch("/api/cities", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setCities(data);
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchCities();
    }, [token]);

    // Fetch Report Data based on active tab
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const query = new URLSearchParams({
                startDate,
                endDate,
                ...(selectedCity !== "0" && { cityId: selectedCity })
            });

            let res;
            if (activeTab === 'dre') {
                res = await fetch(`/api/reports/dre?${query}`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) {
                    const data = await res.json();
                    console.log('[Relatórios] DRE data:', data);
                    setDreData(data);
                }
            } else if (activeTab === 'breakdown') {
                res = await fetch(`/api/reports/breakdown?${query}`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) {
                    const data = await res.json();
                    console.log('[Relatórios] Breakdown data:', data);
                    setBreakdownData(data);
                }
            } else if (activeTab === 'indicators') {
                res = await fetch(`/api/reports/indicators`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) {
                    const data = await res.json();
                    console.log('[Relatórios] Indicators data:', data);
                    setIndicatorsData(data);
                }
            } else if (activeTab === 'operational') {
                res = await fetch(`/api/reports/operational?${query}`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) {
                    const data = await res.json();
                    console.log('[Relatórios] Operational data:', data);
                    setOperationalData(data);
                }
            }

            if (res && !res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
                console.error('[Relatórios] Error response:', { status: res.status, data: errorData });

                if (res.status === 403) {
                    throw new Error("Acesso negado. Você não tem permissão para visualizar este relatório.");
                }
                throw new Error(errorData.error || "Falha ao carregar dados do servidor.");
            }

        } catch (error: any) {
            console.error("Error fetching report data", error);
            setError(error.message || "Ocorreu um erro ao carregar o relatório.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab, startDate, endDate, selectedCity]); // Refetch on filter change

    // Exports
    const exportPDF = () => {
        const doc = new jsPDF();
        const logoUrl = "/logo-integrai.jpg";
        const img = new Image();
        img.src = logoUrl;

        const generatePDF = () => {
            // Add logo
            try {
                doc.addImage(img, 'JPEG', 14, 10, 25, 25);
            } catch (e) {
                console.warn("Could not add logo to PDF");
            }

            doc.setFontSize(16);
            doc.text(`Relatório - ${activeTab.toUpperCase()}`, 45, 20);
            doc.setFontSize(10);
            doc.text(`Período: ${startDate} a ${endDate}`, 45, 27);
            doc.text(`Gerado em: ${new Date().toLocaleString()}`, 45, 32);

            if (activeTab === 'dre' && dreData) {
                autoTable(doc, {
                    startY: 45,
                    head: [['Item', 'Valor (R$)']],
                    body: [
                        ['Receita Bruta', dreData.grossRevenue?.toFixed(2)],
                        ['Custos Operacionais', dreData.operationalCosts?.toFixed(2)],
                        ['Despesas', dreData.expenses?.toFixed(2)],
                        ['Lucro Bruto', dreData.grossProfit?.toFixed(2)],
                        ['Lucro Líquido', dreData.netProfit?.toFixed(2)]
                    ]
                });
            }
            else if (activeTab === 'breakdown' && breakdownData) {
                doc.text("Por Cidade", 14, 45);
                autoTable(doc, {
                    startY: 50,
                    head: [['Cidade', 'Receita', 'Custo']],
                    body: breakdownData.byCity.map((item: any) => [item.city_name, item.revenue, item.cost])
                });
            }
            else if (activeTab === 'operational' && operationalData) {
                // Summary Table
                doc.text("Resumo Operacional", 14, 45);
                autoTable(doc, {
                    startY: 50,
                    head: [['Métrica', 'Valor']],
                    body: [
                        ['Total Mensagens', operationalData.summary.totalMessages],
                        ['Taxa de Falha (Msg)', `${operationalData.summary.failureRateMsg}%`],
                        ['Taxa de Falha (Campanha)', `${operationalData.summary.failureRateCamp}%`],
                        ['Tarefas Concluídas', operationalData.summary.tasksCompleted],
                        ['Interações IA', operationalData.summary.aiInteractions],
                    ]
                });

                // Detailed Volume Table
                doc.text("Volume Diário", 14, doc.lastAutoTable.finalY + 10);
                autoTable(doc, {
                    startY: doc.lastAutoTable.finalY + 15,
                    head: [['Data', 'Total', 'Enviadas', 'Recebidas', 'Falhas']],
                    body: operationalData.messageVolume.map((m: any) => [
                        m.date,
                        m.count,
                        m.outbound,
                        m.inbound,
                        m.failed
                    ])
                });
            }

            doc.save(`relatorio_${activeTab}_${Date.now()}.pdf`);
        };

        img.onload = generatePDF;
        img.onerror = generatePDF; // Fallback without logo
    };

    const exportExcel = () => {
        let ws;
        if (activeTab === 'dre' && dreData) {
            ws = XLSX.utils.json_to_sheet([dreData]);
        } else if (activeTab === 'breakdown' && breakdownData) {
            ws = XLSX.utils.json_to_sheet(breakdownData.byCity);
        } else if (activeTab === 'operational' && operationalData) {
            ws = XLSX.utils.json_to_sheet(operationalData.messageVolume);
        } else {
            return;
        }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dados");
        XLSX.writeFile(wb, `relatorio_${activeTab}.xlsx`);
    };

    // --- Components for Tabs ---
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    const renderLoading = () => (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground animate-in fade-in">
            <Loader2 className="h-10 w-10 animate-spin mb-4" />
            <p>Carregando dados do relatório...</p>
        </div>
    );

    const renderError = () => (
        <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error || "Ocorreu um erro ao carregar os dados."}</AlertDescription>
            <Button variant="outline" size="sm" onClick={fetchData} className="mt-2">Deleted Tentar Novamente</Button>
        </Alert>
    );

    const renderEmpty = (msg: string = "Nenhum resultado encontrado para o período selecionado.") => (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border rounded-lg bg-muted/10">
            <AlertTriangle className="h-10 w-10 mb-4 opacity-50" />
            <p>{msg}</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Relatórios Executivos</h2>
                    <p className="text-muted-foreground">Visão completa da operação e finanças.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={exportPDF} disabled={loading || !!error}>
                        <FileDown className="mr-2 h-4 w-4" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportExcel} disabled={loading || !!error}>
                        <FileDown className="mr-2 h-4 w-4" /> Excel
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Filter className="h-4 w-4" /> Filtros
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-4">
                    <div>
                        <label className="text-xs font-medium">Início</label>
                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-medium">Fim</label>
                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-medium">Cidade</label>
                        <Select value={selectedCity} onValueChange={setSelectedCity}>
                            <SelectTrigger>
                                <SelectValue placeholder="Todas as Cidades" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">Todas as Cidades</SelectItem>
                                {cities.map((c: any) => (
                                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <Button className="w-full" onClick={fetchData} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Atualizar"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error && renderError()}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="operational">Operacional</TabsTrigger>
                    <TabsTrigger value="dre">Financeiro (DRE)</TabsTrigger>
                    <TabsTrigger value="breakdown">Cidades/Serviços</TabsTrigger>
                    <TabsTrigger value="indicators">Indicadores</TabsTrigger>
                </TabsList>

                <TabsContent value="operational" className="space-y-4">
                    {loading && !operationalData ? renderLoading() : (
                        operationalData ? (
                            <div className="space-y-4">
                                {/* Key Indicators */}
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Total Mensagens</CardTitle>
                                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{operationalData.summary.totalMessages}</div>
                                            <p className="text-xs text-muted-foreground">Enviadas + Recebidas</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Taxa de Falha (Geral)</CardTitle>
                                            <AlertTriangle className={`h-4 w-4 ${Number(operationalData.summary.failureRateMsg) > 5 ? 'text-red-500' : 'text-yellow-500'}`} />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{operationalData.summary.failureRateMsg}%</div>
                                            <p className="text-xs text-muted-foreground">Campanhas: {operationalData.summary.failureRateCamp}% Failed</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Tarefas Concluídas</CardTitle>
                                            <CheckSquare className="h-4 w-4 text-green-500" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{operationalData.summary.tasksCompleted}</div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Interações IA</CardTitle>
                                            <Zap className="h-4 w-4 text-purple-500" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{operationalData.summary.aiInteractions}</div>
                                            <p className="text-xs text-muted-foreground">Processadas pelo sistema</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Charts */}
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                                    <Card className="col-span-4">
                                        <CardHeader>
                                            <CardTitle>Volume de Mensagens (Últimos dias)</CardTitle>
                                        </CardHeader>
                                        <CardContent className="pl-2">
                                            <div className="h-[300px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={operationalData.messageVolume}>
                                                        <defs>
                                                            <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                                            </linearGradient>
                                                            <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                                                                <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <XAxis dataKey="date" fontSize={10} tickFormatter={(value) => format(new Date(value), 'dd/MM')} />
                                                        <YAxis fontSize={10} />
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <Tooltip labelFormatter={(v) => format(new Date(v), 'dd/MM/yyyy')} />
                                                        <Area type="monotone" dataKey="inbound" stroke="#8884d8" fillOpacity={1} fill="url(#colorIn)" name="Recebidas" />
                                                        <Area type="monotone" dataKey="outbound" stroke="#82ca9d" fillOpacity={1} fill="url(#colorOut)" name="Enviadas" />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="col-span-3">
                                        <CardHeader>
                                            <CardTitle>Composição de Tráfego</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-[300px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={operationalData.messageVolume}>
                                                        <XAxis dataKey="date" hide />
                                                        <YAxis />
                                                        <Tooltip />
                                                        <Legend />
                                                        <Bar dataKey="failed" stackId="a" fill="#dc2626" name="Falhas" />
                                                        <Bar dataKey="count" stackId="b" fill="#2563eb" name="Total" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        ) : renderEmpty("Sem dados operacionais para exibir.")
                    )}
                </TabsContent>

                <TabsContent value="dre" className="space-y-4">
                    {loading && !dreData ? renderLoading() : (
                        dreData ? (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Receita Bruta</CardTitle>
                                        <DollarSign className="h-4 w-4 text-green-500" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">R$ {dreData.grossRevenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Custos/Despesas</CardTitle>
                                        <TrendingDown className="h-4 w-4 text-red-500" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">R$ {(Number(dreData.operationalCosts) + Number(dreData.expenses))?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <p className="text-xs text-muted-foreground">Custos + Despesas</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
                                        <TrendingUp className="h-4 w-4 text-primary" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className={`text-2xl font-bold ${dreData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            R$ {dreData.netProfit?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : renderEmpty("Sem dados financeiros para o período.")
                    )}
                </TabsContent>

                <TabsContent value="breakdown" className="space-y-4">
                    {loading && !breakdownData ? renderLoading() : (
                        breakdownData ? (
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card className="col-span-1">
                                    <CardHeader><CardTitle>Receita por Cidade</CardTitle></CardHeader>
                                    <CardContent className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={breakdownData.byCity}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="city_name" fontSize={10} />
                                                <YAxis />
                                                <Tooltip />
                                                <Legend />
                                                <Bar dataKey="revenue" fill="#8884d8" name="Receita" />
                                                <Bar dataKey="cost" fill="#82ca9d" name="Custo" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                                <Card className="col-span-1">
                                    <CardHeader><CardTitle>Receita por Serviço (Categoria)</CardTitle></CardHeader>
                                    <CardContent className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={breakdownData.byService}
                                                    dataKey="revenue"
                                                    nameKey="service_name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={80}
                                                    label
                                                >
                                                    {breakdownData.byService.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : renderEmpty("Sem dados detalhados para exibir.")
                    )}
                </TabsContent>

                <TabsContent value="indicators" className="space-y-4">
                    {loading && !indicatorsData ? renderLoading() : (
                        indicatorsData ? (
                            <div className="grid gap-4">
                                <div className="grid gap-4 md:grid-cols-3">
                                    <Card>
                                        <CardHeader className="pb-2"><CardTitle className="text-sm">Margem de Lucro (Mês Atual)</CardTitle></CardHeader>
                                        <CardContent><div className="text-2xl font-bold">{indicatorsData.margin}%</div></CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2"><CardTitle className="text-sm">Crescimento (vs Mês Anterior)</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className={`text-2xl font-bold flex items-center ${Number(indicatorsData.growth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {Number(indicatorsData.growth) >= 0 ? <TrendingUp className="mr-2 h-4 w-4" /> : <TrendingDown className="mr-2 h-4 w-4" />}
                                                {indicatorsData.growth}%
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                                <Card>
                                    <CardHeader><CardTitle>Evolução Financeira (6 meses)</CardTitle></CardHeader>
                                    <CardContent className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={indicatorsData.evolution}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="month" />
                                                <YAxis />
                                                <Tooltip />
                                                <Legend />
                                                <Line type="monotone" dataKey="revenue" stroke="#8884d8" name="Receita" />
                                                <Line type="monotone" dataKey="cost" stroke="#82ca9d" name="Custo" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : renderEmpty("Calculando indicadores...")
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default RelatoriosPage;
