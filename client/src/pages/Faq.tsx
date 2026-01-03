import { useState } from "react";
import { Search, HelpCircle, Rocket, MessageCircle, Users, ShieldCheck, Megaphone, Wallet2, Globe, AlertCircle, MessageSquare } from "lucide-react";
import { Input } from "../components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useCallback } from "react";
import { Loader2, Trash2, Reply } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";

const faqData = [
    {
        category: "Primeiros Passos",
        icon: Rocket,
        items: [
            {
                question: "Como conectar meu WhatsApp ao sistema?",
                answer: "Para conectar seu WhatsApp, acesse a aba 'QR Code' no menu lateral e utilize o seu celular para escanear o código exibido na tela, da mesma forma que faria no WhatsApp Web."
            },
            {
                question: "Onde vejo o status da conexão do WhatsApp?",
                answer: "O status da conexão pode ser visualizado na própria aba 'QR Code' ou no indicador de conexão presente no topo da tela em diversas áreas do sistema."
            },
            {
                question: "O sistema funciona em tempo real?",
                answer: "Sim! Integramos com a API para que todas as mensagens enviadas e recebidas sejam sincronizadas instantaneamente com o sistema."
            }
        ]
    },
    {
        category: "Atendimento",
        icon: MessageCircle,
        items: [
            {
                question: "Como iniciar uma nova conversa?",
                answer: "Vá até a aba 'Atendimento', clique no ícone '+' ou em 'Nova Conversa' e pesquise pelo contato desejado ou insira um novo número."
            },
            {
                question: "Por que não consigo enviar mensagens?",
                answer: "Verifique se o seu WhatsApp está conectado no sistema e se o aparelho possui acesso à internet. Certifique-se também de que o número de destino é válido."
            },
            {
                question: "Posso atender mais de um cliente ao mesmo tempo?",
                answer: "Sim, o sistema é multicanal e permite que você gerencie múltiplas janelas de conversa simultaneamente."
            }
        ]
    },
    {
        category: "Contatos e Conversas",
        icon: Users,
        items: [
            {
                question: "Como importar meus contatos?",
                answer: "O sistema sincroniza automaticamente os contatos da sua conta de WhatsApp assim que a conexão é estabelecida. Você também pode sincronizá-los manualmente na aba 'Contatos'."
            },
            {
                question: "Posso criar grupos de contatos?",
                answer: "Sim, você pode organizar seus contatos em listas ou categorias para facilitar a gestão de campanhas e atendimentos."
            }
        ]
    },
    {
        category: "Usuários e Permissões",
        icon: ShieldCheck,
        items: [
            {
                question: "Quem pode criar usuários no sistema?",
                answer: "Apenas usuários com nível de permissão 'Administrador' ou 'SuperAdmin' podem gerenciar e criar novos usuários."
            },
            {
                question: "Como funcionam os níveis de permissão?",
                answer: "Cada usuário pode ter acesso a abas específicas (Dashboard, CRM, Financeiro, etc.) dependendo das competências atribuídas pelo administrador."
            },
            {
                question: "Quantos usuários posso cadastrar?",
                answer: "O limite de usuários depende do seu plano contratado. Consulte as configurações da empresa para ver os limites atuais."
            }
        ]
    },
    {
        category: "Campanhas e Follow-up",
        icon: Megaphone,
        items: [
            {
                question: "O que é uma campanha de envio?",
                answer: "Campanhas permitem o envio em massa de mensagens para uma lista de contatos selecionada, facilitando comunicações oficiais ou informativas."
            },
            {
                question: "Como funciona o Follow-up?",
                answer: "O Follow-up serve para agendar retornos e lembretes de contato com seus leads ou clientes, garantindo que nenhum atendimento seja esquecido."
            }
        ]
    },
    {
        category: "Financeiro",
        icon: Wallet2,
        items: [
            {
                question: "Onde vejo minhas faturas?",
                answer: "Todas as informações financeiras e transações podem ser visualizadas na aba 'Financeiro'."
            },
            {
                question: "Como atualizar meus dados de cobrança?",
                answer: "Entre em contato com o suporte ou acesse as configurações da empresa para solicitar alterações nos dados de cobrança."
            }
        ]
    },
    {
        category: "Integrações",
        icon: Globe,
        items: [
            {
                question: "O sistema integra com outros CRMs?",
                answer: "Nosso sistema já possui um CRM nativo, mas oferecemos APIs para integração com outras ferramentas externas sob demanda."
            }
        ]
    },
    {
        category: "Problemas Comuns",
        icon: AlertCircle,
        items: [
            {
                question: "Meu WhatsApp aparece como offline, o que fazer?",
                answer: "Primeiro, verifique a conexão de internet no seu celular. Se persistir, tente desconectar e conectar novamente pelo QR Code."
            },
            {
                question: "As mensagens não estão chegando, como resolver?",
                answer: "Verifique os logs de conexão e certifique-se de que o webhook está configurado corretamente. O sistema tenta restabelecer a conexão automaticamente na maioria dos casos."
            },
            {
                question: "O sistema está lento, o que posso fazer?",
                answer: "Verifique sua conexão de rede local. Limpar o cache do navegador também pode ajudar a melhorar o desempenho da interface."
            }
        ]
    }
];

const FaqPage = () => {
    const { token, user } = useAuth();
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("Primeiros Passos");
    const [userQuestion, setUserQuestion] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // User Questions State
    const [dynamicQuestions, setDynamicQuestions] = useState<any[]>([]);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

    // Answer Modal State
    const [answeringQuestion, setAnsweringQuestion] = useState<any>(null);
    const [answerText, setAnswerText] = useState("");
    const [isPublic, setIsPublic] = useState(false);

    const fetchQuestions = useCallback(async () => {
        if (!token) return;
        setIsLoadingQuestions(true);
        try {
            const res = await fetch("/api/faq/questions", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDynamicQuestions(data);
            }
        } catch (error) {
            console.error("Error fetching questions:", error);
        } finally {
            setIsLoadingQuestions(false);
        }
    }, [token]);

    useEffect(() => {
        fetchQuestions();
    }, [fetchQuestions]);

    const handleSubmitQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userQuestion.trim()) return;

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/faq/questions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ question: userQuestion })
            });

            if (res.ok) {
                toast.success("Sua dúvida foi enviada com sucesso!");
                setUserQuestion("");
                setIsDialogOpen(false);
                fetchQuestions();
            } else {
                toast.error("Erro ao enviar pergunta.");
            }
        } catch (error) {
            toast.error("Erro de conexão.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAnswerQuestion = async () => {
        if (!answerText.trim() || !answeringQuestion) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/faq/questions/${answeringQuestion.id}/answer`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ answer: answerText, is_public: isPublic })
            });

            if (res.ok) {
                toast.success("Pergunta respondida com sucesso!");
                setAnsweringQuestion(null);
                setAnswerText("");
                fetchQuestions();
            } else {
                toast.error("Erro ao responder.");
            }
        } catch (error) {
            toast.error("Erro de conexão.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteQuestion = async (id: number) => {
        if (!confirm("Deseja realmente excluir esta pergunta?")) return;
        try {
            const res = await fetch(`/api/faq/questions/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success("Pergunta excluída.");
                fetchQuestions();
            } else {
                toast.error("Erro ao excluir.");
            }
        } catch (error) {
            toast.error("Erro de conexão.");
        }
    };

    const isSuperAdmin = user?.role?.toUpperCase() === 'SUPERADMIN';

    const filteredFaq = faqData.map(category => ({
        ...category,
        items: category.items.filter(item =>
            item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.answer.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(category => category.items.length > 0);

    return (
        <div className="container py-10 px-4 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center p-2 bg-primary/10 rounded-full mb-4">
                    <HelpCircle className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                    Perguntas Frequentes (FAQ)
                </h1>
                <p className="text-muted-foreground text-xl max-w-2xl mx-auto">
                    Tudo o que você precisa saber para dominar o sistema Integrai em um só lugar.
                </p>
            </div>

            <div className="relative mb-16 max-w-2xl mx-auto group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary-soft/20 rounded-xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Pesquise por uma dúvida ou palavra-chave..."
                        className="pl-12 h-14 text-lg shadow-lg border-muted/20 focus-visible:ring-primary/50 bg-background/50 backdrop-blur-sm rounded-xl"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-8">
                {searchTerm ? (
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold px-1">Resultados da busca ({filteredFaq.reduce((acc, cat) => acc + cat.items.length, 0)})</h2>
                        {filteredFaq.length > 0 ? (
                            filteredFaq.map((category) => (
                                <div key={category.category} className="space-y-3">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1">
                                        <category.icon className="h-4 w-4" />
                                        {category.category}
                                    </h3>
                                    <Accordion type="single" collapsible className="w-full space-y-2">
                                        {category.items.map((item, idx) => (
                                            <AccordionItem key={idx} value={`${category.category}-${idx}`} className="border rounded-lg bg-card px-4 shadow-sm">
                                                <AccordionTrigger className="hover:no-underline font-medium text-left">
                                                    {item.question}
                                                </AccordionTrigger>
                                                <AccordionContent className="text-muted-foreground leading-relaxed">
                                                    {item.answer}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed">
                                <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">Nenhum resultado encontrado para "{searchTerm}"</p>
                                <p className="text-muted-foreground">Tente utilizar outras palavras-chave ou navegue pelas categorias.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <Tabs defaultValue="Primeiros Passos" value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="overflow-x-auto pb-4 custom-scrollbar mb-4">
                            <TabsList className="h-auto p-1 bg-muted/50 inline-flex min-w-full md:min-w-0">
                                {faqData.map((category) => (
                                    <TabsTrigger
                                        key={category.category}
                                        value={category.category}
                                        className="flex items-center gap-2 py-2.5 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                    >
                                        <category.icon className="h-4 w-4" />
                                        <span className="whitespace-nowrap">{category.category}</span>
                                    </TabsTrigger>
                                ))}
                                <TabsTrigger
                                    value="Dúvidas dos Usuários"
                                    className="flex items-center gap-2 py-2.5 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                >
                                    <Users className="h-4 w-4" />
                                    <span className="whitespace-nowrap">Dúvidas dos Usuários</span>
                                </TabsTrigger>
                                <TabsTrigger
                                    value="Não Respondidas"
                                    className="flex items-center gap-2 py-2.5 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                >
                                    <AlertCircle className="h-4 w-4" />
                                    <span className="whitespace-nowrap">Não Respondidas</span>
                                    {dynamicQuestions.filter(q => !q.is_answered).length > 0 && (
                                        <Badge variant="destructive" className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                                            {dynamicQuestions.filter(q => !q.is_answered).length}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {faqData.map((category) => (
                            <TabsContent key={category.category} value={category.category} className="mt-0 animate-in slide-in-from-bottom-2 duration-300">
                                <div className="bg-card border rounded-2xl p-2 shadow-sm">
                                    <Accordion type="single" collapsible className="w-full">
                                        {category.items.map((item, idx) => (
                                            <AccordionItem key={idx} value={`item-${idx}`} className="border-none px-4 py-1">
                                                <AccordionTrigger className="hover:no-underline font-semibold text-lg text-left py-4 border-b last:border-0 border-muted">
                                                    {item.question}
                                                </AccordionTrigger>
                                                <AccordionContent className="text-lg text-muted-foreground pt-2 pb-6 leading-relaxed">
                                                    {item.answer}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </div>
                            </TabsContent>
                        ))}

                        <TabsContent value="Dúvidas dos Usuários" className="mt-0 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-card border rounded-2xl p-2 shadow-sm">
                                {isLoadingQuestions ? (
                                    <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                ) : dynamicQuestions.filter(q => q.is_answered).length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground">Nenhuma pergunta respondida ainda.</div>
                                ) : (
                                    <Accordion type="single" collapsible className="w-full">
                                        {dynamicQuestions.filter(q => q.is_answered).map((q) => (
                                            <AccordionItem key={q.id} value={`user-q-${q.id}`} className="border-none px-4 py-1">
                                                <div className="flex items-center justify-between border-b last:border-0 border-muted">
                                                    <AccordionTrigger className="hover:no-underline font-semibold text-lg text-left py-4 flex-1">
                                                        <div className="flex flex-col gap-1">
                                                            <span>{q.question}</span>
                                                            <span className="text-[10px] uppercase tracking-wider text-primary font-bold">Por: {q.user_name || 'Usuário'}</span>
                                                        </div>
                                                    </AccordionTrigger>
                                                    {(isSuperAdmin || Number(q.user_id) === Number(user?.id)) && (
                                                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDeleteQuestion(q.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                                <AccordionContent className="text-lg text-muted-foreground pt-2 pb-6 leading-relaxed">
                                                    {q.answer}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="Não Respondidas" className="mt-0 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-4">
                                {isLoadingQuestions ? (
                                    <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                ) : dynamicQuestions.filter(q => !q.is_answered).length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground">Todas as perguntas foram respondidas! ✨</div>
                                ) : (
                                    dynamicQuestions.filter(q => !q.is_answered).map((q) => (
                                        <div key={q.id} className="p-4 border rounded-xl bg-muted/30 flex items-start justify-between gap-4">
                                            <div className="space-y-1 flex-1">
                                                <p className="font-semibold text-lg">{q.question}</p>
                                                <p className="text-xs text-muted-foreground">Enviada por <span className="font-bold text-primary">{q.user_name || 'Usuário'}</span> em {new Date(q.created_at).toLocaleDateString()}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                {isSuperAdmin && (
                                                    <Button size="sm" onClick={() => { setAnsweringQuestion(q); setAnswerText(""); setIsPublic(false); }} className="gap-2">
                                                        <Reply className="h-4 w-4" /> Responder
                                                    </Button>
                                                )}
                                                {(isSuperAdmin || Number(q.user_id) === Number(user?.id)) && (
                                                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDeleteQuestion(q.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                )}

                <div className="mt-16 p-10 bg-gradient-to-br from-primary-soft/40 animate-pulse to-primary-soft/5 rounded-3xl border border-primary/10 text-center">
                    <MessageSquare className="h-10 w-10 text-primary mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-3">Não encontrou sua dúvida?</h2>
                    <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                        Nossa equipe está pronta para ajudar você com qualquer questão técnica ou operacional.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <Button size="lg" className="rounded-full px-10 font-bold shadow-lg hover:shadow-primary/20 transition-all">
                            Falar com Suporte
                        </Button>

                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="lg" className="rounded-full px-10 font-bold border-primary text-primary hover:bg-primary/5 transition-all">
                                    Deixar uma Pergunta
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Qual a sua dúvida?</DialogTitle>
                                    <DialogDescription>
                                        Escreva abaixo sua pergunta. Vamos analisá-la e responder o mais breve possível.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <Textarea
                                        placeholder="Digite aqui sua pergunta detalhadamente..."
                                        className="min-h-[120px] resize-none"
                                        value={userQuestion}
                                        onChange={(e) => setUserQuestion(e.target.value)}
                                    />
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={handleSubmitQuestion}
                                        disabled={isSubmitting || !userQuestion.trim()}
                                        className="w-full sm:w-auto"
                                    >
                                        {isSubmitting ? "Enviando..." : "Enviar Pergunta"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>

            {/* Answer Modal (SuperAdmin Only) */}
            <Dialog open={!!answeringQuestion} onOpenChange={(open) => !open && setAnsweringQuestion(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Responder Pergunta</DialogTitle>
                        <DialogDescription>
                            Sua resposta ficará disponível para todos os usuários.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-3 bg-muted rounded-lg text-sm italic">
                            "{answeringQuestion?.question}"
                        </div>
                        <Textarea
                            placeholder="Escreva a resposta aqui..."
                            className="min-h-[150px]"
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                        />
                        <div className="flex items-center space-x-2">
                            <Checkbox id="isPublic" checked={isPublic} onCheckedChange={(checked) => setIsPublic(checked as boolean)} />
                            <label htmlFor="isPublic" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Tornar esta resposta pública para todos
                            </label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAnsweringQuestion(null)}>Cancelar</Button>
                        <Button onClick={handleAnswerQuestion} disabled={isSubmitting || !answerText.trim()}>
                            {isSubmitting ? "Enviando..." : "Salvar Resposta"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FaqPage;
