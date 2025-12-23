import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

const CidadesPage = () => {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Cidades e estados</h2>
          <p className="text-xs text-muted-foreground">
            Controle das cidades ativas, performance por região e definição de cores para identificação visual.
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Montes Claros/MG</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <Badge className="badge-pill bg-primary-soft/70 text-[11px] text-primary-soft-foreground">Cor azul</Badge>
            <p className="text-[11px] text-muted-foreground">
              Cidade ativa com destaque visual para identificar rapidamente conversas e indicadores.
            </p>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Barreiras/BA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <Badge className="badge-pill bg-accent/80 text-[11px] text-accent-foreground">Cor amarela</Badge>
            <p className="text-[11px] text-muted-foreground">
              Permite enxergar rapidamente no atendimento de qual cidade é cada contato.
            </p>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Outras cidades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              Novas cidades podem ser ativadas/desativadas, sempre com associação de cores para o mapa visual da
              operação.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default CidadesPage;
