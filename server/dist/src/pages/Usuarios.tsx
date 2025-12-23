import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

const UsuariosPage = () => {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Gestão de usuários</h2>
          <p className="text-xs text-muted-foreground">
            Passageiros, motoristas e administradores com filtros por cidade, estado e status.
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Passageiros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              Lista de passageiros com filtros por cidade/estado e histórico de corridas.
            </p>
            <Badge variant="outline" className="badge-pill text-[11px]">
              Filtros por cidade e estado
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Motoristas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              Gestão completa dos cadastros, documentos, status (ativo, pendente, bloqueado) e repasses.
            </p>
            <Badge variant="outline" className="badge-pill text-[11px]">
              Status: ativo, pendente, bloqueado
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Administradores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              Controle de acessos internos, permissões por módulo e cidades liberadas para cada admin.
            </p>
            <Badge variant="outline" className="badge-pill text-[11px]">
              Permissões por módulo
            </Badge>
          </CardContent>
        </Card>
      </section>

      <p className="text-[11px] text-muted-foreground">
        Nesta etapa os dados são apenas ilustrativos para definir o layout. A conexão com banco de dados, regras de
        permissão e filtros avançados será feita na evolução do projeto.
      </p>
    </div>
  );
};

export default UsuariosPage;
