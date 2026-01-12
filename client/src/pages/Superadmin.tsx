import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";
import { Separator } from "../components/ui/separator";
import { useAuth } from "../contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Pencil, Trash2, Upload, Users, KeyRound, RotateCcw, ShieldAlert } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { cn } from "../lib/utils";

const AVAILABLE_PERMISSIONS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "crm", label: "CRM" },
  { id: "atendimentos", label: "Atendimentos" },
  { id: "financeiro", label: "Financeiro" },
  { id: "relatorios", label: "Relatórios" },
  { id: "configuracoes", label: "Configurações" }
];

// Schema now only validates text fields; file validation is manual or via input accept
const companySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório."),
  cnpj: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  operation_type: z.enum(["motoristas", "clientes", "pacientes"]).optional(),
});

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  logo_url: string | null;
  evolution_instance: string | null;
  evolution_apikey: string | null;
  operation_type: "motoristas" | "clientes" | "pacientes" | null;
  plan_id?: number;
  due_date?: string;
}

interface AppUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

const SuperadminPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Form states
  const [formValues, setFormValues] = useState({
    name: "",
    cnpj: "",
    city: "",
    state: "",
    phone: "",
    evolution_instance: "",
    evolution_apikey: "",
    operation_type: "clientes", // Default
    plan_id: "",
    due_date: "",
  });
  const [plans, setPlans] = useState<any[]>([]); // New state for plans
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // User Management State
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companyUsers, setCompanyUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [resetPasswords, setResetPasswords] = useState<{ [key: number]: string }>(
    {}
  );
  const [savingPassword, setSavingPassword] = useState<number | null>(null);

  // New User State
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    password: "",
    permissions: [] as string[],
    city: "",
    state: "",
    phone: "",
  });
  const [creatingUser, setCreatingUser] = useState(false);

  // System Mode State
  const [currentMode, setCurrentMode] = useState("normal");
  const [isChangingMode, setIsChangingMode] = useState(false);

  const loadMode = async () => {
    try {
      const res = await fetch("/api/admin/system/mode", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentMode(data.mode);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleModeChange = async (newMode: string) => {
    setIsChangingMode(true);
    try {
      const res = await fetch("/api/admin/system/mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode: newMode }),
      });

      if (!res.ok) throw new Error("Falha ao trocar modo");

      toast({
        title: "Modo alterado",
        description: `Sistema operando agora em modo: ${newMode.toUpperCase()}`,
      });
      setCurrentMode(newMode);
    } catch (e: any) {
      toast({
        title: "Erro ao trocar modo",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsChangingMode(false);
    }
  };

  const loadCompanies = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/companies", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Falha ao carregar empresas");
      const data = await res.json();
      setCompanies(data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao carregar empresas",
        description: "Não foi possível buscar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadCompanies();
      loadMode();
      loadCompanies();
      loadMode();
      // Load plans
      fetch("/api/plans", { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setPlans(data))
        .catch(err => console.error("Failed to load plans", err));
    }
  }, [token]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value: string) => {
    setFormValues((prev) => ({ ...prev, operation_type: value }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setRemoveLogo(false); // If they selected a file, don't remove the existing one (the new one will replace it)
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormValues({
      name: company.name ?? "",
      cnpj: company.cnpj ?? "",
      city: company.city ?? "",
      state: company.state ?? "",
      phone: company.phone ?? "",
      evolution_instance: company.evolution_instance ?? "",
      evolution_apikey: company.evolution_apikey ?? "",
      operation_type: company.operation_type ?? "clientes",
      plan_id: company.plan_id ? String(company.plan_id) : "",
      due_date: company.due_date ? new Date(company.due_date).toISOString().split('T')[0] : "",
    });
    setSelectedFile(null);
    setRemoveLogo(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenDashboard = (company: Company) => {
    navigate(`/app/dashboard?companyId=${company.id}`);
  };

  const resetForm = () => {
    setEditingCompany(null);
    setFormValues({
      name: "",
      cnpj: "",
      city: "",
      state: "",
      phone: "",
      evolution_instance: "",
      evolution_apikey: "",
      operation_type: "clientes",
      plan_id: "",
      due_date: "",
    });
    setSelectedFile(null);
    setRemoveLogo(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = companySchema.safeParse({
      name: formValues.name,
      cnpj: formValues.cnpj,
      city: formValues.city,
      state: formValues.state,
      phone: formValues.phone
    });
    // Schema doesn't validate evolution fields yet, keeping strict only on basic info or adding if needed

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      toast({
        title: "Dados inválidos",
        description: issue?.message ?? "Verifique os campos do formulário.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const url = editingCompany ? `/api/companies/${editingCompany.id}` : "/api/companies";
      const method = editingCompany ? "PUT" : "POST";

      const formData = new FormData();
      formData.append("name", parsed.data.name);
      if (parsed.data.cnpj) formData.append("cnpj", parsed.data.cnpj);
      if (parsed.data.city) formData.append("city", parsed.data.city);
      if (parsed.data.state) formData.append("state", parsed.data.state);
      if (parsed.data.phone) formData.append("phone", parsed.data.phone);
      formData.append("operation_type", formValues.operation_type);
      if (formValues.plan_id) formData.append("plan_id", formValues.plan_id);
      if (formValues.due_date) formData.append("due_date", formValues.due_date);

      // Evolution fields
      if (formValues.evolution_instance) formData.append("evolution_instance", formValues.evolution_instance);
      if (formValues.evolution_apikey) formData.append("evolution_apikey", formValues.evolution_apikey);

      if (selectedFile) {
        formData.append("logo", selectedFile);
      } else if (removeLogo) {
        formData.append("remove_logo", "true");
      }

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          // Content-Type is set automatically by browser for FormData
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao salvar empresa");
      }

      toast({
        title: editingCompany ? "Empresa atualizada" : "Empresa cadastrada",
        description: "Operação realizada com sucesso.",
      });

      resetForm();
      await loadCompanies();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro inesperado",
        description: err.message || "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (company: Company) => {
    try {
      setDeletingId(company.id);
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Erro ao excluir empresa");

      toast({
        title: "Empresa excluída",
        description: `A empresa ${company.name} foi removida com sucesso.`,
      });

      await loadCompanies();
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro inesperado",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleManageUsers = async (company: Company) => {
    setSelectedCompanyId(company.id);
    setLoadingUsers(true);
    setCompanyUsers([]);
    setCompanyUsers([]);
    setNewUser({ full_name: "", email: "", password: "", permissions: [], city: "", state: "", phone: "" }); // Reset form
    try {
      const res = await fetch(`/api/companies/${company.id}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCompanyUsers(data);
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Erro ao carregar usuários",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handlePasswordChange = (userId: number, value: string) => {
    setResetPasswords((prev) => ({ ...prev, [userId]: value }));
  };

  const submitPasswordReset = async (userId: number) => {
    const newPassword = resetPasswords[userId];
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }

    setSavingPassword(userId);
    try {
      const res = await fetch(`/api/users/${userId}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!res.ok) throw new Error();

      toast({ title: "Senha atualizada com sucesso!" });
      setResetPasswords((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch (e) {
      toast({ title: "Erro ao resetar senha", variant: "destructive" });
    } finally {
      setSavingPassword(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;
    if (!newUser.full_name || !newUser.email || !newUser.password) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    setCreatingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newUser,
          company_id: selectedCompanyId,
          role: "ADMIN", // Defaulting to Admin for company users created this way, or could be USUARIO
          user_type: "company_user",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao criar usuário");
      }

      const createdUser = await res.json();
      setCompanyUsers((prev) => [createdUser, ...prev]);
      setNewUser({ full_name: "", email: "", password: "", permissions: [], city: "", state: "", phone: "" });
      toast({ title: "Usuário adicionado com sucesso!" });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Erro ao excluir usuário");

      toast({
        title: "Usuário excluído",
        description: "O usuário foi removido com sucesso.",
      });

      setCompanyUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro inesperado",
        description: err.message || "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-stretch bg-gradient-to-br from-primary-soft via-background to-primary/5 px-4 py-6">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 md:flex-row">
        <section className="flex-1 space-y-4">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
              Painel de <span className="text-primary">Gestão de Clientes</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Cadastre e gerencie seus clientes, visualize estatísticas e acesse os painéis individuais.
            </p>
          </header>
          <Card className="border border-primary-soft/70 bg-card/95 shadow-strong">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base sm:text-lg">Carteira de Clientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando empresas...</p>
              ) : companies.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada até o momento.</p>
              ) : (
                <div className="space-y-2 overflow-hidden rounded-xl border border-border/60 bg-background/60">
                  <div className="grid grid-cols-6 gap-3 border-b border-border/60 bg-muted/60 px-3 py-2 text-[11px] font-medium text-muted-foreground sm:text-xs">
                    <span>Nome</span>
                    <span>CNPJ</span>
                    <span>Cidade/UF</span>
                    <span>Vencimento</span>
                    <span>Logo</span>
                    <span className="text-right">Ações</span>
                  </div>
                  <div className="divide-y divide-border/60">
                    {companies.map((company) => (
                      <div
                        key={company.id}
                        className="grid grid-cols-6 items-center gap-3 px-3 py-2 text-[11px] sm:text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenDashboard(company)}
                          className="truncate text-left font-medium text-primary hover:underline"
                        >
                          {company.name}
                        </button>
                        <span className="truncate text-muted-foreground">{company.cnpj || "-"}</span>
                        <span className="truncate text-muted-foreground">
                          {company.city || company.state ? `${company.city ?? ""}/${company.state ?? ""}` : "-"}
                        </span>
                        <span className={cn("truncate font-medium",
                          company.due_date && new Date(company.due_date) < new Date() ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {company.due_date ? new Date(company.due_date).toLocaleDateString('pt-BR') : "-"}
                        </span>
                        <div className="truncate text-primary flex items-center gap-2">
                          {company.logo_url ? (
                            <>
                              <img src={company.logo_url} alt="Logo" className="h-6 w-6 object-cover rounded" />
                              <span>Configurado</span>
                            </>
                          ) : "Sem logo"}
                        </div>
                        <span className="flex items-center justify-end gap-1.5">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 border-primary-soft/60 text-primary"
                                onClick={() => handleManageUsers(company)}
                              >
                                <Users className="h-3.5 w-3.5" />
                                <span className="sr-only">Usuários</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Usuários: {company.name}</DialogTitle>
                                <DialogDescription>
                                  Gerencie o acesso dos usuários desta empresa.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                {loadingUsers ? (
                                  <p className="text-sm text-muted-foreground">Carregando usuários...</p>
                                ) : (
                                  <div className="space-y-4">
                                    {companyUsers.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
                                    ) : (
                                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {companyUsers.map(user => (
                                          <div key={user.id} className="flex items-center justify-between rounded-lg border p-3 bg-muted/40">
                                            <div className="space-y-1">
                                              <p className="text-sm font-medium">{user.full_name}</p>
                                              <p className="text-xs text-muted-foreground">{user.email}</p>
                                              <span className="text-[10px] uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded">{user.role}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="flex items-center gap-2">
                                                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                                                <Input
                                                  type="password"
                                                  placeholder="Nova senha"
                                                  className="h-7 w-32 text-xs"
                                                  value={resetPasswords[user.id] || ''}
                                                  onChange={(e) => handlePasswordChange(user.id, e.target.value)}
                                                />
                                              </div>
                                              <Button
                                                size="sm"
                                                className="h-7 text-xs"
                                                disabled={savingPassword === user.id}
                                                onClick={() => submitPasswordReset(user.id)}
                                              >
                                                {savingPassword === user.id ? 'Sal...' : 'Redefinir'}
                                              </Button>

                                              <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                  <Button
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-7 w-7 border-destructive/40 text-destructive"
                                                    title="Excluir Usuário"
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                  </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                  <AlertDialogHeader>
                                                    <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                      Tem certeza que deseja excluir o usuário {user.full_name}? Esta ação não pode ser desfeita.
                                                    </AlertDialogDescription>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction
                                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                      onClick={() => handleDeleteUser(user.id)}
                                                    >
                                                      Excluir
                                                    </AlertDialogAction>
                                                  </AlertDialogFooter>
                                                </AlertDialogContent>
                                              </AlertDialog>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <Separator />

                                    <div className="space-y-3 pt-2">
                                      <h4 className="text-sm font-medium">Adicionar novo usuário</h4>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <Input
                                          placeholder="Nome completo"
                                          className="h-8 text-xs"
                                          value={newUser.full_name}
                                          onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                                        />
                                        <Input
                                          placeholder="Email"
                                          type="email"
                                          className="h-8 text-xs"
                                          value={newUser.email}
                                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        />
                                        <Input
                                          placeholder="Senha"
                                          type="password"
                                          className="h-8 text-xs"
                                          value={newUser.password}
                                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                        />
                                        <Input
                                          placeholder="Telefone"
                                          className="h-8 text-xs"
                                          value={newUser.phone}
                                          onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                                        />
                                        <Input
                                          placeholder="Cidade"
                                          className="h-8 text-xs"
                                          value={newUser.city}
                                          onChange={(e) => setNewUser({ ...newUser, city: e.target.value })}
                                        />
                                        <Input
                                          placeholder="UF"
                                          className="h-8 text-xs"
                                          maxLength={2}
                                          value={newUser.state}
                                          onChange={(e) => setNewUser({ ...newUser, state: e.target.value.toUpperCase() })}
                                        />
                                        <div className="col-span-1 md:col-span-3 flex justify-end">
                                          <Button
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={handleCreateUser}
                                            disabled={creatingUser}
                                          >
                                            {creatingUser ? "Adicionando..." : "Adicionar Usuário"}
                                          </Button>
                                        </div>
                                      </div>

                                      <div className="pt-2">
                                        <label className="text-xs font-medium mb-2 block">Permissões de Acesso</label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                          {AVAILABLE_PERMISSIONS.map((perm) => (
                                            <div key={perm.id} className="flex items-center space-x-2">
                                              <Checkbox
                                                id={`perm-${perm.id}`}
                                                checked={newUser.permissions.includes(perm.id)}
                                                onCheckedChange={(checked) => {
                                                  setNewUser(prev => {
                                                    if (checked) {
                                                      return { ...prev, permissions: [...prev.permissions, perm.id] };
                                                    } else {
                                                      return { ...prev, permissions: prev.permissions.filter(p => p !== perm.id) };
                                                    }
                                                  })
                                                }}
                                              />
                                              <label
                                                htmlFor={`perm-${perm.id}`}
                                                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                              >
                                                {perm.label}
                                              </label>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 border-primary-soft/60 text-primary"
                            onClick={() => handleEdit(company)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 border-destructive/40 text-destructive"
                                disabled={deletingId === company.id}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="sr-only">Excluir</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir a empresa {company.name}? Esta ação não pode ser
                                  desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(company)}
                                >
                                  {deletingId === company.id ? "Excluindo..." : "Confirmar"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="w-full max-w-md space-y-6">
          <Card className="border border-primary-soft/70 bg-card/95 shadow-strong">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" />
                Modos Operacionais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={currentMode === "normal" ? "default" : "outline"}
                  className={cn("h-16 flex-col gap-1", currentMode === "normal" && "border-2 border-primary")}
                  onClick={() => handleModeChange("normal")}
                  disabled={isChangingMode}
                >
                  <span className="font-bold">Normal</span>
                  <span className="text-[10px] opacity-70">Padrão</span>
                </Button>
                <Button
                  variant={currentMode === "maintenance" ? "default" : "outline"}
                  className={cn("h-16 flex-col gap-1", currentMode === "maintenance" && "bg-amber-500 hover:bg-amber-600 text-white")}
                  onClick={() => handleModeChange("maintenance")}
                  disabled={isChangingMode}
                >
                  <span className="font-bold">Manutenção</span>
                  <span className="text-[10px] opacity-70">Admin apenas</span>
                </Button>
                <Button
                  variant={currentMode === "emergency" ? "default" : "outline"}
                  className={cn("h-16 flex-col gap-1", currentMode === "emergency" && "bg-red-600 hover:bg-red-700 text-white")}
                  onClick={() => handleModeChange("emergency")}
                  disabled={isChangingMode}
                >
                  <span className="font-bold">Emergência</span>
                  <span className="text-[10px] opacity-70">SuperAdmin</span>
                </Button>
                <Button
                  variant={currentMode === "readonly" ? "default" : "outline"}
                  className={cn("h-16 flex-col gap-1", currentMode === "readonly" && "bg-blue-600 hover:bg-blue-700 text-white")}
                  onClick={() => handleModeChange("readonly")}
                  disabled={isChangingMode}
                >
                  <span className="font-bold">Somente Leitura</span>
                  <span className="text-[10px] opacity-70">Bloqueia escrita</span>
                </Button>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg border text-xs text-muted-foreground space-y-1">
                <p>● <b>Normal:</b> Acesso total para todos.</p>
                <p>● <b>Manutenção:</b> Apenas administradores entram.</p>
                <p>● <b>Emergência:</b> Apenas SuperAdmin entra.</p>
                <p>● <b>Somente Leitura:</b> Ninguém pode salvar ou deletar.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-primary-soft/70 bg-card/95 shadow-strong">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Novo Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleSubmit}>
                {/* Form fields: Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome do Cliente / Empresa</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Minha Empresa"
                    required
                    value={formValues.name}
                    onChange={handleChange}
                  />
                </div>
                {/* Form fields: CNPJ */}
                <div className="space-y-1.5">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    name="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={formValues.cnpj}
                    onChange={handleChange}
                  />
                </div>
                {/* Form fields: City/State */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      name="city"
                      placeholder="Goiânia"
                      value={formValues.city}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="state">UF</Label>
                    <Input
                      id="state"
                      name="state"
                      placeholder="GO"
                      maxLength={2}
                      value={formValues.state}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Operation Type Selector */}
                <div className="space-y-1.5">
                  <Label htmlFor="operation_type">Tipo de Operação</Label>
                  <Select onValueChange={handleSelectChange} value={formValues.operation_type}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o ramo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clientes">Clientes (Padrão)</SelectItem>
                      <SelectItem value="motoristas">Motoristas</SelectItem>
                      <SelectItem value="pacientes">Pacientes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Form fields: Phone */}
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone de contato</Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="(62) 99999-9999"
                    value={formValues.phone}
                    onChange={handleChange}
                  />
                </div>


                <Separator className="my-2" />
                <p className="text-sm font-semibold text-primary">Integração Evolution API</p>

                <div className="space-y-1.5">
                  <Label htmlFor="evolution_instance">Nome da Instância</Label>
                  <Input
                    id="evolution_instance"
                    name="evolution_instance"
                    placeholder="minha-instancia"
                    value={formValues.evolution_instance}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="evolution_apikey">API Key</Label>
                  <Input
                    id="evolution_apikey"
                    name="evolution_apikey"
                    type="password"
                    placeholder="sk_..."
                    value={formValues.evolution_apikey}
                    onChange={handleChange}
                  />
                </div>

                <Separator className="my-2" />
                <p className="text-sm font-semibold text-primary">Plano e Pagamento</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="plan_id">Plano</Label>
                    <Select onValueChange={(val) => setFormValues(prev => ({ ...prev, plan_id: val }))} value={String(formValues.plan_id)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o plano" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map(p => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="due_date">Vencimento</Label>
                    <Input
                      id="due_date"
                      name="due_date"
                      type="date"
                      value={formValues.due_date}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <Separator className="my-2" />

                <div className="space-y-2">
                  <Label htmlFor="logo">Logo da empresa</Label>

                  {editingCompany?.logo_url && !selectedFile && (
                    <div className="flex items-center gap-3 p-2 rounded-lg border border-primary-soft/40 bg-primary-soft/5 mb-1.5 transition-all">
                      <div className="relative">
                        <img
                          src={editingCompany.logo_url}
                          alt="Logo"
                          className={cn(
                            "h-12 w-12 rounded object-contain bg-white border border-border/50",
                            removeLogo && "opacity-40 grayscale"
                          )}
                        />
                        {removeLogo && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="h-0.5 w-6 bg-destructive absolute rotate-45" />
                            <span className="h-0.5 w-6 bg-destructive absolute -rotate-45" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate leading-tight">
                          {removeLogo ? "Marcar para remover" : "Logotipo atual"}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {removeLogo ? "A logo será apagada ao salvar" : "Imagem configurada no perfil"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8",
                          removeLogo ? "text-primary hover:bg-primary/10" : "text-destructive hover:bg-destructive/10"
                        )}
                        onClick={() => setRemoveLogo(!removeLogo)}
                        title={removeLogo ? "Cancelar remoção" : "Remover logotipo"}
                      >
                        {removeLogo ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Input
                      id="logo"
                      name="logo"
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="flex-1 cursor-pointer h-9 text-xs"
                    />
                    {selectedFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="text-xs h-9 px-3"
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground px-1">
                    Formatos aceitos: JPG, PNG, WEBP, GIF. Máx 5MB.
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button type="submit" className="flex-1" size="lg" disabled={isSubmitting}>
                    {isSubmitting
                      ? "Salvando..."
                      : editingCompany
                        ? "Atualizar empresa"
                        : "Salvar empresa"}
                  </Button>
                  {editingCompany && (
                    <Button type="button" variant="outline" size="lg" onClick={resetForm}>
                      Cancelar edição
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
    </div >
  );
};

export default SuperadminPage;
