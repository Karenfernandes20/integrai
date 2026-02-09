
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
        description: "Ideal para pequenas empresas que estão começando.",
        monthly: 497,
        annual: 497 * 12 * 0.8, // 20% off
        stripeLinkMonthly: "https://buy.stripe.com/test_basic_monthly",
        stripeLinkAnnual: "https://buy.stripe.com/test_basic_annual",
        features: [
            "Até 5 Usuários",
            "1 Conexão WhatsApp",
            "CRM Completo",
            "Agendamentos Ilimitados",
            "1 Agente de IA",
            "Campanhas de Mensagens",
            "5.000 mensagens/mês",
            "Suporte por Email"
        ],
        highlight: false
    },
    {
        name: "Avançado",
        description: "Para empresas que buscam crescimento acelerado.",
        monthly: 597,
        annual: 597 * 12 * 0.8,
        stripeLinkMonthly: "https://buy.stripe.com/test_pro_monthly",
        stripeLinkAnnual: "https://buy.stripe.com/test_pro_annual",
        features: [
            "Até 15 Usuários",
            "3 Conexões WhatsApp",
            "CRM Avançado com BI",
            "Agendamentos Ilimitados",
            "3 Agentes de IA",
            "Automações Avançadas",
            "20.000 mensagens/mês",
            "API de Integração",
            "Suporte Prioritário"
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

    const handleSelectPlan = (plan: typeof PLANS[0]) => {
        const link = isAnnual ? plan.stripeLinkAnnual : plan.stripeLinkMonthly;
        // In production, you would Create a Checkout Session via backend. 
        // For now, using direct link redirection as requested.
        window.open(link, '_blank');
        // Do not close immediately if we want them to come back and see something? 
        // Usually, we close or keep open. Let's close.
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto w-full">
                <DialogHeader>
                    <div className="flex flex-col items-center gap-2">
                        <Badge variant="outline" className="text-primary border-primary/50 bg-primary/10">Planos & Preços</Badge>
                        <DialogTitle className="text-2xl font-bold text-center">Invista no crescimento da sua empresa</DialogTitle>
                        <DialogDescription className="text-center text-base">
                            Escolha o plano ideal desbloquear todo o potencial do seu negócio.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex justify-center items-center gap-4 mt-2 mb-6">
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

                <div className="grid md:grid-cols-2 gap-6 px-1 max-w-4xl mx-auto">
                    {PLANS.map((plan) => {
                        const price = isAnnual ? (plan.monthly * 0.8).toFixed(0) : plan.monthly;

                        return (
                            <div
                                key={plan.name}
                                className={`
                                    border rounded-xl p-5 transition-all relative bg-card flex flex-col
                                    ${plan.highlight ? 'border-primary shadow-lg ring-1 ring-primary/20 z-10' : 'border-border hover:border-primary/50'}
                                `}
                            >
                                {plan.highlight && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm">
                                        Mais Popular
                                    </div>
                                )}

                                <div className="mb-4">
                                    <h3 className="text-xl font-bold">{plan.name}</h3>
                                    <p className="text-xs text-muted-foreground mt-1 min-h-[32px]">{plan.description}</p>
                                </div>

                                <div className="mb-4">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xs font-medium text-muted-foreground">R$</span>
                                        <span className="text-3xl font-extrabold tracking-tight">{price}</span>
                                        <span className="text-muted-foreground text-sm">/mês</span>
                                    </div>
                                    {isAnnual && (
                                        <p className="text-[10px] text-green-600 font-medium mt-1">
                                            Cobrado anualmente
                                        </p>
                                    )}
                                </div>

                                <Button
                                    className={`w-full mb-6 font-bold ${plan.highlight ? 'bg-primary hover:bg-primary/90' : ''}`}
                                    variant={plan.highlight ? "default" : "outline"}
                                    onClick={() => handleSelectPlan(plan)}
                                >
                                    Assinar {plan.name}
                                </Button>

                                <div className="space-y-3 flex-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Incluso:</p>
                                    <ul className="space-y-2">
                                        {plan.features.map((feature, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs">
                                                <div className="mt-0.5 min-w-[14px]">
                                                    <Check className={`h-3.5 w-3.5 ${plan.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                                                </div>
                                                <span className="text-muted-foreground/90 leading-tight">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Info className="h-4 w-4" />
                    <span>Precisa de algo customizado? <button onClick={() => window.open('https://wa.me/5511999999999', '_blank')} className="underline hover:text-primary">Fale com vendas</button></span>
                </div>

                <div className="mt-6 pt-6 border-t px-4">
                    <h4 className="text-center font-semibold text-muted-foreground mb-4 text-xs uppercase tracking-wider">Empresas que confiam na Integrai</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-muted/30 p-3 rounded-lg relative">
                            <Quote className="h-5 w-5 text-primary/20 absolute top-2 left-2" />
                            <p className="text-xs italic text-muted-foreground pt-3 mb-2">"O plano Pro transformou nosso atendimento. As automações economizam horas da equipe todos os dias."</p>
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center font-bold text-[10px] text-blue-700">RC</div>
                                <div>
                                    <p className="text-[10px] font-bold text-foreground">Ricardo Costa</p>
                                    <p className="text-[9px] text-muted-foreground">Diretor Comercial, Viamove</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg relative">
                            <Quote className="h-5 w-5 text-primary/20 absolute top-2 left-2" />
                            <p className="text-xs italic text-muted-foreground pt-3 mb-2">"A IA é incrível. Qualificamos 3x mais leads desde que ativamos o módulo Enterprise."</p>
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-pink-100 flex items-center justify-center font-bold text-[10px] text-pink-700">MT</div>
                                <div>
                                    <p className="text-[10px] font-bold text-foreground">Maria Torres</p>
                                    <p className="text-[9px] text-muted-foreground">Gestora de Marketing, SolarTech</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
