import { ArrowRight, BarChart3, MessageCircle, ShieldCheck, Users, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-soft via-background to-background">
      {/* Top navigation */}
      <header className="border-b border-primary-soft/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">Integrai</span>
              <span className="text-[11px] text-muted-foreground">Painel de gestão</span>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/superlogin")}
              className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 font-medium"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              SuperAdmin
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/login")}
              className="text-muted-foreground hover:text-primary"
            >
              Login
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/cadastro")}
              className="gap-2 shadow-sm"
            >
              Cadastre-se
              <ArrowRight className="h-3 w-3" />
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero section */}
      <main className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 pb-12 pt-10 sm:pt-16 md:pb-20">
        <section className="flex flex-col items-center text-center space-y-8 max-w-4xl">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary border border-primary/10">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Novo CRM + Atendimento WhatsApp
            </span>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-foreground">
              Gestão completa dos seus <span className="text-primary">atendimentos e vendas</span>
            </h1>

            <p className="max-w-2xl mx-auto text-base text-muted-foreground sm:text-lg leading-relaxed">
              O Integrai centraliza CRM, financeiro, atendimento via WhatsApp e automações em uma única plataforma inteligente.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button size="lg" className="gap-2 h-12 text-base px-8 shadow-md" onClick={() => navigate("/cadastro")}>
              Começar agora
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/login")}
              className="h-12 text-base px-8 border-primary/20 hover:bg-primary/5"
            >
              Já tenho conta
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm text-muted-foreground pt-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>CRM Integrado</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>WhatsApp API</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Controle Financeiro</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Relatórios 360º</span>
            </div>
          </div>
        </section>

        {/* Dashboard Preview Section */}
        <section className="w-full relative mt-8">
          <div className="text-center mb-10 space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Potencialize sua Operação</h2>
            <p className="text-muted-foreground">Módulos especializados para cada necessidade do seu negócio.</p>
          </div>

          <div className="absolute -z-10 bg-primary/20 blur-[120px] w-[60%] h-[300px] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" />
          <DashboardPreview />
        </section>

        {/* Feature Gallery */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl mt-12 px-4">
          <div className="flex flex-col gap-4 group">
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
              <img src="/real_atendimento.png" alt="Atendimento WhatsApp Real" className="aspect-video object-cover object-top" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Atendimento Multicanal</h3>
              <p className="text-sm text-muted-foreground mt-1">Chat real com suporte a mensagens de texto, áudio e grupos. Identificação visual de atendentes e status de conversa.</p>
            </div>
          </div>
          <div className="flex flex-col gap-4 group">
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
              <img src="/real_crm.png" alt="CRM Kanban Real" className="aspect-video object-cover object-top" />
            </div>
            <div>
              <h3 className="text-xl font-bold">CRM Integrado</h3>
              <p className="text-sm text-muted-foreground mt-1">Kanban board para gestão de leads com colunas personalizáveis e cartões de oportunidades com valores.</p>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};

// Import DashboardPreview
import { DashboardPreview } from "../components/landing/DashboardPreview";
export default Index;
