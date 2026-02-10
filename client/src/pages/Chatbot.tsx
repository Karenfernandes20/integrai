
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bot, Plus, MoreHorizontal, Play, Pause, Trash2, Edit, Network, Save, ArrowLeft } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Bot {
    id: number;
    name: string;
    description: string;
    status: 'active' | 'inactive' | 'draft';
    active_instances_count: number;
    updated_at: string;
}

const Chatbot = () => {
    const { token } = useAuth();
    const { toast } = useToast();
    const [bots, setBots] = useState<Bot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedBotId, setSelectedBotId] = useState<number | null>(null); // If set, shows Editor

    // New Bot Dialog
    const [isNewBotOpen, setIsNewBotOpen] = useState(false);
    const [newBotName, setNewBotName] = useState('');
    const [newBotDesc, setNewBotDesc] = useState('');

    useEffect(() => {
        if (token) fetchBots();
    }, [token]);

    const fetchBots = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/bots', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setBots(data);
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Falha ao carregar bots", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateBot = async () => {
        if (!newBotName) return;
        try {
            const res = await fetch('/api/bots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name: newBotName, description: newBotDesc })
            });

            if (res.ok) {
                toast({ title: "Sucesso", description: "Bot criado!" });
                setIsNewBotOpen(false);
                setNewBotName('');
                setNewBotDesc('');
                fetchBots();
            } else {
                throw new Error("Falha ao criar");
            }
        } catch (error) {
            toast({ title: "Erro", description: "Falha ao criar bot", variant: "destructive" });
        }
    };

    const handleDeleteBot = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir este bot?")) return;
        try {
            const res = await fetch(`/api/bots/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast({ title: "Bot excluído" });
                fetchBots();
            }
        } catch (error) {
            toast({ title: "Erro", description: "Falha ao excluir", variant: "destructive" });
        }
    };

    const toggleBotStatus = async (bot: Bot) => {
        const newStatus = bot.status === 'active' ? 'inactive' : 'active';
        try {
            const res = await fetch(`/api/bots/${bot.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                toast({ title: `Bot ${newStatus === 'active' ? 'ativado' : 'pausado'}` });
                fetchBots();
            }
        } catch (error) {
            toast({ title: "Erro", description: "Falha ao atualizar status", variant: "destructive" });
        }
    };

    if (selectedBotId) {
        return (
            <BotEditor
                botId={selectedBotId}
                onBack={() => { setSelectedBotId(null); fetchBots(); }}
            />
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Chatbots</h1>
                    <p className="text-slate-500">Crie e gerencie seus fluxos de atendimento automático</p>
                </div>
                <Button onClick={() => setIsNewBotOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-2 h-4 w-4" /> Novo Bot
                </Button>
            </div>

            {isLoading ? (
                <div className="text-center py-20 text-slate-500">Carregando bots...</div>
            ) : bots.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Bot className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">Nenhum bot criado</h3>
                    <p className="text-slate-500 mb-6">Comece criando seu primeiro fluxo de automação.</p>
                    <Button onClick={() => setIsNewBotOpen(true)} variant="outline">Criar meu primeiro bot</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bots.map(bot => (
                        <Card key={bot.id} className="hover:shadow-md transition-shadow group">
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start">
                                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                        <Bot size={24} />
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="-mr-2 text-slate-400 hover:text-slate-600">
                                                <MoreHorizontal size={20} />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => setSelectedBotId(bot.id)}>
                                                <Edit className="mr-2 h-4 w-4" /> Editar Fluxo
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => toggleBotStatus(bot)}>
                                                {bot.status === 'active' ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                                                {bot.status === 'active' ? 'Pausar' : 'Ativar'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => handleDeleteBot(bot.id)}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <CardTitle className="mt-4 text-xl">{bot.name}</CardTitle>
                                <CardDescription className="line-clamp-2 min-h-[40px]">
                                    {bot.description || "Sem descrição"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4 text-sm text-slate-600">
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${bot.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                        {bot.status === 'active' ? 'Ativo' : 'Inativo'}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Network size={14} />
                                        {bot.active_instances_count} instâncias
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0 border-t bg-slate-50/50 p-4 mt-auto">
                                <div className="w-full flex justify-between items-center">
                                    <span className="text-xs text-slate-500">
                                        Editado {format(new Date(bot.updated_at), "d 'de' MMM", { locale: ptBR })}
                                    </span>
                                    <Button size="sm" variant="secondary" onClick={() => setSelectedBotId(bot.id)}>
                                        Editar
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isNewBotOpen} onOpenChange={setIsNewBotOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Chatbot</DialogTitle>
                        <DialogDescription>Dê um nome para identificar seu fluxo de automação.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome do Bot</label>
                            <Input
                                placeholder="Ex: Atendimento Inicial"
                                value={newBotName}
                                onChange={(e) => setNewBotName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Descrição (Opcional)</label>
                            <Input
                                placeholder="Para que serve este bot?"
                                value={newBotDesc}
                                onChange={(e) => setNewBotDesc(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsNewBotOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateBot} disabled={!newBotName}>Criar Bot</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

import { VisualEditor } from '../components/chatbot/VisualEditor';
import { Node, Edge } from '../components/chatbot/types';
import { BotInstancesDialog } from '../components/chatbot/BotInstancesDialog';

const BotEditor = ({ botId, onBack }: { botId: number, onBack: () => void }) => {
    const { token } = useAuth();
    const { toast } = useToast();
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isInstancesOpen, setIsInstancesOpen] = useState(false);

    useEffect(() => {
        fetchFlow();
    }, [botId]);

    const fetchFlow = async () => {
        try {
            const res = await fetch(`/api/bots/${botId}/flow`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();

                // The new Professional Chatbot uses JSONB directly, no need for complex mapping 
                // but we handle both for partial legacy support if any.
                const mappedNodes: Node[] = (data.nodes || []).map((n: any) => ({
                    id: n.id,
                    type: n.type,
                    position: n.position || { x: n.position_x || 100, y: n.position_y || 100 },
                    data: n.data || n.content || {}
                }));

                const mappedEdges: Edge[] = (data.edges || []).map((e: any) => ({
                    id: e.id,
                    source: e.source || e.source_node_id,
                    target: e.target || e.target_node_id,
                    sourceHandle: e.sourceHandle || e.source_handle,
                    targetHandle: e.targetHandle || e.target_handle,
                    label: e.label
                }));

                setNodes(mappedNodes);
                setEdges(mappedEdges);
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Falha ao carregar fluxo", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (currentNodes: Node[], currentEdges: Edge[]) => {
        try {
            // Map visual nodes back to database format
            const payload = {
                nodes: currentNodes.map(n => ({
                    id: n.id,
                    type: n.type,
                    position: { x: n.position.x, y: n.position.y },
                    data: n.data
                })),
                edges: currentEdges.map(e => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    sourceHandle: e.sourceHandle,
                    targetHandle: e.targetHandle || null,
                    label: e.label || null
                }))
            };

            const res = await fetch(`/api/bots/${botId}/flow`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ flow: payload })
            });

            if (res.ok) {
                toast({ title: "Sucesso", description: "Fluxo salvo como rascunho!" });
            } else {
                throw new Error("Falha ao salvar");
            }
        } catch (error) {
            toast({ title: "Erro", description: "Não foi possível salvar o fluxo", variant: "destructive" });
        }
    };

    if (isLoading) {
        return <div className="h-screen flex items-center justify-center bg-slate-50">Carregando editor...</div>;
    }

    return (
        <div className="h-screen flex flex-col bg-slate-50 fixed inset-0 z-50">
            <div className="bg-white border-b px-4 py-2 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft size={20} />
                    </Button>
                    <div>
                        <h2 className="font-bold text-sm text-slate-800">Editor de Fluxo</h2>
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p className="text-xs text-slate-500">Conectado</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsInstancesOpen(true)}>
                        <Network className="mr-2 h-4 w-4" /> Instâncias
                    </Button>
                    <Button
                        className="bg-purple-600 hover:bg-purple-700"
                        onClick={async () => {
                            try {
                                const res = await fetch(`/api/bots/${botId}/publish`, {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                if (res.ok) toast({ title: "Publicado!", description: "Seu chatbot agora está ativo nas instâncias conectadas." });
                                else toast({ title: "Erro na publicação", variant: "destructive" });
                            } catch (e) { toast({ title: "Erro", description: "Falha ao publicar", variant: "destructive" }); }
                        }}
                    >
                        Publicar
                    </Button>
                </div>
            </div>

            <div className="flex-1 relative">
                <VisualEditor
                    initialNodes={nodes}
                    initialEdges={edges}
                    onSave={handleSave}
                />
            </div>

            <BotInstancesDialog
                botId={botId}
                open={isInstancesOpen}
                onOpenChange={setIsInstancesOpen}
            />
        </div>
    );
};

export default Chatbot;
