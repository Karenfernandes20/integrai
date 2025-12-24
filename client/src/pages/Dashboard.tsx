import { useEffect, useState } from "react";
import { ArrowUpRight, MapPin, Users, Wallet2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

// Dados reais serão preenchidos pela API futuramente
const chartData: Array<{ name: string; corridas: number }> = [];

const chartConfig = {
  corridas: {
    label: "Corridas",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

interface CompanySummary {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  logo_url: string | null;
}

const DashboardPage = () => {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get("companyId");

  const [company, setCompany] = useState<CompanySummary | null>(null);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  useEffect(() => {
    const loadCompany = async () => {
      if (!companyId) {
        setCompany(null);
        setCompanyError(null);
        return;
      }

      setIsLoadingCompany(true);
      setCompanyError(null);

      const { data, error } = await supabase
        .from("companies")
        .select("id, name, city, state, logo_url")
        .eq("id", companyId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar empresa no Dashboard", error);
        setCompany(null);
        setCompanyError("Não foi possível carregar os dados da empresa.");
      } else {
        setCompany((data as CompanySummary | null) ?? null);
      }

      setIsLoadingCompany(false);
    };

    void loadCompany();
  }, [companyId]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {companyId && (
        <section className="mb-2 rounded-lg border border-primary-soft bg-primary-soft/20 px-3 py-2 text-xs sm:mb-3">
          {isLoadingCompany ? (
            <p className="text-muted-foreground">Carregando dados da empresa selecionada...</p>
          ) : company ? (
            <div className="flex items-center gap-3">
              {company.logo_url && (
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
                  <img
                    src={company.logo_url}
                    alt={`Logo da empresa ${company.name}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-foreground">
                  Visão atual: <span className="font-semibold text-primary">{company.name}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {company.city || company.state
                    ? [company.city, company.state].filter(Boolean).join("/")
                    : "Cidade/UF não informados"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">
              {companyError ?? "Empresa não encontrada ou você não tem acesso a ela."}
            </p>
          )}
        </section>
      )}

      {/* Indicadores principais sem números fictícios */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="elevated-card animate-card-fade-up border-none bg-card/90">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 sm:pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground sm:text-xs">
              Passageiros cadastrados
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="pb-3 sm:pb-4">
            <p className="text-xl font-semibold sm:text-2xl">—</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Os dados reais serão exibidos aqui assim que a integração estiver ativa.
            </p>
          </CardContent>
        </Card>

        <Card className="elevated-card animate-card-fade-up border-none bg-card/90">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 sm:pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground sm:text-xs">
              Motoristas cadastrados
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="pb-3 sm:pb-4">
            <p className="text-xl font-semibold sm:text-2xl">—</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Os dados serão carregados automaticamente a partir do backend.
            </p>
          </CardContent>
        </Card>

        <Card className="elevated-card animate-card-fade-up border-none bg-card/90">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 sm:pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground sm:text-xs">
              Corridas em andamento
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent className="pb-3 sm:pb-4">
            <p className="text-xl font-semibold sm:text-2xl">—</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Este indicador será alimentado em tempo real quando a integração estiver pronta.
            </p>
          </CardContent>
        </Card>

        <Card className="elevated-card animate-card-fade-up border-none bg-card/90">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 sm:pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground sm:text-xs">
              Cidades ativas
            </CardTitle>
            <MapPin className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="pb-3 sm:pb-4">
            <p className="text-xl font-semibold sm:text-2xl">—</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Em breve serão exibidas aqui apenas informações reais da operação.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Área reservada para gráficos com dados reais */}
      <section className="grid gap-4 lg:grid-cols-[2fr,1.3fr]">
        <Card className="elevated-card border-none bg-card/95">
          <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-3">
            <div>
              <CardTitle className="text-sm">Corridas por estado</CardTitle>
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                Assim que os dados forem integrados, este gráfico mostrará as corridas reais por estado.
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-1 sm:pt-0">
            <ChartContainer config={chartConfig} className="mt-1 h-52 sm:mt-2 sm:h-64">
              <AreaChart data={chartData} margin={{ left: -24, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="corridas"
                  stroke="hsl(var(--primary))"
                  fill="url(#area-fill)"
                  strokeWidth={2}
                  dot={false}
                />
                <defs>
                  <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="elevated-card border-none bg-card/95">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm">Resumo financeiro</CardTitle>
              <p className="text-xs text-muted-foreground">
                Os valores serão alimentados automaticamente a partir dos dados reais da plataforma.
              </p>
            </div>
            <Wallet2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-3 pt-1 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-primary-soft/60 px-3 py-2">
              <span className="text-muted-foreground">Faturamento total</span>
              <span className="font-semibold text-foreground">—</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-muted-foreground">Faturamento mensal</span>
              <span className="font-semibold text-foreground">—</span>
            </div>
            <div className="grid gap-2 rounded-lg bg-background px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Motoristas</span>
                <span className="font-medium text-foreground">—</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Empreendedores locais</span>
                <span className="font-medium text-foreground">—</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plataforma</span>
                <span className="font-medium text-foreground">—</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Nenhum número exibido aqui é fictício: os dados só aparecerão quando vierem do backend.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Seção informativa, sem números falsos */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-dashed bg-background/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Indicadores por cidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-[11px] text-muted-foreground">
              Aqui você poderá acompanhar indicadores reais de cada cidade assim que a integração de dados for
              concluída.
            </p>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Atendimento em destaque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              A aba Atendimento será integrada ao Evolution API para exibir conversas reais organizadas por cidade e
              estado.
            </p>
            <p className="text-[11px] text-muted-foreground">
              No momento nenhum número é simulado: os dados serão carregados diretamente da sua operação.
            </p>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pronto para escalar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              A estrutura do painel está pronta para receber dados reais, novos módulos, relatórios e permissões
              avançadas.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default DashboardPage;
