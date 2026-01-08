
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Check, CheckCircle2, ChevronRight, Lock, MessageSquare, Play, Settings, UserPlus, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/use-toast";
import { Progress } from "../components/ui/progress";

// ONBOARDING STEPS
// 1. Welcome & Tenant Confirmation (Company already created usually on Signup) -> User Check?
// 2. Add Users (Invite Admin if not current) - Already covered by Initial User. Let's make Step 2: Add Team? Or Skip.
// 3. Connect WhatsApp (QR Code)
// 4. Activate AI
// 5. Send Test Message

const STEPS = [
    { id: 1, label: "Boas Vindas", icon: CheckCircle2 },
    { id: 2, label: "Usuários", icon: UserPlus },
    { id: 3, label: "Conexão", icon: Settings },
    { id: 4, label: "Inteligência", icon: Zap },
    { id: 5, label: "Teste Final", icon: MessageSquare },
];

export default function OnboardingPage() {
    const { user, token, refreshUser } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [testPhone, setTestPhone] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {
        const fetchStatus = async () => {
            if (!token) return;
            try {
                const res = await fetch('/api/onboarding/status', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setCurrentStep(data.step || 1);
                }
            } catch (e) {
                console.error("Failed to fetch onboarding status");
            } finally {
                setLoading(false);
            }
        };
        fetchStatus();
    }, [token]);

    const updateStep = async (step: number) => {
        setLoading(true);
        try {
            const res = await fetch('/api/onboarding/step', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ step })
            });

            if (res.ok) {
                setCurrentStep(step);
            }
        } catch (e) {
            toast({ title: "Erro ao salvar progresso", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (currentStep < 5) {
            updateStep(currentStep + 1);
        } else {
            finishOnboarding();
        }
    };

    const finishOnboarding = async () => {
        try {
            await fetch('/api/onboarding/complete', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast({ title: "Setup Concluído!", className: "bg-green-600 text-white" });
            refreshUser(); // Refresh checks
            navigate("/app/dashboard");
        } catch (e) {
            toast({ title: "Erro ao finalizar", variant: "destructive" });
        }
    };

    const sendTest = async () => {
        if (!testPhone) return toast({ title: "Digite um número", variant: "destructive" });
        setSending(true);
        try {
            const res = await fetch('/api/evolution/messages/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    number: testPhone,
                    text: "Olá! Esta é uma mensagem de teste do Integrai. Seu sistema está configurado corretamente. 🚀"
                })
            });

            if (res.ok) {
                toast({ title: "Mensagem enviada!", description: "Verifique seu WhatsApp." });
                handleNext(); // Finish
            } else {
                const err = await res.json();
                toast({ title: "Erro no envio", description: err.message || "Verifique a conexão", variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Erro de conexão", variant: "destructive" });
        } finally {
            setSending(false);
        }
    };

    if (loading) return <div className="h-screen w-full flex items-center justify-center">Carregando...</div>;

    // RENDER COMPONENTS PER STEP

    // Step 1: Welcome
    const WelcomeStep = () => (
        <div className="space-y-4">
            <h2 className="text-xl font-bold">Bem-vindo ao Integrai!</h2>
            <p className="text-muted-foreground">
                Vamos configurar sua conta em poucos passos para que você possa começar a atender seus clientes com Inteligência Artificial.
            </p>
            <div className="bg-muted p-4 rounded-lg text-sm">
                <p><strong>Empresa:</strong> {user?.company?.name}</p>
                <p><strong>Plano:</strong> Básico (Trial)</p>
            </div>
            <Button onClick={handleNext} className="w-full">Começar Configuração <ChevronRight className="ml-2 h-4 w-4" /></Button>
        </div>
    );

    // Step 2: Users (Mock for now, instruct them to add later or allow invite)
    const UsersStep = () => (
        <div className="space-y-4">
            <h2 className="text-xl font-bold">Equipe</h2>
            <p className="text-muted-foreground">
                Você é o administrador principal. Você poderá convidar outros membros da equipe depois no menu "Usuários".
            </p>
            <div className="border border-dashed p-6 rounded text-center">
                <UserPlus className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm">Configuração de equipe simplificada neste assistente.</p>
            </div>
            <Button onClick={handleNext} className="w-full">Continuar</Button>
        </div>
    );

    // Step 3: Connection (Redirect to QR Code page logic or simple check)
    const ConnectionStep = () => (
        <div className="space-y-4">
            <h2 className="text-xl font-bold">Conectar WhatsApp</h2>
            <p className="text-muted-foreground">
                Para enviar mensagens, precisamos conectar seu WhatsApp.
            </p>
            <div className="alert bg-yellow-500/10 text-yellow-600 p-3 rounded text-sm border border-yellow-500/20">
                ⚠️ Certifique-se que o aparelho está com internet.
            </div>
            <Button variant="outline" className="w-full mb-2" onClick={() => window.open('/app/qr-code', '_blank')}>
                Abrir QR Code em nova aba
            </Button>
            <p className="text-xs text-muted-foreground text-center">Após conectar, clique em continuar.</p>
            <div className="flex gap-2">
                <Button variant="secondary" onClick={() => updateStep(currentStep - 1)}>Voltar</Button>
                <Button onClick={handleNext} className="flex-1">Já Conectei</Button>
            </div>
        </div>
    );

    // Step 4: AI
    const AIStep = () => (
        <div className="space-y-4">
            <h2 className="text-xl font-bold">Ativar Inteligência Artificial</h2>
            <p className="text-muted-foreground">
                O Integrai já vem com um agente pré-configurado para triagem. Deseja ativá-lo agora?
            </p>
            <div className="flex items-center gap-4 border p-4 rounded bg-card">
                <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h4 className="font-semibold">Agente Padrão</h4>
                    <p className="text-xs text-muted-foreground">Responde dúvidas básicas e faz triagem.</p>
                </div>
            </div>
            <Button onClick={handleNext} className="w-full">Ativar IA</Button>
            <Button variant="ghost" className="w-full text-xs" onClick={handleNext}>Pular setup de IA por enquanto</Button>
        </div>
    );

    // Step 5: Test
    const TestStep = () => (
        <div className="space-y-4">
            <h2 className="text-xl font-bold">Teste Final</h2>
            <p className="text-muted-foreground">
                Vamos enviar uma mensagem para garantir que tudo está funcionando.
            </p>
            <div className="space-y-2">
                <Label>Número para teste (com DDD)</Label>
                <Input
                    placeholder="5511999999999"
                    value={testPhone}
                    onChange={e => setTestPhone(e.target.value)}
                />
            </div>

            <Button onClick={sendTest} disabled={sending} className="w-full">
                {sending ? "Enviando..." : "Enviar Teste e Concluir"}
            </Button>
            <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => finishOnboarding()}>
                Pular teste e ir para o Dashboard
            </Button>
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-background">
            {/* Sidebar / Progress */}
            <div className="md:w-80 bg-muted/30 border-r p-8 flex flex-col justify-between">
                <div>
                    <div className="mb-8">
                        <img src="/logo-integrai.jpg" alt="Logo" className="h-8 w-8 rounded mb-2" />
                        <h1 className="font-bold text-lg tracking-tight">Configuração Inicial</h1>
                    </div>

                    <div className="space-y-6 relative">
                        {/* Line */}
                        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border -z-10" />

                        {STEPS.map((step, idx) => {
                            const isCompleted = currentStep > step.id;
                            const isCurrent = currentStep === step.id;

                            return (
                                <div key={step.id} className={`flex items-center gap-3 ${isCurrent ? 'opacity-100' : 'opacity-60'}`}>
                                    <div className={`
                                        h-8 w-8 rounded-full flex items-center justify-center border-2 z-10 transition-colors
                                        ${isCompleted || isCurrent ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-muted-foreground/30 text-muted-foreground'}
                                    `}>
                                        {isCompleted ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                                    </div>
                                    <span className={`font-medium ${isCurrent ? 'text-primary' : ''}`}>{step.label}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="text-xs text-muted-foreground">
                    Precisa de ajuda? <a href="#" className="underline">Contatar suporte</a>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center p-6">
                <Card className="max-w-md w-full shadow-lg border-t-4 border-t-primary">
                    <CardHeader>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Passo {currentStep} de 5
                            </span>
                        </div>
                        <Progress value={(currentStep / 5) * 100} className="h-1" />
                    </CardHeader>
                    <CardContent className="pt-6">
                        {currentStep === 1 && <WelcomeStep />}
                        {currentStep === 2 && <UsersStep />}
                        {currentStep === 3 && <ConnectionStep />}
                        {currentStep === 4 && <AIStep />}
                        {currentStep === 5 && <TestStep />}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
