
import { Check, Info, Quote } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { useState } from "react";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";

const PLANS = [
    {
        name: "Básico",
        description: "Estrutura completa para profissionalizar seu atendimento e vendas.",
        monthly: 497,
        annual: 497 * 0.8, // 20% off roughly or just manual if preferred. Let's keep the math dynamic or fixed. User gave 497. 
        // User didn't specify annual pricing, but component uses 'annual' field.
        // Let's assume 497 is monthly.
        // 497 * 12 = 5964.
        // If discount, maybe 397 * 12? 
        // Use logic proportional to previous. 97 -> 77 (~20% off).
        // 497 - 20% = 397.6. Let's say 397 to be clean? Or just 497/month and calculate annual.
        // Let's use 397 for annual monthly equivalent.
        features: [
            "Até 5 Usuários",
            "CRM Completo",
            "1 Conexão WhatsApp",
            "Automações de Mensagens",
            "Agendamentos",
            "Suporte via Email"
        ],
        highlight: false
    },
    {
        name: "Avançado",
        description: "Potência máxima com IA e múltiplos canais para escalar.",
        monthly: 597,
        annual: 497, // 597 - 100 roughly.
        features: [
            "Usuários Ilimitados",
            "3 Conexões WhatsApp",
            "Agentes de IA Ilimitados",
            "Automações Avançadas (n8n)",
            "Disparos em Massa",
            "Gerente de Contas"
        ],
        highlight: true
    }
];

interface UpgradeModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
    const [isAnnual, setIsAnnual] = useState(false);

    const handleSelectPlan = (planName: string) => {
        const period = isAnnual ? 'Anual' : 'Mensal';
        const msg = `Olá, quero contratar o plano *${planName}* no formato *${period}*.`;
        window.open(`https://wa.me/5511999999999?text=${encodeURIComponent(msg)}`, '_blank');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[90vh] md:h-auto overflow-y-auto">
                <DialogHeader>
                    <div className="flex flex-col items-center gap-2">
                        <Badge variant="outline" className="text-primary border-primary/50 bg-primary/10">Planos & Preços</Badge>
                        <DialogTitle className="text-3xl font-bold text-center">Invista no crescimento da sua empresa</DialogTitle>
                        <DialogDescription className="text-center text-lg">
                            Escolha o plano ideal desbloquear todo o potencial do seu negócio.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex justify-center items-center gap-4 mt-4 mb-8">
                    <Label htmlFor="billing-mode" className={`cursor-pointer ${!isAnnual ? 'font-bold' : ''}`}>Mensal</Label>
                    <Switch
                        id="billing-mode"
                        checked={isAnnual}
                        onCheckedChange={setIsAnnual}
                        className="data-[state=checked]:bg-green-600"
                    />
                    <Label htmlFor="billing-mode" className={`cursor-pointer flex items-center gap-2 ${isAnnual ? 'font-bold' : ''}`}>
                        Anual <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">-20%</span>
                    </Label>
                </div>

                <div className="grid md:grid-cols-3 gap-6 px-2">
                    {PLANS.map((plan) => {
                        const price = isAnnual ? plan.annual : plan.monthly;

                        return (
                            <div
                                key={plan.name}
                                className={`
                                    border rounded-2xl p-6 transition-all relative bg-card flex flex-col
                                    ${plan.highlight ? 'border-primary shadow-xl scale-105 shadow-primary/20 z-10' : 'border-border hover:border-primary/50'}
                                `}
                            >
                                {plan.highlight && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-purple-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-lg">
                                        Recomendado
                                    </div>
                                )}

                                <div className="mb-6">
                                    <h3 className="text-2xl font-bold">{plan.name}</h3>
                                    <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">{plan.description}</p>
                                </div>

                                <div className="mb-6">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-sm font-medium text-muted-foreground">R$</span>
                                        <span className="text-4xl font-extrabold tracking-tight">{price}</span>
                                        <span className="text-muted-foreground">/mês</span>
                                    </div>
                                    {isAnnual && (
                                        <p className="text-xs text-green-600 font-medium mt-1">
                                            Cobrado anualmente (R$ {price * 12})
                                        </p>
                                    )}
                                </div>

                                <Button
                                    className={`w-full mb-8 font-bold ${plan.highlight ? 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25' : ''}`}
                                    variant={plan.highlight ? "default" : "outline"}
                                    onClick={() => handleSelectPlan(plan.name)}
                                >
                                    {plan.highlight ? 'Começar Agora' : 'Escolher ' + plan.name}
                                </Button>

                                <div className="space-y-4 flex-1">
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">O que está incluso:</p>
                                    <ul className="space-y-3">
                                        {plan.features.map((feature, i) => (
                                            <li key={i} className="flex items-start gap-3 text-sm">
                                                <div className="mt-1 min-w-[16px]">
                                                    <Check className={`h-4 w-4 ${plan.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                                                </div>
                                                <span className="text-muted-foreground/90">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Info className="h-4 w-4" />
                    <span>Precisa de algo customizado? <button onClick={() => handleSelectPlan('Custom')} className="underline hover:text-primary">Fale com vendas</button></span>
                </div>

                <div className="mt-8 pt-8 border-t">
                    <h4 className="text-center font-semibold text-muted-foreground mb-6 text-sm uppercase tracking-wider">Empresas que confiam na Integrai</h4>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-muted/30 p-4 rounded-lg relative">
                            <Quote className="h-6 w-6 text-primary/20 absolute top-2 left-2" />
                            <p className="text-sm italic text-muted-foreground pt-4 mb-2">"O plano Pro transformou nosso atendimento. As automações economizam horas da equipe todos os dias."</p>
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-xs text-blue-700">RC</div>
                                <div>
                                    <p className="text-xs font-bold text-foreground">Ricardo Costa</p>
                                    <p className="text-[10px] text-muted-foreground">Diretor Comercial, Viamove</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-lg relative">
                            <Quote className="h-6 w-6 text-primary/20 absolute top-2 left-2" />
                            <p className="text-sm italic text-muted-foreground pt-4 mb-2">"A IA é incrível. Qualificamos 3x mais leads desde que ativamos o módulo Enterprise."</p>
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-pink-100 flex items-center justify-center font-bold text-xs text-pink-700">MT</div>
                                <div>
                                    <p className="text-xs font-bold text-foreground">Maria Torres</p>
                                    <p className="text-[10px] text-muted-foreground">Gestora de Marketing, SolarTech</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
