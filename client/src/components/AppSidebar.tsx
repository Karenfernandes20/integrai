import { NavLink } from "./NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from "./ui/sidebar";
import { cn } from "../lib/utils";
import {
  LayoutDashboard,
  MessageCircle,
  KanbanSquare,
  Wallet2,
  Users,
  MapPin,
  QrCode,
  Settings,
  LogOut,
  Building2,
  FileText,
  CalendarCheck,
  CheckSquare,
  HelpCircle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState, useEffect } from "react";
import { EditProfileModal } from "./EditProfileModal";

const items = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/app/dashboard" },
  { label: "Atendimento", icon: MessageCircle, to: "/app/atendimento" },
  { label: "Grupos", icon: Users, to: "/app/grupos" },
  { label: "Campanhas", icon: FileText, to: "/app/campanhas" },
  { label: "Follow-up", icon: CalendarCheck, to: "/app/follow-up" },
  { label: "Contatos", icon: Users, to: "/app/contatos" },
  { label: "CRM", icon: KanbanSquare, to: "/app/crm" },
  { label: "Financeiro", icon: Wallet2, to: "/app/financeiro" },
  { label: "Usuários", icon: Users, to: "/app/usuarios" },
  { label: "Cidades", icon: MapPin, to: "/app/cidades" },
  { label: "QR Code", icon: QrCode, to: "/app/qr-code" },
  { label: "Ajuda / FAQ", icon: HelpCircle, to: "/app/faq" },
  { label: "Configurações", icon: Settings, to: "/app/configuracoes" },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const currentPath = location.pathname;

  const { token } = useAuth();

  useEffect(() => {
    if (user?.role === 'SUPERADMIN' && token) {
      const fetchTaskCount = async () => {
        try {
          const res = await fetch('/api/admin/tasks/count', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setTaskCount(data.count);
          }
        } catch (e) { }
      };
      fetchTaskCount();
      const interval = setInterval(fetchTaskCount, 60000); // Poll every minute
      return () => clearInterval(interval);
    }
  }, [user, token]);

  const handleLogout = () => {
    const role = user?.role;
    logout();
    if (role === 'SUPERADMIN') {
      navigate("/superlogin");
    } else {
      navigate("/login");
    }
  };

  const navItems = [...items];
  if (user?.role === 'SUPERADMIN') {
    navItems.splice(1, 0, { label: "Clientes", icon: Building2, to: "/app/empresas" });
    navItems.splice(2, 0, { label: "Tarefas", icon: CheckSquare, to: "/app/tarefas" });
  }

  if (user?.role === 'SUPERADMIN' || user?.role === 'ADMIN') {
    // Insert "Relatórios" before the last item (Configurações) if FAQ is before Configurações
    // Or just push and ensure FAQ is moved.
    // Let's simplify: push all, then find FAQ and move it to penultimate.
    navItems.push({ label: "Relatórios", icon: FileText, to: "/app/relatorios" });
  }

  // Ensure FAQ is penultimate (second to last)
  const faqIndex = navItems.findIndex(i => i.label === "Ajuda / FAQ");
  if (faqIndex > -1) {
    const [faqItem] = navItems.splice(faqIndex, 1);
    navItems.splice(navItems.length - 1, 0, faqItem);
  }

  // Permission Logic
  const filteredNavItems = navItems.filter(item => {
    if (user?.role === 'SUPERADMIN') return true;

    // Legacy support: if no permissions array, show all (or assume migrated to [])
    // Ideally we assume [] means nothing, but for safety let's check if undefined
    if (user?.permissions === undefined) return true;

    let requiredPerm = "";
    switch (item.label) {
      case "Dashboard": requiredPerm = "dashboard"; break;
      case "Atendimento": requiredPerm = "atendimentos"; break;
      case "Grupos": requiredPerm = "atendimentos"; break;
      case "Campanhas": requiredPerm = "atendimentos"; break;
      case "Follow-up": requiredPerm = "atendimentos"; break;
      case "Contatos": requiredPerm = "atendimentos"; break;
      case "CRM": requiredPerm = "crm"; break;
      case "Financeiro": requiredPerm = "financeiro"; break;
      case "Relatórios": requiredPerm = "relatorios"; break; // Explicit permission
      case "Configurações": requiredPerm = "configuracoes"; break;
      case "Usuários": requiredPerm = "configuracoes"; break;
      case "Cidades": requiredPerm = "configuracoes"; break;
      case "QR Code": requiredPerm = "configuracoes"; break;
      default: return true;
    }

    return user.permissions.includes(requiredPerm);
  });



  return (
    <Sidebar className="data-[variant=sidebar]:border-r data-[variant=sidebar]:border-sidebar-border" collapsible="offcanvas">
      <SidebarHeader className="gap-3 border-b border-sidebar-border/60 pb-4">
        <div
          className="flex items-center gap-3 cursor-pointer p-1 rounded-lg hover:bg-sidebar-accent/50 transition-colors group"
          onClick={() => setIsEditProfileOpen(true)}
          title="Ver/Editar perfil"
        >
          {user?.role === 'SUPERADMIN' ? (
            <img
              src="/logo-integrai.jpg"
              alt="Logo Integrai"
              className="h-9 w-9 rounded-xl object-contain bg-white"
            />
          ) : user?.company?.logo_url ? (
            <img
              src={user.company.logo_url}
              alt="Logo"
              className="h-9 w-9 rounded-xl object-cover bg-white"
            />
          ) : (
            <img
              src="/logo-integrai.jpg"
              alt="Logo Integrai"
              className="h-9 w-9 rounded-xl object-contain bg-white"
            />
          )}
          <div className="flex flex-col text-xs min-w-0">
            <span className="text-sm font-semibold tracking-tight truncate max-w-[120px] group-hover:text-sidebar-primary-foreground">
              {user?.company?.name || "Integrai"}
            </span>
            <span className="text-[11px] text-sidebar-foreground/70 group-hover:text-sidebar-foreground">Editar perfil</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-[0.16em] text-sidebar-foreground/60">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <nav className="mt-1 flex flex-col gap-1 text-sm">
              {filteredNavItems.map((item) => {
                const isActive = currentPath.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                    activeClassName="bg-sidebar-primary text-sidebar-primary-foreground shadow-strong"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{item.label}</span>
                    {item.label === "Tarefas" && taskCount > 0 && (
                      <span className="ml-auto bg-accent text-accent-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {taskCount}
                      </span>
                    )}
                    {isActive && item.label !== "Tarefas" && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-sidebar-border/70 pt-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-sidebar-foreground/80 transition-colors hover:bg-destructive/10 hover:text-destructive-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </button>
      </SidebarFooter>
      <EditProfileModal isOpen={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)} />
    </Sidebar>
  );
}
