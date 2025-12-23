import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { userService } from "../services/userService";
import { Loader2 } from "lucide-react";

const UsuariosPage = () => {
  // Ainda chamamos a API apenas para manter a estrutura de dados ativa,
  // mas ignoramos o retorno para manter a visão sempre vazia.
  const { isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: userService.getUsers,
  });

  // Ao montar, dispara um DELETE em app_users para zerar a base no backend.
  useEffect(() => {
    userService
      .clearUsers()
      .catch(() => {
        // Silencia erro aqui; a tela continua funcionando mesmo se o backend não estiver disponível.
      });
  }, []);

  // Zera visão no painel: sempre mostra 0 em todos os cards.
  const passengers: any[] = [];
  const drivers: any[] = [];
  const admins: any[] = [];

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Erro ao carregar usuários. Verifique se o backend está rodando.</div>;
  }

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
            <CardTitle className="text-sm">Passageiros ({passengers.length})</CardTitle>
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
            <CardTitle className="text-sm">Motoristas ({drivers.length})</CardTitle>
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

      <div className="rounded-md border p-4">
        <h3 className="mb-4 text-sm font-medium">Lista de Usuários Recentes</h3>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Nenhum usuário encontrado.</p>
        </div>
      </div>
    </div>
  );
};

export default UsuariosPage;
