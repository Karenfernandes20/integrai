import React, { Component, ErrorInfo, ReactNode } from "react";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 text-red-900 p-4 font-sans">
          <div className="max-w-2xl w-full bg-white shadow-xl rounded-lg p-8 border border-red-100">
            <h1 className="text-2xl font-bold mb-2 text-red-700">Oops! Algo deu errado.</h1>
            <p className="mb-4 text-gray-600">Ocorreu um erro inesperado na interface (Frontend Crash).</p>

            <div className="bg-slate-900 text-slate-50 p-4 rounded-md text-xs font-mono overflow-auto max-h-60 mb-6">
              <strong>{this.state.error?.message}</strong>
              <div className="mt-2 opacity-70 whitespace-pre-wrap">{this.state.error?.stack}</div>
            </div>

            <div className="flex gap-4">
              <button
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
              >
                Limpar Dados Locais e Sair
              </button>
              <button
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition"
                onClick={() => window.location.reload()}
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
import GruposPage from "./pages/Grupos";
import CampanhasPage from "./pages/Campanhas";
import FaqPage from "./pages/Faq";
import TagsPage from "./pages/Tags";
import TasksPage from "./pages/Tasks";
import LogsPage from "./pages/Logs";
import AlertsPage from "./pages/Alerts";
import HealthPage from "./pages/Health";
import IAPage from "./pages/IA";
import AuditoriaPage from "./pages/Auditoria";


import TemplatesPage from "./pages/Templates";
import RoadmapPage from "./pages/Roadmap";
import ConversionReports from "./pages/ConversionReports";

// Lavajato Pages
import AgendaWrapper from "./pages/AgendaWrapper";
import VehiclesPage from "./pages/lavajato/Vehicles";
import ServiceOrdersPage from "./pages/lavajato/ServiceOrders";
import ServicesPage from "./pages/lavajato/Services";

// Restaurant Pages
import PedidosPage from "./pages/restaurante/Pedidos";
import MesasPage from "./pages/restaurante/Mesas";
import CozinhaPage from "./pages/restaurante/Cozinha";
import CardapioPage from "./pages/restaurante/Cardapio";
import EntregasPage from "./pages/restaurante/Entregas";

// Loja Pages
import VendasLojaPage from "./pages/loja/Vendas";
import EstoquePage from "./pages/loja/Estoque";
import FornecedoresPage from "./pages/loja/Fornecedores";
import MetasPage from "./pages/loja/Metas";


import { AuthProvider } from "./contexts/AuthContext";
import AdminRoute from "./components/AdminRoute";
import LoginPage from "./pages/Login";
import SuperAdminLoginPage from "./pages/SuperAdminLogin";
import SignupPage from "./pages/Signup";
import OnboardingPage from "./pages/Onboarding";
import LegalPage from "./pages/LegalPage";
import { RouteGuard } from "./components/RouteGuard";
const queryClient = new QueryClient();

import { ThemeProvider } from "next-themes";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <ErrorBoundary>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/superlogin" element={<SuperAdminLoginPage />} />
                <Route path="/cadastro" element={<SignupPage />} />
                <Route path="/" element={<Index />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/termos-de-servico" element={<LegalPage type="terms" />} />
                <Route path="/politica-de-privacidade" element={<LegalPage type="privacy" />} />

                <Route element={<AdminRoute roles={['SUPERADMIN']} />}>
                  <Route path="/superadmin" element={<SuperadminPage />} />
                  {/* Use the new dashboard component for the panel if SuperadminPage is old/placeholder */}
                  <Route path="/admin/dashboard" element={<SuperadminPage />} />
                </Route>

                <Route path="/app" element={<AdminLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="atendimento" element={<AtendimentoPage />} />
                  <Route path="grupos" element={<GruposPage />} />
                  <Route path="campanhas" element={<CampanhasPage />} />
                  <Route path="crm" element={<CrmPage />} />
                  <Route path="agenda" element={<AgendaWrapper />} />
                  <Route path="financeiro" element={<FinanceiroPage />} />
                  <Route path="usuarios" element={<UsuariosPage />} />
                  <Route path="cidades" element={<CidadesPage />} />
                  <Route path="qr-code" element={<QrCodePage />} />
                  <Route path="configuracoes" element={<ConfiguracoesPage />} />
                  <Route path="contatos" element={<ContatosPage />} />
                  <Route path="follow-up" element={<FollowUpPage />} />
                  <Route path="faq" element={<FaqPage />} />
                  <Route path="tags" element={<TagsPage />} />

                  {/* Lavajato Specific Routes */}
                  <Route element={<RouteGuard requiredProfile="LAVAJATO" />}>
                    {/* Agenda is now handled by AgendaWrapper at root level */}
                    <Route path="veiculos" element={<VehiclesPage />} />
                    <Route path="os" element={<ServiceOrdersPage />} />
                    <Route path="servicos" element={<ServicesPage />} />
                  </Route>

                  {/* Restaurant Specific Routes */}
                  <Route element={<RouteGuard requiredProfile="RESTAURANTE" />}>
                    <Route path="pedidos" element={<PedidosPage />} />
                    <Route path="mesas" element={<MesasPage />} />
                    <Route path="cozinha" element={<CozinhaPage />} />
                    <Route path="cardapio" element={<CardapioPage />} />
                    <Route path="entregas" element={<EntregasPage />} />
                  </Route>

                  {/* Loja Specific Routes */}
                  <Route element={<RouteGuard requiredProfile="LOJA" />}>
                    <Route path="loja/vendas" element={<VendasLojaPage />} />
                    <Route path="loja/estoque" element={<EstoquePage />} />
                    <Route path="loja/fornecedores" element={<FornecedoresPage />} />
                    <Route path="loja/metas" element={<MetasPage />} />
                  </Route>

                  {/* SuperAdmin Routes */}
                  <Route element={<AdminRoute roles={['SUPERADMIN', 'ADMIN']} />}>
                    <Route path="empresas" element={<SuperadminPage />} />
                    <Route path="relatorios" element={<RelatoriosPage />} />
                    <Route path="tarefas" element={<TasksPage />} />
                    <Route path="logs" element={<LogsPage />} />
                    <Route path="alertas" element={<AlertsPage />} />
                    <Route path="saude" element={<HealthPage />} />
                    <Route path="ia" element={<IAPage />} />
                    <Route path="auditoria" element={<AuditoriaPage />} />


                    <Route path="relatorios/conversao" element={<ConversionReports />} />
                  </Route>

                  <Route element={<AdminRoute roles={['SUPERADMIN']} />}>
                    <Route path="templates" element={<TemplatesPage />} />
                    <Route path="roadmap" element={<RoadmapPage />} />
                  </Route>
                </Route>

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </ErrorBoundary>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
