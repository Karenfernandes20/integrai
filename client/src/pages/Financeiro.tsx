import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

interface Payable {
  id: number;
  description: string;
  amount: number;
  status: string;
  due_date: string | null;
  city_name?: string | null;
  city_state?: string | null;
}

interface ReceivableByCity {
  city_name: string;
  city_state: string;
  total_amount: number;
}

interface CashFlowEntry {
  id: number;
  description: string;
  amount: number;
  type: "payable" | "receivable";
  status: string;
  due_date: string | null;
  city_name?: string | null;
  city_state?: string | null;
}

const FinanceiroPage = () => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewMode, setViewMode] = useState<"lines" | "chart">("lines");
  const [payables, setPayables] = useState<Payable[]>([]);
  const [receivablesByCity, setReceivablesByCity] = useState<ReceivableByCity[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const [payRes, recRes, cashRes] = await Promise.all([
        fetch(`/api/financial/payables?${params.toString()}`),
        fetch(`/api/financial/receivables-by-city`),
        fetch(`/api/financial/cashflow?${params.toString()}`),
      ]);

      if (payRes.ok) setPayables(await payRes.json());
      if (recRes.ok) setReceivablesByCity(await recRes.json());
      if (cashRes.ok) setCashFlow(await cashRes.json());
    } catch (error) {
      console.error("Erro ao carregar dados financeiros", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalPayables = payables.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const handleCreateExpense = async () => {
    if (!expenseDescription || !expenseAmount || !expenseDate) return;
    try {
      const res = await fetch("/api/financial/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: expenseDescription,
          amount: Number(expenseAmount.replace(",", ".")),
          due_date: expenseDate,
        }),
      });
      if (!res.ok) throw new Error("Erro ao cadastrar despesa");
      setExpenseDescription("");
      setExpenseAmount("");
      setExpenseDate("");
      await fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Visão financeira</h2>
          <p className="text-xs text-muted-foreground">
            Contas a pagar, receber e fluxo de caixa conectados ao backend financeiro.
          </p>
        </div>
      </header>

      {/* Contas a pagar */}
      <section className="space-y-3">
        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-sm">Contas a pagar</CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Filtre por período para ver todas as despesas registradas e o total do período.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Data inicial</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Data final</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Button size="sm" className="mt-4" onClick={fetchData} disabled={isLoading}>
                {isLoading ? "Buscando..." : "Pesquisar"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="inline-flex items-center gap-1 rounded-full bg-background/80 p-1 text-[11px]">
              <button
                type="button"
                className={`rounded-full px-3 py-1 ${
                  viewMode === "lines" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setViewMode("lines")}
              >
                Linhas
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 ${
                  viewMode === "chart" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setViewMode("chart")}
              >
                Gráfico
              </button>
            </div>

            {viewMode === "lines" ? (
              <div className="space-y-2">
                {payables.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Nenhuma despesa encontrada para o período. Cadastre uma nova despesa abaixo.
                  </p>
                ) : (
                  payables.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-md bg-background px-3 py-2"
                    >
                      <div>
                        <p className="text-xs font-medium text-foreground">{p.description}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.city_name ? `${p.city_name}/${p.city_state}` : "Sem cidade"} •
                          {" "}
                          {p.due_date ? new Date(p.due_date).toLocaleDateString() : "Sem vencimento"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-foreground">
                          R$ {Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{p.status}</p>
                      </div>
                    </div>
                  ))
                )}

                <div className="mt-2 flex items-center justify-between border-t pt-2">
                  <span className="text-[11px] text-muted-foreground">Total a pagar no período</span>
                  <span className="text-sm font-semibold text-foreground">
                    R$ {totalPayables.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Visualização em gráfico será detalhada em uma próxima etapa. Por enquanto, utilize a visão em linhas
                para análise.
              </p>
            )}

            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-medium text-foreground">Cadastrar despesa</p>
              <div className="grid gap-2 md:grid-cols-[2fr,1fr,auto] items-end">
                <Input
                  placeholder="Nome da empresa / descrição"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Valor"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <Button size="sm" type="button" onClick={handleCreateExpense}>
                  Cadastrar despesa
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Contas a receber */}
      <section className="grid gap-3 md:grid-cols-2">
        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contas a receber</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {receivablesByCity.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Nenhum lançamento a receber encontrado. Conforme os recebimentos forem registrados, o resumo por
                cidade aparecerá aqui.
              </p>
            ) : (
              receivablesByCity.map((r) => (
                <div
                  key={`${r.city_name}-${r.city_state}`}
                  className="flex items-center justify-between rounded-md bg-background px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      {r.city_name}/{r.city_state}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    R$ {Number(r.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Fluxo de caixa */}
        <Card className="border-dashed bg-background/70">
          <CardHeader className="pb-2 flex items-center justify-between">
            <CardTitle className="text-sm">Fluxo de caixa</CardTitle>
            <Badge variant="outline" className="badge-pill text-[11px]">
              Detalhado por lançamento
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-xs max-h-[260px] overflow-y-auto">
            {cashFlow.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Nenhum lançamento encontrado para o período selecionado.
              </p>
            ) : (
              cashFlow.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-md bg-background px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-medium text-foreground">{c.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.city_name ? `${c.city_name}/${c.city_state}` : "Sem cidade"} •
                      {" "}
                      {c.due_date ? new Date(c.due_date).toLocaleDateString() : "Sem data"}
                    </p>
                  </div>
                  <p
                    className={
                      "text-xs font-semibold " +
                      (c.type === "receivable" ? "text-emerald-500" : "text-destructive")
                    }
                  >
                    {c.type === "receivable" ? "+" : "-"} R$
                    {" "}
                    {Number(c.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default FinanceiroPage;
