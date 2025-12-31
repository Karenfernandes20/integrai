import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userService, User } from "../services/userService";
import { useState } from "react";
import { Loader2, Trash2, Power, PowerOff } from "lucide-react";

const UsuariosPage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [newUser, setNewUser] = useState<{
    full_name: string;
    email: string;
    phone: string;
    user_type: "passenger" | "driver" | "system";
    role: "ADMIN" | "USUARIO";
    password?: string;
  }>({
    full_name: "",
    email: "",
    phone: "",
    user_type: "system",
    role: "USUARIO",
    password: "",
  });

  const { data: users = [], isLoading, error } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: userService.getUsers,
  });

  const createMutation = useMutation({
    mutationFn: userService.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setNewUser({ full_name: "", email: "", phone: "", user_type: "system", role: "USUARIO", password: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => userService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: Partial<User> }) => userService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.full_name || !newUser.phone) return;

    const payload: any = {
      full_name: newUser.full_name,
      email: newUser.email,
      phone: newUser.phone,
    };

    if (newUser.user_type === 'system') {
      payload.role = newUser.role;
      payload.user_type = null;
      payload.password = newUser.password || '123456';
    } else {
      payload.user_type = newUser.user_type;
      payload.role = 'USUARIO';
    }

    createMutation.mutate(payload);
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
  const systemUsers = users.filter((u) => !u.user_type || (u.role === 'ADMIN' || u.role === 'USUARIO' && !u.user_type));

  const filteredUsers = activeTab === 'all' ? users :
    activeTab === 'passengers' ? passengers :
      activeTab === 'drivers' ? drivers : systemUsers;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie passageiros, motoristas e usuários administrativos do sistema.
          </p>
        </div>
      </header>

      {/* DASHBOARD SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-blue-50 dark:bg-blue-950/20">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] font-bold uppercase">Total Usuários</CardDescription>
            <CardTitle className="text-xl font-extrabold">{users.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-emerald-50 dark:bg-emerald-950/20">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] font-bold uppercase">Passageiros</CardDescription>
            <CardTitle className="text-xl font-extrabold text-emerald-600">{passengers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] font-bold uppercase">Motoristas</CardDescription>
            <CardTitle className="text-xl font-extrabold text-amber-600">{drivers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-purple-50 dark:bg-purple-950/20">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] font-bold uppercase">Equipe / Sistema</CardDescription>
            <CardTitle className="text-xl font-extrabold text-purple-600">{systemUsers.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FORM SIDE */}
        <Card className="lg:col-span-1 shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-base">Adicionar Novo Usuário</CardTitle>
            <CardDescription className="text-xs">Cadastre novos acessos ou clientes.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-muted-foreground">Tipo de Usuário</label>
                <select
                  value={newUser.user_type}
                  onChange={(e) => setNewUser((u) => ({ ...u, user_type: e.target.value as any }))}
                  className="w-full h-9 rounded-md border bg-background px-3 text-xs"
                >
                  <option value="system">Usuário do Sistema (Admin/Colaborador)</option>
                  <option value="passenger">Passageiro (Cliente)</option>
                  <option value="driver">Motorista</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-muted-foreground">Nome Completo</label>
                <Input
                  value={newUser.full_name}
                  onChange={(e) => setNewUser((u) => ({ ...u, full_name: e.target.value }))}
                  placeholder="Ex: João Silva"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-muted-foreground">Email (Login)</label>
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                  placeholder="joao@email.com"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-muted-foreground">Telefone / WhatsApp</label>
                <Input
                  value={newUser.phone}
                  onChange={(e) => setNewUser((u) => ({ ...u, phone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className="h-9 text-xs"
                />
              </div>

              {newUser.user_type === 'system' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-muted-foreground">Nível de Acesso</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value as any }))}
                      className="w-full h-9 rounded-md border bg-background px-3 text-xs"
                    >
                      <option value="USUARIO">Colaborador (Padrão)</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-muted-foreground">Senha Inicial</label>
                    <Input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                      placeholder="Padrão: 123456"
                      className="h-9 text-xs"
                    />
                  </div>
                </>
              )}

              <Button type="submit" className="w-full bg-[#008069] hover:bg-[#006d59] font-bold" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {createMutation.isPending ? "Salvando..." : "CADASTRAR USUÁRIO"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* LIST SIDE */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-10">
              <TabsTrigger value="all" className="text-[10px] font-bold uppercase">Todos</TabsTrigger>
              <TabsTrigger value="system" className="text-[10px] font-bold uppercase text-purple-600">Equipe</TabsTrigger>
              <TabsTrigger value="passengers" className="text-[10px] font-bold uppercase text-emerald-600">Passageiros</TabsTrigger>
              <TabsTrigger value="drivers" className="text-[10px] font-bold uppercase text-amber-600">Motoristas</TabsTrigger>
            </TabsList>

            <div className="mt-4 rounded-xl border bg-background shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-muted/30">
                <h3 className="text-sm font-bold uppercase tracking-wider">Lista de Usuários ({filteredUsers.length})</h3>
              </div>

              <div className="divide-y max-h-[600px] overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">
                    <p className="text-xs">Nenhum usuário encontrado nesta categoria.</p>
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div key={user.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900 group">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${user.user_type === 'passenger' ? 'bg-emerald-500' :
                          user.user_type === 'driver' ? 'bg-amber-500' : 'bg-purple-500'
                          }`}>
                          {(user.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{user.full_name || 'Usuário sem nome'}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">{user.email || user.phone}</span>
                            <div className="flex gap-1">
                              <Badge variant="outline" className={`text-[9px] h-4 font-bold border-none uppercase px-1.5 ${user.user_type === 'passenger' ? 'bg-emerald-100 text-emerald-700' :
                                user.user_type === 'driver' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'
                                }`}>
                                {user.user_type ? (user.user_type === 'passenger' ? 'Passageiro' : 'Motorista') : `SISTEMA (${user.role})`}
                              </Badge>
                              <Badge variant="outline" className={`text-[9px] h-4 font-bold border-none uppercase px-1.5 ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {user.is_active ? 'ATIVO' : 'INATIVO'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={user.is_active ? "h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-50" : "h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-50"}
                          onClick={() => updateMutation.mutate({ id: user.id, data: { is_active: !user.is_active } })}
                          title={user.is_active ? "Desativar" : "Ativar"}
                        >
                          {user.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(`Excluir ${user.full_name}?`)) deleteMutation.mutate(user.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default UsuariosPage;
