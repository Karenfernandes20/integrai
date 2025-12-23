import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

const ConfiguracoesPage = () => {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Configurações gerais</h2>
          <p className="text-xs text-muted-foreground">
            Ajustes da plataforma, integrações, permissões de usuários e parâmetros operacionais.
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Plataforma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              Nome da operação, contato oficial, horários de atendimento e padrões de notificação.
            </p>
            <Badge variant="outline" className="badge-pill text-[11px]">
              Parâmetros globais
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Integrações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              Configuração da Evolution API para WhatsApp e outros serviços que serão conectados ao painel.
            </p>
            <Badge variant="outline" className="badge-pill text-[11px]">
              Evolution API
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Permissões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              Definição de perfis (administrador, superadministrador) e acesso por módulo/cidade.
            </p>
            <Badge variant="outline" className="badge-pill text-[11px]">
              Controlo granular
            </Badge>
          </CardContent>
        </Card>
      </section>

      <p className="text-[11px] text-muted-foreground">
        Esta tela define a estrutura de configurações que será ligada ao backend seguro, sem armazenamento de chaves
        sensíveis no frontend.
      </p>
    </div>
  );
};

export default ConfiguracoesPage;
