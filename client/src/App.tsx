import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { AdminLayout } from "./layouts/AdminLayout";
import DashboardPage from "./pages/Dashboard";
import AtendimentoPage from "./pages/Atendimento";
import CrmPage from "./pages/Crm";
import FinanceiroPage from "./pages/Financeiro";
import UsuariosPage from "./pages/Usuarios";
import CidadesPage from "./pages/Cidades";
import QrCodePage from "./pages/QrCode";
import ConfiguracoesPage from "./pages/Configuracoes";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import SuperadminPage from "./pages/Superadmin";
import RelatoriosPage from "./pages/Relatorios";
import ContatosPage from "./pages/Contatos";
import FollowUpPage from "./pages/FollowUp";

import { AuthProvider } from "./contexts/AuthContext";
import AdminRoute from "./components/AdminRoute";
import LoginPage from "./pages/Login";
import SuperAdminLoginPage from "./pages/SuperAdminLogin";
import SignupPage from "./pages/Signup";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/superlogin" element={<SuperAdminLoginPage />} />
            <Route path="/cadastro" element={<SignupPage />} />
            <Route path="/" element={<Index />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route element={<AdminRoute roles={['SUPERADMIN']} />}>
              <Route path="/superadmin" element={<SuperadminPage />} />
              {/* Use the new dashboard component for the panel if SuperadminPage is old/placeholder */}
              <Route path="/admin/dashboard" element={<SuperadminPage />} />
            </Route>

            <Route path="/app" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="atendimento" element={<AtendimentoPage />} />
              <Route path="crm" element={<CrmPage />} />
              <Route path="financeiro" element={<FinanceiroPage />} />
              <Route path="usuarios" element={<UsuariosPage />} />
              <Route path="cidades" element={<CidadesPage />} />
              <Route path="qr-code" element={<QrCodePage />} />
              <Route path="configuracoes" element={<ConfiguracoesPage />} />
              <Route path="contatos" element={<ContatosPage />} />
              <Route path="follow-up" element={<FollowUpPage />} />

              {/* SuperAdmin Routes */}
              <Route element={<AdminRoute roles={['SUPERADMIN', 'ADMIN']} />}>
                <Route path="empresas" element={<SuperadminPage />} />
                <Route path="relatorios" element={<RelatoriosPage />} />
              </Route>
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
