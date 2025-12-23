import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

const FinanceiroPage = () => {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Visão financeira</h2>
          <p className="text-xs text-muted-foreground">
            Contas a pagar, receber, comissões e filtros por cidade/estado (dados ilustrativos nesta versão).
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contas a receber</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-primary-soft/60 px-3 py-2">
              <span className="text-muted-foreground">Total previsto</span>
              <span className="font-semibold text-foreground">R$ 128.000,00</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Inclui repasses de cartões, PIX e parceiros.</p>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contas a pagar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-muted-foreground">Obrigações do período</span>
              <span className="font-semibold text-foreground">R$ 62.000,00</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Comissões, taxas operacionais e serviços.</p>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Comissões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid gap-1 rounded-lg bg-background px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Motoristas</span>
                <span className="font-medium text-foreground">60%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Empreendedor local</span>
                <span className="font-medium text-foreground">25%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plataforma</span>
                <span className="font-medium text-foreground">15%</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Percentuais apenas ilustrativos para representar a divisão entre os participantes.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Histórico financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
              <div>
                <p className="font-medium text-foreground">Repasse mensal motoristas</p>
                <p className="text-[11px] text-muted-foreground">Montes Claros/MG • jan/2025</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Status</p>
                <p className="text-xs font-semibold text-foreground">Liquidado</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Relatórios detalhados por período, cidade e estado serão conectados ao banco de dados na próxima fase.
            </p>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Filtros principais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="badge-pill border-primary/40 bg-primary-soft/50 text-[11px]">
                Cidade
              </Badge>
              <Badge variant="outline" className="badge-pill text-[11px]">
                Estado
              </Badge>
              <Badge variant="outline" className="badge-pill text-[11px]">
                Período
              </Badge>
              <Badge variant="outline" className="badge-pill text-[11px]">
                Status de pagamento
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              A interface está pronta para ser conectada a filtros reais e geração de relatórios exportáveis.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default FinanceiroPage;
