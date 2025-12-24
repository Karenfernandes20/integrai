import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";
import { Separator } from "../components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";

const companySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório."),
  cnpj: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  logo_url: z.string().url("Informe uma URL válida para o logo.").optional().or(z.literal("")),
});

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  logo_url: string | null;
}

const SuperadminPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formValues, setFormValues] = useState({
    name: "",
    cnpj: "",
    city: "",
    state: "",
    phone: "",
    logo_url: "",
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCompanies = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, cnpj, city, state, phone, logo_url")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast({
        title: "Erro ao carregar empresas",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setCompanies(data as Company[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormValues({
      name: company.name ?? "",
      cnpj: company.cnpj ?? "",
      city: company.city ?? "",
      state: company.state ?? "",
      phone: company.phone ?? "",
      logo_url: company.logo_url ?? "",
    });
  };

  const handleOpenDashboard = (company: Company) => {
    navigate(`/app/dashboard?companyId=${company.id}`);
  };

  const resetForm = () => {
    setEditingCompany(null);
    setFormValues({
      name: "",
      cnpj: "",
      city: "",
      state: "",
      phone: "",
      logo_url: "",
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = companySchema.safeParse(formValues);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      toast({
        title: "Dados inválidos",
        description: issue?.message ?? "Verifique os campos do formulário.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingCompany) {
        const { error } = await supabase
          .from("companies")
          .update({
            name: parsed.data.name,
            cnpj: parsed.data.cnpj || null,
            city: parsed.data.city || null,
            state: parsed.data.state || null,
            phone: parsed.data.phone || null,
            logo_url: parsed.data.logo_url || null,
          })
          .eq("id", editingCompany.id);

        if (error) {
          toast({
            title: "Erro ao atualizar empresa",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Empresa atualizada",
          description: "As informações da empresa foram salvas com sucesso.",
        });
      } else {
        const { error } = await supabase.from("companies").insert({
          name: parsed.data.name,
          cnpj: parsed.data.cnpj || null,
          city: parsed.data.city || null,
          state: parsed.data.state || null,
          phone: parsed.data.phone || null,
          logo_url: parsed.data.logo_url || null,
        });

        if (error) {
          toast({
            title: "Erro ao cadastrar empresa",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Empresa cadastrada",
          description: "A empresa foi criada com sucesso.",
        });
      }

      resetForm();
      await loadCompanies();
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

  const handleDelete = async (company: Company) => {
    try {
      setDeletingId(company.id);
      const { error } = await supabase.from("companies").delete().eq("id", company.id);

      if (error) {
        toast({
          title: "Erro ao excluir empresa",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Empresa excluída",
        description: `A empresa ${company.name} foi removida com sucesso.`,
      });

      await loadCompanies();
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro inesperado",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex min-h-screen items-stretch bg-gradient-to-br from-primary-soft via-background to-primary/5 px-4 py-6">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 md:flex-row">
        <section className="flex-1 space-y-4">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
              Painel <span className="text-primary">Superadmin</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Cadastre e gerencie empresas (como ViaMoveCar) para ter uma visão geral e acesso aos painéis de cada uma.
            </p>
          </header>
          <Card className="border border-primary-soft/70 bg-card/95 shadow-strong">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base sm:text-lg">Empresas cadastradas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando empresas...</p>
              ) : companies.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada até o momento.</p>
              ) : (
                <div className="space-y-2 overflow-hidden rounded-xl border border-border/60 bg-background/60">
                  <div className="grid grid-cols-6 gap-3 border-b border-border/60 bg-muted/60 px-3 py-2 text-[11px] font-medium text-muted-foreground sm:text-xs">
                    <span>Nome</span>
                    <span>CNPJ</span>
                    <span>Cidade/UF</span>
                    <span>Telefone</span>
                    <span>Logo</span>
                    <span className="text-right">Ações</span>
                  </div>
                  <div className="divide-y divide-border/60">
                    {companies.map((company) => (
                      <div
                        key={company.id}
                        className="grid grid-cols-6 items-center gap-3 px-3 py-2 text-[11px] sm:text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenDashboard(company)}
                          className="truncate text-left font-medium text-primary hover:underline"
                        >
                          {company.name}
                        </button>
                        <span className="truncate text-muted-foreground">{company.cnpj || "-"}</span>
                        <span className="truncate text-muted-foreground">
                          {company.city || company.state ? `${company.city ?? ""}/${company.state ?? ""}` : "-"}
                        </span>
                        <span className="truncate text-muted-foreground">{company.phone || "-"}</span>
                        <span className="truncate text-primary">
                          {company.logo_url ? "Logo configurado" : "Sem logo"}
                        </span>
                        <span className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 border-primary-soft/60 text-primary"
                            onClick={() => handleEdit(company)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 border-destructive/40 text-destructive"
                                disabled={deletingId === company.id}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="sr-only">Excluir</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir a empresa {company.name}? Esta ação não pode ser
                                  desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(company)}
                                >
                                  {deletingId === company.id ? "Excluindo..." : "Confirmar"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="w-full max-w-md">
          <Card className="border border-primary-soft/70 bg-card/95 shadow-strong">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Cadastrar nova empresa</CardTitle>
            </CardHeader>
            <CardContent>
                <form className="space-y-3" onSubmit={handleSubmit}>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nome da empresa</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="ViaMoveCar"
                      required
                      value={formValues.name}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      name="cnpj"
                      placeholder="00.000.000/0000-00"
                      value={formValues.cnpj}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        name="city"
                        placeholder="Goiânia"
                        value={formValues.city}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="state">UF</Label>
                      <Input
                        id="state"
                        name="state"
                        placeholder="GO"
                        maxLength={2}
                        value={formValues.state}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Telefone de contato</Label>
                    <Input
                      id="phone"
                      name="phone"
                      placeholder="(62) 99999-9999"
                      value={formValues.phone}
                      onChange={handleChange}
                    />
                  </div>
                  <Separator className="my-2" />
                  <div className="space-y-1.5">
                    <Label htmlFor="logo_url">URL do logo</Label>
                    <Input
                      id="logo_url"
                      name="logo_url"
                      placeholder="https://exemplo.com/logo.png"
                      value={formValues.logo_url}
                      onChange={handleChange}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      No futuro podemos adicionar upload de imagem; por enquanto use uma URL pública da logo.
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button type="submit" className="flex-1" size="lg" disabled={isSubmitting}>
                      {isSubmitting
                        ? editingCompany
                          ? "Salvando..."
                          : "Salvando..."
                        : editingCompany
                          ? "Atualizar empresa"
                          : "Salvar empresa"}
                    </Button>
                    {editingCompany && (
                      <Button type="button" variant="outline" size="lg" onClick={resetForm}>
                        Cancelar edição
                      </Button>
                    )}
                  </div>
                </form>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default SuperadminPage;
