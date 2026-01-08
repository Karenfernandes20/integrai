import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
    Plus, FileText, MessageSquare, CheckSquare, FileSignature,
    Pencil, Trash2, Copy, History, Search, ArrowLeft
} from "lucide-react";
import { useToast } from "../hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { Badge } from "../components/ui/badge";

interface Template {
    id: number;
    name: string;
    type: 'message' | 'document' | 'task' | 'contract';
    content: string;
    variables: string[];
    version: number;
    updated_at: string;
}

const TEMPLATE_TYPES = [
    { id: 'message', label: 'Mensagens', icon: MessageSquare },
    { id: 'document', label: 'Documentos', icon: FileText },
    { id: 'task', label: 'Tarefas', icon: CheckSquare },
    { id: 'contract', label: 'Contratos', icon: FileSignature },
];

const TemplatesPage = () => {
    const { token } = useAuth();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('message');
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Editing/Creating State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        content: '',
        type: 'message'
    });
    const [variablesList, setVariablesList] = useState<string[]>([]);
    const [createVersion, setCreateVersion] = useState(false);

    // History State
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyData, setHistoryData] = useState<Template[]>([]);
    const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);


    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/config/templates?type=${activeTab}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTemplates(data);
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Erro ao carregar templates", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchTemplates();
    }, [token, activeTab]);

    const handleOpenDialog = (template?: Template) => {
        if (template) {
            setEditingTemplate(template);
            setFormData({
                name: template.name,
                content: template.content,
                type: template.type
            });
            setVariablesList(template.variables || []);
            setCreateVersion(false);
        } else {
            setEditingTemplate(null);
            setFormData({
                name: '',
                content: '',
                type: activeTab
            });
            setVariablesList([]);
            setCreateVersion(false);
        }
        setIsDialogOpen(true);
    };

    // Auto-detect variables {{var}}
    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, content: val }));

        const matches = val.match(/{{\s*[\w]+\s*}}/g);
        if (matches) {
            const clean = matches.map(m => m.replace(/[{}]/g, '').trim());
            setVariablesList(Array.from(new Set(clean)));
        } else {
            setVariablesList([]);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.content) {
            toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
            return;
        }

        try {
            const url = editingTemplate
                ? `/api/config/templates/${editingTemplate.id}`
                : '/api/config/templates';

            const method = editingTemplate ? 'PUT' : 'POST';

            const body = {
                ...formData,
                variables: variablesList,
                createNewVersion: editingTemplate ? createVersion : undefined
            };

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error();

            toast({ title: editingTemplate ? "Template atualizado" : "Template criado" });
            setIsDialogOpen(false);
            fetchTemplates();
        } catch (e) {
            toast({ title: "Erro ao salvar template", variant: "destructive" });
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await fetch(`/api/config/templates/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            toast({ title: "Template removido" });
            fetchTemplates();
        } catch (e) {
            toast({ title: "Erro ao remover", variant: "destructive" });
        }
    };

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
        toast({ title: "Copiado para a área de transferência" });
    };

    const loadHistory = async (id: number) => {
        setSelectedHistoryId(id);
        setHistoryOpen(true);
        setHistoryData([]);
        try {
            const res = await fetch(`/api/config/templates/${id}/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setHistoryData(await res.json());
            }
        } catch (e) {
            console.error(e);
        }
    };

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Central de Templates</h1>
                    <p className="text-muted-foreground mt-1">
                        Gerencie modelos padronizados para mensagens, documentos e processos.
                    </p>
                </div>
                <Button onClick={() => handleOpenDialog()} className="gap-2">
                    <Plus className="h-4 w-4" /> Novo Template
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                            <TabsList>
                                {TEMPLATE_TYPES.map(type => (
                                    <TabsTrigger key={type.id} value={type.id} className="gap-2">
                                        <type.icon className="h-4 w-4" />
                                        {type.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                        <div className="relative w-64 hidden md:block">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar templates..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="py-10 text-center text-muted-foreground">Carregando...</div>
                    ) : filteredTemplates.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                            <p>Nenhum template encontrado nesta categoria.</p>
                            <Button variant="link" onClick={() => handleOpenDialog()}>Criar o primeiro</Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredTemplates.map(template => (
                                <Card key={template.id} className="group relative overflow-hidden transition-all hover:shadow-md border-muted">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <CardTitle className="text-base font-semibold">{template.name}</CardTitle>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="text-[10px] h-5">v{template.version}</Badge>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {new Date(template.updated_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopy(template.content)} title="Copiar">
                                                    <Copy className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => loadHistory(template.id)} title="Histórico">
                                                    <History className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleOpenDialog(template)} title="Editar">
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" title="Excluir">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Excluir Template?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta ação não pode ser desfeita. O template será arquivado.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(template.id)} className="bg-destructive hover:bg-destructive/90">
                                                                Excluir
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-2">
                                        <div className="bg-muted/30 p-3 rounded-md text-xs text-muted-foreground line-clamp-3 font-mono">
                                            {template.content}
                                        </div>
                                        {template.variables && template.variables.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-1">
                                                {template.variables.map(v => (
                                                    <Badge key={v} variant="outline" className="text-[10px] text-primary bg-primary/5 border-primary/20">
                                                        {`{{${v}}}`}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit Modal */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingTemplate ? 'Editar Template' : 'Novo Template'}</DialogTitle>
                        <DialogDescription>
                            Configure o conteúdo e variáveis dinâmicas. Use {'{{variavel}}'} para criar campos dinâmicos.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nome do Template</label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ex: Mensagem de Boas-vindas"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Tipo</label>
                                <select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formData.type}
                                    disabled={!!editingTemplate}
                                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                                >
                                    {TEMPLATE_TYPES.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Conteúdo</label>
                            <Textarea
                                className="h-[200px] font-mono text-sm"
                                value={formData.content}
                                onChange={handleContentChange}
                                placeholder="Digite o conteúdo aqui..."
                            />
                            <p className="text-xs text-muted-foreground text-right">
                                {formData.content.length} caracteres
                            </p>
                        </div>

                        {variablesList.length > 0 && (
                            <div className="p-3 bg-muted/30 rounded-lg border">
                                <p className="text-xs font-semibold mb-2">Variáveis Detectadas:</p>
                                <div className="flex flex-wrap gap-2">
                                    {variablesList.map(v => (
                                        <Badge key={v} variant="secondary" className="text-xs">
                                            {v}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {editingTemplate && (
                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="newVersion"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={createVersion}
                                    onChange={e => setCreateVersion(e.target.checked)}
                                />
                                <label htmlFor="newVersion" className="text-sm font-medium cursor-pointer">
                                    Criar como nova versão (v{(editingTemplate.version || 1) + 1})
                                </label>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit}>Salvar Template</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* History Modal */}
            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Histórico de Versões</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {historyData.map((ver, idx) => (
                            <div key={ver.id} className="flex gap-4 p-3 border rounded-lg bg-card hover:bg-muted/20 transition-colors">
                                <div className="flex flex-col items-center gap-1 min-w-[3rem]">
                                    <Badge variant={idx === 0 ? "default" : "secondary"}>v{ver.version}</Badge>
                                    {idx === 0 && <span className="text-[10px] text-primary font-medium">Atual</span>}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium">{ver.name}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{ver.content}</p>
                                    <p className="text-[10px] text-muted-foreground pt-1">
                                        Atualizado em {new Date(ver.updated_at).toLocaleString()}
                                    </p>
                                </div>
                                {idx !== 0 && (
                                    <Button size="sm" variant="ghost" className="h-8" onClick={() => handleCopy(ver.content)}>
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
};

export default TemplatesPage;
