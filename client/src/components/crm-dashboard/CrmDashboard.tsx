import { useState, useEffect } from "react";
import { CompanySummary } from "../../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrmOverviewCards } from "./CrmOverviewCards";
import { CrmFunnel } from "./CrmFunnel";
import { CrmPerformance } from "./CrmPerformance";
import { CrmRealTime } from "./CrmRealTime";
import { CrmSales } from "./CrmSales";
import { CrmLeadSources } from "./CrmLeadSources";
import { CrmQuality } from "./CrmQuality";
import { CrmFollowUps } from "./CrmFollowUps";
import { CrmTechStatus } from "./CrmTechStatus";
import { CrmAiInsights } from "./CrmAiInsights";
import { Filter, RefreshCw } from "lucide-react";

interface CrmDashboardProps {
    company: CompanySummary;
}

export const CrmDashboard = ({ company }: CrmDashboardProps) => {
    const [dateRange, setDateRange] = useState<any>(null); // Placeholder for date state
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem("auth_token");
                const res = await fetch("/api/crm/dashboard", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setDashboardData(data);
                }
            } catch (e) {
                console.error("Failed to fetch dashboard", e);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* HEADER & FILTERS */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard CRM</h1>
                    <p className="text-muted-foreground text-sm">
                        Gestão completa de atendimento e vendas para <span className="font-semibold text-primary">{company.name}</span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Filters preserved... */}
                    <div className="flex items-center gap-2 bg-background p-1 rounded-md border shadow-sm">
                        <Select defaultValue="all">
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                                <SelectValue placeholder="Atendente" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos Atendentes</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select defaultValue="today">
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                                <SelectValue placeholder="Período" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="today">Hoje</SelectItem>
                                <SelectItem value="yesterday">Ontem</SelectItem>
                                <SelectItem value="week">Esta Semana</SelectItem>
                                <SelectItem value="month">Este Mês</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => window.location.reload()}
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <CrmAiInsights />

            {/* 1. VISÃO GERAL */}
            <CrmOverviewCards data={dashboardData?.overview} />

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="w-full justify-start overflow-x-auto bg-transparent p-0 border-b rounded-none h-auto">
                    <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Visão Geral</TabsTrigger>
                    <TabsTrigger value="sales" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Vendas</TabsTrigger>
                    <TabsTrigger value="quality" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Qualidade</TabsTrigger>
                    <TabsTrigger value="tech" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Técnico</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 pt-4">
                    {/* 2. FUNIL & 3. PERFORMANCE */}
                    <div className="grid lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <CrmFunnel data={dashboardData?.funnel} />
                        </div>
                        <div>
                            <CrmPerformance />
                        </div>
                    </div>

                    {/* 5. ATIVIDADE RECENTE & 6. ORIGEM */}
                    <div className="grid lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1">
                            <CrmLeadSources />
                        </div>
                        <div className="lg:col-span-2">
                            <CrmRealTime activities={dashboardData?.activities} />
                        </div>
                    </div>

                    {/* 8. FOLLOW-UPS */}
                    <CrmFollowUps />
                </TabsContent>

                <TabsContent value="sales" className="space-y-6 pt-4">
                    <CrmSales />
                </TabsContent>

                <TabsContent value="quality" className="space-y-6 pt-4">
                    <CrmQuality />
                </TabsContent>

                <TabsContent value="tech" className="space-y-6 pt-4">
                    <CrmTechStatus />
                </TabsContent>
            </Tabs>

        </div>
    );
};
