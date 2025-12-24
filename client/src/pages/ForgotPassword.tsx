import { useState } from "react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { useToast } from "../hooks/use-toast";
import { supabase } from "../../../src/integrations/supabase/client";

const emailSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

const ForgotPasswordPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();

    const parseResult = emailSchema.safeParse({ email });
    if (!parseResult.success) {
      toast({
        title: "E-mail inválido",
        description: parseResult.error.issues[0]?.message ?? "Verifique o e-mail informado.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast({
          title: "Erro ao enviar link",
          description: error.message || "Não foi possível enviar o e-mail de recuperação.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Verifique seu e-mail",
        description: "Enviamos um link para você redefinir sua senha.",
      });
      navigate("/");
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro inesperado",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft via-background to-primary/5 px-4 py-6">
      <main className="w-full max-w-md">
        <Card className="border border-primary-soft/70 bg-card/95 shadow-strong">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Recuperar senha</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail cadastrado</Label>
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
              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate("/")}
              >
                Voltar para login
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ForgotPasswordPage;
