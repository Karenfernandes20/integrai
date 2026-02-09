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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";

const PERMISSION_GROUPS = [
  {
    name: "📊 Financeiro",
    permissions: [
      { id: 'finance.view', label: 'Visualizar financeiro' },
      { id: 'finance.create', label: 'Criar cobranças' },
      { id: 'finance.edit', label: 'Editar cobranças' },
      { id: 'finance.delete', label: 'Excluir cobranças' },
      { id: 'finance.export', label: 'Exportar relatórios' }
    ]
  },
  {
    name: "📋 Cadastros",
    permissions: [
      { id: 'reg.companies', label: 'Empresas' },
      { id: 'reg.users', label: 'Usuários' },
      { id: 'reg.clients', label: 'Clientes' },
      { id: 'reg.professionals', label: 'Profissionais' },
      { id: 'reg.products', label: 'Produtos' },
      { id: 'reg.services', label: 'Serviços' }
    ]
  },
  {
    name: "📅 Agendamentos",
    permissions: [
      { id: 'schedule.view', label: 'Visualizar agenda' },
      { id: 'schedule.create', label: 'Criar agendamento' },
      { id: 'schedule.edit', label: 'Editar agendamento' },
      { id: 'schedule.cancel', label: 'Cancelar agendamento' },
      { id: 'schedule.delete', label: 'Excluir agendamento' },
      { id: 'schedule.view_others', label: 'Ver agenda de outros usuários' }
    ]
  },
  {
    name: "💬 Atendimentos / CRM",
    permissions: [
      { id: 'crm.view', label: 'Visualizar atendimentos' },
      { id: 'crm.attend', label: 'Atender clientes' },
      { id: 'crm.transfer', label: 'Transferir atendimento' },
      { id: 'crm.close', label: 'Encerrar atendimento' },
      { id: 'crm.move_cards', label: 'Mover cards no CRM' },
      { id: 'crm.edit_stages', label: 'Editar etapas do funil' }
    ]
  },
  {
    name: "🤖 Chatbot",
    permissions: [
      { id: 'bot.view', label: 'Visualizar chatbots' },
      { id: 'bot.create', label: 'Criar chatbot' },
      { id: 'bot.edit', label: 'Editar chatbot' },
      { id: 'bot.publish', label: 'Publicar chatbot' },
      { id: 'bot.connect', label: 'Conectar chatbot a números' },
      { id: 'bot.metrics', label: 'Visualizar métricas' }
    ]
  },
  {
    name: "📣 Campanhas",
    permissions: [
      { id: 'campaigns.create', label: 'Criar campanhas' },
      { id: 'campaigns.edit', label: 'Editar campanhas' },
      { id: 'campaigns.send', label: 'Disparar campanhas' },
      { id: 'campaigns.report', label: 'Ver relatórios' }
    ]
  },
  {
    name: "📦 Estoque / Vendas",
    permissions: [
      { id: 'inventory.view', label: 'Visualizar estoque' },
      { id: 'inventory.create_prod', label: 'Criar produto' },
      { id: 'inventory.edit_prod', label: 'Editar produto' },
      { id: 'inventory.delete_prod', label: 'Excluir produto' },
      { id: 'inventory.sale', label: 'Registrar venda' },
      { id: 'inventory.cancel_sale', label: 'Cancelar venda' }
    ]
  },
  {
    name: "📈 BI / Relatórios",
    permissions: [
      { id: 'bi.view', label: 'Visualizar dashboards' },
      { id: 'bi.create_report', label: 'Criar relatórios' },
      { id: 'bi.export', label: 'Exportar dados' }
    ]
  },
  {
    name: "⚙️ Configurações",
    permissions: [
      { id: 'settings.company', label: 'Configurações da empresa' },
      { id: 'settings.integrations', label: 'Integrações' },
      { id: 'settings.whatsapp', label: 'Instâncias WhatsApp' },
      { id: 'settings.qrcode', label: 'QR Code' },
      { id: 'settings.webhooks', label: 'Webhooks / n8n' }
    ]
  }
];

// Schema now only validates text fields; file validation is manual or via input accept
const companySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório."),
  cnpj: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  operation_type: z.enum(["motoristas", "clientes", "pacientes", "lavajato", "restaurante", "loja"]).optional(),
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
  operation_type: "motoristas" | "clientes" | "pacientes" | "lavajato" | "restaurante" | "loja" | null;
  category: "generic" | "lavajato" | "restaurante" | "loja" | null;
  plan_id?: number;
  due_date?: string;
  max_instances?: number;
  // Instagram fields
  instagram_enabled?: boolean;
  instagram_app_id?: string;
  instagram_app_secret?: string;
  instagram_page_id?: string;
  instagram_business_id?: string;
  instagram_access_token?: string;
  instagram_status?: 'ATIVO' | 'INATIVO' | 'ERRO';
}

interface AppUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface CompanyInstance {
  id: number;
  company_id: number;
  name: string;
  instance_key: string;
  api_key: string;
  status: string;
}

const SuperadminPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Legal Pages State
  const [legalTerms, setLegalTerms] = useState("");
  const [legalPrivacy, setLegalPrivacy] = useState("");
  const [savingLegal, setSavingLegal] = useState<string | null>(null);


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
    category: "generic", // Default
    plan_id: "",
    due_date: "",
    max_instances: "1",
    // Instagram
    instagram_enabled: false,
    instagram_app_id: "",
    instagram_app_secret: "",
    instagram_page_id: "",
    instagram_business_id: "",
    instagram_access_token: "",
    instagram_status: "",
  });
  const [plans, setPlans] = useState<any[]>([]); // New state for plans
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Instance Management State
  const [instancesConfigOpen, setInstancesConfigOpen] = useState(false);
  const [currentInstances, setCurrentInstances] = useState<CompanyInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);

  const [availablePlans, setAvailablePlans] = useState<any[]>([]);

  // Fetch Companies
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
    role: "USER" as string,
    permissions: [] as string[],
    city: "",
    state: "",
    phone: "",
  });
  const [creatingUser, setCreatingUser] = useState(false);

  // Permissions utility
  const togglePermission = (permId: string) => {
    setNewUser(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  const handleRolePreset = (role: string) => {
    if (role === 'ADMIN') {
      const allPerms = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.id));
      setNewUser(prev => ({ ...prev, role, permissions: allPerms }));
    } else {
      // Clear permissions for manual selection when not ADMIN
      setNewUser(prev => ({ ...prev, role, permissions: [] }));
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

  const loadLegalPages = async () => {
    try {
      const [resTerms, resPrivacy] = await Promise.all([
        fetch('/api/legal-pages/terms'),
        fetch('/api/legal-pages/privacy')
      ]);

      if (resTerms.ok) {
        const data = await resTerms.json();
        setLegalTerms(data.content || '');
      }
      if (resPrivacy.ok) {
        const data = await resPrivacy.json();
        setLegalPrivacy(data.content || '');
      }
    } catch (e) {
      console.error("Failed to load legal pages", e);
    }
  };

  useEffect(() => {
    if (token) {
      loadCompanies();
      loadLegalPages(); // Load legal pages

      // Load plans
      fetch("/api/plans", { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setPlans(data))
        .catch(err => console.error("Failed to load plans", err));
    }
  }, [token]);

  const handleSaveLegal = async (type: 'terms' | 'privacy') => {
    try {
      setSavingLegal(type);
      const content = type === 'terms' ? legalTerms : legalPrivacy;

      const res = await fetch(`/api/legal-pages/${type}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });

      if (!res.ok) throw new Error('Falha ao salvar');

      toast({
        title: "Salvo com sucesso!",
        description: `Página de ${type === 'terms' ? 'Termos' : 'Privacidade'} atualizada.`
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao salvar",
        variant: "destructive"
      });
    } finally {
      setSavingLegal(null);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };



  const handleSelectChange = (value: string) => {
    setFormValues((prev) => ({
      ...prev,
      operation_type: value
    }));
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
      category: company.category ?? "generic",
      plan_id: company.plan_id ? String(company.plan_id) : "",
      due_date: company.due_date ? new Date(company.due_date).toISOString().split('T')[0] : "",
      max_instances: company.max_instances ? String(company.max_instances) : "1",
      // Instagram Mapping
      instagram_enabled: company.instagram_enabled || false,
      instagram_app_id: company.instagram_app_id || "",
      instagram_app_secret: company.instagram_app_secret || "",
      instagram_page_id: company.instagram_page_id || "",
      instagram_business_id: company.instagram_business_id || "",
      instagram_access_token: company.instagram_access_token || "",
      instagram_status: company.instagram_status || "",
    });
    setSelectedFile(null);
    setRemoveLogo(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Reset instances state
    setCurrentInstances([]);

    // Auto load instances if editing
    loadInstancesForCompany(company.id);
  };

  const loadInstancesForCompany = async (companyId: string | number) => {
    setLoadingInstances(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/instances`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentInstances(data);

        // Populate form definitions to show inputs in Edit Mode
        setFormValues(prev => {
          const currentMax = parseInt(prev.max_instances) || 1;
          const newDefs = data.map((inst: any) => ({
            name: inst.name,
            instance_key: inst.instance_key,
            api_key: inst.api_key || ''
          }));

          // Pad if necessary (e.g. if max_instances > connected instances)
          while (newDefs.length < currentMax) {
            newDefs.push({ name: `Instância ${newDefs.length + 1}`, instance_key: '', api_key: '' });
          }

          return {
            ...prev,
          };
        });
      } else {
        toast({ title: "Erro", description: "Falha ao carregar instâncias", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro", description: "Erro de conexão", variant: "destructive" });
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleUpdateInstanceConfig = async (instanceId: number, field: string, value: string) => {
    // Optimistic update
    setCurrentInstances(prev => prev.map(inst =>
      inst.id === instanceId ? { ...inst, [field]: value } : inst
    ));

    try {
      const res = await fetch(`/api/companies/${editingCompany?.id}/instances/${instanceId}`, {
        method: 'PUT',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ [field]: value })
      });

      if (!res.ok) throw new Error("Failed");

      // Optional: Update success state or toast
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao salvar configuração da instância", variant: "destructive" });
    }
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
      category: "generic",
      plan_id: "",
      due_date: "",
      max_instances: "1",
      instagram_enabled: false,
      instagram_app_id: "",
      instagram_app_secret: "",
      instagram_page_id: "",
      instagram_business_id: "",
      instagram_access_token: "",
      instagram_status: "",
    });
    setSelectedFile(null);
    setRemoveLogo(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCurrentInstances([]);
    setInstancesConfigOpen(false);
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
      formData.append("category", formValues.category || "generic");
      if (formValues.plan_id) formData.append("plan_id", formValues.plan_id);
      if (formValues.due_date) formData.append("due_date", formValues.due_date);
      if (formValues.max_instances) formData.append("max_instances", formValues.max_instances);

      // Evolution fields
      if (formValues.evolution_instance) formData.append("evolution_instance", formValues.evolution_instance);
      if (formValues.evolution_apikey) formData.append("evolution_apikey", formValues.evolution_apikey);

      // Instagram fields
      if (formValues.instagram_enabled) {
        formData.append("instagram_enabled", "true");
        if (formValues.instagram_app_id) formData.append("instagram_app_id", formValues.instagram_app_id);
        if (formValues.instagram_app_secret) formData.append("instagram_app_secret", formValues.instagram_app_secret);
        if (formValues.instagram_page_id) formData.append("instagram_page_id", formValues.instagram_page_id);
        if (formValues.instagram_business_id) formData.append("instagram_business_id", formValues.instagram_business_id);
        if (formValues.instagram_access_token) formData.append("instagram_access_token", formValues.instagram_access_token);
      } else {
        formData.append("instagram_enabled", "false");
      }

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
    setNewUser({ full_name: "", email: "", password: "", role: "USER", permissions: [], city: "", state: "", phone: "" }); // Reset form
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
          user_type: "company_user",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error + (data.details ? `: ${data.details}` : "") || "Erro ao criar usuário");
      }

      const createdUser = await res.json();
      setCompanyUsers((prev) => [createdUser, ...prev]);
      setNewUser({ full_name: "", email: "", password: "", role: "USER", permissions: [], city: "", state: "", phone: "" });
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
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">Super Admin</h1>
            <p className="text-slate-500 mt-1">Gestão global do sistema Integrai</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.open('/termos-de-servico', '_blank')}>Ver Termos</Button>
            <Button variant="outline" onClick={() => window.open('/politica-de-privacidade', '_blank')}>Ver Privacidade</Button>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <section className="w-full lg:w-[320px] space-y-6 shrink-0">
            {/* COMPANIES LIST */}
            <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between py-3 px-4 bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-[14px] font-medium text-[#475569] flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#64748B]" />
                  Empresas Cadastradas ({companies.length})
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-[#64748B]" onClick={loadCompanies} disabled={isLoading} title="Atualizar">
                  <RotateCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">Carregando empresas...</div>
                ) : (
                  <div className="space-y-2 p-2">
                    {companies.map((company) => (
                      <div
                        key={company.id}
                        className="flex flex-col py-2 px-3 rounded-[10px] bg-white border border-transparent hover:border-slate-100 hover:bg-[#F8FAFC] transition-all gap-2 group shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {company.logo_url ? (
                            <img src={company.logo_url} alt={company.name} className="h-8 w-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-medium text-[10px] border border-slate-200 shrink-0 uppercase">
                              {company.name.substring(0, 2)}
                            </div>
                          )}
                          <div className="space-y-0 min-w-0 flex-1">
                            <h3 className="font-medium text-slate-700 text-[13px] truncate">{company.name}</h3>
                            <div className="flex gap-2 text-[11px] text-[#94A3B8] items-center">
                              <span className="font-mono">#{company.id}</span>
                              {company.city && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="truncate">{company.city}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[#64748B] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={() => handleOpenDashboard(company)}
                            title="Ver Dashboard"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-end gap-1 px-1">
                          {/* USERS DIALOG */}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-[#64748B] hover:text-primary transition-colors" onClick={() => handleManageUsers(company)} title="Gerenciar Usuários">
                                <Users className="w-3.5 h-3.5" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
                              <DialogHeader>
                                <DialogTitle className="truncate">Usuários - {company.name}</DialogTitle>
                                <DialogDescription>Gerencie o acesso a esta empresa.</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-6 pt-4">
                                <div className="space-y-2">
                                  <h3 className="font-medium text-sm">Usuários Existentes</h3>
                                  {loadingUsers ? <p className="text-xs">Carregando...</p> : companyUsers.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum usuário.</p> : (
                                    <div className="grid gap-2">
                                      {companyUsers.map(u => (
                                        <div key={u.id} className="flex justify-between items-center p-2 border rounded bg-muted/20">
                                          <div className="text-sm">
                                            <div className="font-medium">{u.full_name}</div>
                                            <div className="text-xs text-muted-foreground">{u.email} ({u.role})</div>
                                          </div>
                                          <div className="flex gap-1">
                                            <Dialog>
                                              <DialogTrigger asChild>
                                                <Button size="icon" variant="ghost" className="h-7 w-7"><KeyRound className="w-3 h-3" /></Button>
                                              </DialogTrigger>
                                              <DialogContent>
                                                <DialogHeader><DialogTitle>Resetar Senha</DialogTitle></DialogHeader>
                                                <div className="flex gap-2 pt-4">
                                                  <Input
                                                    type="password"
                                                    placeholder="Nova Senha"
                                                    value={resetPasswords[u.id] || ''}
                                                    onChange={e => handlePasswordChange(u.id, e.target.value)}
                                                  />
                                                  <Button onClick={() => submitPasswordReset(u.id)}>Salvar</Button>
                                                </div>
                                              </DialogContent>
                                            </Dialog>
                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteUser(u.id)}><Trash2 className="w-3 h-3" /></Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <Separator />
                                <div className="space-y-4">
                                  <h3 className="font-medium text-sm">Adicionar Usuário</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Input placeholder="Nome" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} className="h-8 text-xs" />
                                    <Input placeholder="Email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="h-8 text-xs" />
                                    <Input placeholder="Senha" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="h-8 text-xs" />
                                    <Input placeholder="Telefone" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} className="h-8 text-xs" />

                                    <div className="space-y-1.5">
                                      <Label className="text-[10px]">Cargo (Role)</Label>
                                      <Select value={newUser.role} onValueChange={handleRolePreset}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="ADMIN">Administrador</SelectItem>
                                          <SelectItem value="MANAGER">Gestor</SelectItem>
                                          <SelectItem value="USER">Usuário</SelectItem>
                                          <SelectItem value="READ_ONLY">Somente Leitura</SelectItem>
                                          <SelectItem value="CUSTOM">Personalizado</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="flex items-end">
                                      <Button size="sm" onClick={handleCreateUser} disabled={creatingUser} className="w-full h-8 text-xs">
                                        {creatingUser ? 'Adicionando...' : 'Adicionar Usuário'}
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="space-y-4 border rounded-lg p-4 bg-slate-50/50 mt-4">
                                    <h4 className="font-bold text-sm border-b pb-2 flex items-center gap-2">
                                      🧩 Permissões Granulares
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                      {PERMISSION_GROUPS.map(group => (
                                        <div key={group.name} className="space-y-2">
                                          <Label className="text-xs font-bold text-primary flex items-center gap-1">
                                            {group.name}
                                          </Label>
                                          <div className="space-y-2 pl-1">
                                            {group.permissions.map(perm => (
                                              <div key={perm.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                  id={`perm-${perm.id}`}
                                                  checked={newUser.permissions.includes(perm.id)}
                                                  onCheckedChange={() => togglePermission(perm.id)}
                                                  className="h-3.5 w-3.5"
                                                />
                                                <label htmlFor={`perm-${perm.id}`} className="text-[11px] leading-none cursor-pointer text-slate-700 hover:text-primary transition-colors">
                                                  {perm.label}
                                                </label>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Button size="icon" variant="ghost" className="h-7 w-7 text-[#64748B] hover:text-primary transition-colors" onClick={() => handleEdit(company)} title="Editar Empresa">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="text-[#64748B] hover:text-destructive h-7 w-7 transition-colors" title="Excluir Empresa">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="truncate">Excluir {company.name}?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive" onClick={() => handleDelete(company)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* LEGAL PAGES EDITOR */}
            <Card className="border border-primary-soft/70 bg-card/95 shadow-strong">
              <CardHeader>
                <CardTitle className="text-xl">Páginas Legais</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="terms" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="terms">Termos de Serviço</TabsTrigger>
                    <TabsTrigger value="privacy">Política de Privacidade</TabsTrigger>
                  </TabsList>

                  <TabsContent value="terms" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Conteúdo HTML (Termos)</Label>
                      <Textarea
                        rows={15}
                        value={legalTerms}
                        onChange={(e) => setLegalTerms(e.target.value)}
                        className="font-mono text-xs"
                        placeholder="Use tags HTML: <h2>Título</h2>, <p>Parágrafo</p>"
                      />
                    </div>
                    <Button
                      onClick={() => handleSaveLegal('terms')}
                      disabled={savingLegal === 'terms'}
                    >
                      {savingLegal === 'terms' ? 'Salvando...' : 'Salvar Termos'}
                    </Button>
                  </TabsContent>

                  <TabsContent value="privacy" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Conteúdo HTML (Privacidade)</Label>
                      <Textarea
                        rows={15}
                        value={legalPrivacy}
                        onChange={(e) => setLegalPrivacy(e.target.value)}
                        className="font-mono text-xs"
                        placeholder="Use tags HTML: <h2>Título</h2>, <p>Parágrafo</p>"
                      />
                    </div>
                    <Button
                      onClick={() => handleSaveLegal('privacy')}
                      disabled={savingLegal === 'privacy'}
                    >
                      {savingLegal === 'privacy' ? 'Salvando...' : 'Salvar Política'}
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>

          <section className="flex-1 w-full space-y-6">


            {/* NOVO CLIENTE / EDITAR */}
            <Card className="border border-primary-soft/70 bg-card/95 shadow-strong">
              <CardHeader><CardTitle>{editingCompany ? 'Editar Empresa' : 'Novo Cliente'}</CardTitle></CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Nome da Empresa</Label>
                      <Input name="name" value={formValues.name} onChange={handleChange} required placeholder="Nome Fantasia" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CNPJ</Label>
                      <Input name="cnpj" value={formValues.cnpj} onChange={handleChange} placeholder="00.000.000/0000-00" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Telefone</Label>
                      <Input name="phone" value={formValues.phone} onChange={handleChange} placeholder="(XX) XXXXX-XXXX" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Cidade</Label><Input name="city" value={formValues.city} onChange={handleChange} /></div>
                    <div className="space-y-1.5"><Label>UF</Label><Input name="state" value={formValues.state} onChange={handleChange} maxLength={2} /></div>
                  </div>

                  <Separator className="my-2" />
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                      <Label>Tipo de Operação</Label>
                      <Select value={formValues.operation_type} onValueChange={handleSelectChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clientes">Clientes / CRM Geral</SelectItem>
                          <SelectItem value="motoristas">Motoristas / Mobilidade</SelectItem>
                          <SelectItem value="pacientes">Pacientes / Saúde</SelectItem>
                          <SelectItem value="loja">Loja / Varejo</SelectItem>
                          <SelectItem value="lavajato">Lava Jato</SelectItem>
                          <SelectItem value="restaurante">Restaurante</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Instância Evolution (Principal)</Label>
                      <Input name="evolution_instance" value={formValues.evolution_instance} onChange={handleChange} placeholder="nome_da_instancia" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>API Key (Evolution)</Label>
                      <Input name="evolution_apikey" value={formValues.evolution_apikey} onChange={handleChange} placeholder="Global ou Específica" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border rounded p-3">
                    <Label className="w-1/3">Max. Instâncias</Label>
                    <Input
                      type="number"
                      name="max_instances"
                      value={formValues.max_instances}
                      onChange={handleChange}
                      className="w-20"
                      min="1"
                    />
                    <p className="text-xs text-muted-foreground flex-1">Quantidade de slots de conexão disponíveis.</p>
                  </div>

                  <Separator className="my-2" />
                  <div className="flex items-center space-x-2">
                    <Checkbox id="ig_enabled" checked={formValues.instagram_enabled} onCheckedChange={(c) => setFormValues(p => ({ ...p, instagram_enabled: !!c }))} />
                    <Label htmlFor="ig_enabled" className="cursor-pointer">Integrar com Instagram</Label>
                    {formValues.instagram_status === 'ATIVO' && (
                      <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px] h-5">Conectado</Badge>
                    )}
                    {formValues.instagram_status === 'ERRO' && (
                      <Badge variant="destructive" className="text-[10px] h-5">Erro</Badge>
                    )}
                  </div>
                  {formValues.instagram_enabled && (
                    <div className="pl-4 border-l-2 space-y-2 mt-2">
                      <Input name="instagram_page_id" placeholder="Page ID" value={formValues.instagram_page_id} onChange={handleChange} className="h-8 text-xs" />
                      <Input name="instagram_access_token" placeholder="Access Token" type="password" value={formValues.instagram_access_token} onChange={handleChange} className="h-8 text-xs" />
                    </div>
                  )}

                  <Separator className="my-2" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Plano</Label>
                      <Select value={formValues.plan_id ? String(formValues.plan_id) : ""} onValueChange={(val) => setFormValues(prev => ({ ...prev, plan_id: val }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Vencimento</Label>
                      <Input type="date" value={formValues.due_date} onChange={(e) => setFormValues(prev => ({ ...prev, due_date: e.target.value }))} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Logo</Label>
                    <div className="flex gap-2">
                      {editingCompany?.logo_url && !removeLogo && (
                        <div className="relative">
                          <img src={editingCompany.logo_url} className="h-8 w-8 rounded object-cover" />
                          <Button type="button" size="icon" variant="destructive" className="h-4 w-4 absolute -top-1 -right-1 rounded-full" onClick={() => setRemoveLogo(true)}>x</Button>
                        </div>
                      )}
                      <Input type="file" ref={fileInputRef} onChange={handleFileChange} className="text-xs" />
                    </div>
                    {removeLogo && <p className="text-xs text-destructive">Logo será removido.</p>}
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Salvando..." : (editingCompany ? "Atualizar" : "Cadastrar")}
                  </Button>
                  {editingCompany && <Button type="button" variant="outline" className="w-full" onClick={resetForm}>Cancelar Edição</Button>}
                </form>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div >
  );
};
export default SuperadminPage;
