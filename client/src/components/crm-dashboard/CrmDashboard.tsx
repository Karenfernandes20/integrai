import { useState, useEffect } from "react";
import { CompanySummary } from "../../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CrmOverviewCards } from "./CrmOverviewCards";
import { CrmFunnel } from "./CrmFunnel";
import { CrmRealTime } from "./CrmRealTime";
import { CrmFollowUps } from "./CrmFollowUps";
import { RefreshCw } from "lucide-react";
import { TrialChecklist } from "../TrialChecklist";
import { ValueTip } from "../ValueTip";
import { CommunityStats } from "../CommunityStats";




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
                const token = localStorage.getItem("auth_token");
                const url = company.id && company.id !== 'superadmin-view'
                    ? `/api/crm/dashboard?companyId=${company.id}`
                    : "/api/crm/dashboard";

                const res = await fetch(url, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setDashboardData(data);
                }
            } catch (e) {
                console.error("Failed to fetch dashboard", e);
            } finally {
                if (loading) setLoading(false);
            }
        };

        setLoading(true);
        fetchDashboard().then(() => setLoading(false));

        const interval = setInterval(fetchDashboard, 10000); // Increased polling slightly to 10s
        return () => clearInterval(interval);
    }, [company.id]);

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

            {/* 1. VISÃO GERAL */}
            <TrialChecklist />
            <ValueTip
                feature="ai"
                title="Sua IA já está ativa!"
                description="Criamos um Assistente Virtual pronto para uso. Ele pode responder seus clientes 24/7. Tente enviar uma mensagem para 'Teste' para ver a mágica acontecer."
            />
            <CrmOverviewCards data={dashboardData?.overview} />

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <CrmFunnel data={dashboardData?.funnel} />
                    <CrmFollowUps data={dashboardData?.followups} />
                </div>
                <div className="lg:col-span-1">
                    <CrmRealTime activities={dashboardData?.activities} />
                </div>
            </div>

            <CommunityStats />
        </div>
    );
};
