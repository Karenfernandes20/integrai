import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
    Bot,
    Play,
    Pause,
    History,
    Settings,
    Send,
    RefreshCw,
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "../components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function IAPage() {
    const { token } = useAuth();
    const [agents, setAgents] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [testMessage, setTestMessage] = useState("");
    const [testResponse, setTestResponse] = useState("");
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        fetchData();
    }, [token]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [agentsRes, historyRes] = await Promise.all([
                fetch('/api/admin/ai/agents', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/admin/ai/history', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (agentsRes.ok) setAgents(await agentsRes.json());
            if (historyRes.ok) setHistory(await historyRes.json());
        } catch (error) {
            toast.error("Erro ao carregar dados da IA");
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (id: number, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'paused' : 'active';
        try {
            const res = await fetch(`/api/admin/ai/agents/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                setAgents(agents.map(a => a.id === id ? { ...a, status: newStatus } : a));
                toast.success(`Agente ${newStatus === 'active' ? 'ativado' : 'pausado'}`);
            }
        } catch (error) {
            toast.error("Falha ao atualizar status");
        }
    };

    const savePrompt = async (id: number, prompt: string) => {
        try {
            const res = await fetch(`/api/admin/ai/agents/${id}/prompt`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt })
            });

            if (res.ok) {
                toast.success("Prompt atualizado com sucesso!");
                fetchData();
            }
        } catch (error) {
            toast.error("Falha ao salvar prompt");
        }
    };

    const runTest = async () => {
        if (!testMessage) return;
        setTesting(true);
        try {
            const activeAgent = agents.find(a => a.status === 'active');
            const res = await fetch('/api/admin/ai/test', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: testMessage, prompt: activeAgent?.prompt })
            });

            if (res.ok) {
                const data = await res.json();
                setTestResponse(data.response);
            }
        } catch (error) {
            toast.error("Erro no teste da IA");
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Central de IA</h2>
                    <p className="text-muted-foreground">Gerencie seus agentes virtuais e configurações de inteligência artificial.</p>
                </div>
                <Button onClick={fetchData} variant="outline" size="icon">
                    <RefreshCw className={loading ? "animate-spin" : ""} />
                </Button>
            </div>

            <Tabs defaultValue="agents" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                    <TabsTrigger value="agents"><Bot className="w-4 h-4 mr-2" /> Agentes</TabsTrigger>
                    <TabsTrigger value="history"><History className="w-4 h-4 mr-2" /> Histórico</TabsTrigger>
                    <TabsTrigger value="test"><Send className="w-4 h-4 mr-2" /> Playground</TabsTrigger>
                </TabsList>

                <TabsContent value="agents" className="space-y-4 pt-4">
                    {agents.map(agent => (
                        <Card key={agent.id}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div className="space-y-1">
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        {agent.name}
                                        <Badge variant={agent.status === 'active' ? "default" : "secondary"} className={agent.status === 'active' ? "bg-green-500 hover:bg-green-600" : ""}>
                                            {agent.status === 'active' ? "Ativo" : "Pausado"}
                                        </Badge>
                                    </CardTitle>
                                    <CardDescription>Provedor: {agent.provider} ({agent.model})</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground mr-2">
                                        {agent.status === 'active' ? 'Agente Ativo' : 'Agente Pausado'}
                                    </span>
                                    <Switch
                                        checked={agent.status === 'active'}
                                        onCheckedChange={() => toggleStatus(agent.id, agent.status)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Prompt do Sistema (Personalidade)</label>
                                    <Textarea
                                        defaultValue={agent.prompt}
                                        className="min-h-[150px] font-mono text-sm bg-slate-50"
                                        id={`prompt-${agent.id}`}
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        onClick={() => savePrompt(agent.id, (document.getElementById(`prompt-${agent.id}`) as HTMLTextAreaElement).value)}
                                        size="sm"
                                        className="gap-2"
                                    >
                                        <Settings className="w-4 h-4" /> Atualizar Configuração
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </TabsContent>

                <TabsContent value="history" className="pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Resposta Recentes da IA</CardTitle>
                            <CardDescription>Últimas 50 mensagens enviadas automaticamente por seus agentes.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px] w-full pr-4">
                                <div className="space-y-4">
                                    {history.map((msg, idx) => (
                                        <div key={idx} className="flex flex-col gap-1 border-b pb-3 last:border-0">
                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold text-sm">{msg.contact_name || msg.phone}</span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {format(new Date(msg.sent_at), "dd/MM HH:mm", { locale: ptBR })}
                                                </span>
                                            </div>
                                            <div className="bg-primary-soft/30 p-2 rounded-lg text-sm italic">
                                                "{msg.content}"
                                            </div>
                                        </div>
                                    ))}
                                    {history.length === 0 && (
                                        <div className="text-center py-10 text-muted-foreground">
                                            Nenhuma interação de IA encontrada recentemente.
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="test" className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Testar Agente</CardTitle>
                                <CardDescription>Simule uma mensagem para ver como a IA responderia com o prompt atual.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Sua Mensagem</label>
                                    <Textarea
                                        placeholder="Ex: Oi, como faço para falar com o suporte?"
                                        value={testMessage}
                                        onChange={(e) => setTestMessage(e.target.value)}
                                        className="min-h-[100px]"
                                    />
                                </div>
                                <Button
                                    onClick={runTest}
                                    disabled={testing || !testMessage}
                                    className="w-full gap-2"
                                >
                                    {testing ? <RefreshCw className="animate-spin w-4 h-4" /> : <Play className="w-4 h-4" />}
                                    Executar Teste
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Resultado do Teste</CardTitle>
                                <CardDescription>Resposta gerada pelo motor de IA (Simulado).</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="min-h-[200px] p-4 rounded-xl border bg-slate-50 relative overflow-hidden">
                                    {testing ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                                            <div className="flex gap-2">
                                                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                                                <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                                                <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                                            </div>
                                        </div>
                                    ) : testResponse ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                                                <CheckCircle2 className="w-4 h-4" /> IA Respondeu:
                                            </div>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{testResponse}</p>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center pt-8">
                                            <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                                            <p className="text-sm">Envie uma mensagem ao lado para testar.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
