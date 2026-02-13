import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  CreditCard,
  Users,
  Zap,
  Plus,
  Pencil,
  Shield,
  UserX,
  UserCheck,
  AlertTriangle,
  Download,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { EvolutionStatus } from "../components/EvolutionStatus";
import { InstagramStatus } from "../components/InstagramStatus";

type AccessType = "admin" | "gerente" | "vendedor" | "atendimento";
type BillingStatus = "active" | "past_due" | "cancelled" | "trialing" | string;

interface TeamUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  permissions?: string[];
  is_active: boolean;
  company_id: number;
}

interface CompanyBillingData {
  id: number;
  name: string;
  plan_id?: number | null;
  due_date?: string | null;
  billingDueDay?: number | null;
  billing_due_day?: number | null;
  planName?: string | null;
  plan_name?: string | null;
  planValue?: number | string | null;
  plan_value?: number | string | null;
  billingStatus?: string | null;
  billing_status?: string | null;
  billingStartDate?: string | null;
  billing_start_date?: string | null;
}

interface BillingInfo {
  status: BillingStatus;
  plan_name?: string;
  plan_price?: string | number;
  current_period_end?: string;
}

interface Invoice {
  id: number;
  amount: string | number;
  status: string;
  created_at: string;
  due_date: string;
  pdf_url?: string;
}

const ACCESS_TYPE_LABEL: Record<AccessType, string> = {
  admin: "Admin",
  gerente: "Gerente",
  vendedor: "Vendedor",
  atendimento: "Atendimento",
};

const ACCESS_TYPE_PERMISSIONS: Record<AccessType, string[]> = {
  admin: [],
  gerente: [
    "crm.view", "crm.attend", "crm.transfer", "crm.close", "crm.move_cards",
    "inventory.view", "inventory.create_prod", "inventory.edit_prod", "inventory.sale",
    "finance.view", "finance.create", "finance.edit",
    "campaigns.create", "campaigns.edit", "campaigns.report",
    "bi.view"
  ],
  vendedor: [
    "crm.view", "crm.attend", "crm.move_cards",
    "reg.clients",
    "inventory.view", "inventory.sale",
    "schedule.view", "schedule.create"
  ],
  atendimento: [
    "crm.view", "crm.attend", "crm.transfer", "crm.close",
    "reg.clients",
    "schedule.view"
  ],
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const SP_DATE = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

const parseAccessType = (u: TeamUser): AccessType => {
  if ((u.role || "").toUpperCase() === "ADMIN") return "admin";
  const perms = new Set(u.permissions || []);
  if (perms.has("finance.edit") || perms.has("inventory.create_prod")) return "gerente";
  if (perms.has("inventory.sale") && perms.has("crm.move_cards")) return "vendedor";
  return "atendimento";
};

const addMonthsKeepingDay = (year: number, monthIndex: number, day: number) => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay), 12, 0, 0, 0);
};

const calcNextInvoiceDate = (dueDay: number) => {
  const now = new Date();
  const thisMonthDue = addMonthsKeepingDay(now.getFullYear(), now.getMonth(), dueDay);
  const nextMonthDue = addMonthsKeepingDay(now.getFullYear(), now.getMonth() + 1, dueDay);
  if (now.getTime() > thisMonthDue.getTime()) return nextMonthDue;
  return thisMonthDue;
};

const TeamSection = () => {
  const { token, user } = useAuth();
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);

  const [selected, setSelected] = useState<TeamUser | null>(null);
  const [newUser, setNewUser] = useState({ full_name: "", email: "", access_type: "atendimento" as AccessType, password: "" });
  const [editUser, setEditUser] = useState({ full_name: "", email: "" });
  const [editType, setEditType] = useState<AccessType>("atendimento");

  const canManage = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  const loadTeam = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Falha ao carregar equipe");
      const data = (await res.json()) as TeamUser[];
      const currentCompanyId = Number(user?.company_id || 0);
      const filtered = Array.isArray(data)
        ? data.filter((u) => Number(u.company_id) === currentCompanyId)
        : [];
      setTeam(filtered);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar equipe");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, [token, user?.company_id]);

  const handleCreateUser = async () => {
    if (!token || !canManage) return;
    if (!newUser.full_name.trim() || !newUser.email.trim()) {
      toast.error("Nome e email são obrigatórios");
      return;
    }
    try {
      const payload: any = {
        full_name: newUser.full_name.trim(),
        email: newUser.email.trim(),
        phone: "",
        role: newUser.access_type === "admin" ? "ADMIN" : "USUARIO",
        user_type: null,
        password: newUser.password?.trim() || "123456",
      };
      if (newUser.access_type !== "admin") {
        payload.permissions = ACCESS_TYPE_PERMISSIONS[newUser.access_type];
      }

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao criar usuário");

      toast.success("Usuário criado com sucesso");
      toast.info("Envio de convite por email não está configurado neste ambiente.");
      setIsCreateOpen(false);
      setNewUser({ full_name: "", email: "", access_type: "atendimento", password: "" });
      loadTeam();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar usuário");
    }
  };

  const handleSaveEdit = async () => {
    if (!token || !selected || !canManage) return;
    try {
      const res = await fetch(`/api/users/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          full_name: editUser.full_name.trim(),
          email: editUser.email.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao editar usuário");
      toast.success("Usuário atualizado");
      setIsEditOpen(false);
      loadTeam();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao editar usuário");
    }
  };

  const handleSaveType = async () => {
    if (!token || !selected || !canManage) return;
    try {
      const payload: any = {
        role: editType === "admin" ? "ADMIN" : "USUARIO",
      };
      if (editType !== "admin") payload.permissions = ACCESS_TYPE_PERMISSIONS[editType];
      const res = await fetch(`/api/users/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao alterar tipo de acesso");
      toast.success("Tipo de acesso alterado");
      setIsTypeOpen(false);
      loadTeam();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao alterar tipo de acesso");
    }
  };

  const handleToggleActive = async (u: TeamUser) => {
    if (!token || !canManage) return;
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao atualizar status");
      toast.success(!u.is_active ? "Usuário reativado" : "Usuário desativado");
      loadTeam();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao alterar status");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Equipe</CardTitle>
          <CardDescription>Gerencie os usuários da sua empresa.</CardDescription>
        </div>
        {canManage && (
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar Usuário
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo de Acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">Carregando equipe...</TableCell></TableRow>
              ) : team.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">Nenhum usuário cadastrado.</TableCell></TableRow>
              ) : (
                team.map((u) => {
                  const access = parseAccessType(u);
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{ACCESS_TYPE_LABEL[access]}</TableCell>
                      <TableCell>
                        <Badge variant={u.is_active ? "default" : "secondary"}>{u.is_active ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelected(u);
                              setEditUser({ full_name: u.full_name || "", email: u.email || "" });
                              setIsEditOpen(true);
                            }}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelected(u);
                              setEditType(parseAccessType(u));
                              setIsTypeOpen(true);
                            }}
                            title="Alterar tipo de acesso"
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(u)}
                            title={u.is_active ? "Desativar usuário" : "Ativar usuário"}
                          >
                            {u.is_active ? <UserX className="h-4 w-4 text-rose-600" /> : <UserCheck className="h-4 w-4 text-emerald-600" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Usuário</DialogTitle>
            <DialogDescription>Cria um usuário vinculado à empresa atual.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome" value={newUser.full_name} onChange={(e) => setNewUser((p) => ({ ...p, full_name: e.target.value }))} />
            <Input placeholder="Email" type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
            <Select value={newUser.access_type} onValueChange={(v: AccessType) => setNewUser((p) => ({ ...p, access_type: v }))}>
              <SelectTrigger><SelectValue placeholder="Tipo de acesso" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="gerente">Gerente</SelectItem>
                <SelectItem value="vendedor">Vendedor</SelectItem>
                <SelectItem value="atendimento">Atendimento</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Senha provisória (opcional)" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome" value={editUser.full_name} onChange={(e) => setEditUser((p) => ({ ...p, full_name: e.target.value }))} />
            <Input placeholder="Email" type="email" value={editUser.email} onChange={(e) => setEditUser((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTypeOpen} onOpenChange={setIsTypeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar Tipo de Acesso</DialogTitle></DialogHeader>
          <Select value={editType} onValueChange={(v: AccessType) => setEditType(v)}>
            <SelectTrigger><SelectValue placeholder="Tipo de acesso" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="gerente">Gerente</SelectItem>
              <SelectItem value="vendedor">Vendedor</SelectItem>
              <SelectItem value="atendimento">Atendimento</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsTypeOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveType}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

const BillingSection = () => {
  const { token, user } = useAuth();
  const [company, setCompany] = useState<CompanyBillingData | null>(null);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token || !user?.company_id) return;
      setIsLoading(true);
      try {
        const [companyRes, billingRes, invRes] = await Promise.all([
          fetch(`/api/companies/${user.company_id}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/billing/subscription", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/billing/invoices", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (companyRes.ok) setCompany(await companyRes.json());
        if (billingRes.ok) {
          const b = await billingRes.json();
          if (b && b.status !== "none") setBilling(b);
        }
        if (invRes.ok) setInvoices(await invRes.json());
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [token, user?.company_id]);

  const billingDueDay = useMemo(() => {
    const fromNew = Number(company?.billingDueDay || company?.billing_due_day || 0);
    if (fromNew >= 1 && fromNew <= 31) return fromNew;
    if (company?.due_date) {
      const d = new Date(company.due_date);
      if (!Number.isNaN(d.getTime())) return d.getDate();
    }
    return 10;
  }, [company]);

  const nextInvoiceDate = useMemo(() => calcNextInvoiceDate(billingDueDay), [billingDueDay]);

  const planName = useMemo(() => {
    return (
      company?.planName ||
      company?.plan_name ||
      billing?.plan_name ||
      (company?.plan_id ? `Plano #${company.plan_id}` : "Plano")
    );
  }, [company, billing]);

  const monthlyValue = useMemo(() => {
    const raw = company?.planValue ?? company?.plan_value ?? billing?.plan_price ?? 0;
    const n = typeof raw === "string" ? Number(raw) : Number(raw || 0);
    return Number.isFinite(n) ? n : 0;
  }, [company, billing]);

  const billingStatus = ((company?.billingStatus || company?.billing_status || billing?.status || "active") as BillingStatus).toLowerCase();
  const isCancelled = billingStatus === "cancelled";
  const isPastDue = billingStatus === "past_due";

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando faturamento...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className={isPastDue ? "border-rose-300" : ""}>
        <CardHeader>
          <CardTitle>Plano Atual</CardTitle>
          <CardDescription>Visão geral da assinatura e próxima cobrança.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isPastDue || isCancelled) && (
            <div className={`rounded-md border p-3 flex items-start gap-2 text-sm ${isPastDue ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>{isPastDue ? "Empresa inadimplente: regularize para evitar bloqueios." : "Plano cancelado: renovação automática desativada."}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Plano Atual</div>
              <div className="font-semibold">{planName}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Valor Mensal</div>
              <div className="font-semibold">{BRL.format(monthlyValue)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Próximo Vencimento</div>
              <div className="font-semibold">{SP_DATE.format(nextInvoiceDate)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Status</div>
              <Badge variant={isPastDue ? "destructive" : isCancelled ? "secondary" : "default"}>
                {isPastDue ? "Inadimplente" : isCancelled ? "Cancelado" : "Ativo"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Próxima Fatura</CardTitle>
          <CardDescription>Parcela futura calculada automaticamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>{planName}</TableCell>
                  <TableCell className="text-right">{BRL.format(monthlyValue)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold">{BRL.format(monthlyValue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <Button onClick={() => toast.info("Pagamento online ainda não configurado.")} className="gap-2">
              <CreditCard className="h-4 w-4" /> Pagar agora
            </Button>
            <Button variant="outline" onClick={() => toast.info("Boleto indisponível neste ambiente.")} className="gap-2">
              <Download className="h-4 w-4" /> Baixar boleto
            </Button>
            <Button variant="outline" onClick={() => toast.info("Atualização de cartão indisponível neste ambiente.")}>
              Atualizar cartão
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pagamentos</CardTitle>
          <CardDescription>Faturas registradas da empresa.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-14 text-center text-muted-foreground">Nenhuma fatura registrada.</TableCell>
                  </TableRow>
                ) : invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{SP_DATE.format(new Date(inv.created_at))}</TableCell>
                    <TableCell>{SP_DATE.format(new Date(inv.due_date))}</TableCell>
                    <TableCell>{BRL.format(Number(inv.amount || 0))}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "paid" ? "default" : inv.status === "past_due" ? "destructive" : "secondary"}>
                        {inv.status === "paid" ? "Pago" : inv.status === "past_due" ? "Em atraso" : inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ConfiguracoesPage = () => {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie equipe, assinatura e integrações da empresa.
        </p>
      </header>

      <Tabs defaultValue="team" className="w-full">
        <TabsList className="w-full justify-start h-12 bg-muted/50 p-1">
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" /> Equipe
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" /> Planos e Faturas
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Zap className="h-4 w-4" /> Integrações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-6">
          <TeamSection />
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <BillingSection />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>WhatsApp (Evolution API)</CardTitle>
                <CardDescription>Conexão com seu número oficial.</CardDescription>
              </CardHeader>
              <CardContent>
                <EvolutionStatus />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Instagram Business</CardTitle>
                <CardDescription>Integração oficial Meta.</CardDescription>
              </CardHeader>
              <CardContent>
                <InstagramStatus />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfiguracoesPage;
