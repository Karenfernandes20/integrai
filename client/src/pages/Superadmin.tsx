
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Building2,
  FileText,
  LayoutDashboard,
  ShieldAlert,
  Settings2,
  Terminal
} from "lucide-react";
import { Button } from "../components/ui/button";

// Components
import { CompanyList } from "../components/admin/CompanyList";
import { CompanyFormDrawer } from "../components/admin/CompanyFormDrawer";
import { UserManagementDialog } from "../components/admin/UserManagementDialog";
import { InstanceConfigDialog } from "../components/admin/InstanceConfigDialog";
import { LegalPagesSection } from "../components/admin/LegalPagesSection";

// Types
import { Company } from "../components/admin/types";

export default function Superadmin() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { toast } = useToast();

  // State
  const [activeTab, setActiveTab] = useState("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);

  // Modals/Drawers State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [manageUsersCompany, setManageUsersCompany] = useState<Company | null>(null);
  const [manageInstancesCompany, setManageInstancesCompany] = useState<Company | null>(null);

  useEffect(() => {
    if (!token) {
      navigate("/superlogin");
      return;
    }
    loadCompanies();
    loadPlans();
  }, [token, navigate]);

  const loadCompanies = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/companies", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCompanies(await res.json());
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Falha ao carregar empresas.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const res = await fetch("/api/plans", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPlans(await res.json());
    } catch (e) { }
  };

  const handleDelete = async (company: Company) => {
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao deletar');
      }

      toast({ title: "Sucesso", description: "Empresa removida com sucesso." });
      loadCompanies();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const handleOpenDashboard = (company: Company) => {
    navigate(`/app/dashboard?companyId=${company.id}`);
  };

  const handleAddNew = () => {
    setEditingCompany(null);
    setIsFormOpen(true);
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setIsFormOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 py-8 md:px-8 md:py-12">
        {/* Header Section */}
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-primary" />
              Painel de Controle SuperAdmin
            </h1>
            <p className="text-slate-500 font-medium">Gestão centralizada de empresas, acessos e configurações globais.</p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2 shadow-sm bg-white" onClick={() => window.open('https://github.com/integrai', '_blank')}>
              <Terminal className="h-4 w-4" /> Logs do Sistema
            </Button>
            <Button variant="outline" className="gap-2 shadow-sm bg-white" onClick={() => navigate('/app/dashboard')}>
              <LayoutDashboard className="h-4 w-4" /> Voltar ao App
            </Button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-slate-200/50 p-1 rounded-xl h-12 shadow-sm mb-6">
            <TabsTrigger value="companies" className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg h-10 px-8 gap-2">
              <Building2 className="h-4 w-4" /> Gestão de Clientes
            </TabsTrigger>
            <TabsTrigger value="legal" className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg h-10 px-8 gap-2">
              <FileText className="h-4 w-4" /> Páginas Legais
            </TabsTrigger>
          </TabsList>

          <TabsContent value="companies" className="space-y-6 animate-in fade-in duration-500">
            <CompanyList
              companies={companies}
              isLoading={isLoading}
              onAddNew={handleAddNew}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onManageUsers={(c) => setManageUsersCompany(c)}
              onManageInstances={(c) => setManageInstancesCompany(c)}
              onOpenDashboard={handleOpenDashboard}
            />

            {/* Note: Additional instances config usually logic is part of Edit or a separate action */}
            {/* In the older UI it was separate, let's add an action for it in List if needed, 
                 or just open it from the "Edit" context if appropriate. 
                 I'll add it as a secondary action in the list for better UX. */}
          </TabsContent>

          <TabsContent value="legal" className="space-y-6 animate-in fade-in duration-500">
            <LegalPagesSection token={token} />
          </TabsContent>
        </Tabs>
      </div>

      {/* --- DRAWERS & DIALOGS --- */}

      <CompanyFormDrawer
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        editingCompany={editingCompany}
        token={token}
        plans={plans}
        onSuccess={loadCompanies}
      />

      <UserManagementDialog
        open={!!manageUsersCompany}
        onOpenChange={(open) => !open && setManageUsersCompany(null)}
        company={manageUsersCompany}
        token={token}
      />

      <InstanceConfigDialog
        open={!!manageInstancesCompany}
        onOpenChange={(open) => !open && setManageInstancesCompany(null)}
        company={manageInstancesCompany}
        token={token}
      />
    </div>
  );
}
