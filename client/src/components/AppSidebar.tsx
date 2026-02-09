import { NavLink } from "./NavLink";
import { getMenuByProfile, SUPERADMIN_ITEMS } from "../lib/MenuEngine";
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
  Terminal,
  Bell,
  Activity,
  HelpCircle,
  Bot,
  Fingerprint,
  GitBranch,
  LayoutTemplate,
  Map,
  Tags as TagsIcon,
  Car,
  Wrench,
  ClipboardList,
  TrendingUp,
  ShoppingBag,
  Coffee,
  ChefHat,
  Truck,
  Package,
  Target,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState, useEffect } from "react";
import { EditProfileModal } from "./EditProfileModal";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

const items: any[] = []; // Placeholder to avoid breaking if referenced elsewhere, but unused now.

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token, logout } = useAuth(); // Destructure token here
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const currentPath = location.pathname;

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

          const alertRes = await fetch('/api/admin/alerts/count', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (alertRes.ok) {
            const alertData = await alertRes.json();
            setAlertCount(alertData.count);
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

  const [searchParams] = useSearchParams();
  const [impersonatedProfile, setImpersonatedProfile] = useState<string | null>(null);

  useEffect(() => {
    const urlCompanyId = searchParams.get('companyId');
    if (user?.role === 'SUPERADMIN' && urlCompanyId && token) {
      // Fetch company profile to impersonate menu
      fetch(`/api/companies/${urlCompanyId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.operational_profile) setImpersonatedProfile(data.operational_profile);
          else {
            // Fallback logic similar to main engine
            let p = 'GENERIC';
            if (data.operation_type === 'pacientes' || data.category === 'clinica') p = 'CLINICA';
            else if (data.operation_type === 'loja' || data.category === 'loja') p = 'LOJA';
            else if (data.category === 'lavajato') p = 'LAVAJATO';
            else if (data.category === 'restaurante') p = 'RESTAURANTE';
            else if (data.operation_type === 'motoristas' || data.category === 'transporte') p = 'TRANSPORTE';
            setImpersonatedProfile(p);
          }
        })
        .catch(() => setImpersonatedProfile(null));
    } else {
      setImpersonatedProfile(null);
    }
  }, [searchParams, user, token]);

  // --- DYNAMIC MENU ENGINE ---
  // Determine Profile
  let profile = impersonatedProfile || (user as any)?.company?.operational_profile;
  if (!profile) {
    if ((user as any)?.company?.category === 'loja' || (user as any)?.company?.operation_type === 'loja') profile = 'LOJA';
    else if ((user as any)?.company?.category === 'lavajato') profile = 'LAVAJATO';
    else if ((user as any)?.company?.category === 'restaurante') profile = 'RESTAURANTE';
    else if ((user as any)?.company?.operation_type === 'motoristas' || (user as any)?.company?.category === 'transporte') profile = 'TRANSPORTE';
    else if ((user as any)?.company?.operation_type === 'pacientes' || (user as any)?.company?.category === 'clinica') profile = 'CLINICA';
    else profile = 'GENERIC';
  }

  // Get Base Items
  let navItems = getMenuByProfile(profile);

  // Inject Superadmin Items if applicable
  if (user?.role === 'SUPERADMIN') {
    // If superadmin, we should append the specific tools
    // But Superadmin might also want to see the "Company Content" logic.
    // Usually Superadmin sees "GENERIC" unless impersonating, but let's stick to the engine.
    navItems = [...navItems, ...SUPERADMIN_ITEMS];
  }

  // Ensure FAQ is penultimate (second to last) if it exists, logic from before
  const faqIndex = navItems.findIndex(i => i.label === "Ajuda / FAQ");
  if (faqIndex > -1 && faqIndex < navItems.length - 1) {
    const [faqItem] = navItems.splice(faqIndex, 1);
    navItems.splice(navItems.length - 1, 0, faqItem); // Put before last? Or just put at end if not superadmin?
    // User logic was "Splice penultimate".
    // If we have SUPERADMIN items appended, FAQ might get pushed up.
    // Let's keep simpler logic for now: FAQ usually ends up near bottom or just leave as is.
  }

  // Permission Logic
  const filteredNavItems = navItems.filter(item => {
    // 1. SuperAdmin Only Check
    if (item.superAdminOnly && user?.role !== 'SUPERADMIN') return false;

    // 2. Grant Everything to Superadmin
    if (user?.role === 'SUPERADMIN') return true;

    // 3. Permission Check
    // If no permission requirements, show it
    if (!item.requiredPermission) return true;

    // If user has no permissions array (and not admin), hide restricted
    if (!user?.permissions) return false;

    return user.permissions.includes(item.requiredPermission);
  });

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };



  return (
    <Sidebar className="data-[variant=sidebar]:border-r data-[variant=sidebar]:border-sidebar-border" collapsible="offcanvas">
      <SidebarHeader className="gap-3 border-b border-sidebar-border/60 pb-4">
        <div
          className="flex items-center gap-3 cursor-pointer p-1 rounded-lg hover:bg-sidebar-accent/50 transition-colors group"
          onClick={() => setIsEditProfileOpen(true)}
          title="Ver/Editar perfil"
        >
          {user?.company?.logo_url && user?.role !== 'SUPERADMIN' ? (
            <img
              src={user.company.logo_url}
              alt="Logo"
              className="h-9 w-9 rounded-xl object-cover bg-white"
            />
          ) : (
            <Avatar className="h-9 w-9 rounded-xl border border-sidebar-border/50 shrink-0">
              <AvatarImage src={user?.profile_pic_url} className="object-cover" />
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold rounded-xl">
                {getInitials(user?.full_name || "??")}
              </AvatarFallback>
            </Avatar>
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
                    {item.label === "Alertas" && alertCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {alertCount}
                      </span>
                    )}
                    {isActive && item.label !== "Tarefas" && item.label !== "Alertas" && (
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
