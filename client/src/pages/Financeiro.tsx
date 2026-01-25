import { useState, useEffect, useMemo } from "react";
import { ManageCostCentersDialog } from "../components/ManageCostCentersDialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from "../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "../components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "../components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "../components/ui/dropdown-menu";
import { ScrollArea } from "../components/ui/scroll-area";
import { cn } from "../lib/utils";
import {
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Download,
  Plus,
  Search,
  X,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  PieChart as PieChartIcon,
  Table as TableIcon,
  MoreVertical,
  Pencil,
  Trash2,
  FileText,
  FileDown,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Settings
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from "recharts";
import { format, isAfter, isBefore, addDays, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "../contexts/AuthContext";
import RelationshipManager from "../components/RelationshipManager";

interface Transaction {
  id: number;
  description: string;
  amount: number;
  status: "pending" | "paid" | "excluded" | "cancelled";
  type: "payable" | "receivable";
  due_date: string | null;
  issue_date: string | null;
  paid_at: string | null;
  category: string | null;
  notes: string | null;
  company_id?: number | null;
  city_name?: string | null;
  city_state?: string | null;
  cost_center?: string | null;
}

// Keep as fallbacks only if DB is empty/loading
const CATEGORIES_EXPENSES_FALLBACK = [
  "Luz", "Internet", "Aluguel", "Combustível", "Manutenção",
  "Impostos", "Salários", "Marketing", "Limpeza", "Outros"
];

const CATEGORIES_REVENUES_FALLBACK = [
  "Corrida", "Assinatura", "Serviço", "Comissão", "Outros"
];

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658", "#8dd1e1", "#a4de65", "#d0ed57"];

const FinanceiroPage = () => {
  const { token, user } = useAuth();
  // Main Tabs State
  const [mainTab, setMainTab] = useState("expenses"); // expenses, revenues, cashflow

  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState({
    revenues: 0,
    expenses: 0,
    balance: 0,
    receivables: 0,
    payables: 0,
    overdue: 0,
    received: 0,
    paid: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeView, setActiveView] = useState("table"); // table, charts
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [customCategories, setCustomCategories] = useState<{ id: number, name: string, type: string }[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Cost Centers Management
  const [isManageCostCentersOpen, setIsManageCostCentersOpen] = useState(false);
  const [costCenters, setCostCenters] = useState<{ id: number, name: string }[]>([]);
  const [newCostCenterName, setNewCostCenterName] = useState("");

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/financial/categories", {
      });
      if (res.ok) {
        const data = await res.json();
        setCustomCategories(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Erro ao buscar categorias", error);
    }
  };

  const fetchCostCenters = async () => {
    try {
      const res = await fetch("/api/financial/cost-centers", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCostCenters(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Erro ao buscar centros de custo", error);
    }
  };

  // Filters
  const [startDate, setStartDate] = useState(format(startOfDay(new Date()), "yyyy-MM-01"));
  const [endDate, setEndDate] = useState(format(addDays(startOfDay(new Date()), 30), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Form State
  const [formData, setFormData] = useState<Partial<Transaction>>({
    description: "",
    amount: 0,
    due_date: format(new Date(), "yyyy-MM-dd"),
    issue_date: format(new Date(), "yyyy-MM-dd"),
    category: "Outros",
    status: "pending",
    type: "payable",
    notes: "",
    cost_center: ""
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (searchTerm) params.append("search", searchTerm);

      // Determine what to fetch based on mainTab
      let endpoint = "/api/financial/payables";
      if (mainTab === "revenues") endpoint = "/api/financial/receivables";
      if (mainTab === "cashflow") endpoint = "/api/financial/cashflow";

      const res = await fetch(`${endpoint}?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(Array.isArray(data) ? data : []);
      } else {
        const errText = await res.text();
        console.error("Erro ao buscar transações:", errText);
      }

      // Always fetch stats for the period
      const statsRes = await fetch(`/api/financial/stats?startDate=${startDate}&endDate=${endDate}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error("Erro ao carregar dados financeiros", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
      fetchCategories();
      fetchCostCenters();
    }
  }, [mainTab, startDate, endDate, statusFilter, categoryFilter, token]);

  // Effect to handle default view for each tab
  useEffect(() => {
    if (mainTab === 'revenues') {
      setActiveView('charts');
    } else {
      setActiveView('table');
    }
  }, [mainTab]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const type = mainTab === 'revenues' ? 'receivable' : 'payable';
      const res = await fetch("/api/financial/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: newCategoryName, type })
      });
      if (res.ok) {
        setNewCategoryName("");
        fetchCategories();
      }
    } catch (error) {
      console.error("Erro ao criar categoria", error);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("Remover esta categoria?")) return;
    try {
      const res = await fetch(`/api/financial/categories/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        // Find if we were using this category in the form
        const deletedCat = customCategories.find(c => c.id === id);
        if (deletedCat && formData.category === deletedCat.name) {
          setFormData(prev => ({ ...prev, category: "Outros" }));
        }
        fetchCategories();
      }
    } catch (error) {
      console.error("Erro ao remover categoria", error);
    }
  };

  const handleSave = async () => {
    if (!formData.description || !formData.amount) {
      alert("Preencha os campos obrigatórios.");
      return;
    }

    try {
      const method = formData.id ? "PUT" : "POST";
      const url = formData.id ? `/api/financial/transactions/${formData.id}` : "/api/financial/transactions";

      const dataToSave = {
        ...formData,
        type: (mainTab === "revenues" ? "receivable" : "payable"),
        company_id: formData.company_id || user?.company_id
      };

      console.log("Enviando dados:", dataToSave);

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(dataToSave)
      });

      if (res.ok) {
        setIsDialogOpen(false);
        resetForm();
        await fetchData();
      } else {
        const errData = await res.json();
        console.error("Erro do servidor:", errData);
        alert(`Erro ao salvar: ${errData.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error("Erro ao salvar", error);
      alert("Erro ao conectar com o servidor.");
    }
  };

  const resetForm = () => {
    setFormData({
      description: "",
      amount: 0,
      due_date: format(new Date(), "yyyy-MM-dd"),
      issue_date: format(new Date(), "yyyy-MM-dd"),
      category: "Outros",
      status: "pending",
      type: (mainTab === "revenues" ? "receivable" : "payable") as any,
      notes: "",
      cost_center: ""
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deseja excluir este registro? Ele ficará visível como 'Excluído' e poderá ser reativado.")) return;
    try {
      const res = await fetch(`/api/financial/transactions/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) await fetchData();
    } catch (error) {
      console.error("Erro ao excluir", error);
    }
  };

  const handleReactivate = async (id: number) => {
    if (!confirm("Deseja reativar esta movimentação?")) return;
    try {
      const res = await fetch(`/api/financial/transactions/${id}/reactivate`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) await fetchData();
    } catch (error) {
      console.error("Erro ao reativar", error);
    }
  };

  const handleMarkAsReceivedOrPaid = async (id: number) => {
    try {
      const res = await fetch(`/api/financial/transactions/${id}/pay`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) await fetchData();
    } catch (error) {
      console.error("Erro ao processar", error);
    }
  };

  // Calculations
  const safeFormat = (dateStr: string | null | undefined, formatStr: string) => {
    if (!dateStr) return "--";
    try {
      const date = parseISO(dateStr);
      if (isNaN(date.getTime())) return "--";
      return format(date, formatStr, { locale: ptBR });
    } catch (e) {
      return "--";
    }
  };

  const isOverdue = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    try {
      const date = parseISO(dateStr);
      if (isNaN(date.getTime())) return false;
      const now = startOfDay(new Date());
      return isBefore(date, now) && format(date, "yyyy-MM-dd") !== format(now, "yyyy-MM-dd");
    } catch (e) {
      return false;
    }
  };

  // -------------------------------------------------------------------------
  // RENDER BLOCKS
  // -------------------------------------------------------------------------

  const renderTable = () => (
    <div className="rounded-xl border shadow-sm bg-white overflow-hidden">
      <Table>
        <TableHeader className="bg-zinc-50/50">
          <TableRow>
            <TableHead className="w-[30%] min-w-[200px] text-[10px] font-bold uppercase">Descrição / Origem</TableHead>
            <TableHead className="w-[15%] text-[10px] font-bold uppercase">Categoria</TableHead>
            <TableHead className="w-[10%] text-center text-[10px] font-bold uppercase">Emissão</TableHead>
            <TableHead className="w-[10%] text-center text-[10px] font-bold uppercase">
              {mainTab === 'revenues' ? 'Recebimento' : 'Vencimento'}
            </TableHead>
            <TableHead className="w-[15%] text-right text-[10px] font-bold uppercase">Valor</TableHead>
            <TableHead className="w-[10%] text-center text-[10px] font-bold uppercase">Status</TableHead>
            <TableHead className="w-[10%] text-center text-[10px] font-bold uppercase w-[150px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="h-48 text-center text-zinc-400 font-medium font-bold animate-pulse">Sincronizando dados...</TableCell>
            </TableRow>
          ) : filteredData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-48 text-center text-zinc-400 font-medium">
                Nenhum registro encontrado para este período.
              </TableCell>
            </TableRow>
          ) : (
            filteredData.map((t) => (
              <TableRow
                key={t.id}
                className="cursor-pointer hover:bg-zinc-50/80 group transition-colors"
                onClick={() => { setSelectedTransaction(t); setIsSheetOpen(true); }}
              >
                <TableCell className="max-w-[300px]">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2.5 rounded-xl shadow-sm shrink-0",
                      t.type === 'receivable' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      {t.type === 'receivable' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-bold text-sm text-zinc-900 truncate" title={t.description}>{t.description}</span>
                      <span className="text-[10px] text-zinc-400 font-medium truncate" title={t.notes || ""}>#{t.id} • {t.notes || "Sem observações"}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] font-extrabold border-zinc-200 text-zinc-600 px-2 py-0 h-5">
                    {t.category || "Outros"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-mono text-[11px] font-medium text-zinc-600">
                  {safeFormat(t.issue_date, "dd/MM/yyyy")}
                </TableCell>
                <TableCell className={cn(
                  "text-center font-mono text-[11px] font-bold",
                  isOverdue(t.due_date) && t.status !== 'paid' ? "text-red-500" : "text-zinc-600"
                )}>
                  {safeFormat(t.due_date, "dd/MM/yyyy")}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-black text-sm",
                  t.type === 'receivable' ? "text-emerald-700" : "text-zinc-900"
                )}>
                  R$ {Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-center">
                  {getStatusBadge(t)}
                </TableCell>
                <TableCell className="text-center w-[150px]" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1">
                    {t.status !== 'paid' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 shrink-0"
                        onClick={() => handleMarkAsReceivedOrPaid(t.id)}
                        title={t.type === 'receivable' ? "Receber" : "Pagar"}
                      >
                        {t.type === 'receivable' ? <ArrowUpRight className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 shrink-0"
                      onClick={() => { setFormData(t); setIsDialogOpen(true); }}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreVertical className="h-4 w-4 text-zinc-400" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleMarkAsReceivedOrPaid(t.id)}>
                          {t.type === 'receivable' ? 'Marcar como Recebido' : 'Marcar como Pago'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setFormData(t); setIsDialogOpen(true); }}>Editar</DropdownMenuItem>
                        {t.status === 'excluded' || t.status === 'cancelled' ? (
                          <DropdownMenuItem onClick={() => handleReactivate(t.id)} className="text-blue-600 font-bold">
                            Reativar Movimentação
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleDelete(t.id)} className="text-red-600">Excluir</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        <TableFooter className="bg-zinc-50 border-t-2">
          <TableRow>
            <TableCell colSpan={4} className="py-5 px-6">
              <div className="flex gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Total de Itens</span>
                  <span className="text-sm font-black text-zinc-900">{filteredData.length} registros</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-amber-500 uppercase">Pendente</span>
                  <span className="text-sm font-black text-amber-600 whitespace-nowrap">R$ {totals.pending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-red-500 uppercase">Vencido</span>
                  <span className="text-sm font-black text-red-600 whitespace-nowrap">R$ {totals.overdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-right py-5 pr-6" colSpan={3}>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Resumo Filtrado</span>
                <span className="text-xl font-black text-zinc-900 whitespace-nowrap">
                  Total: R$ {totals.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );

  const renderCharts = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
      <Card className="border-none shadow-sm h-[450px]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center justify-between text-zinc-500">
            {mainTab === 'cashflow' ? 'Fluxo Diário x Acumulado' : 'Volume por Data'}
            <TrendingUp className="h-4 w-4 text-zinc-400" />
          </CardTitle>
          <CardDescription className="text-[11px]">Análise temporal do período selecionado</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            {mainTab === 'cashflow' ? (
              <BarChart data={cashFlowDailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(v: any) => `R$ ${v.toLocaleString("pt-BR")}`}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold' }} />
                <Bar dataKey="entrada" fill="#10b981" radius={[4, 4, 0, 0]} name="Entradas" />
                <Bar dataKey="saida" fill="#ef4444" radius={[4, 4, 0, 0]} name="Saídas" />
                <Line type="monotone" dataKey="acumulado" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} name="Acumulado" />
              </BarChart>
            ) : (
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(v: any) => `R$ ${v.toLocaleString("pt-BR")}`}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold' }} />
                <Line type="monotone" dataKey="pago" stroke="#008069" strokeWidth={3} dot={{ r: 4 }} name={mainTab === 'revenues' ? 'Recebido' : 'Pago'} />
                <Line type="monotone" dataKey="pendente" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} name={mainTab === 'revenues' ? 'A Receber' : 'Pendente'} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm h-[450px]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center justify-between text-zinc-500">
            Distribuição por Categoria
            <PieChartIcon className="h-4 w-4 text-zinc-400" />
          </CardTitle>
          <CardDescription className="text-[11px]">Concentração financeira por tipo de registro</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieChartData}
                innerRadius={70}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                labelLine={false}
                label={false}
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(v: any, name: any, props: any) => {
                  const total = pieChartData.reduce((a: any, b: any) => a + b.value, 0);
                  const percent = total > 0 ? (v / total * 100).toFixed(1) : 0;
                  return [`R$ ${v.toLocaleString("pt-BR")} (${percent}%)`, name];
                }}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                wrapperStyle={{
                  fontSize: '11px',
                  fontWeight: '500',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  paddingLeft: '20px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

  const filteredData = useMemo(() => {
    if (!Array.isArray(transactions)) return [];
    return transactions.filter(t => {
      // Strict tab filtering to prevent cross-data display
      if (mainTab === "expenses" && t.type !== "payable") return false;
      if (mainTab === "revenues" && t.type !== "receivable") return false;

      const descLower = (t.description || "").toLowerCase();
      const catLower = (t.category || "").toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      return descLower.includes(searchLower) || catLower.includes(searchLower);
    });
  }, [transactions, searchTerm, mainTab]);

  const totals = useMemo(() => {
    if (!Array.isArray(filteredData)) return { pending: 0, paid: 0, overdue: 0, total: 0 };
    const getAmount = (t: Transaction) => {
      const val = Number(t.amount);
      return isNaN(val) ? 0 : val;
    };
    return {
      pending: filteredData.filter(t => t.status === "pending").reduce((sum, t) => sum + getAmount(t), 0),
      paid: filteredData.filter(t => t.status === "paid").reduce((sum, t) => sum + getAmount(t), 0),
      overdue: filteredData.filter(t => t.status !== "paid" && isOverdue(t.due_date)).reduce((sum, t) => sum + getAmount(t), 0),
      total: filteredData.reduce((sum, t) => sum + getAmount(t), 0)
    };
  }, [filteredData]);

  // Chart Data
  const lineChartData = useMemo(() => {
    const grouped = filteredData.reduce((acc: any, t) => {
      const date = safeFormat(t.due_date, "dd/MM");
      if (!acc[date]) acc[date] = { date, pendente: 0, pago: 0, total: 0 };
      const amount = isNaN(Number(t.amount)) ? 0 : Number(t.amount);
      if (t.status === "paid") acc[date].pago += amount;
      else acc[date].pendente += amount;
      acc[date].total += amount;
      return acc;
    }, {});
    return Object.values(grouped).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [filteredData]);

  const pieChartData = useMemo(() => {
    const grouped = filteredData.reduce((acc: any, t) => {
      const cat = t.category || "Outros";
      if (!acc[cat]) acc[cat] = 0;
      const amount = isNaN(Number(t.amount)) ? 0 : Number(t.amount);
      acc[cat] += amount;
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => (b.value as number) - (a.value as number));
  }, [filteredData]);

  const cashFlowDailyData = useMemo(() => {
    if (mainTab !== "cashflow") return [];
    const grouped = filteredData.reduce((acc: any, t) => {
      const date = safeFormat(t.due_date, "dd/MM");
      if (!acc[date]) acc[date] = { date, entrada: 0, saida: 0, saldo: 0 };
      if (t.type === "receivable") acc[date].entrada += Number(t.amount || 0);
      else acc[date].saida += Number(t.amount || 0);
      acc[date].saldo = acc[date].entrada - acc[date].saida;
      return acc;
    }, {});

    // Sort and calculate accumulation
    const sorted = Object.values(grouped).sort((a: any, b: any) => a.date.localeCompare(b.date));
    let accumulated = 0;
    return sorted.map((day: any) => {
      accumulated += day.saldo;
      return { ...day, acumulado: accumulated };
    });
  }, [filteredData, mainTab]);

  // Exports
  const getExportTitle = () => {
    if (mainTab === "expenses") return "Relatório de Despesas & Contas a Pagar";
    if (mainTab === "revenues") return "Relatório de Receitas & Contas a Receber";
    return "Relatório de Fluxo de Caixa";
  };

  const exportCSV = () => {
    const headers = ["Descrição", "Categoria", "Emissão", "Vencimento/Recebimento", "Valor", "Status", "Tipo"];
    const rows = filteredData.map(t => [
      t.description,
      t.category || "",
      t.issue_date ? format(parseISO(t.issue_date), "yyyy-MM-dd") : "",
      t.due_date ? format(parseISO(t.due_date), "yyyy-MM-dd") : "",
      t.amount,
      t.status,
      t.type === "receivable" ? "Receita" : "Despesa"
    ]);
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `financeiro_${mainTab}_${format(new Date(), "yyyyMMdd")}.csv`);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData.map(t => ({
      Descrição: t.description,
      Categoria: t.category,
      Emissão: t.issue_date ? format(parseISO(t.issue_date), "dd/MM/yyyy") : "",
      "Vencimento/Recebimento": t.due_date ? format(parseISO(t.due_date), "dd/MM/yyyy") : "",
      Valor: t.amount,
      Status: t.status.toUpperCase(),
      Tipo: t.type === "receivable" ? "Receita" : "Despesa"
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financeiro");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    saveAs(data, `financeiro_${mainTab}_${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();

    // Add Logo
    const logoUrl = "/logo-integrai.jpg";
    const img = new Image();
    img.src = logoUrl;

    img.onload = () => {
      // Add logo (x, y, width, height)
      doc.addImage(img, 'JPEG', 14, 10, 25, 25);

      const tableColumn = ["Descrição", "Categoria", "Vencimento", "Valor", "Status", "Tipo"];
      const tableRows = filteredData.map(t => [
        t.description,
        t.category || "Sem categoria",
        safeFormat(t.due_date, "dd/MM/yyyy"),
        `R$ ${Number(t.amount || 0).toFixed(2)}`,
        t.status.toUpperCase(),
        t.type === "receivable" ? "RECEITA" : "DESPESA"
      ]);

      doc.setFontSize(16);
      doc.setTextColor(mainTab === "revenues" ? "#008069" : "#ff4444");
      doc.text(getExportTitle(), 45, 20);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 45, 27);
      doc.text(`Período: ${startDate ? format(parseISO(startDate), "dd/MM/yyyy") : "Início"} até ${endDate ? format(parseISO(endDate), "dd/MM/yyyy") : "Hoje"}`, 45, 32);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        styles: { fontSize: 8 },
        headStyles: { fillColor: mainTab === "revenues" ? [0, 128, 105] : [128, 0, 0] }
      });

      doc.save(`financeiro_${mainTab}_${format(new Date(), "yyyyMMdd")}.pdf`);
    };

    img.onerror = () => {
      // Fallback if image fails to load
      const tableColumn = ["Descrição", "Categoria", "Vencimento", "Valor", "Status", "Tipo"];
      const tableRows = filteredData.map(t => [
        t.description,
        t.category || "Sem categoria",
        safeFormat(t.due_date, "dd/MM/yyyy"),
        `R$ ${Number(t.amount || 0).toFixed(2)}`,
        t.status.toUpperCase(),
        t.type === "receivable" ? "RECEITA" : "DESPESA"
      ]);

      doc.setFontSize(16);
      doc.setTextColor(mainTab === "revenues" ? "#008069" : "#ff4444");
      doc.text(getExportTitle(), 14, 15);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 22);
      doc.text(`Período: ${startDate ? format(parseISO(startDate), "dd/MM/yyyy") : "Início"} até ${endDate ? format(parseISO(endDate), "dd/MM/yyyy") : "Hoje"}`, 14, 27);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        styles: { fontSize: 8 },
        headStyles: { fillColor: mainTab === "revenues" ? [0, 128, 105] : [128, 0, 0] }
      });

      doc.save(`financeiro_${mainTab}_${format(new Date(), "yyyyMMdd")}.pdf`);
    };
  };

  const getStatusBadge = (t: Transaction) => {
    const now = startOfDay(new Date());
    const dueDate = t.due_date ? parseISO(t.due_date) : null;
    const itemStatus = t.status;

    if (itemStatus === "excluded" || itemStatus === "cancelled") {
      return (
        <Badge variant="outline" className="border-red-200 text-red-500 bg-red-50 text-[10px] uppercase font-bold text-decoration-line-through">
          Excluído
        </Badge>
      )
    }

    if (itemStatus === "paid") {
      return (
        <Badge className={cn(
          "border-none text-[10px] font-bold whitespace-nowrap px-2 py-0.5 min-w-[80px] justify-center",
          t.type === "receivable" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-emerald-500 hover:bg-emerald-600 text-white"
        )}>
          {t.type === "receivable" ? "RECEBIDO" : "PAGO"}
        </Badge>
      );
    }

    if (dueDate && isBefore(dueDate, now)) {
      return (
        <Badge variant="destructive" className="animate-pulse shadow-sm flex items-center justify-center gap-1 text-[10px] font-bold whitespace-nowrap px-2 py-0.5 min-w-[80px]">
          <AlertCircle className="h-2.5 w-2.5" /> VENCIDO
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none text-[10px] font-bold whitespace-nowrap px-2 py-0.5 min-w-[80px] justify-center">
        {t.type === "receivable" ? "A RECEBER" : "PENDENTE"}
      </Badge>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 bg-zinc-50/30 min-h-screen">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            Controle Financeiro
            <Badge variant="outline" className="text-[10px] h-5 font-bold bg-white">v3.0</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão unificada de receitas, despesas e fluxo de caixa consolidado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-10 text-xs font-bold">
                <Download className="h-4 w-4" /> EXPORTAR
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCSV} className="gap-2"><FileDown className="h-4 w-4" /> CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={exportExcel} className="gap-2"><FileDown className="h-4 w-4 text-emerald-600" /> Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF} className="gap-2"><FileText className="h-4 w-4 text-red-600" /> PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {mainTab !== 'cashflow' && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className={cn(
                  "gap-2 h-10 text-xs font-bold shadow-lg transition-all",
                  mainTab === "revenues" ? "bg-[#008069] hover:bg-[#006d59]" : "bg-zinc-900 hover:bg-zinc-800"
                )}>
                  <Plus className="h-4 w-4" /> {mainTab === "revenues" ? "NOVA RECEITA" : "NOVA DESPESA"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2 shrink-0">
                  <DialogTitle>{formData.id ? "Editar Lançamento" : `Cadastrar ${mainTab === "revenues" ? 'Receita' : 'Despesa'}`}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-2">
                  <div className="grid gap-4 py-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase">{mainTab === "revenues" ? "Cliente / Origem" : "Fornecedor / Descrição"}</label>
                      <Input
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder={mainTab === "revenues" ? "Nome do cliente, plataforma..." : "Vivo, Aluguel, Prolabore..."}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Valor (R$)</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onFocus={(e) => e.target.select()}
                          onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-muted-foreground uppercase">Categoria</label>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-zinc-900"
                            onClick={() => setIsManageCategoriesOpen(true)}
                            title="Gerenciar Categorias"
                            type="button"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Select value={formData.category || "Outros"} onValueChange={v => setFormData({ ...formData, category: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px] overflow-y-auto">
                            <div className="p-2 border-b bg-zinc-50/50 flex items-center justify-between sticky top-0 z-10">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase">Categorias</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-2 text-[10px] font-bold text-blue-600"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsManageCategoriesOpen(true); }}
                              >
                                <Plus className="h-3 w-3 mr-1" /> NOVA
                              </Button>
                            </div>
                            {(() => {
                              const type = mainTab === 'revenues' ? 'receivable' : 'payable';
                              const relevantCategories = customCategories.filter(c => c.type === type);

                              const displayCategories = relevantCategories.length > 0
                                ? relevantCategories
                                : (mainTab === 'revenues' ? CATEGORIES_REVENUES_FALLBACK : CATEGORIES_EXPENSES_FALLBACK).map((c, i) => ({ id: `fallback-${i}`, name: c }));

                              return displayCategories.map(c => (
                                <SelectItem key={c.id} value={c.name} className="cursor-pointer">
                                  {c.name}
                                </SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Emissão</label>
                        <Input
                          type="date"
                          value={formData.issue_date?.split('T')[0] || ""}
                          onChange={e => setFormData({ ...formData, issue_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase">{mainTab === "revenues" ? "Recebimento" : "Vencimento"}</label>
                        <Input
                          type="date"
                          value={formData.due_date?.split('T')[0] || ""}
                          onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Observações</label>
                      <Input
                        value={formData.notes || ""}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Detalhes adicionais..."
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Centro de Custo</label>
                        <button
                          type="button"
                          onClick={() => setIsManageCostCentersOpen(true)}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase"
                        >
                          Gerenciar
                        </button>
                      </div>
                      <Select
                        value={formData.cost_center || ""}
                        onValueChange={(v) => setFormData({ ...formData, cost_center: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {costCenters.length === 0 ? (
                            <div className="p-2 text-center text-sm text-gray-500">
                              Nenhum cadastrado
                            </div>
                          ) : (
                            costCenters.map(cc => (
                              <SelectItem key={cc.id} value={cc.name}>
                                {cc.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 pb-4">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Status</label>
                      <Select value={formData.status} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">{mainTab === "revenues" ? "A receber" : "Pendente"}</SelectItem>
                          <SelectItem value="paid">{mainTab === "revenues" ? "Recebido" : "Pago"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <DialogFooter className="p-6 pt-2 shrink-0 border-t bg-zinc-50/50">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} className={mainTab === 'revenues' ? "bg-[#008069] hover:bg-[#006d59]" : "bg-zinc-900 hover:bg-zinc-800"}>
                    Salvar Lançamento
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* DASHBOARD INDICATORS (TOPO) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <Card className="border-none shadow-sm bg-emerald-50 dark:bg-emerald-950/20">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[10px] font-bold uppercase text-emerald-600 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> Receitas
            </CardDescription>
            <CardTitle className="text-xl font-black text-emerald-700 whitespace-nowrap">
              R$ {stats.revenues.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[10px] text-emerald-600/70">No período selecionado</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-red-50 dark:bg-red-950/20">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[10px] font-bold uppercase text-red-600 flex items-center gap-1">
              <ArrowDownRight className="h-3 w-3" /> Despesas
            </CardDescription>
            <CardTitle className="text-xl font-black text-red-700 whitespace-nowrap">
              R$ {stats.expenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[10px] text-red-600/70">No período selecionado</div>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-none shadow-sm",
          stats.balance >= 0 ? "bg-blue-50 dark:bg-blue-950/20" : "bg-amber-50 dark:bg-amber-950/20"
        )}>
          <CardHeader className="p-4 pb-1">
            <CardDescription className={cn(
              "text-[10px] font-bold uppercase flex items-center gap-1",
              stats.balance >= 0 ? "text-blue-600" : "text-amber-600"
            )}>
              <Wallet className="h-3 w-3" /> Saldo
            </CardDescription>
            <CardTitle className={cn(
              "text-xl font-black whitespace-nowrap",
              stats.balance >= 0 ? "text-blue-700" : "text-amber-700"
            )}>
              R$ {stats.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[10px] opacity-70">Resultado líquido</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[10px] font-bold uppercase text-zinc-500 flex items-center gap-1">
              A Receber
            </CardDescription>
            <CardTitle className="text-xl font-black text-zinc-900 whitespace-nowrap">
              R$ {stats.receivables.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[10px] text-zinc-400">Total pendente</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[10px] font-bold uppercase text-zinc-500 flex items-center gap-1">
              A Pagar
            </CardDescription>
            <CardTitle className="text-xl font-black text-zinc-900 whitespace-nowrap">
              R$ {stats.payables.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[10px] text-zinc-400">Total pendente</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-red-100 dark:bg-red-900/40">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[10px] font-bold uppercase text-red-700 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 animate-pulse" /> Vencidos
            </CardDescription>
            <CardTitle className="text-xl font-black text-red-800 whitespace-nowrap">
              R$ {stats.overdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[10px] text-red-700/70 font-bold">Ação necessária</div>
          </CardContent>
        </Card>
      </div>

      {/* NAVIGATION TABS */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4">
          <TabsList className="bg-transparent border h-11 p-1 gap-1">
            <TabsTrigger value="expenses" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white h-full px-6 font-bold text-xs uppercase transition-all">
              <ArrowDownRight className="h-4 w-4 mr-2" /> Despesas
            </TabsTrigger>
            <TabsTrigger value="revenues" className="data-[state=active]:bg-[#008069] data-[state=active]:text-white h-full px-6 font-bold text-xs uppercase transition-all">
              <ArrowUpRight className="h-4 w-4 mr-2" /> Receitas
            </TabsTrigger>
            <TabsTrigger value="cashflow" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white h-full px-6 font-bold text-xs uppercase transition-all">
              <TrendingUp className="h-4 w-4 mr-2" /> Fluxo de Caixa
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
            <Button
              variant={activeView === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 text-[10px] font-bold uppercase px-4"
              onClick={() => setActiveView('table')}
            >
              <TableIcon className="h-3.5 w-3.5 mr-1.5" /> Tabela
            </Button>
            <Button
              variant={activeView === 'charts' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 text-[10px] font-bold uppercase px-4"
              onClick={() => setActiveView('charts')}
            >
              <PieChartIcon className="h-3.5 w-3.5 mr-1.5" /> Gráficos
            </Button>
          </div>
        </div>

        {/* FILTERS AREA */}
        <div className="mt-4 flex flex-wrap items-end gap-3 bg-white p-4 rounded-xl border shadow-sm">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Descrição, categoria ou notas..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-10 text-sm border-zinc-200"
              />
            </div>
          </div>

          <div className="space-y-1.5 w-[140px]">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Início</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 text-sm border-zinc-200" />
          </div>

          <div className="space-y-1.5 w-[140px]">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Fim</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 text-sm border-zinc-200" />
          </div>

          <div className="space-y-1.5 w-[140px]">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 text-sm border-zinc-200 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">{mainTab === 'revenues' ? 'A Receber' : 'Pendentes'}</SelectItem>
                <SelectItem value="paid">{mainTab === 'revenues' ? 'Recebidos' : 'Pagos'}</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 w-[160px]">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Categoria</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-10 text-sm border-zinc-200 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {(() => {
                  const type = mainTab === 'revenues' ? 'receivable' : 'payable';
                  const relevantCategories = customCategories.filter(c => c.type === type);

                  if (relevantCategories.length === 0) {
                    return (mainTab === 'revenues' ? CATEGORIES_REVENUES_FALLBACK : CATEGORIES_EXPENSES_FALLBACK).map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ));
                  }

                  return relevantCategories.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="ghost"
            className="h-10 text-xs font-bold text-zinc-500 hover:text-red-500 transition-colors"
            onClick={() => {
              setStartDate(format(startOfDay(new Date()), "yyyy-MM-01"));
              setEndDate(format(addDays(startOfDay(new Date()), 30), "yyyy-MM-dd"));
              setStatusFilter("all");
              setCategoryFilter("all");
              setSearchTerm("");
            }}
          >
            <X className="h-4 w-4 mr-2" /> LIMPAR
          </Button>
        </div>

        <TabsContent value="expenses" className="mt-6">
          <div className="space-y-6">
            {activeView === 'table' ? renderTable() : renderCharts()}
          </div>
        </TabsContent>

        <TabsContent value="revenues" className="mt-6">
          <div className="space-y-6">
            {activeView === 'charts' ? (
              <>
                {/* Revenue Focused Dashboard Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card className="bg-[#008069] text-white border-none shadow-lg">
                    <CardHeader className="p-4 pb-0">
                      <CardDescription className="text-white/70 text-[10px] font-bold uppercase">Total Recebido</CardDescription>
                      <CardTitle className="text-2xl font-black">R$ {stats.received.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="text-[10px] font-medium text-white/50">Recursos em caixa</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-amber-500 text-white border-none shadow-lg">
                    <CardHeader className="p-4 pb-0">
                      <CardDescription className="text-white/70 text-[10px] font-bold uppercase">A Receber</CardDescription>
                      <CardTitle className="text-2xl font-black">R$ {stats.receivables.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="text-[10px] font-medium text-white/50">Fluxo futuro estimado</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-zinc-900 text-white border-none shadow-lg">
                    <CardHeader className="p-4 pb-0">
                      <CardDescription className="text-white/70 text-[10px] font-bold uppercase">Previsto Total</CardDescription>
                      <CardTitle className="text-2xl font-black">R$ {(stats.received + stats.receivables).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="text-[10px] font-medium text-white/50">Entrada total no período</div>
                    </CardContent>
                  </Card>
                </div>
                {renderCharts()}
              </>
            ) : (
              renderTable()
            )}
          </div>
        </TabsContent>

        <TabsContent value="cashflow" className="mt-6">
          <div className="space-y-6">
            {activeView === 'table' ? renderTable() : renderCharts()}
          </div>
        </TabsContent>
      </Tabs>

      {/* DETAIL SHEET (SAME AS PREVIOUS BUT UPDATED) */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-md border-none shadow-2xl">
          <SheetHeader className="pb-6 border-b">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-4 rounded-2xl shadow-sm text-white",
                selectedTransaction?.type === 'receivable' ? "bg-emerald-500" : "bg-zinc-900"
              )}>
                {selectedTransaction?.type === 'receivable' ? <ArrowUpRight className="h-7 w-7" /> : <ArrowDownRight className="h-7 w-7" />}
              </div>
              <div>
                <SheetTitle className="text-xl font-black">{selectedTransaction?.type === 'receivable' ? 'Detalhes da Receita' : 'Detalhes da Despesa'}</SheetTitle>
                <SheetDescription className="text-xs font-bold uppercase tracking-wider opacity-60">ID: #{selectedTransaction?.id}</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {selectedTransaction && (
            <div className="flex flex-col h-full py-6 space-y-8">
              <div className="space-y-6">
                <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Valor do Título</span>
                  <span className={cn(
                    "text-4xl font-black",
                    selectedTransaction.type === 'receivable' ? "text-emerald-600" : "text-zinc-900"
                  )}>
                    R$ {Number(selectedTransaction.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <div className="mt-4">
                    {getStatusBadge(selectedTransaction)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Categoria</span>
                    <span className="text-sm font-bold text-zinc-700">{selectedTransaction.category || "Sem categoria"}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cidade</span>
                    <span className="text-sm font-bold text-zinc-700">{selectedTransaction.city_name || "Geral"}</span>
                  </div>
                  {selectedTransaction.cost_center && (
                    <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Centro de Custo</span>
                      <span className="text-sm font-bold text-zinc-700">{selectedTransaction.cost_center}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Data Emissão</span>
                    <span className="text-sm font-bold text-zinc-700">{safeFormat(selectedTransaction.issue_date, "dd/MM/yyyy")}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{selectedTransaction.type === 'receivable' ? 'Previsão Receb.' : 'Vencimento'}</span>
                    <span className={cn("text-sm font-black", isOverdue(selectedTransaction.due_date) && selectedTransaction.status !== 'paid' ? "text-red-500" : "text-zinc-700")}>
                      {safeFormat(selectedTransaction.due_date, "dd/MM/yyyy")}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Descrição / Observações</span>
                  <div className="text-xs text-zinc-600 italic leading-relaxed bg-zinc-50 p-4 rounded-xl border border-dashed border-zinc-200">
                    "{selectedTransaction.description}" <br />
                    {selectedTransaction.notes && <span className="mt-2 block font-medium">Obs: {selectedTransaction.notes}</span>}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <RelationshipManager entityType="contract" entityId={selectedTransaction.id} />
                </div>
              </div>

              <div className="mt-auto grid grid-cols-2 gap-3 pb-8">
                <Button className="w-full gap-2 h-12 font-black shadow-md" onClick={() => { setFormData(selectedTransaction); setIsDialogOpen(true); setIsSheetOpen(false); }}>
                  <Pencil className="h-4 w-4" /> EDITAR
                </Button>

                {selectedTransaction.status !== 'paid' ? (
                  <Button
                    className={cn(
                      "w-full gap-2 h-12 font-black shadow-md",
                      selectedTransaction.type === 'receivable' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-zinc-900 hover:bg-zinc-800"
                    )}
                    onClick={() => handleMarkAsReceivedOrPaid(selectedTransaction.id)}
                  >
                    <CheckCircle2 className="h-4 w-4" /> {selectedTransaction.type === 'receivable' ? 'RECEBER' : 'PAGAR'}
                  </Button>
                ) : (
                  <Button className="w-full gap-2 h-12 font-black" variant="outline" disabled>
                    <CheckCircle2 className="h-4 w-4" /> CONCLUÍDO
                  </Button>
                )}

                <Button
                  className="w-full gap-2 h-12 font-black col-span-2 mt-2"
                  variant="ghost"
                  onClick={() => { handleDelete(selectedTransaction.id); setIsSheetOpen(false); }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" /> EXCLUIR REGISTRO
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={isManageCategoriesOpen} onOpenChange={setIsManageCategoriesOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias ({mainTab === 'revenues' ? 'Receitas' : 'Despesas'})</DialogTitle>
            <DialogDescription>Adicione ou remova categorias personalizadas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nova categoria"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
              />
              <Button onClick={handleAddCategory} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <ScrollArea className="h-[300px] border rounded-2xl p-2 bg-zinc-50/50">
                {(() => {
                  const type = mainTab === 'revenues' ? 'receivable' : 'payable';
                  const filtered = customCategories.filter(c => c.type === type);

                  if (filtered.length === 0) {
                    return <div className="text-sm text-muted-foreground italic text-center py-10">Nenhuma categoria cadastrada.</div>;
                  }

                  return filtered.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 hover:bg-white hover:shadow-sm transition-all rounded-xl mb-1 border border-transparent hover:border-zinc-100">
                      <span className="text-sm font-bold text-zinc-700">{c.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full"
                        onClick={() => handleDeleteCategory(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ));
                })()}
              </ScrollArea>

              <div className="text-[10px] text-zinc-400 font-medium px-2 italic">
                * As categorias excluídas não afetarão lançamentos antigos, mas não aparecerão mais para novos cadastros.
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Cost Centers Dialog */}
      <ManageCostCentersDialog
        isOpen={isManageCostCentersOpen}
        onClose={() => setIsManageCostCentersOpen(false)}
        costCenters={costCenters}
        onRefresh={fetchCostCenters}
        token={token}
      />

    </div>
  );
};

export default FinanceiroPage;
