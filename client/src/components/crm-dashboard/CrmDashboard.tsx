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




import { DashboardDateFilter } from "../DashboardDateFilter";

interface CrmDashboardProps {
    company: CompanySummary;
}

export const CrmDashboard = ({ company }: CrmDashboardProps) => {
    // Persistent date state
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
        const saved = localStorage.getItem('dashboard_date_range');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return { start: "", end: "" };
            }
        }
        return { start: "", end: "" };
    });

    const [dashboardData, setDashboardData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Save to localStorage when changed
    useEffect(() => {
        if (dateRange.start || dateRange.end) {
            localStorage.setItem('dashboard_date_range', JSON.stringify(dateRange));
        } else {
            localStorage.removeItem('dashboard_date_range');
        }
    }, [dateRange]);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const token = localStorage.getItem("auth_token");

                // 1. Ping System Status to Self-Heal DB Logic
                try {
                    await fetch(`/api/system/whatsapp/status`, {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                } catch (err) {
                    console.warn("Status ping failed", err);
                }

                // 2. Fetch Dashboard Data
                let url = company.id && company.id !== 'superadmin-view'
                    ? `/api/crm/dashboard?companyId=${company.id}`
                    : "/api/crm/dashboard?";

                if (dateRange?.start) url += `&startDate=${dateRange.start}`;
                if (dateRange?.end) url += `&endDate=${dateRange.end}`;

                const res = await fetch(url, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (res.status === 403) {
                    const data = await res.json();
                    setDashboardData({ accessBlocked: true, message: data.message });
                    return;
                }

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

        setLoading(true);
        fetchDashboard();

        const interval = setInterval(fetchDashboard, 15000); // Polling every 15s
        return () => clearInterval(interval);
    }, [company.id, dateRange]);

    if (dashboardData?.accessBlocked) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 p-8 bg-card rounded-lg border border-dashed border-red-200">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 text-red-600 animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-center">Acesso ao Dashboard Bloqueado</h2>
                <p className="text-muted-foreground text-center max-w-md">
                    {dashboardData.message || "Conecte um número de WhatsApp via QR Code para visualizar os dados do dashboard."}
                </p>
                <Button onClick={() => window.location.href = '/conexao'}>Ir para Conexão</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* HEADER & FILTERS */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard CRM</h1>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-muted-foreground text-sm">
                            Gestão completa para <span className="font-semibold text-primary">{company.name}</span>
                        </p>
                        {dashboardData?.overview?.activeInstancePhone && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-medium text-primary uppercase tracking-wider">
                                <span className={`h-1.5 w-1.5 rounded-full ${dashboardData?.overview?.whatsappStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></span>
                                Instância ativa: {dashboardData?.overview?.activeInstancePhone}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <DashboardDateFilter
                        initialStart={dateRange.start}
                        initialEnd={dateRange.end}
                        onApply={(start, end) => setDateRange({ start, end })}
                        onClear={() => setDateRange({ start: "", end: "" })}
                    />

                    <div className="flex items-center gap-1 sm:gap-2 bg-background p-1 rounded-md border shadow-sm shrink-0">

                        <Select defaultValue="all">
                            <SelectTrigger className="flex-1 sm:w-[140px] h-8 text-xs">
                                <SelectValue placeholder="Atendente" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0"
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
