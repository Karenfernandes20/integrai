import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { MessageCircle, User, Building2, Phone, Mail } from "lucide-react";

const WHATSAPP_NUMBER = "5538999540230";

const SignupPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("name") || "").trim();
    const company = String(formData.get("company") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const details = String(formData.get("details") || "").trim();

    if (!name || !company || !email || !phone) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Nome, empresa, e-mail e telefone são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const messageLines = [
      "Novo cadastro Integrai:",
      "",
      `Nome: ${name}`,
      `Empresa: ${company}`,
      `E-mail: ${email}`,
      `Telefone: ${phone}`,
      city && `Cidade: ${city}`,
      details && "",
      details && `Detalhes: ${details}`,
      "",
      "Origem: formulário de cadastro no painel Integrai",
    ].filter(Boolean);

    const whatsappText = encodeURIComponent(messageLines.join("\n"));
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappText}`;

    window.open(whatsappUrl, "_blank");

    toast({
      title: "Redirecionando para o WhatsApp",
      description: "Enviamos os dados do seu cadastro para o nosso time comercial.",
    });

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-soft via-background to-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl border border-primary-soft/60 bg-card/95 shadow-strong">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Cadastre sua empresa para usar o Integrai
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Preencha os dados abaixo e vamos entrar em contato pelo WhatsApp para ativar o painel para sua
            operação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <User className="h-3 w-3 text-muted-foreground" />
                  Nome completo
                  <span className="text-destructive">*</span>
                </label>
                <Input name="name" placeholder="Seu nome" required />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  Nome da empresa
                  <span className="text-destructive">*</span>
                </label>
                <Input name="company" placeholder="Nome da sua empresa" required />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  E-mail
                  <span className="text-destructive">*</span>
                </label>
                <Input name="email" type="email" placeholder="email@empresa.com" required />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  WhatsApp para contato
                  <span className="text-destructive">*</span>
                </label>
                <Input name="phone" placeholder="DDD + número" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Cidade principal de atuação</label>
              <Input name="city" placeholder="Cidade / região" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Fale um pouco sobre como pretende usar o Integrai
              </label>
              <Textarea
                name="details"
                placeholder="Ex: centralizar atendimento WhatsApp, organizar funis de CRM, acompanhar financeiro por cidade..."
                rows={4}
              />
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] text-muted-foreground max-w-xs">
                Os dados não são salvos no sistema neste momento: apenas enviados para o nosso WhatsApp para
                início do contato comercial.
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/login")}
                >
                  Já sou cliente
                </Button>
                <Button type="submit" size="sm" className="gap-2" disabled={loading}>
                  Enviar para WhatsApp
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="absolute bottom-4 flex gap-4 text-xs text-muted-foreground bg-white/50 px-4 py-2 rounded-full border border-border/10 backdrop-blur-sm">
        <a href="/termos-de-servico" className="hover:text-primary transition-colors">Termos de Serviço</a>
        <span>•</span>
        <a href="/politica-de-privacidade" className="hover:text-primary transition-colors">Política de Privacidade</a>
      </div>
    </div >
  );
};

export default SignupPage;
