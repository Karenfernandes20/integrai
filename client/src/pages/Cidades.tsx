import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useEffect, useState } from "react";

interface City {
  id: number;
  name: string;
  state: string;
  color_hex?: string | null;
}

const CidadesPage = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCities = async () => {
    try {
      const res = await fetch("/api/cities");
      if (!res.ok) throw new Error("Erro ao carregar cidades");
      const data = await res.json();
      setCities(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadCities();
  }, []);

  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !state) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, state }),
      });
      if (!res.ok) throw new Error("Erro ao criar cidade");
      setName("");
      setState("");
      await loadCities();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Cidades e estados</h2>
          <p className="text-xs text-muted-foreground">
            Cadastre e gerencie as cidades ativas que aparecem nos filtros, CRM e financeiro.
          </p>
        </div>
      </header>

      <section className="rounded-md border bg-background/70 p-4 space-y-3">
        <h3 className="text-sm font-medium">Incluir nova cidade</h3>
        <form onSubmit={handleAddCity} className="grid gap-3 md:grid-cols-[2fr,1fr,auto] items-end">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Cidade</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Montes Claros"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">UF</label>
            <Input
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              placeholder="MG"
              maxLength={2}
              className="h-8 text-xs uppercase"
            />
          </div>
          <Button type="submit" size="sm" disabled={isSubmitting} className="mt-1">
            {isSubmitting ? "Salvando..." : "Adicionar cidade"}
          </Button>
        </form>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {cities.map((city) => (
          <Card key={city.id} className="border-dashed bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {city.name}/{city.state}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <Badge className="badge-pill text-[11px]">
                Cidade ativa
              </Badge>
              <p className="text-[11px] text-muted-foreground">
                Utilizada em filtros, indicadores e identificação visual no atendimento.
              </p>
            </CardContent>
          </Card>
        ))}

        {cities.length === 0 && (
          <Card className="border-dashed bg-background/40">
            <CardContent className="py-6 text-xs text-muted-foreground">
              Nenhuma cidade cadastrada ainda. Use o formulário acima para adicionar a primeira cidade.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
};

export default CidadesPage;
