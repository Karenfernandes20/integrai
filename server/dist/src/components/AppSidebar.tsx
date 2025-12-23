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
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const items = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/app/dashboard" },
  { label: "Atendimento", icon: MessageCircle, to: "/app/atendimento" },
  { label: "CRM", icon: KanbanSquare, to: "/app/crm" },
  { label: "Financeiro", icon: Wallet2, to: "/app/financeiro" },
  { label: "Usuários", icon: Users, to: "/app/usuarios" },
  { label: "Cidades", icon: MapPin, to: "/app/cidades" },
  { label: "QR Code", icon: QrCode, to: "/app/qr-code" },
  { label: "Configurações", icon: Settings, to: "/app/configuracoes" },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const handleLogout = () => {
    navigate("/");
  };

  return (
    <Sidebar className="data-[variant=sidebar]:border-r data-[variant=sidebar]:border-sidebar-border" collapsible="offcanvas">
      <SidebarHeader className="gap-3 border-b border-sidebar-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary/20 text-sidebar-primary-foreground">
            <span className="text-lg font-semibold">VM</span>
          </div>
          <div className="flex flex-col text-xs">
            <span className="text-sm font-semibold tracking-tight">ViaMoveCar</span>
            <span className="text-[11px] text-sidebar-foreground/70">Painel Administrativo</span>
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
              {items.map((item) => {
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
                    {isActive && (
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
    </Sidebar>
  );
}
