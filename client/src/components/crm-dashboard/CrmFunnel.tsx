import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Filter, MoreHorizontal, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const CrmFunnel = ({ data }: { data?: any[] }) => {
    // Default structure with 0 values if no data provided
    // User requested "Leads" phase to be fixed
    const defaultSteps = [
        { label: "Leads", count: 0, value: "R$ 0", color: "border-blue-500", bg: "bg-blue-50" },
        { label: "Em Atendimento", count: 0, value: "R$ 0", color: "border-indigo-500", bg: "bg-indigo-50" },
        { label: "Proposta Enviada", count: 0, value: "R$ 0", color: "border-purple-500", bg: "bg-purple-50" },
        { label: "Em Negociação", count: 0, value: "R$ 0", color: "border-orange-500", bg: "bg-orange-50" },
        { label: "Venda Concluída", count: 0, value: "R$ 0", color: "border-green-500", bg: "bg-green-50" },
    ];

    const funnelSteps = data && data.length > 0 ? data : defaultSteps;

    return (
        <Card className="h-full border-none shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">Funil de Vendas</CardTitle>
                        <CardDescription>Fluxo de conversão hoje</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">
                    {/* Visual Funnel Bar */}
                    <div className="flex w-full h-8 rounded-full overflow-hidden mb-2">
                        {funnelSteps.map((step, idx) => {
                            const total = funnelSteps.reduce((acc, s) => acc + s.count, 0);
                            const width = (step.count / total) * 100;

                            // Mapeando cores de fundo para Tailwind com segurança (sem template literals complexos para purge)
                            let contentClass = "h-full transition-all hover:opacity-90 cursor-pointer border-r border-white/20";
                            if (idx === 0) contentClass += " bg-blue-500";
                            if (idx === 1) contentClass += " bg-indigo-500";
                            if (idx === 2) contentClass += " bg-purple-500";
                            if (idx === 3) contentClass += " bg-orange-500";
                            if (idx === 4) contentClass += " bg-emerald-500";

                            return (
                                <div key={idx} style={{ width: `${width}%` }} className={contentClass} title={`${step.label}: ${step.count}`} />
                            )
                        })}
                    </div>

                    {/* Funnel Steps Detail */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {funnelSteps.map((step, idx) => (
                            <div key={idx} className={`relative flex flex-col p-3 rounded-lg border-l-4 ${step.color} bg-background hover:bg-muted/50 transition-colors shadow-sm`}>
                                <span className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">{step.label}</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-bold">{step.count}</span>
                                    <span className="text-[10px] text-muted-foreground">leads</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-1">{step.value} est.</span>
                            </div>
                        ))}
                    </div>

                    {/* Funnel Insight */}
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2 bg-muted/30 p-2 rounded">
                        <ArrowRight className="h-3 w-3 text-emerald-500" />
                        <span>Sua taxa de conversão de <strong>Novo Contato</strong> para <strong>Venda</strong> é de <span className="text-emerald-600 font-bold">28%</span> hoje.</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
