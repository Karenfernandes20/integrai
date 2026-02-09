
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/use-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Plus, Building2, Phone, Mail, MapPin, Edit, Trash2, Check, Settings, ShieldCheck } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { ScrollArea } from '../components/ui/scroll-area';

interface InsurancePlan {
    id: number;
    name: string;
    code: string;
    type: string;
    contact_phone: string;
    email: string;
    region: string;
    status: string;
    repayment_days_avg: number;
    rules: string;
    color: string;
    procedures_table: any[];
}

interface Professional {
    id: number;
    name: string;
}

const InsurancePlansPage = () => {
    const { token } = useAuth();
    const { toast } = useToast();
    const [plans, setPlans] = useState<InsurancePlan[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Partial<InsurancePlan> | null>(null);
    const [selectedPlanForConfig, setSelectedPlanForConfig] = useState<InsurancePlan | null>(null);
    const [profConfigs, setProfConfigs] = useState<any[]>([]);

    const fetchPlans = async () => {
        try {
            const res = await fetch('/api/crm/insurance-plans', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setPlans(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchProfessionals = async () => {
        try {
            const res = await fetch('/api/crm/professionals', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setProfessionals(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchProfConfigs = async (planId: number) => {
        try {
            const res = await fetch(`/api/crm/professional-insurance-configs`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProfConfigs(data.filter((c: any) => c.insurance_plan_id === planId));
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchPlans();
        fetchProfessionals();
    }, [token]);

    const handleSavePlan = async () => {
        if (!editingPlan?.name) return;
        setIsLoading(true);
        try {
            const method = editingPlan.id ? 'PUT' : 'POST';
            const url = editingPlan.id ? `/api/crm/insurance-plans/${editingPlan.id}` : '/api/crm/insurance-plans';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(editingPlan)
            });
            if (res.ok) {
                toast({ title: "Sucesso", description: "Convênio salvo com sucesso." });
                setIsDialogOpen(false);
                fetchPlans();
            }
        } catch (e) {
            toast({ title: "Erro", description: "Falha ao salvar convênio.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeletePlan = async (id: number) => {
        if (!confirm("Excluir este convênio?")) return;
        try {
            const res = await fetch(`/api/crm/insurance-plans/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast({ title: "Excluído" });
                fetchPlans();
            }
        } catch (e) { console.error(e); }
    };

    const handleOpenConfig = (plan: InsurancePlan) => {
        setSelectedPlanForConfig(plan);
        fetchProfConfigs(plan.id);
        setIsConfigOpen(true);
    };

    const handleSaveProfConfig = async (profId: number, config: any) => {
        try {
            const res = await fetch('/api/crm/professional-insurance-configs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    professional_id: profId,
                    insurance_plan_id: selectedPlanForConfig?.id,
                    ...config
                })
            });
            if (res.ok) {
                toast({ title: "Configuração salva" });
                fetchProfConfigs(selectedPlanForConfig!.id);
            }
        } catch (e) { console.error(e); }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">Convênios e Planos</h1>
                    <p className="text-muted-foreground mt-1">Gestão inteligente de operadoras e regras de repasse.</p>
                </div>
                <Button onClick={() => { setEditingPlan({ status: 'ACTIVE', type: 'CONVENIO', color: '#3b82f6' }); setIsDialogOpen(true); }} className="shadow-lg shadow-primary/20 transition-all hover:scale-105">
                    <Plus className="mr-2 h-4 w-4" /> Novo Convênio
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map(plan => (
                    <Card key={plan.id} className="group overflow-hidden border-2 transition-all hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
                        <div className="h-1.5 w-full" style={{ backgroundColor: plan.color }} />
                        <CardHeader className="pb-4">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                                <Badge variant={plan.status === 'ACTIVE' ? 'default' : 'secondary'} className={plan.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20' : ''}>
                                    {plan.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                                </Badge>
                            </div>
                            <CardDescription className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] h-5">{plan.type}</Badge>
                                <span className="text-xs font-mono opacity-60">#{plan.code}</span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {plan.contact_phone || '-'}</div>
                                <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 truncate" /> {plan.email || '-'}</div>
                                <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {plan.region || '-'}</div>
                            </div>

                            <div className="pt-4 flex gap-2 border-t">
                                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => { setEditingPlan(plan); setIsDialogOpen(true); }}>
                                    <Edit className="h-3 w-3 mr-1" /> Editar
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => handleOpenConfig(plan)}>
                                    <Settings className="h-3 w-3 mr-1" /> Regras
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeletePlan(plan.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingPlan?.id ? 'Editar Convênio' : 'Novo Convênio'}</DialogTitle>
                    </DialogHeader>
                    <Tabs defaultValue="basic" className="mt-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
                            <TabsTrigger value="rules">Prazos e Regras</TabsTrigger>
                        </TabsList>
                        <TabsContent value="basic" className="space-y-4 pt-4 px-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nome da Operadora</Label>
                                    <Input value={editingPlan?.name || ''} onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Código / Registro</Label>
                                    <Input value={editingPlan?.code || ''} onChange={e => setEditingPlan({ ...editingPlan, code: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tipo</Label>
                                    <Select value={editingPlan?.type} onValueChange={v => setEditingPlan({ ...editingPlan, type: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CONVENIO">Convênio Médico</SelectItem>
                                            <SelectItem value="PLANO_PROPRIO">Plano Próprio</SelectItem>
                                            <SelectItem value="PARTICULAR">Tabela Particular</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Cor de Destaque</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" className="p-1 h-10 w-20" value={editingPlan?.color || '#3b82f6'} onChange={e => setEditingPlan({ ...editingPlan, color: e.target.value })} />
                                        <Input className="flex-1" value={editingPlan?.color || '#3b82f6'} onChange={e => setEditingPlan({ ...editingPlan, color: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Contato</Label>
                                    <Input value={editingPlan?.contact_phone || ''} onChange={e => setEditingPlan({ ...editingPlan, contact_phone: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>E-mail</Label>
                                    <Input value={editingPlan?.email || ''} onChange={e => setEditingPlan({ ...editingPlan, email: e.target.value })} />
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="rules" className="space-y-4 pt-4 px-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Prazo Repasse (Dias)</Label>
                                    <Input type="number" value={editingPlan?.repayment_days_avg || 30} onChange={e => setEditingPlan({ ...editingPlan, repayment_days_avg: parseInt(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <div className="flex items-center gap-2 pt-2">
                                        <Switch checked={editingPlan?.status === 'ACTIVE'} onCheckedChange={checked => setEditingPlan({ ...editingPlan, status: checked ? 'ACTIVE' : 'INACTIVE' })} />
                                        <Label className="font-normal">{editingPlan?.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}</Label>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Regras de Atendimento / Observações</Label>
                                <textarea className="w-full h-32 rounded-md border p-2 text-sm bg-background" value={editingPlan?.rules || ''} onChange={e => setEditingPlan({ ...editingPlan, rules: e.target.value })} />
                            </div>
                        </TabsContent>
                    </Tabs>
                    <DialogFooter className="mt-6">
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSavePlan} disabled={isLoading}>{isLoading ? 'Salvando...' : 'Salvar Convênio'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Mapping Config Dialog */}
            <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Regras do Convênio: {selectedPlanForConfig?.name}</DialogTitle>
                        <CardDescription>Defina quais profissionais atendem este convênio e os valores acordados.</CardDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1 mt-4 pr-4">
                        <div className="space-y-4">
                            {professionals.map(prof => {
                                const config = profConfigs.find(c => c.professional_id === prof.id);
                                return (
                                    <Card key={prof.id} className={`border transition-colors ${config?.active ? 'border-primary/20 bg-primary/5' : 'opacity-70'}`}>
                                        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                                            <div className="flex-1 flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${config?.active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                                                    <ShieldCheck className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm">{prof.name}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{config?.active ? 'Credenciado' : 'Não Credenciado'}</p>
                                                </div>
                                            </div>

                                            {config?.active ? (
                                                <div className="flex items-center gap-4">
                                                    <div className="w-24 space-y-1">
                                                        <Label className="text-[10px]">Valor Base</Label>
                                                        <Input
                                                            className="h-8 text-xs font-mono"
                                                            placeholder="R$ 0,00"
                                                            defaultValue={config.consultation_value}
                                                            onBlur={(e) => handleSaveProfConfig(prof.id, { ...config, consultation_value: parseFloat(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                    <div className="w-24 space-y-1">
                                                        <Label className="text-[10px]">Comissão</Label>
                                                        <Input
                                                            className="h-8 text-xs font-mono"
                                                            placeholder="R$ 0,00"
                                                            defaultValue={config.commission_value}
                                                            onBlur={(e) => handleSaveProfConfig(prof.id, { ...config, commission_value: parseFloat(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleSaveProfConfig(prof.id, { ...config, active: false })}>
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button size="sm" variant="outline" onClick={() => handleSaveProfConfig(prof.id, { active: true })}>
                                                    Habilitar Credenciamento
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </ScrollArea>
                    <DialogFooter className="mt-4 pt-4 border-t">
                        <Button onClick={() => setIsConfigOpen(false)}>Concluído</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default InsurancePlansPage;
