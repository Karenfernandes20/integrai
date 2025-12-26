import { ArrowRight, ShieldAlert, LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, logout, user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Falha no login");
      }

      login(data.token, data.user);

      toast({
        title: "Bem-vindo(a)!",
        description: `Login realizado com sucesso.`,
      });

      navigate("/app/dashboard");
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: error.message || "Verifique suas credenciais.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate("/forgot-password");
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
          <Card className="w-full max-w-md border border-primary-soft/70 bg-card/95 shadow-strong relative">
            <CardHeader className="space-y-1 pb-3 sm:pb-4">
              <CardTitle className="text-sm sm:text-base">
                {isAuthenticated ? `Olá, ${user?.full_name}` : "Login administrativo"}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                {isAuthenticated ? "Você já está conectado." : "Apenas usuários internos autorizados podem acessar."}
              </p>

              {isAuthenticated && user?.role === 'SUPERADMIN' && (
                <div className="absolute top-4 right-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => navigate('/superadmin')}
                    className="gap-2 shadow-sm"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    SuperAdmin
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isAuthenticated ? (
                <div className="flex flex-col gap-4">
                  <Button onClick={() => navigate('/app/dashboard')} size="lg" className="w-full gap-2">
                    <LayoutDashboard className="h-5 w-5" />
                    Acessar Dashboard
                  </Button>

                  <Button variant="outline" onClick={() => { logout(); navigate(0); }} className="w-full">
                    Sair / Logout
                  </Button>

                  <div className="text-xs text-center text-muted-foreground bg-muted p-2 rounded">
                    <p>Debug Info:</p>
                    <p>User: <strong>{user?.email}</strong></p>
                    <p>Role: <strong>{user?.role || 'Sem role'}</strong></p>
                  </div>
                </div>
              ) : (
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
                    disabled={loading}
                  >
                    {loading ? "Entrando..." : "Entrar no painel"}
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Index;
