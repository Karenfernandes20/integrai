import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "").trim();

    if (!email || !password) {
      toast({
        title: "Preencha os dados",
        description: "Informe e-mail e senha administrativos para acessar o painel.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Login simulado",
      description: "Autenticação real será integrada posteriormente.",
    });

    navigate("/app/dashboard");
  };

  const handleForgotPassword = () => {
    toast({
      title: "Recuperação de senha",
      description: "A redefinição de senha será configurada em breve.",
    });
  };

  return (
    <div className="flex min-h-screen items-stretch bg-gradient-to-br from-primary-soft via-background to-primary/5 px-4 py-6">
      <main className="mx-auto flex w-full max-w-5xl flex-col items-stretch gap-8 md:flex-row md:items-stretch md:gap-10">
        <section className="flex flex-1 flex-col justify-center space-y-5 md:space-y-6">
          <span className="inline-flex max-w-[260px] items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-medium text-primary-soft-foreground md:max-w-none">
            ViaMoveCar Admin
            <span className="h-1 w-1 rounded-full bg-accent" />
            Centro de controle da operação
          </span>
          <header>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
              Acesse o painel <span className="text-primary">ViaMoveCar Admin</span>
            </h1>
            <p className="mt-2 max-w-xl text-xs text-muted-foreground sm:text-sm">
              Dashboard, CRM, financeiro, atendimento WhatsApp e gestão de usuários em um único ambiente
              administrativo.
            </p>
          </header>
          <ul className="grid grid-cols-1 gap-3 text-xs text-muted-foreground sm:grid-cols-2 md:max-w-md">
            <li className="rounded-xl bg-card/70 p-3 shadow-soft">
              <p className="font-medium text-foreground">Visão 360º</p>
              <p className="mt-1 text-[11px]">
                Indicadores por cidade, estado e canais de atendimento.
              </p>
            </li>
            <li className="rounded-xl bg-card/70 p-3 shadow-soft">
              <p className="font-medium text-foreground">Pronto para integração</p>
              <p className="mt-1 text-[11px]">
                Evolution API, financeiro e apps móveis serão plugados aqui.
              </p>
            </li>
          </ul>
        </section>

        <section className="flex flex-1 items-center justify-center md:justify-end">
          <Card className="w-full max-w-md border border-primary-soft/70 bg-card/95 shadow-strong">
            <CardHeader className="space-y-1 pb-3 sm:pb-4">
              <CardTitle className="text-sm sm:text-base">Login administrativo</CardTitle>
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                Apenas usuários internos autorizados podem acessar.
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-3 sm:space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail corporativo</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="admin@viamovecar.com"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" name="password" type="password" autoComplete="current-password" required />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="px-0 text-primary"
                      onClick={handleForgotPassword}
                    >
                      Esqueci minha senha
                    </Button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="mt-1 flex w-full items-center justify-center gap-2 sm:mt-2"
                  size="lg"
                >
                  Entrar no painel
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                  Este login é apenas visual nesta versão. A autenticação real com backend seguro será configurada na
                  próxima etapa.
                </p>
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Index;
