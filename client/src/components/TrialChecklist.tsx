
import { CheckCircle2, Circle, ChevronRight, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Progress } from "./ui/progress";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";

export function TrialChecklist() {
    const [status, setStatus] = useState<any>(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        // Fetch onboarding status
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/onboarding/status', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setStatus(data.checklist);

                    // Calculate progress
                    const total = 4;
                    const done = [
                        data.checklist.whatsapp_connected,
                        data.checklist.has_contacts,
                        data.checklist.has_leads,
                        data.checklist.first_message_sent
                    ].filter(Boolean).length;

                    setProgress((done / total) * 100);
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchStatus();
    }, []);

    if (!status || progress === 100) return null; // Hide if done (or show condensed "All Set!")

    const items = [
        {
            label: "Conectar WhatsApp",
            done: status.whatsapp_connected,
            link: "/app/configuracoes",
            cta: "Conectar"
        },
        {
            label: "Importar Contatos",
            done: status.has_contacts,
            link: "/app/configuracoes", // Assuming contacts import is there or contacts page
            cta: "Importar"
        },
        {
            label: "Criar Primeiro Lead",
            done: status.has_leads,
            link: "/app/crm",
            cta: "Criar"
        },
        {
            label: "Enviar Mensagem",
            done: status.first_message_sent,
            link: "/app/atendimento",
            cta: "Enviar"
        }
    ];

    return (
        <Card className="border-l-4 border-l-primary shadow-sm bg-gradient-to-r from-background to-primary/5">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                            Comece Aqui
                        </CardTitle>
                        <CardDescription>Configure sua conta e faça sua primeira venda em minutos.</CardDescription>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <Progress value={progress} className="h-2" />
                    <span className="text-xs font-bold text-muted-foreground">{Math.round(progress)}%</span>
                </div>
            </CardHeader>
            <CardContent className="grid gap-2 pt-2">
                {items.map((item, i) => (
                    <div key={i} className={`flex items-center justify-between p-2 rounded-md transition-colors ${item.done ? 'bg-green-50/50' : 'hover:bg-accent/50'}`}>
                        <div className="flex items-center gap-3">
                            {item.done
                                ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                                : <Circle className="h-5 w-5 text-muted-foreground" />
                            }
                            <span className={`text-sm ${item.done ? 'line-through text-muted-foreground' : 'font-medium'}`}>
                                {item.label}
                            </span>
                        </div>
                        {!item.done && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                                <Link to={item.link}>
                                    {item.cta} <ChevronRight className="h-3 w-3 ml-1" />
                                </Link>
                            </Button>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
