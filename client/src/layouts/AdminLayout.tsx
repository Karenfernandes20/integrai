import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "../components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../components/ui/sidebar";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { ShieldAlert, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { GlobalSearch } from "../components/GlobalSearch";
import { SystemModeBanner } from "../components/SystemModeBanner";
import { SubscriptionBanner } from "../components/SubscriptionBanner";
import { useSubscriptionBanner } from "../hooks/useSubscriptionBanner";
import { UpgradeModal } from "../components/UpgradeModal";
import { ThemeToggle } from "../components/ThemeToggle";
import { Badge } from "../components/ui/badge";
import { getOperationalProfile } from "../lib/profileUtils"; // Added logic

const SECTION_TITLES: Record<string, string> = {
  "/app/dashboard": "Dashboard",
  "/app/atendimento": "Atendimento (WhatsApp)",
  "/app/crm": "CRM",
  "/app/financeiro": "Financeiro",
  "/app/usuarios": "Usuários",
  "/app/cidades": "Cidades",
  "/app/qr-code": "QR Code",
  "/app/configuracoes": "Configurações",
  "/app/relatorios": "Relatórios Gerenciais",
  "/app/templates": "Central de Templates",
  "/app/roadmap": "Roadmap do Produto",
  "/app/faq": "Ajuda / FAQ",
  "/app/relatorios/conversao": "Relatório de Conversão",
};

function getSectionTitle(pathname: string) {
  const match = Object.keys(SECTION_TITLES).find((key) => pathname.startsWith(key));
  return SECTION_TITLES[match ?? "/app/dashboard"];
}

export const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const title = getSectionTitle(location.pathname);
  const { user, logout } = useAuth();
  const { status } = useSubscriptionBanner();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Auto-open modal if overdue
  useEffect(() => {
    if (status?.overdue && user?.role !== 'SUPERADMIN') {
      setShowUpgradeModal(true);
    }
  }, [status?.overdue, user?.role]);

  const handleLogout = () => {
    const role = user?.role;
    logout();
    if (role === 'SUPERADMIN') {
      navigate("/superlogin");
    } else {
      navigate("/login");
    }
  };

  // Dynamic Favicon Update
  useEffect(() => {
    let faviconUrl = "/logo-integrai.jpg?v=2"; // Default fallback

    if (user?.role === 'SUPERADMIN') {
      faviconUrl = "/logo-integrai.jpg?v=2";
    } else if (user?.company?.logo_url) {
      faviconUrl = user.company.logo_url;
    }

    // Try to find existing icon link
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'shortcut icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
  }, [user?.company?.logo_url, user?.role]);

  const isAtendimento = location.pathname.startsWith("/app/atendimento");

  // Calculate Profile
  const profile = getOperationalProfile(user?.company);
  const showProfileBadge = profile && profile !== 'GENERIC';

  return (
    <SidebarProvider>
      <div className={cn("w-full bg-background flex flex-col", isAtendimento ? "h-[100dvh] overflow-hidden" : "min-h-screen")}>
        <SystemModeBanner />
        <SubscriptionBanner />
        <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />

        <div className={cn("flex w-full flex-1", isAtendimento ? "h-full overflow-hidden" : "")}>
          <AppSidebar />

          <SidebarInset className={cn(isAtendimento && "h-[100dvh] overflow-hidden flex flex-col")}>
            <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="-ml-1 sm:mr-1" />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm sm:text-lg font-bold sm:font-semibold tracking-tight truncate max-w-[120px] sm:max-w-none">{title}</h1>
                    {showProfileBadge && (
                      <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary text-[9px] sm:text-[10px] px-1.5 sm:px-2 h-4 sm:h-5 whitespace-nowrap">
                        {profile}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground hidden sm:block">Integrai Control Panel</p>
                </div>
              </div>

              <div className="flex-1 max-w-md mx-8 hidden lg:block">
                <GlobalSearch />
              </div>

              <div className="relative flex items-center gap-3 text-xs">
                {user?.role === 'SUPERADMIN' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2 mr-2 hidden md:flex"
                    onClick={() => navigate('/superadmin')}
                  >
                    <ShieldAlert className="h-4 w-4" />
                    SuperAdmin
                  </Button>
                )}

                <ThemeToggle />

                <div className="hidden text-right md:block">
                  <p className="font-medium">{user?.role === 'SUPERADMIN' ? 'Acesso SuperAdmin' : (user?.full_name || 'Usuário')}</p>
                  <p className="text-[11px] text-muted-foreground max-w-[150px] truncate">
                    {user?.company?.name ? user.company.name : (user?.role || 'Acesso interno')}
                  </p>
                </div>

                {user?.role === 'SUPERADMIN' ? (
                  <img
                    src="/logo-integrai.jpg"
                    className="h-9 w-9 rounded-full object-cover border bg-gray-50"
                    alt="SuperAdmin"
                  />
                ) : (user?.company?.logo_url || user?.profile_pic_url) ? (
                  <img
                    src={user?.company?.logo_url || user?.profile_pic_url}
                    className="h-9 w-9 rounded-full object-cover border bg-gray-50"
                    alt="Avatar"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground" title={user?.full_name}>
                    {user?.full_name?.substring(0, 2).toUpperCase() || 'US'}
                  </div>
                )}
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <main className={cn(
              "flex-1 bg-gradient-to-b from-background via-background to-primary-soft/10",
              (isAtendimento || location.pathname.startsWith("/app/agenda")) ? "p-0 overflow-hidden h-[calc(100dvh-4rem)]" : "px-2 sm:px-4 pb-8 pt-2 sm:pt-4"
            )}>
              {status?.overdue && user?.role !== 'SUPERADMIN' ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-6 p-4 sm:p-8">
                  <div className="bg-red-100 p-4 sm:p-6 rounded-full">
                    <ShieldAlert className="h-12 w-12 sm:h-16 sm:w-16 text-red-600" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-red-700">Acesso Bloqueado</h2>
                  <p className="text-lg sm:text-xl max-w-lg text-muted-foreground">
                    A assinatura da sua empresa está vencida. <br />
                    Por favor, regularize o pagamento para restaurar o acesso ao sistema.
                  </p>
                  <div className="p-4 bg-muted rounded-lg border border-border">
                    <p className="text-sm font-semibold">Vencimento: {status.due_date ? new Date(status.due_date).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div className="flex flex-col gap-3 w-full max-w-sm">
                    <Button size="lg" className="w-full font-bold text-lg h-12" onClick={() => setShowUpgradeModal(true)}>
                      Renovar Assinatura Agora
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => window.open('https://wa.me/5511999999999?text=Preciso%20de%20ajuda%20financeira', '_blank')}>
                      Falar com Suporte
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={cn(
                  "mx-auto flex flex-col h-full",
                  isAtendimento ? "max-w-full gap-0" :
                    location.pathname.startsWith("/app/crm") ? "max-w-full gap-4 p-2 sm:p-4" :
                      location.pathname.startsWith("/app/agenda") ? "max-w-full gap-0 p-0 sm:p-1" : "max-w-6xl gap-4 sm:gap-6"
                )}>
                  <Outlet />
                </div>
              )}
            </main>

            {!isAtendimento && (
              <footer className="border-t py-4 px-6 bg-background/50 text-xs text-muted-foreground flex justify-center gap-4">
                <span>&copy; {new Date().getFullYear()} Integrai</span>
                <span>•</span>
                <a href="/termos-de-servico" target="_blank" className="hover:text-primary transition-colors">Termos</a>
                <span>•</span>
                <a href="/politica-de-privacidade" target="_blank" className="hover:text-primary transition-colors">Privacidade</a>
              </footer>
            )}
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
};
