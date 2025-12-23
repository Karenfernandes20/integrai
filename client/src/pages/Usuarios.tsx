import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userService, User } from "../services/userService";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

const UsuariosPage = () => {
  const queryClient = useQueryClient();
  const [newUser, setNewUser] = useState<{
    full_name: string;
    email: string;
    phone: string;
    user_type: "passenger" | "driver";
    city_id?: number;
    state?: string;
  }>({
    full_name: "",
    email: "",
    phone: "",
    user_type: "passenger",
    city_id: undefined,
    state: "",
  });

  const { data: users = [], isLoading, error } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: userService.getUsers,
  });

  const createMutation = useMutation({
    mutationFn: userService.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setNewUser({ full_name: "", email: "", phone: "", user_type: "passenger", city_id: undefined, state: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => userService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.full_name || !newUser.phone) return;
    createMutation.mutate({
      full_name: newUser.full_name,
      email: newUser.email,
      phone: newUser.phone,
      user_type: newUser.user_type,
      city_id: newUser.city_id ?? 0,
      state: newUser.state ?? "",
    });
  };

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

  const passengers = users.filter((u) => u.user_type === "passenger");
  const drivers = users.filter((u) => u.user_type === "driver");

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Gestão de usuários</h2>
          <p className="text-xs text-muted-foreground">
            Cadastre e remova passageiros e motoristas vinculados às suas cidades.
          </p>
        </div>
      </header>

      <section className="rounded-md border bg-background/70 p-4 space-y-3">
        <h3 className="text-sm font-medium">Adicionar usuário</h3>
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-4 items-end">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Nome</label>
            <Input
              value={newUser.full_name}
              onChange={(e) => setNewUser((u) => ({ ...u, full_name: e.target.value }))}
              className="h-8 text-xs"
              placeholder="Nome completo"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Telefone</label>
            <Input
              value={newUser.phone}
              onChange={(e) => setNewUser((u) => ({ ...u, phone: e.target.value }))}
              className="h-8 text-xs"
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Tipo</label>
            <select
              value={newUser.user_type}
              onChange={(e) => setNewUser((u) => ({ ...u, user_type: e.target.value as "passenger" | "driver" }))}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="passenger">Passageiro</option>
              <option value="driver">Motorista</option>
            </select>
          </div>
          <Button type="submit" size="sm" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Salvando..." : "Cadastrar"}
          </Button>
        </form>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Passageiros ({passengers.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">Lista de passageiros cadastrados na base.</p>
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
            <p className="text-muted-foreground">Gestão de cadastros, documentos e status.</p>
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
              Gestão de acessos internos será configurada em uma próxima etapa.
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="rounded-md border p-4">
        <h3 className="mb-4 text-sm font-medium">Usuários cadastrados</h3>
        {users.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum usuário cadastrado ainda.</p>
        ) : (
          <div className="space-y-2 text-xs">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-md bg-background/70 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-foreground">{user.full_name || user.phone}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {user.user_type === "passenger" ? "Passageiro" : "Motorista"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteMutation.mutate(user.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UsuariosPage;
