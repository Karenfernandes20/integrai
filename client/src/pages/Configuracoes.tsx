
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { PlanUsage } from "../components/PlanUsage";
import { CompanyProfile } from "../components/CompanyProfile";
import UsuariosPage from "./Usuarios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Building2, CreditCard, Users, Zap } from "lucide-react";
import { EvolutionStatus } from "../components/EvolutionStatus";
import { InstagramStatus } from "../components/InstagramStatus";

const ConfiguracoesPage = () => {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Portal da Empresa</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie sua assinatura, equipe e dados corporativos.
        </p>
      </header>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="w-full justify-start h-12 bg-muted/50 p-1">
          <TabsTrigger value="account" className="gap-2">
            <Building2 className="h-4 w-4" /> Perfil
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" /> Plano e Faturas
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" /> Equipe
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Zap className="h-4 w-4" /> Integrações
          </TabsTrigger>
        </TabsList>

        {/* ACCOUNT TAB */}
        <TabsContent value="account" className="mt-6">
          <CompanyProfile />
        </TabsContent>

        {/* BILLING TAB */}
        <TabsContent value="billing" className="mt-6">
          <PlanUsage />
        </TabsContent>

        {/* TEAM TAB */}
        <TabsContent value="team" className="mt-6">
          <div className="border rounded-lg overflow-hidden">
            {/* Embed UsuariosPage but customized slightly or wrapped */}
            <div className="bg-muted/10 p-0">
              <UsuariosPage />
            </div>
          </div>
        </TabsContent>

        {/* INTEGRATIONS TAB */}
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

            <Card className="opacity-60">
              <CardHeader>
                <CardTitle>Pagamentos (Em breve)</CardTitle>
                <CardDescription>Mercado Pago / Stripe</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="outline">Em desenvolvimento</Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default ConfiguracoesPage;
