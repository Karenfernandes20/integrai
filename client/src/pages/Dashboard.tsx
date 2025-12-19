import { ArrowUpRight, MapPin, Users, Wallet2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

const chartData = [
  { name: "MG", corridas: 820 },
  { name: "BA", corridas: 650 },
  { name: "GO", corridas: 430 },
  { name: "SP", corridas: 1120 },
];

const chartConfig = {
  corridas: {
    label: "Corridas",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const DashboardPage = () => {
  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="elevated-card animate-card-fade-up border-none bg-card/90">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 sm:pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground sm:text-xs">
              Passageiros cadastrados
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="pb-3 sm:pb-4">
            <p className="text-xl font-semibold sm:text-2xl">18.245</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Base consolidada em todas as cidades ativas.
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
            <p className="text-xl font-semibold sm:text-2xl">4.392</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Inclui ativos, pendentes e bloqueados.</p>
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
            <p className="text-xl font-semibold sm:text-2xl">37</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Monitoramento em tempo real via app.</p>
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
            <p className="text-xl font-semibold sm:text-2xl">12</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Operações com indicadores atualizados.</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr,1.3fr]">
        <Card className="elevated-card border-none bg-card/95">
          <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-3">
            <div>
              <CardTitle className="text-sm">Corridas por estado</CardTitle>
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                Distribuição das corridas concluídas nos últimos 30 dias.
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
              <p className="text-xs text-muted-foreground">Visão macro da plataforma (valores ilustrativos).</p>
            </div>
            <Wallet2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-3 pt-1 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-primary-soft/60 px-3 py-2">
              <span className="text-muted-foreground">Faturamento total</span>
              <span className="font-semibold text-foreground">R$ 3.280.000,00</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-muted-foreground">Faturamento mensal (ilustrativo)</span>
              <span className="font-semibold text-foreground">R$ 268.000,00</span>
            </div>
            <div className="grid gap-2 rounded-lg bg-background px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Motoristas</span>
                <span className="font-medium text-foreground">60%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Empreendedores locais</span>
                <span className="font-medium text-foreground">25%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plataforma</span>
                <span className="font-medium text-foreground">15%</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Todos os valores são demonstrativos para fins de visualização do painel, sem promessas financeiras.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-dashed bg-background/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Indicadores por cidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-primary-soft/60 px-3 py-2">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary" />Montes Claros/MG
              </span>
              <span className="font-medium">Corridas: 320</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-accent" />Barreiras/BA
              </span>
              <span className="font-medium">Corridas: 210</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cada cidade poderá ter suas próprias cores definidas em Cidades &gt; Configuração visual.
            </p>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Atendimento em destaque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              A aba Atendimento concentra conversas de WhatsApp integradas via Evolution API, com identificação de
              cidade e estado em cores específicas.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Nesta versão inicial os dados são estáticos. A integração em tempo real será conectada na próxima etapa.
            </p>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pronto para escalar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              A estrutura foi pensada para crescer com novos módulos, relatórios, permissões avançadas e integrações.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default DashboardPage;
